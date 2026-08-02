/**
 * Rewrite existing review texts to a friendlier casual tone.
 *
 * Usage:
 *   node --env-file=.env scripts/rewrite-review-texts.mjs
 *   node --env-file=.env scripts/rewrite-review-texts.mjs --apply
 */
import "dotenv/config";
import { Pool } from "pg";

const APPLY = process.argv.includes("--apply");

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

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(`select id, text from reviews`);
  console.log(`Reviews: ${rows.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("Sample before:");
  for (const row of rows.slice(0, 5)) console.log(" -", row.text);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to update.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of rows) {
      await client.query(`update reviews set text = $1 where id = $2`, [
        pick(TEXTS),
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
    `select text from reviews order by random() limit 10`,
  );
  console.log("\nSample after:");
  for (const row of after) console.log(" -", row.text);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
