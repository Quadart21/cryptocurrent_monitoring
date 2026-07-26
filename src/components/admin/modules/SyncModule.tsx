"use client";

import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
} from "@/components/admin/ui";

type SyncResult = {
  total: number;
  ok: number;
  failed: number;
  syncedAt: string;
};

export function SyncModule() {
  const { overview, counts, lastGlobalSyncAt, busy, setBusy, refresh } =
    useAdmin();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const body = (await res.json()) as SyncResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Синхронизация не удалась");
        return;
      }
      setResult(body);
      await refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  const active = (overview?.exchangers ?? []).filter(
    (e) => e.status === "active" || e.status === "error",
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Синхронизация"
        description="Ручной запуск опроса XML-фидов. Автосинк идёт каждую минуту в фоне."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSync()}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Синхронизируем…" : "Запустить синхронизацию"}
          </button>
        }
      />

      <AdminStatGrid
        items={[
          {
            label: "Последняя синхронизация",
            value: lastGlobalSyncAt
              ? new Date(lastGlobalSyncAt).toLocaleString("ru-RU")
              : "—",
          },
          { label: "Курсов в базе", value: counts?.rates ?? 0 },
          { label: "Целей синхронизации", value: active.length },
          { label: "Ошибки", value: counts?.error ?? 0, tone: "warn" },
        ]}
      />

      {error && (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <AdminSection title="Результат последнего ручного запуска">
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-muted">Всего</p>
              <p className="text-xl font-semibold">{result.total}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Успешно</p>
              <p className="text-xl font-semibold text-ok">{result.ok}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">С ошибкой</p>
              <p className="text-xl font-semibold text-danger">{result.failed}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Время</p>
              <p className="text-sm font-semibold">
                {new Date(result.syncedAt).toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        </AdminSection>
      )}

      <AdminSection
        title="Обменники в синхронизации"
        description="Активные и с ошибкой опрашиваются автоматически"
      >
        <div className="divide-y divide-line">
          {active.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Нет целей</p>
          ) : (
            active.map((ex) => (
              <div
                key={ex.id}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{ex.name}</p>
                  <p className="truncate text-xs text-ink-muted">{ex.feedUrl}</p>
                </div>
                <div className="text-xs text-ink-muted">
                  {ex.status === "active"
                    ? "Активен"
                    : ex.status === "error"
                      ? "Ошибка"
                      : ex.status}
                  {ex.lastSyncAt
                    ? ` · ${new Date(ex.lastSyncAt).toLocaleString("ru-RU")}`
                    : ""}
                  {ex.lastError ? ` · ${ex.lastError}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </div>
  );
}
