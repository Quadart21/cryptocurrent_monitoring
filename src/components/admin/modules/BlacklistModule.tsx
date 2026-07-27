"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminPageHeader, AdminSection } from "@/components/admin/ui";

export function BlacklistModule() {
  const { overview, busy, setBusy, refresh } = useAdmin();
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [exchangerId, setExchangerId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const blacklistedIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of overview?.blacklist ?? []) {
      if (b.exchangerId) set.add(b.exchangerId);
      const n = b.name.trim().toLowerCase();
      for (const ex of overview?.exchangers ?? []) {
        if (
          ex.name.trim().toLowerCase() === n ||
          ex.slug.trim().toLowerCase() === n
        ) {
          set.add(ex.id);
        }
      }
    }
    return set;
  }, [overview]);

  const suggestions = useMemo(() => {
    const needle = name.trim().toLowerCase();
    if (needle.length < 1) return [];
    return (overview?.exchangers ?? [])
      .filter((ex) => {
        if (blacklistedIds.has(ex.id)) return false;
        return (
          ex.name.toLowerCase().includes(needle) ||
          ex.slug.toLowerCase().includes(needle)
        );
      })
      .slice(0, 8);
  }, [name, overview, blacklistedIds]);

  function pickExchanger(ex: { id: string; name: string }) {
    setName(ex.name);
    setExchangerId(ex.id);
    setSuggestOpen(false);
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, reason, exchangerId }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(body.error ?? "Не удалось добавить");
        return;
      }
      setName("");
      setReason("");
      setExchangerId(null);
      await refresh();
    } catch {
      setFormError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/blacklist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const rows = (overview?.blacklist ?? []).filter((item) => {
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      item.reason.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Чёрный список"
        description="После добавления обменник скрывается из курсов, списка и выбора пары для пользователей."
      />

      <AdminSection title="Добавить запись">
        <form
          onSubmit={(e) => void addItem(e)}
          className="grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto]"
        >
          <div className="relative">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setExchangerId(null);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => {
                // allow click on suggestion
                window.setTimeout(() => setSuggestOpen(false), 150);
              }}
              placeholder="Название обменника"
              required
              autoComplete="off"
              className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            {suggestOpen && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-line bg-bg-elevated py-1 shadow-lg">
                {suggestions.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => pickExchanger(ex)}
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent-soft"
                    >
                      <span className="font-medium text-ink">{ex.name}</span>
                      <span className="text-xs text-ink-muted">
                        {ex.slug} · {ex.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {exchangerId ? (
              <p className="mt-1 text-[11px] text-ok">
                Привязан к обменнику в каталоге — пропадёт из публичного пула
              </p>
            ) : name.trim().length > 0 ? (
              <p className="mt-1 text-[11px] text-ink-muted">
                Выберите из подсказок или сохраните как свободную запись
              </p>
            ) : null}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина"
            required
            className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Добавить
          </button>
          {formError ? (
            <p className="text-sm text-danger sm:col-span-3">{formError}</p>
          ) : null}
        </form>
      </AdminSection>

      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию или причине"
          className="mb-4 w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-md"
        />
      </div>

      <AdminSection title={`Список (${rows.length})`}>
        <div className="divide-y divide-line">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Пусто</p>
          ) : (
            rows.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{item.reason}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.reportedAt} · жалоб: {item.reports}
                    {item.exchangerId ? " · скрыт из пула" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item.id)}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                >
                  Удалить
                </button>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </div>
  );
}
