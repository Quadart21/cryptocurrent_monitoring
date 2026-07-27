/**
 * One-shot import of legacy .data/store.json (+ .data/logos) into Postgres.
 * Usage: npm run db:import
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const LOGO_DIR = path.join(DATA_DIR, "logos");

async function readLogo(id, format) {
  if (format !== "svg" && format !== "png") return null;
  try {
    return await fs.readFile(path.join(LOGO_DIR, `${id}.${format}`));
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  let raw;
  try {
    raw = await fs.readFile(STORE_PATH, "utf8");
  } catch {
    console.error(`No store at ${STORE_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(raw);
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  console.log("Importing into Postgres…");

  try {
    await client.query("BEGIN");

    await client.query(`
      DELETE FROM rates;
      DELETE FROM reviews;
      DELETE FROM ads;
      DELETE FROM achievements;
      DELETE FROM quality_tags;
      DELETE FROM blacklist;
      DELETE FROM ad_tariffs;
      DELETE FROM exchangers;
      DELETE FROM ad_pricing;
      DELETE FROM seo;
      DELETE FROM app_meta;
    `);

    for (const ex of data.exchangers ?? []) {
      const logo = ex.logo ?? null;
      const logoData = await readLogo(ex.id, logo?.format);
      const traffic = ex.traffic ?? {
        pageViews: 0,
        siteClicks: 0,
        lastViewAt: null,
        lastClickAt: null,
        daily: [],
      };

      await client.query(
        `INSERT INTO exchangers (
          id, slug, name, website, feed_url, contact, description, status, verified,
          rating, reviews, reviews_positive, reviews_negative, age_years, created_at,
          approved_at, last_sync_at, last_error, pair_count, achievement_ids,
          logo_format, logo_updated_at, logo_data, traffic, owner_login, owner_password_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,
          $21,$22,$23,$24::jsonb,$25,$26
        )`,
        [
          ex.id,
          ex.slug ?? ex.id,
          ex.name ?? ex.id,
          ex.website ?? "",
          ex.feedUrl ?? "",
          ex.contact ?? "",
          ex.description ?? "",
          ex.status ?? "pending",
          Boolean(ex.verified),
          Number(ex.rating ?? 0),
          Number(ex.reviews ?? 0),
          Number(ex.reviewsPositive ?? 0),
          Number(ex.reviewsNegative ?? 0),
          Number(ex.ageYears ?? 1),
          ex.createdAt ?? new Date().toISOString(),
          ex.approvedAt ?? null,
          ex.lastSyncAt ?? null,
          ex.lastError ?? null,
          Number(ex.pairCount ?? 0),
          Array.isArray(ex.achievementIds) ? ex.achievementIds : [],
          logoData && logo?.format ? logo.format : null,
          logoData && logo?.updatedAt ? logo.updatedAt : null,
          logoData,
          JSON.stringify(traffic),
          ex.ownerLogin ?? null,
          ex.ownerPasswordHash ?? null,
        ],
      );
    }

    for (const r of data.rates ?? []) {
      await client.query(
        `INSERT INTO rates (
          id, exchanger_id, "from", "to", in_amount, out_amount, rate, reserve,
          min_amount, max_amount, city, param, tofee, synced_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          r.id,
          r.exchangerId,
          r.from,
          r.to,
          Number(r.in ?? 0),
          Number(r.out ?? 0),
          Number(r.rate ?? 0),
          Number(r.reserve ?? 0),
          Number(r.minAmount ?? 0),
          Number(r.maxAmount ?? 0),
          r.city ?? null,
          r.param ?? null,
          r.tofee ?? null,
          r.syncedAt ?? new Date().toISOString(),
        ],
      );
    }

    for (const b of data.blacklist ?? []) {
      await client.query(
        `INSERT INTO blacklist (id, name, reason, reported_at, reports, exchanger_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          b.id,
          b.name,
          b.reason,
          b.reportedAt ?? "",
          Number(b.reports ?? 1),
          b.exchangerId ?? null,
        ],
      );
    }

    for (const t of data.qualityTags ?? []) {
      await client.query(
        `INSERT INTO quality_tags (id, label, active, created_at)
         VALUES ($1,$2,$3,$4)`,
        [
          t.id,
          t.label,
          t.active !== false,
          t.createdAt ?? new Date().toISOString(),
        ],
      );
    }

    for (const r of data.reviews ?? []) {
      await client.query(
        `INSERT INTO reviews (
          id, exchanger_id, exchanger_slug, exchanger_name, sentiment, order_id, text,
          quality_tag_ids, status, created_at, moderated_at, owner_reply, owner_replied_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          r.id,
          r.exchangerId,
          r.exchangerSlug ?? "",
          r.exchangerName ?? "",
          r.sentiment,
          r.orderId ?? "",
          r.text ?? "",
          Array.isArray(r.qualityTagIds) ? r.qualityTagIds : [],
          r.status ?? "pending",
          r.createdAt ?? new Date().toISOString(),
          r.moderatedAt ?? null,
          r.ownerReply ?? null,
          r.ownerRepliedAt ?? null,
        ],
      );
    }

    for (const a of data.achievements ?? []) {
      await client.query(
        `INSERT INTO achievements (id, name, description, svg, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          a.id,
          a.name,
          a.description ?? "",
          a.svg ?? "",
          a.createdAt ?? new Date().toISOString(),
        ],
      );
    }

    for (const a of data.ads ?? []) {
      const stats = a.stats ?? {
        impressions: 0,
        clicks: 0,
        lastImpressionAt: null,
        lastClickAt: null,
        daily: [],
      };
      await client.query(
        `INSERT INTO ads (
          id, name, type, placement, title, body, href, image_url, exchanger_id,
          active, priority, starts_at, ends_at, created_at, stats
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
        [
          a.id,
          a.name ?? a.id,
          a.type ?? "banner",
          a.placement ?? "dashboard",
          a.title ?? "",
          a.body ?? "",
          a.href ?? "",
          a.imageUrl ?? "",
          a.exchangerId ?? null,
          a.active !== false,
          Number(a.priority ?? 0),
          a.startsAt ?? null,
          a.endsAt ?? null,
          a.createdAt ?? new Date().toISOString(),
          JSON.stringify(stats),
        ],
      );
    }

    for (const t of data.adTariffs ?? []) {
      await client.query(
        `INSERT INTO ad_tariffs (
          id, placement, type, title, description, size_label, price, period,
          currency, features, active, sort_order, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          t.id,
          t.placement,
          t.type,
          t.title,
          t.description ?? "",
          t.sizeLabel ?? "",
          Number(t.price ?? 0),
          t.period ?? "week",
          "RUB",
          Array.isArray(t.features) ? t.features : [],
          t.active !== false,
          Number(t.sortOrder ?? 0),
          t.updatedAt ?? new Date().toISOString(),
        ],
      );
    }

    const pricing = data.adPricing ?? {};
    await client.query(
      `INSERT INTO ad_pricing (id, contact, intro, note) VALUES (1,$1,$2,$3)`,
      [
        pricing.contact ?? "ads@gapsnap.local",
        pricing.intro ?? "",
        pricing.note ?? "",
      ],
    );

    const s = data.seo ?? {};
    await client.query(
      `INSERT INTO seo (
        id, site_name, site_url, title_default, title_template, description, keywords,
        og_title, og_description, og_image_url, twitter_card, twitter_handle,
        robots_index, robots_follow, robots_extra, robots_txt_extra, sitemap_enabled,
        noindex_paths, google_verification, yandex_verification, bing_verification,
        json_ld_enabled, organization_name, organization_logo_url
      ) VALUES (
        1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      )`,
      [
        s.siteName ?? "GapSnap",
        s.siteUrl ?? "",
        s.titleDefault ?? "GapSnap",
        s.titleTemplate ?? "%s · GapSnap",
        s.description ?? "",
        s.keywords ?? "",
        s.ogTitle ?? "GapSnap",
        s.ogDescription ?? "",
        s.ogImageUrl ?? "",
        s.twitterCard ?? "summary_large_image",
        s.twitterHandle ?? "",
        s.robotsIndex !== false,
        s.robotsFollow !== false,
        s.robotsExtra ?? "",
        s.robotsTxtExtra ?? "",
        s.sitemapEnabled !== false,
        s.noindexPaths ?? "",
        s.googleVerification ?? "",
        s.yandexVerification ?? "",
        s.bingVerification ?? "",
        s.jsonLdEnabled !== false,
        s.organizationName ?? "GapSnap",
        s.organizationLogoUrl ?? "",
      ],
    );

    await client.query(
      `INSERT INTO app_meta (id, last_global_sync_at, seeded_at)
       VALUES (1, $1, NOW())`,
      [data.lastGlobalSyncAt ?? null],
    );

    await client.query("COMMIT");
    console.log(
      `Done: ${(data.exchangers ?? []).length} exchangers, ${(data.rates ?? []).length} rates, ${(data.achievements ?? []).length} achievements.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
