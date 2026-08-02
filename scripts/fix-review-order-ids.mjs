/**
 * Rewrite review order_id values to random integers in [540, 10000].
 *
 * Usage:
 *   node --env-file=.env scripts/fix-review-order-ids.mjs
 *   node --env-file=.env scripts/fix-review-order-ids.mjs --apply
 */
import "dotenv/config";
import { Pool } from "pg";

const APPLY = process.argv.includes("--apply");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(`select id, order_id from reviews`);
  console.log(`Reviews: ${rows.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(
    "Sample before:",
    rows.slice(0, 8).map((r) => r.order_id),
  );

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to update.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of rows) {
      const orderId = String(randInt(540, 10000));
      await client.query(`update reviews set order_id = $1 where id = $2`, [
        orderId,
        row.id,
      ]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const { rows: after } = await pool.query(
    `select order_id from reviews order by random() limit 12`,
  );
  const { rows: bounds } = await pool.query(
    `select min(order_id::int) as min_id, max(order_id::int) as max_id
     from reviews
     where order_id ~ '^[0-9]+$'`,
  );
  console.log("Sample after:", after.map((r) => r.order_id));
  console.log("Bounds:", bounds[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
