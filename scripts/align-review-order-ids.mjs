/**
 * Align review order_id with created_at per exchanger:
 * later reviews get higher order numbers (monotone within 540..10000).
 *
 * Usage:
 *   node --env-file=.env scripts/align-review-order-ids.mjs
 *   node --env-file=.env scripts/align-review-order-ids.mjs --apply
 */
import "dotenv/config";
import { Pool } from "pg";

const APPLY = process.argv.includes("--apply");
const MIN_ORDER = 540;
const MAX_ORDER = 10000;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Assign increasing order IDs for a chronologically sorted list.
 * Leaves room so denser exchangers still fit under MAX_ORDER.
 */
function assignOrderIds(count) {
  if (count <= 0) return [];
  if (count === 1) return [randInt(MIN_ORDER, Math.min(MAX_ORDER, MIN_ORDER + 800))];

  // Start reasonably low so later reviews can grow.
  const startMax = Math.max(
    MIN_ORDER,
    Math.min(2500, MAX_ORDER - count * 2),
  );
  let current = randInt(MIN_ORDER, startMax);
  const ids = [current];

  const remainingSlots = MAX_ORDER - current;
  const stepsLeft = count - 1;
  // Average gap, with some randomness but never going backwards.
  const avgGap = Math.max(1, Math.floor(remainingSlots / stepsLeft));

  for (let i = 1; i < count; i++) {
    const left = count - i;
    const room = MAX_ORDER - current;
    const maxGap = Math.max(1, Math.floor(room / left));
    const minGap = 1;
    // Prefer around avgGap, but clamp to what's left.
    const hi = Math.min(maxGap, Math.max(minGap, avgGap + randInt(0, 8)));
    const lo = Math.min(hi, Math.max(minGap, avgGap - randInt(0, 3)));
    current += randInt(lo, hi);
    if (current > MAX_ORDER) current = MAX_ORDER;
    ids.push(current);
  }

  return ids;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(
    `select id, exchanger_id, exchanger_slug, order_id, created_at
     from reviews
     order by exchanger_id, created_at asc, id asc`,
  );

  const byExchanger = new Map();
  for (const row of rows) {
    if (!byExchanger.has(row.exchanger_id)) byExchanger.set(row.exchanger_id, []);
    byExchanger.get(row.exchanger_id).push(row);
  }

  const updates = [];
  const samples = [];

  for (const [exchangerId, list] of byExchanger) {
    const orderIds = assignOrderIds(list.length);
    for (let i = 0; i < list.length; i++) {
      updates.push({ id: list[i].id, orderId: String(orderIds[i]) });
    }
    if (samples.length < 3) {
      samples.push({
        slug: list[0].exchanger_slug,
        count: list.length,
        first: {
          at: list[0].created_at.slice(0, 10),
          old: list[0].order_id,
          next: String(orderIds[0]),
        },
        mid: {
          at: list[Math.floor(list.length / 2)].created_at.slice(0, 10),
          old: list[Math.floor(list.length / 2)].order_id,
          next: String(orderIds[Math.floor(list.length / 2)]),
        },
        last: {
          at: list[list.length - 1].created_at.slice(0, 10),
          old: list[list.length - 1].order_id,
          next: String(orderIds[list.length - 1]),
        },
      });
    }
  }

  console.log(`Reviews: ${rows.length} across ${byExchanger.size} exchangers`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("Samples (date → order_id old → new):");
  for (const s of samples) {
    console.log(
      `  ${s.slug} (n=${s.count}): ${s.first.at} #${s.first.old}->#${s.first.next} … ${s.mid.at} #${s.mid.old}->#${s.mid.next} … ${s.last.at} #${s.last.old}->#${s.last.next}`,
    );
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to update.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const u of updates) {
      await client.query(`update reviews set order_id = $1 where id = $2`, [
        u.orderId,
        u.id,
      ]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Verify no regressions: later created_at with smaller order_id within same exchanger.
  const { rows: bad } = await pool.query(`
    with ordered as (
      select
        exchanger_slug,
        created_at,
        order_id::int as oid,
        lag(order_id::int) over (
          partition by exchanger_id
          order by created_at asc, id asc
        ) as prev_oid
      from reviews
      where order_id ~ '^[0-9]+$'
    )
    select exchanger_slug, created_at, oid, prev_oid
    from ordered
    where prev_oid is not null and oid < prev_oid
    limit 20
  `);

  if (bad.length) {
    console.error("Found regressions:", bad);
    process.exitCode = 1;
  } else {
    console.log("\nOK: order_id is non-decreasing with created_at per exchanger.");
  }

  const { rows: bounds } = await pool.query(
    `select min(order_id::int) as min_id, max(order_id::int) as max_id
     from reviews where order_id ~ '^[0-9]+$'`,
  );
  console.log("Bounds:", bounds[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
