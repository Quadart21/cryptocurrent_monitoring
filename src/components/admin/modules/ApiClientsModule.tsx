"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";

type ClientRow = {
  id: string;
  name: string;
  email: string;
  website: string;
  purpose: string;
  status: string;
  keyPrefix: string | null;
  rateLimitPerSec: number;
  lastUsedAt: string | null;
  createdAt: string;
  moderatedAt: string | null;
  adminNote: string;
};

const TABS = [
  { id: "pending", label: "На проверке" },
  { id: "approved", label: "Одобрены" },
  { id: "rejected", label: "Отклонены" },
  { id: "revoked", label: "Отозваны" },
  { id: "all", label: "Все" },
] as const;

export function ApiClientsModule() {
  const { busy, setBusy, refresh, can } = useAdmin();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [apiEnabled, setApiEnabledState] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const canWrite = can("api_clients.write");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/api-clients");
    if (!res.ok) {
      setError("Не удалось загрузить заявки");
      return;
    }
    const data = (await res.json()) as {
      clients: ClientRow[];
      apiEnabled?: boolean;
    };
    setClients(data.clients);
    setApiEnabledState(data.apiEnabled !== false);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (tab === "all") return clients;
    return clients.filter((c) => c.status === tab);
  }, [clients, tab]);

  async function toggleApi(enabled: boolean) {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setEnabled", enabled }),
      });
      const body = (await res.json()) as {
        error?: string;
        apiEnabled?: boolean;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      setApiEnabledState(body.apiEnabled !== false);
      await refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function act(
    id: string,
    action: "approve" | "reject" | "revoke" | "pending",
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          adminNote: noteDraft[id],
        }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.error ?? "Ошибка");
        return;
      }
      await load();
      await refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="API-ключи"
        description="Заявки на доступ к публичному API /v2. При одобрении ключ уходит на email один раз."
      />

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <AdminSection title="Публичный API">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {apiEnabled ? "API включён" : "API выключен"}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Выключает /v2, страницу /api-docs, приём заявок и ссылки API в
              меню и футере. Выданные ключи сохраняются, но запросы получают
              503.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !canWrite}
            onClick={() => void toggleApi(!apiEnabled)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              apiEnabled
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {apiEnabled ? "Отключить API" : "Включить API"}
          </button>
        </div>
      </AdminSection>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? "bg-accent text-white"
                : "bg-bg-soft text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id !== "all"
              ? ` (${clients.filter((c) => c.status === t.id).length})`
              : ` (${clients.length})`}
          </button>
        ))}
      </div>

      <AdminSection title="Заявки">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">Нет записей в этой вкладке.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-sm text-ink-muted">{c.email}</p>
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent hover:underline"
                      >
                        {c.website}
                      </a>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs text-ink-muted">
                    {c.status}
                    {c.keyPrefix ? ` · ${c.keyPrefix}…` : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-muted">
                  {c.purpose}
                </p>
                <p className="text-xs text-ink-muted">
                  Создано: {new Date(c.createdAt).toLocaleString("ru-RU")}
                  {c.lastUsedAt
                    ? ` · Использован: ${new Date(c.lastUsedAt).toLocaleString("ru-RU")}`
                    : ""}
                  {` · Лимит: ${c.rateLimitPerSec}/с`}
                </p>
                <label className="block space-y-1">
                  <span className="text-xs text-ink-muted">Заметка админа</span>
                  <input
                    value={noteDraft[c.id] ?? c.adminNote}
                    onChange={(e) =>
                      setNoteDraft((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                    placeholder="Опционально"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {c.status === "pending" || c.status === "rejected" ? (
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => void act(c.id, "approve")}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Одобрить и выслать ключ
                    </button>
                  ) : null}
                  {c.status === "pending" ? (
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => void act(c.id, "reject")}
                      className="rounded-lg bg-bg-soft px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  ) : null}
                  {c.status === "approved" ? (
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => void act(c.id, "revoke")}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Отозвать ключ
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
