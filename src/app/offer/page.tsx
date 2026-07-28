import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description:
    "Условия использования мониторинга GapSnap для посетителей и владельцев обменников.",
};

export default function OfferPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[{ href: "/", label: "Главная" }, { label: "Оферта" }]}
      />
      <h1 className="font-display text-3xl font-semibold text-ink">
        Публичная оферта
      </h1>
      <p className="text-sm text-ink-muted">Редакция от 28 июля 2026 г.</p>
      <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Используя сайт GapSnap, вы принимаете условия настоящей оферты.
          Сервис предоставляет информационный мониторинг курсов на основе
          XML-фидов обменников.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          1. Предмет
        </h2>
        <p>
          GapSnap не является стороной сделки обмена, платёжным агентом или
          гарантом. Все операции совершаются на сайтах обменников.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          2. Точность данных
        </h2>
        <p>
          Курсы и резервы обновляются по мере опроса фидов и могут отличаться от
          фактических на момент перехода. Перед обменом сверяйте условия на
          стороне обменника.
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          3. Реклама и партнёрство
        </h2>
        <p>
          Платное размещение регулируется отдельными договорённостями.
          Партнёрская программа может быть доступна на странице{" "}
          <a href="/partners" className="text-accent hover:underline">
            /partners
          </a>
          .
        </p>
        <h2 className="font-display text-lg font-semibold text-ink">
          4. Ответственность
        </h2>
        <p>
          Мы не несём ответственность за действия третьих лиц, убытки от обмена
          и простои из‑за сбоев сети/фидов.
        </p>
      </div>
    </article>
  );
}
