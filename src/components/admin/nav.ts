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
  },
  {
    id: "exchangers",
    href: `${ADMIN_PATH}/exchangers`,
    label: "Обменники",
    description: "Заявки и статусы",
    group: "moderation",
    badge: "pending",
  },
  {
    id: "reviews",
    href: `${ADMIN_PATH}/reviews`,
    label: "Отзывы",
    description: "Модерация отзывов",
    group: "moderation",
    badge: "pendingReviews",
  },
  {
    id: "complaints",
    href: `${ADMIN_PATH}/complaints`,
    label: "Жалобы",
    description: "Очередь жалоб на обменники",
    group: "moderation",
    badge: "pendingComplaints",
  },
  {
    id: "blacklist",
    href: `${ADMIN_PATH}/blacklist`,
    label: "Чёрный список",
    description: "Скам и жалобы",
    group: "moderation",
  },
  {
    id: "banners",
    href: `${ADMIN_PATH}/banners`,
    label: "Баннеры",
    description: "Кнопка GapSnap на сайтах",
    group: "moderation",
    badge: "bannerMissing",
  },
  {
    id: "blog",
    href: `${ADMIN_PATH}/blog`,
    label: "Новости",
    description: "Публикации и AI-импорт",
    group: "content",
  },
  {
    id: "qualities",
    href: `${ADMIN_PATH}/qualities`,
    label: "Качества",
    description: "Теги для отзывов",
    group: "content",
  },
  {
    id: "achievements",
    href: `${ADMIN_PATH}/achievements`,
    label: "Ачивки",
    description: "Иконки у обменников",
    group: "content",
  },
  {
    id: "ads",
    href: `${ADMIN_PATH}/ads`,
    label: "Креативы",
    description: "Баннеры и закрепы",
    group: "ads",
  },
  {
    id: "ad-tariffs",
    href: `${ADMIN_PATH}/ad-tariffs`,
    label: "Тарифы",
    description: "Цены на /advertise",
    group: "ads",
  },
  {
    id: "seo",
    href: `${ADMIN_PATH}/seo`,
    label: "SEO",
    description: "Мета, robots, sitemap",
    group: "site",
  },
  {
    id: "legal",
    href: `${ADMIN_PATH}/legal`,
    label: "Правовые",
    description: "Политики и cookies",
    group: "site",
  },
  {
    id: "email",
    href: `${ADMIN_PATH}/email`,
    label: "Email",
    description: "Шаблоны и журнал",
    group: "site",
  },
  {
    id: "catalog",
    href: `${ADMIN_PATH}/catalog`,
    label: "Каталог",
    description: "Валюты и города",
    group: "data",
  },
  {
    id: "sync",
    href: `${ADMIN_PATH}/sync`,
    label: "Синхронизация",
    description: "Фиды и новые коды",
    group: "data",
    badge: "syncQueue",
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
  if (badge === "bannerMissing") return counts.bannerMissing;
  if (badge === "syncQueue") {
    return counts.pendingCatalog;
  }
  return 0;
}
