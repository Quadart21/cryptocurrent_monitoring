/**
 * Seed positive approved reviews for all exchangers.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-positive-reviews.mjs
 *   node --env-file=.env scripts/seed-positive-reviews.mjs --apply
 *
 * Default is dry-run. Kubex gets the highest count with a modest lead.
 */
import "dotenv/config";
import { Pool } from "pg";
import { randomBytes } from "crypto";

const APPLY = process.argv.includes("--apply");
const KUBEX_SLUG = "kubex";
const MIN_REVIEWS = 5;
const MAX_OTHERS = 88;
const KUBEX_MIN = 90;
const KUBEX_MAX = 100;

const QUALITY_TAGS = ["q_fast", "q_24_7", "q_support", "q_rate", "q_trust"];

const TEXTS = [
  "Всё супер, быстро сделали. Буду ещё заходить)",
  "Норм обменник, без заморочек. Мне зашло.",
  "Кинул заявку — через пару минут уже на карте. Красота!",
  "Курс норм, деньги пришли быстро. Спасибо!",
  "Уже второй раз меняю, оба раза всё ок.",
  "Просто и понятно, ничего лишнего. Рекомендую друзьям.",
  "Поддержка быстро ответила, помогли разобраться. Плюс.",
  "Обменял usdt — всё прошло гладко, без нервов.",
  "Быстро, удобно, без сюрпризов. То что нужно.",
  "Курс получше чем у многих, и не тянут время.",
  "Заявку взяли сразу, перевод пришёл как надо.",
  "Всё чётко, без лишних вопросов. Нравится.",
  "Меняю тут уже не раз — пока только плюсы.",
  "Сайт простой, обмен за пару минут. Огонь.",
  "Ребята молодцы, всё быстро и спокойно прошло.",
  "Деньги пришли быстрее чем думал. Спасибо!",
  "Нормальный курс, адекватная поддержка. Буду ещё.",
  "Всё прошло с первого раза, без танцев с бубном.",
  "Удобно очень. Особенно когда надо срочно.",
  "Кинул — получил. Без задержек. Класс.",
  "Поддержка ответила почти сразу, помогли. Спасибо.",
  "Курс устроил, сумма пришла целиком. Всё гуд.",
  "Не первый раз тут, всегда без проблем.",
  "Быстро ответили в чате и провели обмен. Топ.",
  "Просто зашёл, сделал обмен и забыл. Как и должно быть.",
  "Всё ок, буду пользоваться дальше.",
  "Хороший обменник, без странных комиссий.",
  "Обмен занял минут 5–10. Мне хватило с головой.",
  "Друзьям уже скинул ссылку, сам доволен.",
  "Курс честный, перевод вовремя. Нравится.",
  "Всё легко и по-человечески. Спасибо ребят.",
  "Менял немаленькую сумму — прошло спокойно.",
  "Уже третий раз, всё так же быстро и норм.",
  "Никаких затыков, всё как написано. Плюс.",
  "Поддержка живая, не боты одни. Это радует.",
  "Курс норм, сайт понятный. Буду ещё заглядывать.",
  "Сделали быстро, даже не успел понервничать)",
  "Всё просто: заявка, ожидание короткое — и готово.",
  "Очень удобно, особенно вечером когда срочно надо.",
  "Деньги пришли, курс совпал. Всё супер.",
  "Без лишней воды — просто работает. Мне так и надо.",
  "Обмен прошёл гладко, спасибо!",
  "Уже месяц тут меняю, всё стабильно.",
  "Норм сервис, не подвели. Рекомендую.",
  "Быстро и без заморочек. Буду ещё.",
  "Курс хороший, поддержка нормальная. Ок.",
  "Всё понравилось, буду сюда возвращаться.",
  "Заявку закрыли быстро, перевод пришёл. Класс.",
  "Просто, быстро, по делу. Спасибо!",
  "Мне зашло. Без нервов и ожиданий по часу.",
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pickTags() {
  const count = randInt(1, 3);
  const shuffled = [...QUALITY_TAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function newReviewId() {
  return `rv_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function randomOrderId() {
  return String(randInt(540, 10000));
}

function randomCreatedAt() {
  const now = Date.now();
  const daysAgo = randInt(1, 240);
  const ms = now - daysAgo * 24 * 60 * 60 * 1000 - randInt(0, 86_400_000);
  return new Date(ms).toISOString();
}

function assignCounts(exchangers) {
  const counts = new Map();
  let maxOther = 0;

  for (const ex of exchangers) {
    if (ex.slug === KUBEX_SLUG) continue;
    const n = randInt(MIN_REVIEWS, MAX_OTHERS);
    counts.set(ex.id, n);
    if (n > maxOther) maxOther = n;
  }

  const kubex = exchangers.find((e) => e.slug === KUBEX_SLUG);
  if (kubex) {
    const lead = randInt(2, 8);
    let kubexCount = Math.min(
      KUBEX_MAX,
      Math.max(KUBEX_MIN, maxOther + lead),
    );
    if (kubexCount <= maxOther) {
      kubexCount = Math.min(KUBEX_MAX, maxOther + 1);
    }
    counts.set(kubex.id, kubexCount);
  }

  return counts;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    const { rows: exchangers } = await client.query(
      `select id, slug, name, status, reviews
       from exchangers
       where status = 'active'
       order by name`,
    );

    if (!exchangers.length) {
      console.log("No active exchangers found");
      return;
    }

    const { rows: existing } = await client.query(
      `select exchanger_id, count(*)::int as n
       from reviews
       where status = 'approved'
       group by exchanger_id`,
    );
    const existingMap = new Map(existing.map((r) => [r.exchanger_id, r.n]));

    const counts = assignCounts(exchangers);
    const plan = exchangers.map((ex) => {
      const target = counts.get(ex.id) ?? MIN_REVIEWS;
      const have = existingMap.get(ex.id) ?? 0;
      const toAdd = Math.max(0, target - have);
      return { ...ex, target, have, toAdd };
    });

    const totalToAdd = plan.reduce((s, p) => s + p.toAdd, 0);
    console.log(`Active exchangers: ${plan.length}`);
    console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
    console.log(`Reviews to insert: ${totalToAdd}`);
    console.log("---");
    for (const p of plan.sort((a, b) => b.target - a.target)) {
      console.log(
        `${p.slug.padEnd(24)} have=${String(p.have).padStart(3)} target=${String(p.target).padStart(3)} add=${String(p.toAdd).padStart(3)}`,
      );
    }

    if (!APPLY) {
      console.log("\nDry-run only. Re-run with --apply to insert.");
      return;
    }

    if (totalToAdd === 0) {
      console.log("Nothing to insert.");
      return;
    }

    await client.query("begin");
    let inserted = 0;

    for (const p of plan) {
      if (p.toAdd <= 0) continue;
      for (let i = 0; i < p.toAdd; i++) {
        const createdAt = randomCreatedAt();
        const id = `${newReviewId()}_${inserted}`;
        await client.query(
          `insert into reviews (
             id, exchanger_id, exchanger_slug, exchanger_name,
             sentiment, order_id, text, quality_tag_ids,
             status, created_at, moderated_at, thread_closed
           ) values (
             $1, $2, $3, $4,
             'positive', $5, $6, $7,
             'approved', $8, $9, false
           )`,
          [
            id,
            p.id,
            p.slug,
            p.name,
            randomOrderId(),
            pick(TEXTS),
            pickTags(),
            createdAt,
            createdAt,
          ],
        );
        inserted += 1;
      }
    }

    await client.query(
      `update exchangers e
       set
         reviews = s.total,
         reviews_positive = s.positive,
         reviews_negative = s.negative,
         rating = case
           when s.total = 0 then 0
           else round((s.positive::numeric / s.total) * 5, 2)
         end
       from (
         select
           exchanger_id,
           count(*) filter (where status = 'approved')::int as total,
           count(*) filter (where status = 'approved' and sentiment = 'positive')::int as positive,
           count(*) filter (where status = 'approved' and sentiment = 'negative')::int as negative
         from reviews
         group by exchanger_id
       ) s
       where e.id = s.exchanger_id`,
    );

    await client.query("commit");
    console.log(`\nInserted ${inserted} positive reviews and recomputed stats.`);

    const { rows: top } = await client.query(
      `select slug, reviews, reviews_positive, reviews_negative, rating
       from exchangers
       where status = 'active'
       order by reviews desc
       limit 10`,
    );
    console.log("\nTop by review count:");
    console.table(top);
  } catch (err) {
    await client.query("rollback").catch(() => {});
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
