/**
 * Seed 20 exchanger achievements into Postgres.
 * Usage: node --env-file=.env scripts/seed-achievements.mjs
 */
import "dotenv/config";
import { Pool } from "pg";

const now = new Date().toISOString();

const ITEMS = [
  {
    id: "ach_verified",
    name: "Проверенный",
    description:
      "Обменник прошёл ручную проверку — можно обменивать спокойнее",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 12.2l3 3.1 6-6.4" stroke="#fbbf24" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_top_rating",
    name: "Топ рейтинг",
    description: "Один из лидеров по оценкам пользователей",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.4l2.6 6.4 7 .6-5.3 4.6 1.6 6.8L12 17.4 6.1 20.8l1.6-6.8L2.4 9.4l7-.6L12 2.4z"/><path fill="#fbbf24" d="M12 8.2l.9 2.2 2.4.2-1.8 1.6.5 2.3L12 13.2l-2 1.3.5-2.3-1.8-1.6 2.4-.2L12 8.2z"/></svg>`,
  },
  {
    id: "ach_people_choice",
    name: "Народный выбор",
    description: "Ему доверяют тысячи людей — судя по отзывам",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19.5c.8-3 2.9-4.5 4.5-4.5s3.7 1.5 4.5 4.5M11.5 19.5c.8-3 2.9-4.5 4.5-4.5s3.7 1.5 4.5 4.5" stroke="#fbbf24" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  },
  {
    id: "ach_veteran",
    name: "Ветеран",
    description: "Годы на рынке: надёжность, проверенная временем",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M7 3h10v3.2l2 1.5V10c0 4.2-2.8 7.6-7 8.8C7.8 17.6 5 14.2 5 10V7.7L7 6.2V3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v5l3 1.8" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_lightning",
    name: "Молния",
    description: "Обмен без долгого ожидания — заявки уходят быстро",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M13.2 2L4.8 13.4h5.4L9.2 22l9.6-12.8h-5.6L13.2 2z"/><path fill="#fbbf24" d="M13.2 2l-2.8 7.2h3.2l-1.2 4.4 5.8-7.8h-3.4L13.2 2z"/></svg>`,
  },
  {
    id: "ach_best_rate",
    name: "Лучший курс",
    description: "Часто даёт самый выгодный курс на популярных парах",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M4 17l5-5 3.5 3.5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_wide_choice",
    name: "Широкий выбор",
    description: "Много направлений — почти любой обмен в одном месте",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="7" r="2.2" fill="currentColor"/><circle cx="17" cy="17" r="2.2" fill="currentColor"/><circle cx="17" cy="7" r="2.2" fill="#fbbf24"/><circle cx="7" cy="17" r="2.2" fill="#fbbf24"/><path d="M9 7h6M7 9v6M17 9v6M9 17h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".85"/></svg>`,
  },
  {
    id: "ach_no_surprises",
    name: "Без сюрпризов",
    description: "Курс честный: получаете то, на что рассчитывали",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 12h8M8 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="8.5" r="1.25" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_support_24_7",
    name: "На связи 24/7",
    description: "Поддержка отвечает в любое время суток",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 0 1 9 9h-2.2a6.8 6.8 0 1 0-6.8 6.8V21A9 9 0 1 1 12 3z" fill="currentColor"/><circle cx="18.2" cy="5.8" r="2.1" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_partner",
    name: "Партнёр GapSnap",
    description: "Официальный партнёр мониторинга — повышенное доверие",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.1 4.8L19.5 9l-3.6 3.4.9 5.1L12 15.2 7.2 17.5l.9-5.1L4.5 9l5.4-1.2L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.3" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_reserves",
    name: "Живые резервы",
    description: "Крупные суммы доступны без «резерв закончился»",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M9 16V10.5M12 16V8M15 16v-3.5" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  },
  {
    id: "ach_honest",
    name: "Честный обмен",
    description: "Прозрачные условия, без скрытых комиссий",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3.2v5.3c0 4.4-2.9 7.8-7 9.1-4.1-1.3-7-4.7-7-9.1V6.2L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.2 12.1l1.9 1.9 3.8-4" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_aml",
    name: "AML-ready",
    description: "Понятные правила проверки — меньше риска блокировок",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 10V7.5a3 3 0 0 1 6 0V10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="15" r="1.4" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_crypto_pro",
    name: "Крипто-профи",
    description: "Отличный выбор для BTC, ETH, USDT и другой крипты",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.8v10.4M9.6 9.2h3.3c1.3 0 2.2.8 2.2 1.9s-.9 1.9-2.2 1.9H9.6h3.6c1.4 0 2.4.8 2.4 2s-1 2-2.4 2H9.6" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_fiat_master",
    name: "Фиат-мастер",
    description: "Удобный обмен с картами и банковскими переводами",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="17" height="12" rx="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 10h17" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="14.2" r="1.4" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_antiscam",
    name: "Антискам",
    description: "Чистая репутация — минимум жалоб, максимум спокойствия",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5.5c0 4.6-3.1 8.2-8 9.5-4.9-1.3-8-4.9-8-9.5V7l8-4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12.5l2.1 2.1L15.5 10" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "ach_uptime",
    name: "Аптайм",
    description: "Всегда на связи: курсы и обмен доступны стабильно",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l3.2-3.2" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>`,
  },
  {
    id: "ach_newcomer",
    name: "Новичок месяца",
    description: "Свежий игрок с сильным стартом и хорошими отзывами",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 3.5l1.4 4.2H18l-3.5 2.7 1.3 4.3L12 12.8 8.2 14.7l1.3-4.3L6 7.7h4.6L12 3.5z" fill="currentColor"/><circle cx="18.5" cy="6" r="2.2" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_local_hero",
    name: "Локальный герой",
    description: "Лучший вариант для обменов «у себя в регионе»",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="#fbbf24"/></svg>`,
  },
  {
    id: "ach_vip",
    name: "VIP-сервис",
    description: "Премиум-обслуживание и персональный подход",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M4.5 8.5L7.2 17h9.6l2.7-8.5-3.6 2.2L12 5.5 8.1 10.7 4.5 8.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 17h7" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  },
];

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required (check .env)");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    let upserted = 0;
    for (const item of ITEMS) {
      await client.query(
        `INSERT INTO achievements (id, name, description, svg, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           svg = EXCLUDED.svg`,
        [item.id, item.name, item.description, item.svg, now],
      );
      upserted += 1;
      console.log(`✓ ${item.name}`);
    }
    console.log(`\nDone: ${upserted} achievements upserted.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
