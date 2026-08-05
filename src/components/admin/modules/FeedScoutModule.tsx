"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminDrawer,
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
type WorkerFilter = "all" | "active" | "banned" | "exhausted" | "unlimited";
type PayoutFilter = "all" | "paid" | "failed" | "none";

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
  xrocket?: {
    ok: boolean;
    appName?: string;
    balances?: Array<{ currency: string; balance: number }>;
    error?: string;
  };
  env: { hasBotToken: boolean; hasXrocketPayKey: boolean };
  stats: {
    workers: number;
    activeWorkers: number;
    bannedWorkers: number;
    exhaustedWorkers: number;
    acceptedTotal: number;
    paidTotal: number;
    failedPayouts: number;
    failedPayoutsNow: number;
    budgetReserved: number;
    freeUsdt: number | null;
    usdtBalance: number | null;
    payoutAmount: number;
    payoutCurrency: string;
    balanceLinkCapacity: number | null;
    freeLinkCapacity: number | null;
  };
};

const TABS: Array<{ id: TabId; label: string; badge?: number }> = [
  { id: "overview", label: "Обзор" },
  { id: "workers", label: "Воркеры" },
  { id: "submissions", label: "Сдачи" },
  { id: "settings", label: "Настройки" },
];

const inputClass =
  "w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15";
const btnGhost =
  "rounded-xl border border-line px-3 py-2 text-sm text-ink-muted transition hover:bg-bg-soft hover:text-ink disabled:opacity-50";
const btnAccent =
  "rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50";
const btnTiny =
  "rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-bg-soft disabled:opacity-50";

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
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtMoney(n: number, currency: string): string {
  const rounded = Math.round(n * 1000) / 1000;
  return `${rounded} ${currency}`;
}

function workerLabel(w: Pick<FeedScoutWorker, "username" | "tgUserId" | "firstName">) {
  return w.username ? `@${w.username}` : w.tgUserId;
}

function payoutTone(status: string): string {
  if (status === "paid") return "text-ok";
  if (status === "failed") return "text-warn";
  return "text-ink-muted";
}

function payoutLabel(status: string): string {
  if (status === "paid") return "Выплачено";
  if (status === "failed") return "Ошибка";
  return "Ожидает";
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
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

  const [workerQ, setWorkerQ] = useState("");
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>("all");
  const [subQ, setSubQ] = useState("");
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>("all");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const [drawerWorkerId, setDrawerWorkerId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [grantDraft, setGrantDraft] = useState("10");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial admin snapshot
    void load();
  }, [load]);

  const drawerWorker = useMemo(
    () => snap?.workers.find((w) => w.id === drawerWorkerId) ?? null,
    [snap, drawerWorkerId],
  );

  function openWorkerDrawer(id: string) {
    const w = snap?.workers.find((row) => row.id === id);
    setNoteDraft(w?.adminNote ?? "");
    setDrawerWorkerId(id);
  }

  const filteredWorkers = useMemo(() => {
    if (!snap) return [];
    const q = workerQ.trim().toLowerCase();
    return snap.workers.filter((w) => {
      if (workerFilter === "active" && w.status !== "active") return false;
      if (workerFilter === "banned" && w.status !== "banned") return false;
      if (
        workerFilter === "exhausted" &&
        !(w.linkQuota !== null && (w.linksRemaining ?? 0) <= 0)
      ) {
        return false;
      }
      if (workerFilter === "unlimited" && w.linkQuota !== null) return false;
      if (!q) return true;
      return (
        w.username.toLowerCase().includes(q) ||
        w.tgUserId.includes(q) ||
        w.firstName.toLowerCase().includes(q) ||
        w.adminNote.toLowerCase().includes(q)
      );
    });
  }, [snap, workerQ, workerFilter]);

  const filteredSubs = useMemo(() => {
    if (!snap) return [];
    const q = subQ.trim().toLowerCase();
    return snap.submissions.filter((s) => {
      if (payoutFilter !== "all" && s.payoutStatus !== payoutFilter) return false;
      if (selectedWorkerId && s.workerId !== selectedWorkerId) return false;
      if (!q) return true;
      return (
        s.feedUrl.toLowerCase().includes(q) ||
        s.workerUsername.toLowerCase().includes(q) ||
        s.workerTgUserId.includes(q) ||
        (s.exchangerId ?? "").toLowerCase().includes(q)
      );
    });
  }, [snap, subQ, payoutFilter, selectedWorkerId]);

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
        result?: { ok: boolean; url?: string; error?: string; paid?: number; stillFailed?: number; retried?: number };
        count?: number;
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
            .filter((b) => Number(b.balance) > 0)
            .map((b) => `${b.balance} ${b.currency}`)
            .join(", ");
          setInfo(
            `xRocket OK: ${data.xrocket.appName ?? "app"}${bals ? ` · ${bals}` : ""}`,
          );
        } else {
          setInfo(`xRocket: ${data.xrocket.error ?? "ошибка"}`);
        }
      } else if (data.result && "url" in (data.result as object)) {
        const r = data.result as { ok: boolean; url?: string; error?: string };
        setInfo(r.ok ? `Webhook: ${r.url ?? "OK"}` : r.error ?? "Ошибка webhook");
      } else if (data.result && "retried" in (data.result as object)) {
        const r = data.result as {
          retried: number;
          paid: number;
          stillFailed: number;
        };
        setInfo(
          `Повтор выплат: ${r.retried}, успешно ${r.paid}, ошибок ${r.stillFailed}`,
        );
      } else if (typeof data.count === "number") {
        setInfo(`Обнулены квоты у ${data.count} воркеров`);
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

  const tabs = useMemo(() => {
    if (!snap) return TABS;
    return TABS.map((t) =>
      t.id === "submissions" && snap.stats.failedPayoutsNow > 0
        ? { ...t, badge: snap.stats.failedPayoutsNow }
        : t.id === "workers" && snap.stats.exhaustedWorkers > 0
          ? { ...t, badge: snap.stats.exhaustedWorkers }
          : t,
    );
  }, [snap]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Feed Scout"
        description="Скауты XML-фидов: квоты, баланс xRocket, выплаты и очередь сдач."
        actions={
          <div className="flex flex-wrap gap-2">
            {snap?.settings.botUsername ? (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  copyText(`https://t.me/${snap.settings.botUsername}`);
                  setInfo(`Ссылка на бота скопирована (@${snap.settings.botUsername})`);
                }}
              >
                @{snap.settings.botUsername}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className={btnGhost}
            >
              Обновить
            </button>
            {canWrite && snap ? (
              <button
                type="button"
                disabled={busy}
                className={btnAccent}
                onClick={() =>
                  void runAction(
                    {
                      action: "settings",
                      settings: { enabled: !snap.settings.enabled },
                    },
                    snap.settings.enabled ? "Бот выключен" : "Бот включён",
                  )
                }
              >
                {snap.settings.enabled ? "Выключить бота" : "Включить бота"}
              </button>
            ) : null}
          </div>
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

      <AdminTabBar tabs={tabs} value={tab} onChange={setTab} />

      {!snap ? (
        <p className="text-sm text-ink-muted">Загрузка…</p>
      ) : (
        <>
          {tab === "overview" ? (
            <OverviewTab
              snap={snap}
              canWrite={canWrite}
              busy={busy}
              onAction={runAction}
              onOpenWorkers={(filter) => {
                setWorkerFilter(filter);
                setTab("workers");
              }}
              onOpenFailed={() => {
                setPayoutFilter("failed");
                setTab("submissions");
              }}
            />
          ) : null}

          {tab === "workers" ? (
            <WorkersTab
              snap={snap}
              workers={filteredWorkers}
              canWrite={canWrite}
              busy={busy}
              workerQ={workerQ}
              workerFilter={workerFilter}
              onWorkerQ={setWorkerQ}
              onWorkerFilter={setWorkerFilter}
              onAction={runAction}
              onOpen={openWorkerDrawer}
              onFilterSubs={(id) => {
                setSelectedWorkerId(id);
                setTab("submissions");
              }}
            />
          ) : null}

          {tab === "submissions" ? (
            <SubmissionsTab
              snap={snap}
              rows={filteredSubs}
              canWrite={canWrite}
              busy={busy}
              subQ={subQ}
              payoutFilter={payoutFilter}
              selectedWorkerId={selectedWorkerId}
              onSubQ={setSubQ}
              onPayoutFilter={setPayoutFilter}
              onSelectedWorkerId={setSelectedWorkerId}
              onAction={runAction}
            />
          ) : null}

          {tab === "settings" ? (
            <SettingsTab
              snap={snap}
              canWrite={canWrite}
              busy={busy}
              botToken={botToken}
              xrocketKey={xrocketKey}
              payoutAmount={payoutAmount}
              payoutCurrency={payoutCurrency}
              enabled={enabled}
              onBotToken={setBotToken}
              onXrocketKey={setXrocketKey}
              onPayoutAmount={setPayoutAmount}
              onPayoutCurrency={setPayoutCurrency}
              onEnabled={setEnabled}
              onSave={saveSettings}
              onAction={runAction}
            />
          ) : null}
        </>
      )}

      <AdminDrawer
        open={Boolean(drawerWorker)}
        onClose={() => setDrawerWorkerId(null)}
        title={drawerWorker ? workerLabel(drawerWorker) : "Воркер"}
        description={
          drawerWorker
            ? `${drawerWorker.firstName || "без имени"} · id ${drawerWorker.tgUserId}`
            : undefined
        }
        widthClassName="max-w-md"
      >
        {drawerWorker && snap ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2">
                <p className="text-xs text-ink-muted">Принято</p>
                <p className="text-lg font-semibold tabular-nums">
                  {drawerWorker.acceptedCount}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2">
                <p className="text-xs text-ink-muted">Осталось</p>
                <p className="text-lg font-semibold tabular-nums">
                  {drawerWorker.linksRemaining === null
                    ? "∞"
                    : drawerWorker.linksRemaining}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2">
                <p className="text-xs text-ink-muted">Выплачено</p>
                <p className="text-lg font-semibold tabular-nums">
                  {fmtMoney(
                    drawerWorker.paidTotal,
                    snap.stats.payoutCurrency,
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2">
                <p className="text-xs text-ink-muted">Резерв</p>
                <p className="text-lg font-semibold tabular-nums">
                  {fmtMoney(
                    drawerWorker.budgetReserved,
                    snap.stats.payoutCurrency,
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-muted">
              Последняя сдача: {fmtDate(drawerWorker.lastSubmissionAt)}
            </p>

            {canWrite ? (
              <>
                <Field label="Выдать ещё ссылок">
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 25, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={busy}
                        className={btnTiny}
                        onClick={() =>
                          void runAction(
                            {
                              action: "grantLinks",
                              workerId: drawerWorker.id,
                              addLinks: n,
                            },
                            `+${n} ссылок`,
                          )
                        }
                      >
                        +{n}
                      </button>
                    ))}
                    <input
                      className={`${inputClass} w-20 px-2 py-1`}
                      type="number"
                      min={1}
                      value={grantDraft}
                      onChange={(e) => setGrantDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={btnTiny}
                      onClick={() =>
                        void runAction(
                          {
                            action: "grantLinks",
                            workerId: drawerWorker.id,
                            addLinks: Number(grantDraft),
                          },
                          `+${grantDraft} ссылок`,
                        )
                      }
                    >
                      Выдать
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={btnTiny}
                      onClick={() =>
                        void runAction(
                          {
                            action: "setRemaining",
                            workerId: drawerWorker.id,
                            remaining: 0,
                          },
                          "Квота обнулена",
                        )
                      }
                    >
                      Обнулить
                    </button>
                  </div>
                </Field>

                <Field label="Заметка">
                  <textarea
                    className={`${inputClass} min-h-[88px]`}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Кто это, контакты, условия…"
                  />
                </Field>
                <button
                  type="button"
                  disabled={busy}
                  className={btnAccent}
                  onClick={() =>
                    void runAction(
                      {
                        action: "setWorkerNote",
                        workerId: drawerWorker.id,
                        adminNote: noteDraft,
                      },
                      "Заметка сохранена",
                    )
                  }
                >
                  Сохранить заметку
                </button>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      setSelectedWorkerId(drawerWorker.id);
                      setDrawerWorkerId(null);
                      setTab("submissions");
                    }}
                  >
                    Сдачи воркера
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btnGhost}
                    onClick={() =>
                      void runAction(
                        {
                          action: "setWorkerStatus",
                          workerId: drawerWorker.id,
                          status:
                            drawerWorker.status === "banned"
                              ? "active"
                              : "banned",
                        },
                        drawerWorker.status === "banned"
                          ? "Разбанен"
                          : "Забанен",
                      )
                    }
                  >
                    {drawerWorker.status === "banned" ? "Разбанить" : "Забанить"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}

function OverviewTab({
  snap,
  canWrite,
  busy,
  onAction,
  onOpenWorkers,
  onOpenFailed,
}: {
  snap: Snapshot;
  canWrite: boolean;
  busy: boolean;
  onAction: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  onOpenWorkers: (f: WorkerFilter) => void;
  onOpenFailed: () => void;
}) {
  const overReserved =
    snap.stats.usdtBalance !== null &&
    snap.stats.budgetReserved > snap.stats.usdtBalance;

  return (
    <div className="space-y-5">
      <AdminStatGrid
        items={[
          {
            label: "Баланс USDT",
            value:
              snap.stats.usdtBalance === null
                ? "—"
                : snap.stats.usdtBalance,
            tone: overReserved ? "warn" : "ok",
          },
          {
            label: "Свободно под квоты",
            value:
              snap.stats.freeUsdt === null
                ? "—"
                : `${snap.stats.freeUsdt} (~${snap.stats.freeLinkCapacity ?? "—"} ссылок)`,
            tone: overReserved ? "warn" : undefined,
          },
          {
            label: "Зарезервировано",
            value: fmtMoney(
              snap.stats.budgetReserved,
              snap.stats.payoutCurrency,
            ),
            tone: overReserved ? "warn" : undefined,
          },
          {
            label: "Ставка",
            value: fmtMoney(
              snap.stats.payoutAmount,
              snap.stats.payoutCurrency,
            ),
          },
        ]}
      />

      <AdminStatGrid
        items={[
          {
            label: "Активные воркеры",
            value: snap.stats.activeWorkers,
          },
          {
            label: "Без квоты",
            value: snap.stats.exhaustedWorkers,
            tone: snap.stats.exhaustedWorkers > 0 ? "warn" : undefined,
          },
          {
            label: "Принято / выплачено",
            value: `${snap.stats.acceptedTotal} / ${fmtMoney(snap.stats.paidTotal, snap.stats.payoutCurrency)}`,
            tone: "ok",
          },
          {
            label: "Ошибки выплат",
            value: snap.stats.failedPayoutsNow,
            tone: snap.stats.failedPayoutsNow > 0 ? "warn" : undefined,
          },
        ]}
      />

      {overReserved ? (
        <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Квоты резервируют больше, чем есть на балансе xRocket. Уменьшите
          лимиты или пополните приложение.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title="Состояние" description="Бот и платежи">
          <div className="space-y-3 px-5 py-4 text-sm">
            <HealthRow
              label="Бот"
              ok={snap.settings.enabled && snap.settings.hasBotToken}
              value={
                snap.settings.hasBotToken
                  ? `@${snap.settings.botUsername || "?"} · ${snap.settings.enabled ? "ON" : "OFF"}`
                  : "токен не задан"
              }
            />
            <HealthRow
              label="Webhook"
              ok={Boolean(
                snap.webhook.url &&
                  snap.webhook.url === snap.webhook.expectedUrl,
              )}
              value={
                snap.webhook.url
                  ? snap.webhook.url === snap.webhook.expectedUrl
                    ? "установлен"
                    : "URL не совпадает"
                  : "не установлен"
              }
            />
            <HealthRow
              label="xRocket"
              ok={Boolean(snap.xrocket?.ok)}
              value={
                snap.xrocket?.ok
                  ? snap.xrocket.appName ?? "OK"
                  : snap.xrocket?.error ?? "нет данных"
              }
            />
            {snap.webhook.lastErrorMessage ? (
              <p className="text-xs text-warn">{snap.webhook.lastErrorMessage}</p>
            ) : null}
          </div>
        </AdminSection>

        <AdminSection title="Быстрые действия">
          <div className="flex flex-wrap gap-2 px-5 py-4">
            <button
              type="button"
              className={btnGhost}
              onClick={() => onOpenWorkers("exhausted")}
            >
              Воркеры без квоты ({snap.stats.exhaustedWorkers})
            </button>
            <button type="button" className={btnGhost} onClick={onOpenFailed}>
              Ошибки выплат ({snap.stats.failedPayoutsNow})
            </button>
            {canWrite ? (
              <>
                <button
                  type="button"
                  disabled={busy || snap.stats.failedPayoutsNow === 0}
                  className={btnGhost}
                  onClick={() => void onAction({ action: "retryAllFailed" })}
                >
                  Retry все failed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={btnGhost}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Обнулить остатки квот у всех активных воркеров?",
                      )
                    ) {
                      return;
                    }
                    void onAction({ action: "zeroAllQuotas" });
                  }}
                >
                  Обнулить все квоты
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={btnGhost}
                  onClick={() => void onAction({ action: "setWebhook" })}
                >
                  Переустановить webhook
                </button>
              </>
            ) : null}
          </div>
        </AdminSection>
      </div>

      <AdminSection title="Топ воркеров" description="По числу принятых ссылок">
        <div className="divide-y divide-line">
          {[...snap.workers]
            .sort((a, b) => b.acceptedCount - a.acceptedCount)
            .slice(0, 5)
            .map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{workerLabel(w)}</span>
                  {w.adminNote ? (
                    <span className="ml-2 text-xs text-ink-muted">
                      {w.adminNote.slice(0, 40)}
                    </span>
                  ) : null}
                </div>
                <div className="tabular-nums text-ink-muted">
                  {w.acceptedCount} ссылок ·{" "}
                  {fmtMoney(w.paidTotal, snap.stats.payoutCurrency)} · ост.{" "}
                  {w.linksRemaining === null ? "∞" : w.linksRemaining}
                </div>
              </div>
            ))}
          {snap.workers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Пока пусто</p>
          ) : null}
        </div>
      </AdminSection>
    </div>
  );
}

function HealthRow({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className={`text-right font-medium ${ok ? "text-ok" : "text-warn"}`}>
        {value}
      </span>
    </div>
  );
}

function WorkersTab({
  snap,
  workers,
  canWrite,
  busy,
  workerQ,
  workerFilter,
  onWorkerQ,
  onWorkerFilter,
  onAction,
  onOpen,
  onFilterSubs,
}: {
  snap: Snapshot;
  workers: FeedScoutWorker[];
  canWrite: boolean;
  busy: boolean;
  workerQ: string;
  workerFilter: WorkerFilter;
  onWorkerQ: (v: string) => void;
  onWorkerFilter: (v: WorkerFilter) => void;
  onAction: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  onOpen: (id: string) => void;
  onFilterSubs: (id: string) => void;
}) {
  const filters: Array<{ id: WorkerFilter; label: string }> = [
    { id: "all", label: "Все" },
    { id: "active", label: "Active" },
    { id: "exhausted", label: "Без квоты" },
    { id: "unlimited", label: "∞" },
    { id: "banned", label: "Ban" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="Поиск: @user, id, заметка…"
          value={workerQ}
          onChange={(e) => onWorkerQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                workerFilter === f.id
                  ? "bg-accent text-white"
                  : "border border-line text-ink-muted hover:bg-bg-soft"
              }`}
              onClick={() => onWorkerFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {workers.length === 0 ? (
          <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-ink-muted">
            Никого не найдено
          </p>
        ) : (
          workers.map((w) => (
            <article
              key={w.id}
              className="rounded-2xl border border-line bg-bg-soft/20 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onOpen(w.id)}
                >
                  <p className="font-medium text-ink">{workerLabel(w)}</p>
                  <p className="text-xs text-ink-muted">
                    {w.firstName || "—"} · {w.status}
                  </p>
                </button>
                <span className="text-xs tabular-nums text-ink-muted">
                  ост. {w.linksRemaining === null ? "∞" : w.linksRemaining}
                </span>
              </div>
              <p className="mt-2 text-sm tabular-nums text-ink-muted">
                {w.acceptedCount} принято ·{" "}
                {fmtMoney(w.paidTotal, snap.stats.payoutCurrency)}
              </p>
              {w.adminNote ? (
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                  {w.adminNote}
                </p>
              ) : null}
              {canWrite ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[10, 25, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={busy}
                      className={btnTiny}
                      onClick={() =>
                        void onAction(
                          {
                            action: "grantLinks",
                            workerId: w.id,
                            addLinks: n,
                          },
                          `+${n}`,
                        )
                      }
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    className={btnTiny}
                    onClick={() =>
                      void onAction(
                        {
                          action: "setRemaining",
                          workerId: w.id,
                          remaining: 0,
                        },
                        "Обнулено",
                      )
                    }
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className={btnTiny}
                    onClick={() => onOpen(w.id)}
                  >
                    Ещё
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {/* Desktop table */}
      <AdminSection
        title={`Воркеры (${workers.length})`}
        description="Клик по имени — карточка. +N выдаёт оставшиеся слоты."
        className="hidden md:block"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-bg-soft/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Воркер</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Принято</th>
                <th className="px-4 py-3 font-medium">Осталось</th>
                <th className="px-4 py-3 font-medium">Резерв</th>
                <th className="px-4 py-3 font-medium">Выплачено</th>
                <th className="px-4 py-3 font-medium">Активность</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-ink-muted"
                  >
                    Никого не найдено
                  </td>
                </tr>
              ) : (
                workers.map((w) => (
                  <tr key={w.id} className="border-b border-line/70">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left hover:text-accent"
                        onClick={() => onOpen(w.id)}
                      >
                        <div className="font-medium">{workerLabel(w)}</div>
                        <div className="text-[11px] text-ink-muted">
                          {w.firstName || "—"}
                          {w.adminNote
                            ? ` · ${w.adminNote.slice(0, 28)}`
                            : ""}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {w.status === "banned" ? (
                        <span className="text-danger">ban</span>
                      ) : w.linkQuota !== null &&
                        (w.linksRemaining ?? 0) <= 0 ? (
                        <span className="text-warn">no quota</span>
                      ) : (
                        <span className="text-ok">active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{w.acceptedCount}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {w.linksRemaining === null ? "∞" : w.linksRemaining}
                      {w.linkQuota !== null ? (
                        <span className="text-ink-muted">
                          {" "}
                          / {w.linkQuota}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {fmtMoney(w.budgetReserved, snap.stats.payoutCurrency)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {fmtMoney(w.paidTotal, snap.stats.payoutCurrency)}
                      {w.failedPayouts > 0 ? (
                        <span className="ml-1 text-warn">
                          ({w.failedPayouts})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {fmtDate(w.lastSubmissionAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              className={btnTiny}
                              onClick={() =>
                                void onAction(
                                  {
                                    action: "grantLinks",
                                    workerId: w.id,
                                    addLinks: 10,
                                  },
                                  "+10",
                                )
                              }
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className={btnTiny}
                              onClick={() =>
                                void onAction(
                                  {
                                    action: "grantLinks",
                                    workerId: w.id,
                                    addLinks: 50,
                                  },
                                  "+50",
                                )
                              }
                            >
                              +50
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className={btnTiny}
                              onClick={() =>
                                void onAction(
                                  {
                                    action: "setRemaining",
                                    workerId: w.id,
                                    remaining: 0,
                                  },
                                  "0",
                                )
                              }
                            >
                              0
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={btnTiny}
                          onClick={() => onFilterSubs(w.id)}
                        >
                          Сдачи
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}

function SubmissionsTab({
  snap,
  rows,
  canWrite,
  busy,
  subQ,
  payoutFilter,
  selectedWorkerId,
  onSubQ,
  onPayoutFilter,
  onSelectedWorkerId,
  onAction,
}: {
  snap: Snapshot;
  rows: FeedScoutSubmission[];
  canWrite: boolean;
  busy: boolean;
  subQ: string;
  payoutFilter: PayoutFilter;
  selectedWorkerId: string | null;
  onSubQ: (v: string) => void;
  onPayoutFilter: (v: PayoutFilter) => void;
  onSelectedWorkerId: (v: string | null) => void;
  onAction: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
}) {
  const filters: Array<{ id: PayoutFilter; label: string }> = [
    { id: "all", label: "Все" },
    { id: "paid", label: "Paid" },
    { id: "failed", label: "Failed" },
    { id: "none", label: "Pending" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          className={`${inputClass} lg:max-w-sm`}
          placeholder="Поиск по URL / воркеру…"
          value={subQ}
          onChange={(e) => onSubQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClass} w-auto py-2`}
            value={selectedWorkerId ?? ""}
            onChange={(e) => onSelectedWorkerId(e.target.value || null)}
          >
            <option value="">Все воркеры</option>
            {snap.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {workerLabel(w)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  payoutFilter === f.id
                    ? "bg-accent text-white"
                    : "border border-line text-ink-muted hover:bg-bg-soft"
                }`}
                onClick={() => onPayoutFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {canWrite && snap.stats.failedPayoutsNow > 0 ? (
            <button
              type="button"
              disabled={busy}
              className={btnGhost}
              onClick={() => void onAction({ action: "retryAllFailed" })}
            >
              Retry all failed
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-ink-muted">
            Нет сдач
          </p>
        ) : (
          rows.map((s) => (
            <article
              key={s.id}
              className="rounded-2xl border border-line bg-bg-soft/20 p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-ink-muted">
                  {fmtDate(s.createdAt)}
                </span>
                <span className={payoutTone(s.payoutStatus)}>
                  {payoutLabel(s.payoutStatus)}
                </span>
              </div>
              <a
                href={s.feedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-accent"
              >
                {s.feedUrl}
              </a>
              <p className="mt-1 text-xs text-ink-muted">
                {s.workerUsername
                  ? `@${s.workerUsername}`
                  : s.workerTgUserId}{" "}
                · {s.pairCount} пар · {fmtMoney(s.amount, s.currency)}
              </p>
              {s.payoutError ? (
                <p className="mt-1 text-xs text-warn">{s.payoutError}</p>
              ) : null}
              {canWrite && s.payoutStatus === "failed" ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`${btnTiny} mt-2`}
                  onClick={() =>
                    void onAction(
                      { action: "retryPayout", submissionId: s.id },
                      "Retry ok",
                    )
                  }
                >
                  Retry
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>

      <AdminSection
        title={`Сдачи (${rows.length})`}
        className="hidden md:block"
      >
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-ink-muted"
                  >
                    Нет сдач
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-line/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">
                      {fmtDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {s.workerUsername
                        ? `@${s.workerUsername}`
                        : s.workerTgUserId}
                    </td>
                    <td className="max-w-[320px] px-4 py-3">
                      <a
                        href={s.feedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-accent hover:underline"
                        title={s.feedUrl}
                      >
                        {s.feedUrl}
                      </a>
                      {s.exchangerId ? (
                        <span className="text-[11px] text-ink-muted">
                          {s.exchangerId}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.pairCount}</td>
                    <td className="px-4 py-3">
                      <span className={payoutTone(s.payoutStatus)}>
                        {payoutLabel(s.payoutStatus)}{" "}
                        <span className="tabular-nums">
                          {fmtMoney(s.amount, s.currency)}
                        </span>
                      </span>
                      {s.payoutError ? (
                        <span
                          className="mt-0.5 block max-w-[220px] truncate text-[11px] text-warn"
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
                          className={btnTiny}
                          onClick={() =>
                            void onAction(
                              {
                                action: "retryPayout",
                                submissionId: s.id,
                              },
                              "Retry ok",
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
    </div>
  );
}

function SettingsTab({
  snap,
  canWrite,
  busy,
  botToken,
  xrocketKey,
  payoutAmount,
  payoutCurrency,
  enabled,
  onBotToken,
  onXrocketKey,
  onPayoutAmount,
  onPayoutCurrency,
  onEnabled,
  onSave,
  onAction,
}: {
  snap: Snapshot;
  canWrite: boolean;
  busy: boolean;
  botToken: string;
  xrocketKey: string;
  payoutAmount: string;
  payoutCurrency: string;
  enabled: boolean;
  onBotToken: (v: string) => void;
  onXrocketKey: (v: string) => void;
  onPayoutAmount: (v: string) => void;
  onPayoutCurrency: (v: string) => void;
  onEnabled: (v: boolean) => void;
  onSave: (e: FormEvent) => void;
  onAction: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AdminSection title="Параметры" description="Ставка и секреты">
        <form onSubmit={(e) => void onSave(e)} className="space-y-4 px-5 py-4">
          <Field
            label="Bot token"
            hint={
              snap.settings.hasBotToken
                ? `Сейчас: ${snap.settings.botTokenHint}`
                : "Токен от @BotFather"
            }
          >
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              placeholder={
                snap.settings.hasBotToken
                  ? "Пусто = не менять"
                  : "123456:ABC..."
              }
              value={botToken}
              onChange={(e) => onBotToken(e.target.value)}
              disabled={!canWrite || busy}
            />
          </Field>
          <Field
            label="xRocket Pay key"
            hint={
              snap.settings.hasXrocketPayKey
                ? `Сейчас: ${snap.settings.xrocketPayKeyHint}`
                : "Rocket Pay → Create App"
            }
          >
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              placeholder={
                snap.settings.hasXrocketPayKey
                  ? "Пусто = не менять"
                  : "Rocket-Pay-Key"
              }
              value={xrocketKey}
              onChange={(e) => onXrocketKey(e.target.value)}
              disabled={!canWrite || busy}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма за ссылку">
              <input
                className={inputClass}
                type="number"
                min={0}
                step="0.001"
                value={payoutAmount}
                onChange={(e) => onPayoutAmount(e.target.value)}
                disabled={!canWrite || busy}
              />
            </Field>
            <Field label="Валюта">
              <input
                className={inputClass}
                value={payoutCurrency}
                onChange={(e) => onPayoutCurrency(e.target.value)}
                disabled={!canWrite || busy}
              />
            </Field>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!canWrite || busy}
            onClick={() => onEnabled(!enabled)}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-bg-soft/30 px-4 py-3.5 text-left"
          >
            <span>
              <span className="block text-sm font-medium text-ink">
                Бот включён
              </span>
              <span className="text-xs text-ink-muted">
                Выключенный бот не принимает ссылки
              </span>
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                enabled ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
              }`}
            >
              {enabled ? "ON" : "OFF"}
            </span>
          </button>
          {canWrite ? (
            <button type="submit" disabled={busy} className={btnAccent}>
              Сохранить
            </button>
          ) : null}
        </form>
      </AdminSection>

      <AdminSection title="Инфра" description="Проверки и webhook">
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="break-all text-ink-muted">
            Ожидаемый webhook:
            <br />
            <span className="text-ink">{snap.webhook.expectedUrl}</span>
          </p>
          <p className="break-all text-ink-muted">
            Текущий: {snap.webhook.url || "—"}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!canWrite || busy}
              className={btnGhost}
              onClick={() => void onAction({ action: "testBot" })}
            >
              Тест бота
            </button>
            <button
              type="button"
              disabled={!canWrite || busy}
              className={btnGhost}
              onClick={() => void onAction({ action: "testXrocket" })}
            >
              Тест xRocket
            </button>
            <button
              type="button"
              disabled={!canWrite || busy}
              className={btnGhost}
              onClick={() => void onAction({ action: "setWebhook" })}
            >
              setWebhook
            </button>
            <button
              type="button"
              disabled={!canWrite || busy}
              className={btnGhost}
              onClick={() => void onAction({ action: "deleteWebhook" })}
            >
              deleteWebhook
            </button>
            <button
              type="button"
              disabled={!canWrite || busy}
              className={btnGhost}
              onClick={() =>
                void onAction(
                  {
                    action: "settings",
                    settings: { rotateWebhookSecret: true },
                  },
                  "Secret ротирован — снова setWebhook",
                )
              }
            >
              Ротация secret
            </button>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
