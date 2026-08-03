"use client";

import type { OwnerExchanger } from "@/components/owner/OwnerProvider";
import { bannerTone } from "@/components/owner/owner-utils";
import {
  OwnerBadge,
  OwnerCopyButton,
  OwnerEmptyState,
  OwnerSectionCard,
} from "@/components/owner/OwnerUi";

export function OwnerBannerSection({
  exchanger,
}: {
  exchanger: OwnerExchanger;
}) {
  if (!exchanger.bannerHtml) {
    return (
      <OwnerSectionCard
        title="Баннер GapSnap"
        description="Код баннера появится после одобрения обменника."
      >
        <OwnerEmptyState
          title="Пока недоступно"
          description="Когда модерация завершится, здесь будет готовый HTML для вставки на сайт. Баннер обязателен по правилам мониторинга."
        />
      </OwnerSectionCard>
    );
  }

  const check = exchanger.bannerCheck;
  const lastCheck = check?.lastCheckAt
    ? new Date(check.lastCheckAt).toLocaleString("ru-RU")
    : null;

  return (
    <div className="space-y-5">
      <OwnerSectionCard
        title="Баннер GapSnap"
        description="Разместите кнопку на сайте обменника (обычно в футере). Мы раз в сутки проверяем, что она на месте."
        action={
          <OwnerBadge tone={bannerTone(exchanger.bannerStatus)}>
            {exchanger.bannerStatus}
          </OwnerBadge>
        }
      >
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            {
              n: "1",
              title: "Скопируйте код",
              text: "Готовый HTML ниже — одной кнопкой.",
            },
            {
              n: "2",
              title: "Вставьте на сайт",
              text: "Футер или страница «О нас» — главное, чтобы код был в HTML.",
            },
            {
              n: "3",
              title: "Мы проверим",
              text: "Автопроверка раз в сутки. Статус обновится здесь.",
            },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-line bg-bg-soft/40 p-4"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {step.n}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-bg-soft/30 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/badge/${exchanger.bannerToken}`}
            alt="Превью баннера GapSnap"
            width={88}
            height={31}
            className="rounded"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Так увидят посетители</p>
            <p className="mt-1 text-xs text-ink-muted">
              {lastCheck
                ? `Последняя проверка: ${lastCheck}`
                : "Проверка ещё не выполнялась"}
              {typeof check?.consecutiveMisses === "number"
                ? ` · пропусков подряд: ${check.consecutiveMisses}`
                : ""}
            </p>
          </div>
          <OwnerCopyButton text={exchanger.bannerHtml} label="Скопировать HTML" />
        </div>

        <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-bg p-3 text-[11px] leading-relaxed text-ink sm:text-xs">
          {exchanger.bannerHtml}
        </pre>

        {exchanger.bannerStatus === "Баннер не найден" ? (
          <p className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            Кнопка на сайте не найдена. Убедитесь, что код вставлен без изменений
            (включая <code className="text-xs">data-gapsnap-badge</code>) и
            страница доступна без авторизации.
          </p>
        ) : null}
      </OwnerSectionCard>
    </div>
  );
}
