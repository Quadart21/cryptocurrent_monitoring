import type { OwnerExchanger } from "@/components/owner/OwnerProvider";

export type OwnerTabId =
  | "overview"
  | "banner"
  | "traffic"
  | "reviews"
  | "profile";

export const OWNER_TABS: Array<{
  id: OwnerTabId;
  label: string;
  short: string;
}> = [
  { id: "overview", label: "Обзор", short: "Обзор" },
  { id: "banner", label: "Баннер", short: "Баннер" },
  { id: "traffic", label: "Трафик", short: "Трафик" },
  { id: "reviews", label: "Отзывы", short: "Отзывы" },
  { id: "profile", label: "Профиль", short: "Профиль" },
];

export const OWNER_SUPPORT_TG = "GapSnapSupport";
export const OWNER_SUPPORT_TG_URL = `https://t.me/${OWNER_SUPPORT_TG}`;

export function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "В мониторинге";
    case "pending":
      return "На модерации";
    case "rejected":
      return "Отклонён";
    case "error":
      return "Ошибка фида";
    default:
      return status;
  }
}

export function statusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" {
  switch (status) {
    case "active":
      return "ok";
    case "pending":
    case "error":
      return "warn";
    case "rejected":
      return "danger";
    default:
      return "muted";
  }
}

export function statusHint(status: string): string {
  switch (status) {
    case "active":
      return "Курсы видны пользователям GapSnap. Следите за баннером и отвечайте на отзывы.";
    case "pending":
      return "Заявка ещё проверяется. После одобрения появятся баннер, статистика и ответы на отзывы.";
    case "rejected":
      return "Заявка отклонена. Напишите в поддержку — разберёмся и подскажем, что исправить.";
    case "error":
      return "Публикация есть, но XML-фид сейчас с ошибкой. Проверьте ссылку на фид или напишите нам.";
    default:
      return "Статус обменника на мониторинге.";
  }
}

export function canOwnerReply(status: string): boolean {
  return status === "active" || status === "error";
}

export function bannerTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" {
  switch (status) {
    case "Баннер найден":
      return "ok";
    case "Баннер не найден":
      return "danger";
    case "Ошибка проверки":
      return "warn";
    default:
      return "muted";
  }
}

export type OwnerChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  tab?: OwnerTabId;
  hint: string;
};

export function buildOwnerChecklist(
  ex: OwnerExchanger,
): OwnerChecklistItem[] {
  const bannerOk = ex.bannerStatus === "Баннер найден";
  const hasTraffic =
    ex.traffic.pageViews > 0 || ex.traffic.siteClicks > 0;
  const hasReviews = ex.reviews > 0;
  const feedOk = ex.status === "active" && !ex.lastError;

  return [
    {
      id: "moderation",
      title: "Пройти модерацию",
      done: ex.status === "active" || ex.status === "error",
      hint:
        ex.status === "pending"
          ? "Ожидаем проверку заявки"
          : ex.status === "rejected"
            ? "Нужна помощь поддержки"
            : "Готово",
    },
    {
      id: "banner",
      title: "Разместить баннер GapSnap",
      done: bannerOk,
      tab: "banner",
      hint: bannerOk
        ? "Баннер найден на сайте"
        : ex.bannerHtml
          ? "Скопируйте код и вставьте на сайт"
          : "Доступно после одобрения",
    },
    {
      id: "feed",
      title: "Держать XML-фид рабочим",
      done: feedOk,
      tab: "profile",
      hint: ex.lastError
        ? "Сейчас есть ошибка синхронизации"
        : ex.status === "active"
          ? "Синхронизация в порядке"
          : "Станет актуальным после одобрения",
    },
    {
      id: "traffic",
      title: "Смотреть переходы с мониторинга",
      done: hasTraffic,
      tab: "traffic",
      hint: hasTraffic
        ? "Уже есть просмотры или переходы"
        : "Появится, когда пользователи откроют карточку",
    },
    {
      id: "reviews",
      title: "Отвечать на отзывы",
      done: hasReviews,
      tab: "reviews",
      hint: hasReviews
        ? "Есть отзывы — ответьте на одобренные"
        : "Пока отзывов нет — это нормально",
    },
  ];
}

export function toneClass(tone: "ok" | "warn" | "danger" | "muted"): string {
  switch (tone) {
    case "ok":
      return "bg-ok/15 text-ok";
    case "warn":
      return "bg-warn/15 text-warn";
    case "danger":
      return "bg-danger/15 text-danger";
    default:
      return "bg-ink-muted/15 text-ink-muted";
  }
}
