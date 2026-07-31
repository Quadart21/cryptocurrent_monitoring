"use client";

import { useCallback, useEffect, useState } from "react";
import { summarizeUserAgent } from "@/lib/exchanger-traffic-ua";

export type TrafficEventRow = {
  id: string;
  event: "view" | "click";
  ip: string;
  userAgent: string;
  path: string;
  referrer: string;
  createdAt: string;
};

type Filter = "all" | "view" | "click";

export function TrafficEventsPanel({
  endpoint,
  pageSize = 40,
}: {
  /** Full URL with exchangerId already in query for admin, or /api/owner/traffic */
  endpoint: string;
  pageSize?: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<TrafficEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextOffset: number) => {
      setBusy(true);
      setError(null);
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(nextOffset));
        url.searchParams.set("sinceDays", "30");
        if (filter !== "all") url.searchParams.set("event", filter);
        const res = await fetch(url.pathname + url.search, { cache: "no-store" });
        const body = (await res.json()) as {
          events?: TrafficEventRow[];
          total?: number;
          error?: string;
        };
        if (!res.ok) {
          setError(body.error ?? "Не удалось загрузить");
          return;
        }
        setEvents(body.events ?? []);
        setTotal(body.total ?? 0);
        setOffset(nextOffset);
      } catch {
        setError("Сеть недоступна");
      } finally {
        setBusy(false);
      }
    },
    [endpoint, filter, pageSize],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Все"],
              ["view", "Просмотры"],
              ["click", "Переходы"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                filter === id
                  ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                  : "border border-line text-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {total ? `${offset + 1}–${Math.min(total, offset + events.length)} из ${total}` : "Нет событий"}
          <span className="text-ink-muted/70"> · 30 дней</span>
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-bg-soft text-ink-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Когда</th>
              <th className="px-3 py-2.5 font-medium">Тип</th>
              <th className="px-3 py-2.5 font-medium">IP</th>
              <th className="px-3 py-2.5 font-medium">Устройство</th>
              <th className="px-3 py-2.5 font-medium">Откуда</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-ink-muted">
                  {busy
                    ? "Загрузка…"
                    : "Пока пусто — появятся после просмотров и кликов «Перейти на сайт»."}
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="border-t border-line align-top">
                  <td className="px-3 py-2.5 tabular-nums text-ink whitespace-nowrap">
                    {new Date(ev.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                        ev.event === "click"
                          ? "bg-accent/15 text-accent"
                          : "bg-bg-soft text-ink-muted"
                      }`}
                    >
                      {ev.event === "click" ? "переход" : "просмотр"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink">
                    {ev.ip}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted" title={ev.userAgent}>
                    {summarizeUserAgent(ev.userAgent)}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-ink-muted" title={ev.referrer || ev.path}>
                    {ev.referrer
                      ? (() => {
                          try {
                            return new URL(ev.referrer).hostname;
                          } catch {
                            return ev.referrer.slice(0, 40);
                          }
                        })()
                      : ev.path || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy || offset <= 0}
            onClick={() => void load(Math.max(0, offset - pageSize))}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={busy || offset + pageSize >= total}
            onClick={() => void load(offset + pageSize)}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      ) : null}
    </div>
  );
}
