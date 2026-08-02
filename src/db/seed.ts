import "server-only";

import { count, eq } from "drizzle-orm";
import type { Db } from "@/db/index";
import {
  adPricing,
  adTariffs,
  appMeta,
  blacklist,
  exchangers,
  legal,
  qualityTags,
  seo,
} from "@/db/schema";
import { SEED_TERMS_BODY } from "@/data/seed-terms-body";
import { emptyExchangerTraffic } from "@/lib/exchanger-traffic";
import type {
  AdPricingSettings,
  AdTariff,
  BlacklistItem,
  FeedExchanger,
  LegalSettings,
  ReviewQualityTag,
  SeoSettings,
} from "@/lib/store-types";

const SEED_AT = "2025-05-01T00:00:00.000Z";

export const seedBlacklist: BlacklistItem[] = [
  {
    id: "b1",
    name: "QuickCoin24",
    reason: "AML-скам: блокировка средств после оплаты и требование «доплаты».",
    reportedAt: "2026-05-12",
    reports: 47,
    exchangerId: null,
  },
  {
    id: "b2",
    name: "TurboBit Exchange",
    reason: "Невыплата по подтверждённым заявкам, поддержка перестала отвечать.",
    reportedAt: "2026-03-28",
    reports: 31,
    exchangerId: null,
  },
  {
    id: "b3",
    name: "RubleRocket",
    reason: "Поддельные реквизиты и фишинговые зеркала официального сайта.",
    reportedAt: "2026-01-09",
    reports: 62,
    exchangerId: null,
  },
  {
    id: "b4",
    name: "ShadowPay Pro",
    reason: "Массовые жалобы на подмену курса после создания заявки.",
    reportedAt: "2025-11-17",
    reports: 24,
    exchangerId: null,
  },
];

export const seedQualityTags: ReviewQualityTag[] = [
  { id: "q_fast", label: "Быстрый", active: true, createdAt: SEED_AT },
  { id: "q_24_7", label: "Круглосуточный", active: true, createdAt: SEED_AT },
  {
    id: "q_support",
    label: "Отзывчивая поддержка",
    active: true,
    createdAt: SEED_AT,
  },
  { id: "q_rate", label: "Выгодный курс", active: true, createdAt: SEED_AT },
  { id: "q_trust", label: "Надёжный", active: true, createdAt: SEED_AT },
];

export const seedExchanger: FeedExchanger = {
  id: "kubex",
  slug: "kubex",
  name: "Kubex",
  website: "https://kubex.me",
  exchangeUrlTemplate: "https://kubex.me/ru/exchange/{0}/{1}",
  feedUrl: "https://kubex.me/exports/valuta.xml",
  contact: "seed@gapsnap.local",
  description:
    "Пример обменника с публичным XML-фидом курсов.",
  status: "active",
  verified: true,
  rating: 0,
  reviews: 0,
  reviewsPositive: 0,
  reviewsNegative: 0,
  ageYears: 3,
  createdAt: SEED_AT,
  approvedAt: "2025-05-01T00:00:00.000Z",
  lastSyncAt: null,
  lastError: null,
  pairCount: 0,
  achievementIds: [],
  logo: null,
  traffic: emptyExchangerTraffic(),
  bannerToken: null,
  bannerCheck: {
    status: "pending",
    lastCheckAt: null,
    lastSeenAt: null,
    missingSince: null,
    consecutiveMisses: 0,
    lastError: null,
    lastNotifiedAt: null,
    lastOwnerWarnedAt: null,
    ownerWarnCount: 0,
  },
  ownerLogin: "kubex",
  ownerPasswordHash:
    "f6488fe194edbdd61499874cfa9f82a3390859df4da15f770a3cce0327763832",
  ownerEmail: "seed@gapsnap.local",
  ownerTotpSecret: null,
  ownerTotpEnabled: false,
  inviteEmailSentAt: null,
  inviteEmailTo: "",
  apiId: 1,
};

export const seedAdPricing: AdPricingSettings = {
  contact: "support@gapsnap.org",
  intro:
    "Разместите баннер или выделите обменник в мониторинге GapSnap. Ниже — актуальные форматы, размеры и тарифы.",
  note: "Цены указаны в рублях. Слоты ограничены: при занятости даты согласуем отдельно.",
};

export const seedSeo: SeoSettings = {
  siteName: "GapSnap",
  siteUrl: process.env.SITE_URL?.trim() || "https://gapsnap.org",
  titleDefault: "GapSnap — мониторинг обменников",
  titleTemplate: "%s · GapSnap",
  description:
    "Сравнивайте курсы проверенных обменников криптовалют. XML-фиды, рейтинг и отзывы.",
  keywords:
    "обменник, курс криптовалют, мониторинг обменников, USDT, Bitcoin, GapSnap",
  ogTitle: "GapSnap — мониторинг обменников",
  ogDescription:
    "Актуальные курсы и проверенные обменники. Сравнение предложений в одном месте.",
  ogImageUrl: "",
  twitterCard: "summary_large_image",
  twitterHandle: "",
  robotsIndex: true,
  robotsFollow: true,
  robotsExtra: "",
  robotsTxtExtra: "",
  sitemapEnabled: true,
  noindexPaths: "/api/",
  googleVerification: "",
  yandexVerification: "",
  bingVerification: "",
  jsonLdEnabled: true,
  organizationName: "GapSnap",
  organizationLogoUrl: "",
  contactEmail: "support@gapsnap.org",
  contactTelegram: "",
  googleAnalyticsId: "",
  yandexMetricaId: "",
  gtmId: "",
};

export const seedLegal: LegalSettings = {
  privacyTitle: "Политика конфиденциальности",
  privacyUpdatedAt: SEED_AT,
  privacyBody: `GapSnap («мы») — сервис мониторинга курсов обменников. Мы не проводим обмен валют и не храним средства пользователей.

## Какие данные собираем

- Email при подтверждении отзыва или заявке обменника
- Технические логи (IP, User-Agent) для безопасности
- Cookies: необходимые (тема, сессия кабинета/админки, согласие) и аналитические (по вашему выбору)
- При входе в кабинет — проверка Cloudflare Turnstile (защита от ботов)

## Зачем

Для модерации отзывов, связи с владельцами обменников, защиты от злоупотреблений и улучшения сервиса.

## Передача третьим лицам

Данные не продаём. Могут обрабатываться хостинг-провайдером и сервисами почты/аналитики в рамках выбранных настроек. Для защиты входа в кабинет используется Cloudflare Turnstile.

## Контакты

По вопросам персональных данных напишите на email из футера сайта или укажите контакт в заявке обменника.`,
  cookieTitle: "Политика cookies",
  cookieUpdatedAt: SEED_AT,
  cookieBody: `На сайте GapSnap используются cookies и похожие технологии.

## Необходимые cookies

Нужны для работы сайта: тема оформления, согласие на cookies, сессия кабинета владельца и админки. Их нельзя отключить без потери функций.

## Аналитические cookies

Помогают понять, как пользуются сайтом (Google Analytics, Яндекс.Метрика, GTM — если подключены в настройках). Загружаются **только после вашего согласия**.

## Управление

При первом визите вы можете принять все cookies или только необходимые. Изменить выбор можно, очистив cookies браузера и обновив страницу — снова появится плашка согласия.

Подробнее о персональных данных — в [политике конфиденциальности](/privacy).`,
  termsTitle: "Условия использования",
  termsUpdatedAt: SEED_AT,
  termsBody: SEED_TERMS_BODY,
  bannerTitle: "Мы используем cookies",
  bannerBody:
    "Необходимые cookies нужны для работы сайта. Аналитические — только с вашего согласия. Подробнее в политике cookies.",
};

export const seedAdTariffs: AdTariff[] = [
  {
    id: "tar_header",
    placement: "header",
    type: "banner",
    title: "Баннер под шапкой",
    description:
      "Горизонтальный баннер сразу под топбаром на всех публичных страницах.",
    sizeLabel: "1200×90",
    price: 25000,
    period: "week",
    currency: "RUB",
    features: [
      "Весь сайт",
      "Случайная ротация при нескольких креативах",
      "Статистика показов и кликов",
    ],
    active: true,
    sortOrder: 10,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_dashboard",
    placement: "dashboard",
    type: "banner",
    title: "Баннер над курсами",
    description: "Баннер на главной странице над таблицей предложений.",
    sizeLabel: "1200×120",
    price: 35000,
    period: "week",
    currency: "RUB",
    features: [
      "Главная страница",
      "Максимальный охват при выборе пары",
      "Статистика CTR",
    ],
    active: true,
    sortOrder: 20,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_home_mid",
    placement: "home_mid",
    type: "banner",
    title: "Баннер между курсами и новостями",
    description:
      "Баннер на главной после таблицы курсов — второй контакт, когда пользователь уже смотрел предложения.",
    sizeLabel: "1200×120",
    price: 28000,
    period: "week",
    currency: "RUB",
    features: [
      "Только главная",
      "После таблицы курсов",
      "Статистика CTR",
    ],
    active: true,
    sortOrder: 25,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_pair_after",
    placement: "pair_after",
    type: "banner",
    title: "Баннер на странице пары",
    description:
      "Баннер на SEO-страницах направлений после таблицы курсов, до FAQ.",
    sizeLabel: "1200×90",
    price: 22000,
    period: "week",
    currency: "RUB",
    features: [
      "Страницы /rates/…",
      "Целевой трафик по направлению",
      "Статистика CTR",
    ],
    active: true,
    sortOrder: 28,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_exchanger_page",
    placement: "exchanger_page",
    type: "banner",
    title: "Баннер на карточке обменника",
    description:
      "Баннер на странице обменника между описанием и отзывами.",
    sizeLabel: "1200×90",
    price: 20000,
    period: "week",
    currency: "RUB",
    features: [
      "Страницы /exchangers/…",
      "Аудитория, сравнивающая обменники",
      "Статистика CTR",
    ],
    active: true,
    sortOrder: 29,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_footer",
    placement: "footer",
    type: "banner",
    title: "Баннер внизу страницы",
    description: "Крупный баннер в футере публичных страниц.",
    sizeLabel: "970×250",
    price: 18000,
    period: "week",
    currency: "RUB",
    features: ["Все публичные страницы", "Большой креатив", "Статистика"],
    active: true,
    sortOrder: 30,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_ticker",
    placement: "ticker",
    type: "ticker",
    title: "Бегущая строка",
    description: "Текстовая полоса под шапкой с ссылкой на ваш сайт.",
    sizeLabel: "текст до 120 символов",
    price: 12000,
    period: "week",
    currency: "RUB",
    features: ["Весь сайт", "Быстрый запуск без макета", "Ссылка на сайт"],
    active: true,
    sortOrder: 40,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_exchangers",
    placement: "exchangers",
    type: "highlight",
    title: "Выделение в списке обменников",
    description: "Подсветка карточки обменника на странице /exchangers.",
    sizeLabel: "без баннера",
    price: 15000,
    period: "week",
    currency: "RUB",
    features: [
      "Страница списка обменников",
      "Привязка к вашему обменнику",
      "Повышенная заметность",
    ],
    active: true,
    sortOrder: 50,
    updatedAt: SEED_AT,
  },
  {
    id: "tar_rates",
    placement: "rates",
    type: "rates_pin",
    title: "Закреп в таблице курсов",
    description:
      "Ваш обменник поднимается в таблице курсов — на всех парах или только на выбранных.",
    sizeLabel: "без баннера",
    price: 40000,
    period: "week",
    currency: "RUB",
    features: [
      "Главная и страницы пар",
      "Область: везде или выбранные пары",
      "Закреп поверх органической сортировки",
      "Максимальная конверсия в переход",
    ],
    active: true,
    sortOrder: 60,
    updatedAt: SEED_AT,
  },
];

/** Insert any seed tariffs that are missing (safe for already-seeded DBs). */
export async function ensureMissingAdTariffs(db: Db): Promise<void> {
  if (!seedAdTariffs.length) return;
  await db
    .insert(adTariffs)
    .values(
      seedAdTariffs.map((t) => ({
        id: t.id,
        placement: t.placement,
        type: t.type,
        title: t.title,
        description: t.description,
        sizeLabel: t.sizeLabel,
        price: t.price,
        period: t.period,
        currency: t.currency,
        features: t.features,
        active: t.active,
        sortOrder: t.sortOrder,
        updatedAt: t.updatedAt,
      })),
    )
    .onConflictDoNothing({ target: adTariffs.id });
}

/** Backfill terms of use when column exists but body is empty. */
export async function ensureLegalTerms(db: Db): Promise<void> {
  const [row] = await db.select().from(legal).where(eq(legal.id, 1)).limit(1);
  if (!row) {
    await db
      .insert(legal)
      .values({ id: 1, ...seedLegal })
      .onConflictDoNothing();
    return;
  }
  if (typeof row.termsBody === "string" && row.termsBody.trim()) return;
  await db
    .update(legal)
    .set({
      termsTitle: seedLegal.termsTitle,
      termsBody: seedLegal.termsBody,
      termsUpdatedAt: seedLegal.termsUpdatedAt,
    })
    .where(eq(legal.id, 1));
}

export async function ensureSeeded(db: Db): Promise<void> {
  const [meta] = await db.select().from(appMeta).where(eq(appMeta.id, 1)).limit(1);
  if (meta?.seededAt) return;

  const [exCount] = await db.select({ n: count() }).from(exchangers);
  if ((exCount?.n ?? 0) > 0) {
    await db
      .insert(appMeta)
      .values({ id: 1, lastGlobalSyncAt: null, seededAt: new Date() })
      .onConflictDoUpdate({
        target: appMeta.id,
        set: { seededAt: new Date() },
      });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(exchangers).values({
      id: seedExchanger.id,
      slug: seedExchanger.slug,
      name: seedExchanger.name,
      website: seedExchanger.website,
      exchangeUrlTemplate: seedExchanger.exchangeUrlTemplate,
      feedUrl: seedExchanger.feedUrl,
      contact: seedExchanger.contact,
      description: seedExchanger.description,
      status: seedExchanger.status,
      verified: seedExchanger.verified,
      rating: seedExchanger.rating,
      reviews: seedExchanger.reviews,
      reviewsPositive: seedExchanger.reviewsPositive,
      reviewsNegative: seedExchanger.reviewsNegative,
      ageYears: seedExchanger.ageYears,
      createdAt: seedExchanger.createdAt,
      approvedAt: seedExchanger.approvedAt,
      lastSyncAt: seedExchanger.lastSyncAt,
      lastError: seedExchanger.lastError,
      pairCount: seedExchanger.pairCount,
      achievementIds: seedExchanger.achievementIds,
      logoFormat: null,
      logoUpdatedAt: null,
      logoData: null,
      traffic: seedExchanger.traffic,
      bannerToken: seedExchanger.bannerToken,
      bannerCheck: seedExchanger.bannerCheck,
      ownerLogin: seedExchanger.ownerLogin,
      ownerPasswordHash: seedExchanger.ownerPasswordHash,
      ownerEmail: seedExchanger.ownerEmail,
      ownerTotpSecret: null,
      ownerTotpEnabled: false,
      apiId: seedExchanger.apiId,
    });

    if (seedBlacklist.length) {
      await tx.insert(blacklist).values(seedBlacklist);
    }
    if (seedQualityTags.length) {
      await tx.insert(qualityTags).values(seedQualityTags);
    }
    if (seedAdTariffs.length) {
      await tx.insert(adTariffs).values(
        seedAdTariffs.map((t) => ({
          id: t.id,
          placement: t.placement,
          type: t.type,
          title: t.title,
          description: t.description,
          sizeLabel: t.sizeLabel,
          price: t.price,
          period: t.period,
          currency: t.currency,
          features: t.features,
          active: t.active,
          sortOrder: t.sortOrder,
          updatedAt: t.updatedAt,
        })),
      );
    }

    await tx.insert(adPricing).values({
      id: 1,
      contact: seedAdPricing.contact,
      intro: seedAdPricing.intro,
      note: seedAdPricing.note,
    });

    await tx.insert(seo).values({
      id: 1,
      siteName: seedSeo.siteName,
      siteUrl: seedSeo.siteUrl,
      titleDefault: seedSeo.titleDefault,
      titleTemplate: seedSeo.titleTemplate,
      description: seedSeo.description,
      keywords: seedSeo.keywords,
      ogTitle: seedSeo.ogTitle,
      ogDescription: seedSeo.ogDescription,
      ogImageUrl: seedSeo.ogImageUrl,
      twitterCard: seedSeo.twitterCard,
      twitterHandle: seedSeo.twitterHandle,
      robotsIndex: seedSeo.robotsIndex,
      robotsFollow: seedSeo.robotsFollow,
      robotsExtra: seedSeo.robotsExtra,
      robotsTxtExtra: seedSeo.robotsTxtExtra,
      sitemapEnabled: seedSeo.sitemapEnabled,
      noindexPaths: seedSeo.noindexPaths,
      googleVerification: seedSeo.googleVerification,
      yandexVerification: seedSeo.yandexVerification,
      bingVerification: seedSeo.bingVerification,
      jsonLdEnabled: seedSeo.jsonLdEnabled,
      organizationName: seedSeo.organizationName,
      organizationLogoUrl: seedSeo.organizationLogoUrl,
      contactEmail: seedSeo.contactEmail,
      contactTelegram: seedSeo.contactTelegram,
      googleAnalyticsId: seedSeo.googleAnalyticsId,
      yandexMetricaId: seedSeo.yandexMetricaId,
      gtmId: seedSeo.gtmId,
    });

    await tx.insert(legal).values({
      id: 1,
      privacyTitle: seedLegal.privacyTitle,
      privacyBody: seedLegal.privacyBody,
      privacyUpdatedAt: seedLegal.privacyUpdatedAt,
      cookieTitle: seedLegal.cookieTitle,
      cookieBody: seedLegal.cookieBody,
      cookieUpdatedAt: seedLegal.cookieUpdatedAt,
      termsTitle: seedLegal.termsTitle,
      termsBody: seedLegal.termsBody,
      termsUpdatedAt: seedLegal.termsUpdatedAt,
      bannerTitle: seedLegal.bannerTitle,
      bannerBody: seedLegal.bannerBody,
    });

    await tx
      .insert(appMeta)
      .values({ id: 1, lastGlobalSyncAt: null, seededAt: new Date() })
      .onConflictDoUpdate({
        target: appMeta.id,
        set: { seededAt: new Date() },
      });
  });
}
