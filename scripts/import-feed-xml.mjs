/**
 * Import a BestChange-style rates XML into an exchanger by slug.
 * Usage: node --env-file=.env scripts/import-feed-xml.mjs --slug mine-exchange --file ./rates.xml
 */
import fs from "node:fs";
import { Client } from "pg";
import { XMLParser } from "fast-xml-parser";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const raw = String(value).trim().replace(",", ".").replace(/\s+/g, " ");
  const match = raw.match(/^[-+]?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

function str(value) {
  if (value == null) return "";
  return String(value).trim();
}

function parseRatesXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    isArray: (name) => name === "item",
  });
  const doc = parser.parse(xml);
  const root = doc?.rates ?? doc?.Rates;
  if (!root) throw new Error("no <rates>");
  const items = asArray(root.item ?? root.Item);
  const result = [];
  for (const raw of items) {
    const from = str(raw.from ?? raw.From).toUpperCase();
    const to = str(raw.to ?? raw.To).toUpperCase();
    const inAmount = num(raw.in ?? raw.In);
    const outAmount = num(raw.out ?? raw.Out);
    if (!from || !to || inAmount <= 0 || outAmount <= 0) continue;
    const minAmount = num(
      raw.minamount ?? raw.minAmount ?? raw.frommin ?? raw.fromMin,
      0,
    );
    const maxAmount = num(
      raw.maxamount ?? raw.maxAmount ?? raw.frommax ?? raw.fromMax,
      Number.POSITIVE_INFINITY,
    );
    result.push({
      from,
      to,
      inAmount,
      outAmount,
      rate: outAmount / inAmount,
      reserve: num(raw.amount ?? raw.Amount ?? raw.reserve),
      minAmount,
      maxAmount,
      city: str(raw.city ?? raw.City) || null,
      param: str(raw.param ?? raw.Param) || null,
      tofee: str(raw.tofee ?? raw.toFee) || null,
    });
  }
  if (!result.length) throw new Error("no valid <item>");
  return result;
}

const slug = arg("slug");
const file = arg("file");
if (!slug || !file) {
  console.error("Usage: --slug <slug> --file <path.xml>");
  process.exit(1);
}

const xml = fs.readFileSync(file, "utf8");
const items = parseRatesXml(xml);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  const ex = await client.query(
    `SELECT id FROM exchangers WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (!ex.rows[0]) throw new Error(`exchanger not found: ${slug}`);
  const exchangerId = ex.rows[0].id;
  const syncedAt = new Date().toISOString();

  await client.query(`DELETE FROM rates WHERE exchanger_id = $1`, [exchangerId]);

  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    let p = 1;
    for (let j = 0; j < chunk.length; j += 1) {
      const item = chunk[j];
      const id = `${exchangerId}_${item.from}_${item.to}_${i + j}`;
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
      );
      params.push(
        id,
        exchangerId,
        item.from,
        item.to,
        item.inAmount,
        item.outAmount,
        item.rate,
        item.reserve,
        item.minAmount,
        Number.isFinite(item.maxAmount) ? item.maxAmount : 0,
        item.city,
        item.param,
        item.tofee,
        syncedAt,
      );
    }
    await client.query(
      `INSERT INTO rates (
        id, exchanger_id, "from", "to", in_amount, out_amount, rate, reserve,
        min_amount, max_amount, city, param, tofee, synced_at
      ) VALUES ${values.join(",")}`,
      params,
    );
  }

  await client.query(
    `UPDATE exchangers
     SET status = 'active', last_error = NULL, last_sync_at = $2, pair_count = $3
     WHERE id = $1`,
    [exchangerId, syncedAt, items.length],
  );
  await client.query("COMMIT");
  console.log(`OK ${slug}: ${items.length} pairs`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
