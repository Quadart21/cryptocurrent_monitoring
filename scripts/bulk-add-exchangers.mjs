/**
 * Bulk-add exchangers from a JSON list into Postgres.
 *
 * Usage:
 *   node --env-file=.env scripts/bulk-add-exchangers.mjs
 *   node --env-file=.env scripts/bulk-add-exchangers.mjs --apply
 *   node --env-file=.env scripts/bulk-add-exchangers.mjs --apply --check-feeds
 *   node --env-file=.env scripts/bulk-add-exchangers.mjs --file scripts/data/bulk-exchangers-batch1.json --apply
 *
 * Default is dry-run (no DB writes). Skips rows whose website or feed_url already exists.
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

const DEFAULT_FILE = path.join(
  process.cwd(),
  "scripts/data/bulk-exchangers-batch1.json",
);

const CYR_MAP = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[а-яё]/gi, (ch) => CYR_MAP[ch] ?? "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function newId() {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function emptyTraffic() {
  return {
    pageViews: 0,
    siteClicks: 0,
    lastViewAt: null,
    lastClickAt: null,
    daily: [],
  };
}

function emptyBannerCheck() {
  return {
    status: "pending",
    lastCheckAt: null,
    lastSeenAt: null,
    missingSince: null,
    consecutiveMisses: 0,
    lastError: null,
    lastNotifiedAt: null,
    lastOwnerWarnedAt: null,
    ownerWarnCount: 0,
  };
}

function resolveFeedUrl(feedUrl) {
  const code =
    process.env.FEED_PARTNER_CODE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_NAME?.trim().toLowerCase().replace(/\s+/g, "") ||
    "gapsnap";
  return feedUrl
    .trim()
    .replace(/:code\b/gi, encodeURIComponent(code))
    .replace(/\{code\}/gi, encodeURIComponent(code))
    .replace(/%code%/gi, encodeURIComponent(code));
}

async function checkFeed(feedUrl) {
  const resolved = resolveFeedUrl(feedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(resolved, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "application/xml, text/xml, */*",
        "User-Agent": "GapSnapMonitor/1.0 (+https://gapsnap.org)",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/<rates[\s>]/i.test(text)) {
      throw new Error("no <rates> root");
    }
    const pairs = (text.match(/<item>/gi) || []).length;
    return { ok: true, pairs, resolved };
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const args = {
    apply: false,
    checkFeeds: false,
    file: DEFAULT_FILE,
    status: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--check-feeds") args.checkFeeds = true;
    else if (a === "--file") args.file = path.resolve(argv[++i] ?? "");
    else if (a.startsWith("--file=")) args.file = path.resolve(a.slice(7));
    else if (a === "--status") args.status = argv[++i];
    else if (a.startsWith("--status=")) args.status = a.slice(9);
  }
  if (args.status && args.status !== "active" && args.status !== "pending") {
    throw new Error("--status must be active or pending");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const raw = await fs.readFile(args.file, "utf8");
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || list.length === 0) {
    console.error("JSON must be a non-empty array");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    const { rows: existing } = await client.query(
      `SELECT id, slug, name, website, feed_url, api_id
       FROM exchangers`,
    );
    const usedSlugs = new Set(existing.map((r) => r.slug));
    const byHost = new Map(
      existing
        .map((r) => [normalizeHost(r.website), r])
        .filter(([h]) => h),
    );
    const byFeed = new Map(
      existing
        .filter((r) => r.feed_url)
        .map((r) => [r.feed_url.trim().toLowerCase(), r]),
    );
    let nextApiId =
      Math.max(0, ...existing.map((r) => Number(r.api_id) || 0)) + 1;

    console.log(
      `${args.apply ? "APPLY" : "DRY-RUN"} · ${list.length} rows · file=${path.relative(process.cwd(), args.file)}`,
    );
    console.log(`Existing exchangers in DB: ${existing.length}`);
    console.log("");

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of list) {
      const name = String(row.name ?? "").trim();
      const website = String(row.website ?? "").trim();
      const feedUrl = String(row.feedUrl ?? "").trim();
      const exchangeUrlTemplate = String(row.exchangeUrlTemplate ?? "").trim();
      const contact = String(row.contact ?? "").trim();
      const description = String(row.description ?? "").trim();
      const status =
        args.status ??
        (row.status === "active" || row.status === "pending"
          ? row.status
          : "pending");
      const skipFeedCheck = Boolean(row.skipFeedCheck);
      const host = normalizeHost(website);

      if (name.length < 2 || !website || !feedUrl) {
        console.log(`✗ SKIP invalid row: ${JSON.stringify(row)}`);
        failed += 1;
        continue;
      }

      const dup =
        (host && byHost.get(host)) ||
        byFeed.get(feedUrl.toLowerCase()) ||
        null;
      if (dup) {
        console.log(
          `· SKIP already exists: ${name} → ${dup.slug} (${dup.id})`,
        );
        skipped += 1;
        continue;
      }

      if (args.checkFeeds && !skipFeedCheck) {
        try {
          const check = await checkFeed(feedUrl);
          console.log(
            `  feed OK ${name}: ${check.pairs} pairs (${check.resolved})`,
          );
        } catch (err) {
          console.log(
            `✗ FEED FAIL ${name}: ${err instanceof Error ? err.message : err}`,
          );
          failed += 1;
          continue;
        }
      } else if (args.checkFeeds && skipFeedCheck) {
        console.log(`  feed check skipped for ${name} (skipFeedCheck)`);
      }

      const slugBase = slugify(name) || "exchanger";
      let slug = slugBase;
      let i = 2;
      while (usedSlugs.has(slug)) {
        slug = `${slugBase}-${i++}`;
      }

      const id = newId();
      const now = new Date().toISOString();
      const apiId = status === "active" ? nextApiId : null;
      if (status === "active") nextApiId += 1;

      const desc =
        description ||
        (status === "active"
          ? "Добавлен массовым импортом."
          : "Черновик: массовый импорт.");

      console.log(
        `${args.apply ? "+" : "~"} ${name} · ${slug} · ${status}${apiId != null ? ` · apiId=${apiId}` : ""}`,
      );
      console.log(`    site ${website}`);
      console.log(`    feed ${feedUrl}`);
      if (row.notes) console.log(`    note ${row.notes}`);

      if (args.apply) {
        await client.query(
          `INSERT INTO exchangers (
            id, slug, name, website, exchange_url_template, feed_url, contact, description,
            status, verified, rating, reviews, reviews_positive, reviews_negative, age_years,
            created_at, approved_at, last_sync_at, last_error, pair_count, achievement_ids,
            logo_format, logo_updated_at, logo_data, traffic, banner_token, banner_check,
            owner_login, owner_password_hash, owner_email, owner_totp_secret, owner_totp_enabled, api_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,false,0,0,0,0,1,
            $10,$11,null,null,0,'{}',
            null,null,null,$12::jsonb,null,$13::jsonb,
            null,null,null,null,false,$14
          )`,
          [
            id,
            slug,
            name,
            website,
            exchangeUrlTemplate,
            feedUrl,
            contact,
            desc,
            status,
            now,
            status === "active" ? now : null,
            JSON.stringify(emptyTraffic()),
            JSON.stringify(emptyBannerCheck()),
            apiId,
          ],
        );
        usedSlugs.add(slug);
        if (host) byHost.set(host, { id, slug, website, feed_url: feedUrl });
        byFeed.set(feedUrl.toLowerCase(), { id, slug, website, feed_url: feedUrl });
      }

      added += 1;
    }

    console.log("");
    console.log(
      `Done: ${added} ${args.apply ? "inserted" : "would insert"}, ${skipped} skipped, ${failed} failed`,
    );
    if (!args.apply) {
      console.log("Re-run with --apply to write to the database.");
      console.log("Optional: --check-feeds to validate XML before insert.");
    } else {
      console.log(
        "Rates will fill on the next feed sync (admin sync / background poller).",
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
