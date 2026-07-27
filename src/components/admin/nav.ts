import { ADMIN_PATH } from "@/lib/admin-auth";
import type { AdminNavItem } from "@/components/admin/types";

export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: "overview",
    href: ADMIN_PATH,
    label: "Обзор",
    description: "Сводка и очередь задач",
  },
  {
    id: "exchangers",
    href: `${ADMIN_PATH}/exchangers`,
    label: "Обменники",
    description: "Заявки и статусы",
  },
  {
    id: "reviews",
    href: `${ADMIN_PATH}/reviews`,
    label: "Отзывы",
    description: "Модерация отзывов",
  },
  {
    id: "qualities",
    href: `${ADMIN_PATH}/qualities`,
    label: "Качества",
    description: "Теги для формы отзыва",
  },
  {
    id: "achievements",
    href: `${ADMIN_PATH}/achievements`,
    label: "Ачивки",
    description: "Иконки у названий",
  },
  {
    id: "ads",
    href: `${ADMIN_PATH}/ads`,
    label: "Реклама",
    description: "Баннеры и слоты",
  },
  {
    id: "ad-tariffs",
    href: `${ADMIN_PATH}/ad-tariffs`,
    label: "Тарифы рекламы",
    description: "Цены для /advertise",
  },
  {
    id: "seo",
    href: `${ADMIN_PATH}/seo`,
    label: "SEO",
    description: "Мета, robots, sitemap",
  },
  {
    id: "email",
    href: `${ADMIN_PATH}/email`,
    label: "Email",
    description: "Шаблоны, smtp.bz, журнал",
  },
  {
    id: "blacklist",
    href: `${ADMIN_PATH}/blacklist`,
    label: "Чёрный список",
    description: "Скам и жалобы",
  },
  {
    id: "sync",
    href: `${ADMIN_PATH}/sync`,
    label: "Синхронизация",
    description: "XML-фиды и статус",
  },
];
