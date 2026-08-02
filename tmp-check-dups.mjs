import pg from "pg";

const { Pool } = pg;
const hosts = [
  "mine.exchange",
  "coindrop.trade",
  "365cash.co",
  "nixexchange.net",
  "coincat.in",
  "daeo.pro",
  "obmenko.org",
  "e-change.io",
  "receive-money.biz",
  "xchange.pub",
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  "SELECT id, slug, name, website, feed_url, status, contact, owner_email FROM exchangers",
);
console.log("TOTAL", rows.length);
for (const h of hosts) {
  const hits = rows.filter(
    (r) =>
      (r.website || "").toLowerCase().includes(h) ||
      (r.feed_url || "").toLowerCase().includes(h),
  );
  if (!hits.length) console.log(h + ": NOT FOUND");
  else
    for (const x of hits)
      console.log(
        h + ":",
        [
          x.slug,
          x.status,
          x.website,
          x.feed_url,
          x.contact || "-",
          x.owner_email || "-",
        ].join(" | "),
      );
}
await pool.end();
