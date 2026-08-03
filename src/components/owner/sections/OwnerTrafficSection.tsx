"use client";

import { TrafficEventsPanel } from "@/components/TrafficEventsPanel";
import type { OwnerExchanger } from "@/components/owner/OwnerProvider";
import {
  OwnerSectionCard,
  OwnerStatCard,
} from "@/components/owner/OwnerUi";

export function OwnerTrafficSection({
  exchanger,
}: {
  exchanger: OwnerExchanger;
}) {
  const daily = exchanger.traffic.daily;

  return (
    <div className="space-y-5">
      <OwnerSectionCard
        title="Трафик с GapSnap"
        description="Сколько людей открыли вашу карточку на мониторинге и перешли на сайт обменника."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OwnerStatCard
            label="Просмотры"
            value={String(exchanger.traffic.pageViews)}
            hint="Открытия страницы обменника"
          />
          <OwnerStatCard
            label="Переходы"
            value={String(exchanger.traffic.siteClicks)}
            hint="Клики на сайт / обмен"
          />
          <OwnerStatCard
            label="Конверсия"
            value={exchanger.traffic.ctr}
            hint="Переходы ÷ просмотры"
          />
          <OwnerStatCard
            label="Направлений в фиде"
            value={String(exchanger.pairCount)}
            hint={
              exchanger.lastSyncAt
                ? `Синхронизация: ${new Date(exchanger.lastSyncAt).toLocaleString("ru-RU")}`
                : "Синхронизации ещё не было"
            }
          />
        </div>

        {daily.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            {/* Desktop table */}
            <table className="hidden w-full min-w-[420px] text-left text-sm md:table">
              <thead>
                <tr className="border-b border-line bg-bg-soft/50 text-xs uppercase tracking-[0.12em] text-ink-muted">
                  <th className="px-4 py-3 font-medium">День</th>
                  <th className="px-4 py-3 font-medium">Просмотры</th>
                  <th className="px-4 py-3 font-medium">Переходы</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.date} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 tabular-nums text-ink">{row.date}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink">
                      {row.pageViews}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-ink">
                      {row.siteClicks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {daily.map((row) => (
                <li
                  key={row.date}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm tabular-nums text-ink">{row.date}</span>
                  <span className="text-xs text-ink-muted">
                    <span className="tabular-nums text-ink">{row.pageViews}</span>{" "}
                    просм. ·{" "}
                    <span className="tabular-nums text-ink">{row.siteClicks}</span>{" "}
                    перех.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink-muted">
            Пока нет данных по дням — статистика появится после первых визитов.
          </p>
        )}
      </OwnerSectionCard>

      <OwnerSectionCard
        title="Журнал визитов"
        description="Каждый просмотр карточки и клик «Перейти на сайт» за последние 30 дней."
      >
        <TrafficEventsPanel endpoint="/api/owner/traffic" />
      </OwnerSectionCard>
    </div>
  );
}
