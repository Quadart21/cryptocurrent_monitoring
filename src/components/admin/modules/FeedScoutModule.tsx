"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminTabBar,
} from "@/components/admin/ui";
import type {
  FeedScoutSettingsPublic,
  FeedScoutSubmission,
  FeedScoutWorker,
} from "@/lib/feed-scout/types";

type TabId = "overview" | "workers" | "submissions" | "settings";

type Snapshot = {
  settings: FeedScoutSettingsPublic;
  workers: FeedScoutWorker[];
  submissions: FeedScoutSubmission[];
  webhook: {
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage?: string;
    expectedUrl: string;
  };
  env: { hasBotToken: boolean; hasXrocketPayKey: boolean };
  stats: {
    workers: number;
    activeWorkers: number;
    acceptedTotal: number;
    paidTotal: number;
    failedPayouts: number;
  };
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "workers", label: "Воркеры" },
  { id: "submissions", label: "Сдачи" },
  { id: "settings", label: "Настройки" },
];

const inputClass =
  "w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

function payoutLabel(status: string): string {
  if (status === "paid") return "Выплачено";
  if (status === "failed") return "Ошибка";
  return "Нет";
}

export function FeedScoutModule() {
  const { busy, setBusy, can } = useAdmin();
  const canWrite = can("feed_scout.write");
  const [tab, setTab] = useState<TabId>("overview");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [botToken, setBotToken] = useState("");
  const [xrocketKey, setXrocketKey] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("1");
  const [payoutCurrency, setPayoutCurrency] = useState("USDT");
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/feed-scout?view=snapshot");
    if (!res.ok) {
      setError("Не удалось загрузить Feed Scout");
      return;
    }
    const data = (await res.json()) as Snapshot;
    setSnap(data);
    setPayoutAmount(String(data.settings.payoutAmount));
    setPayoutCurrency(data.settings.payoutCurrency);
    setEnabled(data.settings.enabled);
    setError(null);
  }, []);

  useEffect(() => {
    // Initial admin snapshot fetch (same pattern as other admin modules).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets remote snapshot into state
    void load();
  }, [load]);

  async function runAction(
    body: Record<string, unknown>,
    okMessage?: string,
  ): Promise<boolean> {
    if (!canWrite) return false;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/feed-scout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        connection?: { ok: boolean; username?: string; error?: string };
        xrocket?: {
          ok: boolean;
          appName?: string;
          balances?: Array<{ currency: string; balance: number }>;
          error?: string;
        };
        result?: { ok: boolean; url?: string; error?: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Ошибка запроса");
        return false;
      }
      if (data.connection) {
        setInfo(
          data.connection.ok
            ? `Бот OK: @${data.connection.username || "?"}`
            : `Бот: ${data.connection.error ?? "ошибка"}`,
        );
      } else if (data.xrocket) {
        if (data.xrocket.ok) {
          const bals = (data.xrocket.balances ?? [])
            .map((b) => `${b.balance} ${b.currency}`)
            .join(", ");
          setInfo(
            `xRocket OK: ${data.xrocket.appName ?? "app"}${bals ? ` (${bals})` : ""}`,
          );
        } else {
          setInfo(`xRocket: ${data.xrocket.error ?? "ошибка"}`);
        }
      } else if (data.result) {
        setInfo(
          data.result.ok
            ? `Webhook: ${data.result.url ?? "OK"}`
            : data.result.error ?? "Ошибка webhook",
        );
      } else if (okMessage) {
        setInfo(okMessage);
      }
      await load();
      return true;
    } catch {
      setError("Сеть / сервер недоступны");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Некорректная сумма выплаты");
      return;
    }
    await runAction(
      {
        action: "settings",
        settings: {
          ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
          ...(xrocketKey.trim() ? { xrocketPayKey: xrocketKey.trim() } : {}),
          payoutAmount: amount,
          payoutCurrency: payoutCurrency.trim() || "USDT",
          enabled,
        },
      },
      "Настройки сохранены",
    );
    setBotToken("");
    setXrocketKey("");
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Feed Scout"
        description="Telegram-бот для сбора XML-фидов: проверка, добавление обменников и выплаты через xRocket."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-xl border border-line px-3.5 py-2 text-sm text-ink-muted hover:bg-bg-soft"
          >
            Обновить
          </button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {info}
        </p>
      ) : null}

      <AdminTabBar tabs={TABS} value={tab} onChange={setTab} />

      {!snap ? (
        <p className="text-sm text-ink-muted">Загрузка…</p>
      ) : (
        <>
          {tab === "overview" ? (
            <div className="space-y-5">
              <AdminStatGrid
                items={[
                  {
                    label: "Воркеры",
                    value: `${snap.stats.activeWorkers}/${snap.stats.workers}`,
                  },
                  {
                    label: "Принято ссылок",
                    value: snap.stats.acceptedTotal,
                  },
                  {
                    label: "Выплачено",
                    value: `${snap.stats.paidTotal} ${snap.settings.payoutCurrency}`,
                    tone: "ok",
                  },
                  {
                    label: "Ошибки выплат",
                    value: snap.stats.failedPayouts,
                    tone: snap.stats.failedPayouts > 0 ? "warn" : undefined,
                  },
                ]}
              />
              <AdminSection
                title="Статус"
                description="Бот, webhook и ставка"
              >
                <div className="space-y-3 px-5 py-4 text-sm">
                  <p>
                    Бот:{" "}
                    <span className="font-medium text-ink">
                      {snap.settings.hasBotToken
                        ? `@${snap.settings.botUsername || "?"} (${snap.settings.botTokenHint})`
                        : "не задан"}
                    </span>
                    {snap.settings.enabled ? (
                      <span className="ml-2 text-ok">включён</span>
                    ) : (
                      <span className="ml-2 text-warn">выключен</span>
                    )}
                  </p>
                  <p>
                    Ставка:{" "}
                    <span className="font-medium tabular-nums">
                      {snap.settings.payoutAmount} {snap.settings.payoutCurrency}
                    </span>
                  </p>
                  <p>
                    xRocket:{" "}
                    {snap.settings.hasXrocketPayKey
                      ? snap.settings.xrocketPayKeyHint
                      : "ключ не задан"}
                  </p>
                  <p className="break-all text-ink-muted">
                    Webhook: {snap.webhook.url || "не установлен"}
                    {snap.webhook.expectedUrl
                      ? ` (ожидается ${snap.webhook.expectedUrl})`
                      : ""}
                  </p>
                  {snap.webhook.lastErrorMessage ? (
                    <p className="text-warn">{snap.webhook.lastErrorMessage}</p>
                  ) : null}
                </div>
              </AdminSection>
            </div>
          ) : null}

          {tab === "workers" ? (
            <AdminSection title="Воркеры" description="Пользователи бота">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-bg-soft/50 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">TG</th>
                      <th className="px-4 py-3 font-medium">Имя</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Ссылок</th>
                      <th className="px-4 py-3 font-medium">Выплачено</th>
                      <th className="px-4 py-3 font-medium">Ошибки</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {snap.workers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-ink-muted"
                        >
                          Пока нет воркеров — они появятся после /start в боте
                        </td>
                      </tr>
                    ) : (
                      snap.workers.map((w) => (
                        <tr key={w.id} className="border-b border-line/70">
                          <td className="px-4 py-3 tabular-nums">
                            {w.username ? `@${w.username}` : w.tgUserId}
                          </td>
                          <td className="px-4 py-3">{w.firstName || "—"}</td>
                          <td className="px-4 py-3">
                            {w.status === "banned" ? (
                              <span className="text-danger">ban</span>
                            ) : (
                              <span className="text-ok">active</span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {w.acceptedCount}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {w.paidTotal} {snap.settings.payoutCurrency}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {w.failedPayouts}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canWrite ? (
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-bg-soft"
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: "setWorkerStatus",
                                      workerId: w.id,
                                      status:
                                        w.status === "banned"
                                          ? "active"
                                          : "banned",
                                    },
                                    w.status === "banned"
                                      ? "Воркер разбанен"
                                      : "Воркер забанен",
                                  )
                                }
                              >
                                {w.status === "banned" ? "Разбан" : "Бан"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          ) : null}

          {tab === "submissions" ? (
            <AdminSection title="Сдачи" description="Принятые XML-фиды">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-bg-soft/50 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Когда</th>
                      <th className="px-4 py-3 font-medium">Воркер</th>
                      <th className="px-4 py-3 font-medium">URL</th>
                      <th className="px-4 py-3 font-medium">Пары</th>
                      <th className="px-4 py-3 font-medium">Выплата</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {snap.submissions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-ink-muted"
                        >
                          Пока нет сдач
                        </td>
                      </tr>
                    ) : (
                      snap.submissions.map((s) => (
                        <tr key={s.id} className="border-b border-line/70">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">
                            {fmtDate(s.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            {s.workerUsername
                              ? `@${s.workerUsername}`
                              : s.workerTgUserId}
                          </td>
                          <td className="max-w-[280px] truncate px-4 py-3">
                            <a
                              href={s.feedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                              title={s.feedUrl}
                            >
                              {s.feedUrl}
                            </a>
                            {s.exchangerId ? (
                              <span className="mt-0.5 block text-[11px] text-ink-muted">
                                {s.exchangerId}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {s.pairCount}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                s.payoutStatus === "paid"
                                  ? "text-ok"
                                  : s.payoutStatus === "failed"
                                    ? "text-warn"
                                    : "text-ink-muted"
                              }
                            >
                              {payoutLabel(s.payoutStatus)}{" "}
                              <span className="tabular-nums">
                                {s.amount} {s.currency}
                              </span>
                            </span>
                            {s.payoutError ? (
                              <span
                                className="mt-0.5 block max-w-[200px] truncate text-[11px] text-warn"
                                title={s.payoutError}
                              >
                                {s.payoutError}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canWrite && s.payoutStatus === "failed" ? (
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-bg-soft"
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: "retryPayout",
                                      submissionId: s.id,
                                    },
                                    "Повтор выплаты выполнен",
                                  )
                                }
                              >
                                Retry
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          ) : null}

          {tab === "settings" ? (
            <div className="space-y-5">
              <AdminSection title="Параметры" description="Бот и выплаты">
                <form
                  onSubmit={(e) => void saveSettings(e)}
                  className="space-y-4 px-5 py-4"
                >
                  <Field
                    label="Bot token"
                    hint={
                      snap.settings.hasBotToken
                        ? `Сейчас: ${snap.settings.botTokenHint}${snap.env.hasBotToken ? " · в .env есть FEED_SCOUT_BOT_TOKEN" : ""}`
                        : snap.env.hasBotToken
                          ? "В .env есть FEED_SCOUT_BOT_TOKEN (подставится при первом запуске)"
                          : "Токен от @BotFather"
                    }
                  >
                    <input
                      className={inputClass}
                      type="password"
                      autoComplete="off"
                      placeholder={
                        snap.settings.hasBotToken
                          ? "Оставьте пустым, чтобы не менять"
                          : "123456:ABC..."
                      }
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      disabled={!canWrite || busy}
                    />
                  </Field>
                  <Field
                    label="xRocket Pay key"
                    hint={
                      snap.settings.hasXrocketPayKey
                        ? `Сейчас: ${snap.settings.xrocketPayKeyHint}`
                        : "Rocket Pay → Create App → API token"
                    }
                  >
                    <input
                      className={inputClass}
                      type="password"
                      autoComplete="off"
                      placeholder={
                        snap.settings.hasXrocketPayKey
                          ? "Оставьте пустым, чтобы не менять"
                          : "Rocket-Pay-Key"
                      }
                      value={xrocketKey}
                      onChange={(e) => setXrocketKey(e.target.value)}
                      disabled={!canWrite || busy}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Сумма за 1 ссылку">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.001"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        disabled={!canWrite || busy}
                      />
                    </Field>
                    <Field label="Валюта">
                      <input
                        className={inputClass}
                        value={payoutCurrency}
                        onChange={(e) => setPayoutCurrency(e.target.value)}
                        disabled={!canWrite || busy}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={!canWrite || busy}
                    onClick={() => setEnabled((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-line bg-bg-soft/30 px-4 py-3.5 text-left"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        Бот включён
                      </span>
                      <span className="text-xs text-ink-muted">
                        Выключенный бот отвечает, что сервис недоступен
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        enabled
                          ? "bg-ok/15 text-ok"
                          : "bg-warn/15 text-warn"
                      }`}
                    >
                      {enabled ? "ON" : "OFF"}
                    </span>
                  </button>
                  {canWrite ? (
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Сохранить
                    </button>
                  ) : null}
                </form>
              </AdminSection>

              <AdminSection title="Проверки и webhook">
                <div className="flex flex-wrap gap-2 px-5 py-4">
                  <button
                    type="button"
                    disabled={!canWrite || busy}
                    className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-bg-soft disabled:opacity-50"
                    onClick={() => void runAction({ action: "testBot" })}
                  >
                    Тест бота
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || busy}
                    className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-bg-soft disabled:opacity-50"
                    onClick={() => void runAction({ action: "testXrocket" })}
                  >
                    Тест xRocket
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || busy}
                    className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-bg-soft disabled:opacity-50"
                    onClick={() => void runAction({ action: "setWebhook" })}
                  >
                    Установить webhook
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || busy}
                    className="rounded-xl border border-line px-3.5 py-2 text-sm text-ink-muted hover:bg-bg-soft disabled:opacity-50"
                    onClick={() => void runAction({ action: "deleteWebhook" })}
                  >
                    Снять webhook
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || busy}
                    className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-bg-soft disabled:opacity-50"
                    onClick={() =>
                      void runAction(
                        {
                          action: "settings",
                          settings: { rotateWebhookSecret: true },
                        },
                        "Secret ротирован — заново установите webhook",
                      )
                    }
                  >
                    Ротация secret
                  </button>
                </div>
              </AdminSection>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
