import { ADMIN_PATH } from "@/lib/admin-auth";
import type {
  AdminCounts,
  AdminNavBadge,
  AdminNavGroup,
  AdminNavItem,
} from "@/components/admin/types";

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { id: "main", label: "Главное" },
  { id: "moderation", label: "Модерация" },
  { id: "content", label: "Контент" },
  { id: "ads", label: "Реклама" },
  { id: "site", label: "Сайт" },
  { id: "data", label: "Данные" },
];

export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: "overview",
    href: ADMIN_PATH,
    label: "Обзор",
    description: "Сводка и очередь",
    group: "main",
    permission: "overview",
  },
  {
    id: "exchangers",
    href: `${ADMIN_PATH}/exchangers`,
    label: "Обменники",
    description: "Заявки и статусы",
    group: "moderation",
    badge: "pending",
    permission: "exchangers.read",
  },
  {
    id: "reviews",
    href: `${ADMIN_PATH}/reviews`,
    label: "Отзывы",
    description: "Модерация отзывов",
    group: "moderation",
    badge: "pendingReviews",
    permission: "reviews.read",
  },
  {
    id: "complaints",
    href: `${ADMIN_PATH}/complaints`,
    label: "Жалобы",
    description: "Очередь жалоб на обменники",
    group: "moderation",
    badge: "pendingComplaints",
    permission: "complaints.read",
  },
  {
    id: "blacklist",
    href: `${ADMIN_PATH}/blacklist`,
    label: "Чёрный список",
    description: "Скам и жалобы",
    group: "moderation",
    permission: "blacklist.read",
  },
  {
    id: "banners",
    href: `${ADMIN_PATH}/banners`,
    label: "Баннеры",
    description: "Кнопка GapSnap на сайтах",
    group: "moderation",
    badge: "bannerMissing",
    permission: "banners.read",
  },
  {
    id: "api-clients",
    href: `${ADMIN_PATH}/api-clients`,
    label: "API-ключи",
    description: "Заявки на доступ к API",
    group: "moderation",
    badge: "pendingApiClients",
    permission: "api_clients.read",
  },
  {
    id: "blog",
    href: `${ADMIN_PATH}/blog`,
    label: "Новости",
    description: "Публикации и AI-импорт",
    group: "content",
    permission: "blog.read",
  },
  {
    id: "qualities",
    href: `${ADMIN_PATH}/qualities`,
    label: "Качества",
    description: "Теги для отзывов",
    group: "content",
    permission: "qualities.read",
  },
  {
    id: "achievements",
    href: `${ADMIN_PATH}/achievements`,
    label: "Ачивки",
    description: "Иконки у обменников",
    group: "content",
    permission: "achievements.read",
  },
  {
    id: "ads",
    href: `${ADMIN_PATH}/ads`,
    label: "Креативы",
    description: "Баннеры и закрепы",
    group: "ads",
    permission: "ads.read",
  },
  {
    id: "ad-tariffs",
    href: `${ADMIN_PATH}/ad-tariffs`,
    label: "Тарифы",
    description: "Цены на /advertise",
    group: "ads",
    permission: "ad_tariffs.read",
  },
  {
    id: "seo",
    href: `${ADMIN_PATH}/seo`,
    label: "SEO",
    description: "Мета, контакты, robots",
    group: "site",
    permission: "seo.read",
  },
  {
    id: "branding",
    href: `${ADMIN_PATH}/branding`,
    label: "Брендинг",
    description: "Лого, фавиконы, OG",
    group: "site",
    permission: "branding.read",
  },
  {
    id: "legal",
    href: `${ADMIN_PATH}/legal`,
    label: "Правовые",
    description: "Политики и cookies",
    group: "site",
    permission: "legal.read",
  },
  {
    id: "email",
    href: `${ADMIN_PATH}/email`,
    label: "Email",
    description: "Шаблоны и журнал",
    group: "site",
    permission: "email.read",
  },
  {
    id: "admins",
    href: `${ADMIN_PATH}/admins`,
    label: "Админы",
    description: "Учётки, роли и 2FA",
    group: "site",
    permission: "admins.read",
  },
  {
    id: "catalog",
    href: `${ADMIN_PATH}/catalog`,
    label: "Каталог",
    description: "Валюты и города",
    group: "data",
    permission: "catalog.read",
  },
  {
    id: "sync",
    href: `${ADMIN_PATH}/sync`,
    label: "Синхронизация",
    description: "Фиды и новые коды",
    group: "data",
    badge: "syncQueue",
    permission: "sync.read",
  },
];

export function adminNavBadgeCount(
  badge: AdminNavBadge | undefined,
  counts: AdminCounts | null,
): number {
  if (!badge || !counts) return 0;
  if (badge === "pending") return counts.pending;
  if (badge === "pendingReviews") return counts.pendingReviews;
  if (badge === "pendingComplaints") return counts.pendingComplaints ?? 0;
  if (badge === "pendingCatalog") return counts.pendingCatalog;
  if (badge === "pendingApiClients") return counts.pendingApiClients ?? 0;
  if (badge === "bannerMissing") return counts.bannerMissing;
  if (badge === "syncQueue") {
    return counts.pendingCatalog;
  }
  return 0;
}
