"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
} from "@/components/admin/ui";
import { ADMIN_PATH } from "@/lib/admin-auth";

type FeedSyncResult = {
  action?: string;
  total: number;
  ok: number;
  failed: number;
  syncedAt: string;
};

type DiscoveryResult = {
  fetchedAt: string;
  newCurrencies: number;
  newCities: number;
  newCountries: number;
  pendingTotal: number;
};

type Proposal = {
  id: string;
  kind: "currency" | "city" | "country";
  code: string;
  name: string;
  payload: Record<string, unknown>;
  status: string;
  discoveredAt: string;
};

const KIND_LABEL: Record<string, string> = {
  currency: "Валюта",
  city: "Город",
  country: "Страна",
};

export function SyncModule() {
  const { overview, counts, lastGlobalSyncAt, busy, setBusy, refresh } =
    useAdmin();
  const [feedResult, setFeedResult] = useState<FeedSyncResult | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [bannerResult, setBannerResult] = useState<{
    checked: number;
    ok: number;
    missing: number;
    errors: number;
    notified: boolean;
    checkedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync?view=proposals&status=pending", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { proposals?: Proposal[] };
      setProposals(body.proposals ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  async function runFeedSync() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feeds" }),
      });
      const body = (await res.json()) as FeedSyncResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Синхронизация фидов не удалась");
        return;
      }
      setFeedResult(body);
      await refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function runDiscovery() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "catalogs" }),
      });
      const body = (await res.json()) as DiscoveryResult & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Проверка каталога не удалась");
        return;
      }
      setDiscovery(body);
      const added =
        body.newCurrencies + body.newCities + body.newCountries;
      setOk(
        added > 0
          ? `Найдено нового: ${body.newCurrencies} валют, ${body.newCities} городов, ${body.newCountries} стран — на модерации`
          : `Новых кодов нет. В очереди: ${body.pendingTotal}`,
      );
      await loadProposals();
      await refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function runBannerCheck() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/banner-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as {
        error?: string;
        checked?: number;
        ok?: number;
        missing?: number;
        errors?: number;
        notified?: boolean;
        checkedAt?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка");
      setBannerResult({
        checked: Number(body.checked ?? 0),
        ok: Number(body.ok ?? 0),
        missing: Number(body.missing ?? 0),
        errors: Number(body.errors ?? 0),
        notified: Boolean(body.notified),
        checkedAt: String(body.checkedAt ?? new Date().toISOString()),
      });
      setOk(
        `Баннеры: найдено ${body.ok}/${body.checked}, нет ${body.missing}, ошибок ${body.errors ?? 0}`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(id: string, status: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "proposal", id, status }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Ошибка");
      setOk(status === "approved" ? "Добавлено в каталог" : "Отклонено");
      await loadProposals();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
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
        description="XML-фиды обменников и новые коды валют на модерацию"
      />

      {error && (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {ok}
        </p>
      )}

      <AdminSection title="XML-фиды" description="Автоопрос каждую минуту">
        <div className="space-y-4 p-5">
          <AdminStatGrid
            items={[
              {
                label: "Последняя синхронизация",
                value: lastGlobalSyncAt
                  ? new Date(lastGlobalSyncAt).toLocaleString("ru-RU")
                  : "—",
              },
              { label: "Курсов в базе", value: counts?.rates ?? 0 },
              { label: "Целей", value: active.length },
              { label: "Ошибки", value: counts?.error ?? 0, tone: "warn" },
            ]}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void runFeedSync()}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Синхронизировать фиды
          </button>
          {feedResult && (
            <p className="text-sm text-ink-muted">
              Результат: {feedResult.ok}/{feedResult.total} успешно
              {feedResult.failed ? `, ошибок ${feedResult.failed}` : ""} ·{" "}
              {new Date(feedResult.syncedAt).toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Баннер GapSnap на сайтах"
        description="Раз в сутки проверяем HTML сайта обменника на наличие нашей кнопки. Алерт на ADMIN_ALERT_EMAIL."
      >
        <div className="space-y-4 p-5">
          <AdminStatGrid
            items={[
              {
                label: "Без баннера",
                value: counts?.bannerMissing ?? 0,
                tone: counts?.bannerMissing ? "warn" : undefined,
              },
              {
                label: "Последняя ручная проверка",
                value: bannerResult
                  ? new Date(bannerResult.checkedAt).toLocaleString("ru-RU")
                  : "—",
              },
            ]}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBannerCheck()}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40 disabled:opacity-60"
          >
            Проверить баннеры сейчас
          </button>
          {bannerResult ? (
            <p className="text-sm text-ink-muted">
              Результат: найдено {bannerResult.ok}/{bannerResult.checked}, нет{" "}
              {bannerResult.missing}, ошибок {bannerResult.errors}
              {bannerResult.notified ? " · письмо админу отправлено" : ""}
            </p>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection
        title="Новые коды валют"
        description="Опрос внешнего каталога раз в 12ч. Новые коды — на модерацию; после одобрения пишутся в PostgreSQL (раздел «Каталог»)"
      >
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runDiscovery()}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/40 disabled:opacity-60"
            >
              Проверить каталог сейчас
            </button>
            <Link
              href={`${ADMIN_PATH}/catalog`}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-accent/40 hover:text-ink"
            >
              Открыть каталог в БД →
            </Link>
            <p className="text-sm text-ink-muted">
              В очереди:{" "}
              <strong className="text-ink">{proposals.length}</strong>
              {discovery
                ? ` · последний опрос ${new Date(discovery.fetchedAt).toLocaleString("ru-RU")}`
                : ""}
            </p>
          </div>

          {proposals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
              Новых кодов на модерации нет
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-bg-soft px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {KIND_LABEL[p.kind] ?? p.kind}
                      </span>
                      <code className="text-sm font-semibold text-accent">
                        {p.code}
                      </code>
                    </div>
                    <p className="mt-1 text-sm text-ink">{p.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Найдено{" "}
                      {new Date(p.discoveredAt).toLocaleString("ru-RU")}
                      {p.kind === "city" && p.payload.countryName
                        ? ` · ${String(p.payload.countryName)}`
                        : ""}
                      {p.kind === "currency" && p.payload.cash
                        ? " · наличные"
                        : ""}
                      {p.kind === "currency" && p.payload.crypto
                        ? " · крипта"
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(p.id, "rejected")}
                      className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted hover:text-danger disabled:opacity-60"
                    >
                      Отклонить
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void moderate(p.id, "approved")}
                      className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      Добавить в каталог
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminSection>

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
