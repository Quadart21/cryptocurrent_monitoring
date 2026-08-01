/**
 * Update exchanger description + email (contact / owner_email) by website domain.
 *
 * Usage:
 *   node --env-file=.env scripts/update-exchanger-contacts.mjs
 *   node --env-file=.env scripts/update-exchanger-contacts.mjs --apply
 *   node --env-file=.env scripts/update-exchanger-contacts.mjs --file scripts/data/exchanger-contact-updates.json --apply
 *
 * Default is dry-run (no DB writes).
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

const DEFAULT_FILE = path.join(
  process.cwd(),
  "scripts/data/exchanger-contact-updates.json",
);

function normalizeHost(urlOrHost) {
  const raw = String(urlOrHost || "").trim();
  if (!raw) return "";
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^www\./, "").toLowerCase();
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileIdx = args.indexOf("--file");
  const file =
    fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : DEFAULT_FILE;

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error("Update file must be a non-empty JSON array");
    process.exit(1);
  }

  const updates = raw.map((row, i) => {
    const domain = normalizeHost(row.domain || row.website || "");
    const description = String(row.description ?? "").trim();
    const email = String(row.email ?? row.contact ?? "")
      .trim()
      .toLowerCase();
    if (!domain) throw new Error(`Row ${i}: missing domain`);
    if (!description) throw new Error(`Row ${i} (${domain}): missing description`);
    if (email && !isEmail(email)) {
      throw new Error(`Row ${i} (${domain}): invalid email ${email}`);
    }
    return { domain, description, email };
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, website, description, contact, owner_email
       FROM exchangers`,
    );

    const byHost = new Map();
    for (const row of rows) {
      const host = normalizeHost(row.website);
      if (!host) continue;
      if (!byHost.has(host)) byHost.set(host, []);
      byHost.get(host).push(row);
    }

    let matched = 0;
    let updated = 0;
    let missing = 0;
    let ambiguous = 0;

    for (const upd of updates) {
      const hits = byHost.get(upd.domain) || [];
      if (hits.length === 0) {
        console.log(`MISSING  ${upd.domain}`);
        missing++;
        continue;
      }
      if (hits.length > 1) {
        console.log(
          `AMBIG    ${upd.domain} → ${hits.map((h) => h.id).join(", ")}`,
        );
        ambiguous++;
        continue;
      }

      const row = hits[0];
      matched++;
      const nextContact = upd.email || row.contact || "";
      const nextOwnerEmail = upd.email || row.owner_email || null;
      const changed =
        row.description !== upd.description ||
        row.contact !== nextContact ||
        (row.owner_email || null) !== nextOwnerEmail;

      console.log(
        `${changed ? "UPDATE" : "SAME  "}  ${upd.domain} (${row.slug})` +
          `\n         desc: ${(row.description || "").slice(0, 50)} → ${upd.description.slice(0, 50)}` +
          `\n         mail: ${row.contact || row.owner_email || "—"} → ${upd.email || "—"}`,
      );

      if (!apply || !changed) continue;

      await pool.query(
        `UPDATE exchangers
         SET description = $1,
             contact = $2,
             owner_email = $3
         WHERE id = $4`,
        [upd.description, nextContact, nextOwnerEmail, row.id],
      );
      updated++;
    }

    console.log(
      `\nDone matched=${matched} updated=${updated} missing=${missing} ambiguous=${ambiguous}` +
        (apply ? " [APPLIED]" : " [dry-run, pass --apply to write]"),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
