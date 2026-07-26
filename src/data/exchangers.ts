import type { Exchanger } from "./types";

export const exchangers: Exchanger[] = [
  {
    id: "1",
    slug: "nordchange",
    name: "NordChange",
    rating: 4.92,
    reviews: 1842,
    ageYears: 7,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Крупный обменник с фокусом на банковские переводы РФ и стейблкоины. Среднее время сделки — около 12 минут.",
  },
  {
    id: "2",
    slug: "atlas-pay",
    name: "Atlas Pay",
    rating: 4.88,
    reviews: 1204,
    ageYears: 5,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Быстрые обмены BTC и ETH, прозрачные лимиты и круглосуточная поддержка в Telegram.",
  },
  {
    id: "3",
    slug: "lime-ex",
    name: "LimeEx",
    rating: 4.81,
    reviews: 956,
    ageYears: 4,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Специализация на USDT TRC20 ↔ СБП. Низкая комиссия на крупные суммы.",
  },
  {
    id: "4",
    slug: "orbit-cash",
    name: "Orbit Cash",
    rating: 4.74,
    reviews: 711,
    ageYears: 6,
    verified: true,
    status: "busy",
    website: "https://example.com",
    description:
      "Широкий список направлений, включая наличные USD. Сейчас повышенная нагрузка.",
  },
  {
    id: "5",
    slug: "riverbit",
    name: "RiverBit",
    rating: 4.69,
    reviews: 640,
    ageYears: 3,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Молодой, но стабильный сервис. Хорошие курсы на ETH и LTC.",
  },
  {
    id: "6",
    slug: "cascade-x",
    name: "Cascade X",
    rating: 4.61,
    reviews: 488,
    ageYears: 8,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Один из старейших пунктов в мониторинге. Консервативные лимиты, высокая надёжность.",
  },
  {
    id: "7",
    slug: "foxswap",
    name: "FoxSwap",
    rating: 4.55,
    reviews: 392,
    ageYears: 2,
    verified: false,
    status: "online",
    website: "https://example.com",
    description:
      "Агрессивные курсы на популярных парах. Рекомендуем начинать с небольших сумм.",
  },
  {
    id: "8",
    slug: "quietledger",
    name: "Quiet Ledger",
    rating: 4.48,
    reviews: 275,
    ageYears: 4,
    verified: true,
    status: "offline",
    website: "https://example.com",
    description:
      "Фокус на приватности и XMR. Сейчас временно недоступен.",
  },
  {
    id: "9",
    slug: "metro-fx",
    name: "Metro FX",
    rating: 4.42,
    reviews: 518,
    ageYears: 5,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "Удобные обмены через Т-Банк и Сбер. Стабильные резервы в RUB.",
  },
  {
    id: "10",
    slug: "pulse-otc",
    name: "Pulse OTC",
    rating: 4.37,
    reviews: 203,
    ageYears: 3,
    verified: true,
    status: "online",
    website: "https://example.com",
    description:
      "OTC-ориентированный пункт для сумм от 300 000 ₽. Индивидуальный курс.",
  },
];

export const blacklisted = [
  {
    id: "b1",
    name: "QuickCoin24",
    reason: "AML-скам: блокировка средств после оплаты и требование «доплаты».",
    reportedAt: "2026-05-12",
    reports: 47,
  },
  {
    id: "b2",
    name: "TurboBit Exchange",
    reason: "Невыплата по подтверждённым заявкам, поддержка перестала отвечать.",
    reportedAt: "2026-03-28",
    reports: 31,
  },
  {
    id: "b3",
    name: "RubleRocket",
    reason: "Поддельные реквизиты и фишинговые зеркала официального сайта.",
    reportedAt: "2026-01-09",
    reports: 62,
  },
  {
    id: "b4",
    name: "ShadowPay Pro",
    reason: "Массовые жалобы на подмену курса после создания заявки.",
    reportedAt: "2025-11-17",
    reports: 24,
  },
];

export function getExchanger(slug: string): Exchanger | undefined {
  return exchangers.find((e) => e.slug === slug);
}

export function getExchangerById(id: string): Exchanger | undefined {
  return exchangers.find((e) => e.id === id);
}
