import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description:
    "Как GapSnap обрабатывает персональные данные пользователей и владельцев обменников.",
};

export default function PrivacyPage() {
  return (
    <article className="prose-gap mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "Конфиденциальность" },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold text-ink">
        Политика конфиденциальности
      </h1>
      <p className="text-sm text-ink-muted">Редакция от 28 июля 2026 г.</p>
      <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
        <p>
          GapSnap («мы») — сервис мониторинга курсов обменников. Мы не проводим
          обмен валют и не храним средства пользователей.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          Какие данные собираем
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Email при подтверждении отзыва или заявке обменника</li>
          <li>Технические логи (IP, User-Agent) для безопасности</li>
          <li>Cookies для сессии админки/кабинета и темы оформления</li>
          <li>Анонимная аналитика (если подключена Метрика/GA4)</li>
        </ul>
        <h2 className="font-display text-lg font-semibold text-ink">
          Зачем
        </h2>
        <p>
          Для модерации отзывов, связи с владельцами обменников, защиты от
          злоупотреблений и улучшения сервиса.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          Передача третьим лицам
        </h2>
        <p>
          Данные не продаём. Могут обрабатываться хостинг-провайдером и сервисами
          почты/аналитики по вашему поручению конфигурации.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          Контакты
        </h2>
        <p>
          По вопросам персональных данных используйте контакт из раздела
          рекламы/заявки на сайте.
        </p>
      </div>
    </article>
  );
}
