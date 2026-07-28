"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatGrid,
} from "@/components/admin/ui";

type Kind = "currencies" | "cities" | "countries" | "groups";

type Meta = {
  fetchedAt: string;
  source: string;
  counts: {
    groups: number;
    countries: number;
    cities: number;
    currencies: number;
  };
};

type CurrencyRow = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  viewname: string;
  urlname?: string;
  crypto: boolean;
  cash: boolean;
  groupId: number;
  defamt?: number;
  bigamt?: number;
  rank: number;
};

type CityRow = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  countryId?: number;
  countryCode: string;
  countryName: string;
  rank: number;
};

type CountryRow = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  rank: number;
};

type GroupRow = {
  id: number;
  name: string;
  nameEn: string;
};

const TABS: { id: Kind; label: string }[] = [
  { id: "currencies", label: "Валюты" },
  { id: "cities", label: "Города" },
  { id: "countries", label: "Страны" },
  { id: "groups", label: "Группы" },
];

const emptyCurrency = (): CurrencyRow => ({
  id: 0,
  code: "",
  name: "",
  nameEn: "",
  viewname: "",
  urlname: "",
  crypto: false,
  cash: false,
  groupId: 0,
  defamt: 0,
  bigamt: 0,
  rank: 9999,
});

const emptyCity = (): CityRow => ({
  id: 0,
  code: "",
  name: "",
  nameEn: "",
  countryId: undefined,
  countryCode: "",
  countryName: "",
  rank: 9999,
});

const emptyCountry = (): CountryRow => ({
  id: 0,
  code: "",
  name: "",
  nameEn: "",
  rank: 9999,
});

const emptyGroup = (): GroupRow => ({
  id: 0,
  name: "",
  nameEn: "",
});

export function CatalogModule() {
  const { busy, setBusy } = useAdmin();
  const [kind, setKind] = useState<Kind>("currencies");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [currencyForm, setCurrencyForm] = useState(emptyCurrency);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [countryForm, setCountryForm] = useState(emptyCountry);
  const [groupForm, setGroupForm] = useState(emptyGroup);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ kind });
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/admin/catalog?${params}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        items?: unknown[];
        meta?: Meta;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось загрузить каталог");
        return;
      }
      setItems(body.items ?? []);
      if (body.meta) setMeta(body.meta);
    } catch {
      setError("Сеть недоступна");
    }
  }, [kind, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditing(true);
    setOk(null);
    setError(null);
    if (kind === "currencies") setCurrencyForm(emptyCurrency());
    if (kind === "cities") setCityForm(emptyCity());
    if (kind === "countries") setCountryForm(emptyCountry());
    if (kind === "groups") setGroupForm(emptyGroup());
  }

  function startEdit(row: unknown) {
    setEditing(true);
    setOk(null);
    setError(null);
    if (kind === "currencies") setCurrencyForm(row as CurrencyRow);
    if (kind === "cities") setCityForm(row as CityRow);
    if (kind === "countries") setCountryForm(row as CountryRow);
    if (kind === "groups") setGroupForm(row as GroupRow);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const item =
        kind === "currencies"
          ? currencyForm
          : kind === "cities"
            ? cityForm
            : kind === "countries"
              ? countryForm
              : groupForm;
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, item }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось сохранить");
        return;
      }
      setOk("Сохранено в БД");
      setEditing(false);
      await load();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: unknown) {
    const label =
      kind === "groups"
        ? `группу #${(row as GroupRow).id}`
        : `код ${(row as { code: string }).code}`;
    if (!confirm(`Удалить ${label} из каталога?`)) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const params = new URLSearchParams({ kind });
      if (kind === "groups") {
        params.set("id", String((row as GroupRow).id));
      } else {
        params.set("code", (row as { code: string }).code);
      }
      const res = await fetch(`/api/admin/catalog?${params}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Не удалось удалить");
        return;
      }
      setOk("Удалено");
      await load();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => items.slice(0, 200), [items]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Каталог"
        description="Валюты, города, страны и группы хранятся в PostgreSQL. JSON в репозитории — только начальный seed."
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

      <AdminSection title="Сводка">
        <div className="p-5">
          <AdminStatGrid
            items={[
              {
                label: "Валюты",
                value: meta?.counts.currencies ?? "—",
              },
              { label: "Города", value: meta?.counts.cities ?? "—" },
              { label: "Страны", value: meta?.counts.countries ?? "—" },
              { label: "Группы", value: meta?.counts.groups ?? "—" },
            ]}
          />
          <p className="mt-3 text-xs text-ink-muted">
            Источник: {meta?.source ?? "—"}
            {meta?.fetchedAt
              ? ` · обновлено ${new Date(meta.fetchedAt).toLocaleString("ru-RU")}`
              : ""}
          </p>
        </div>
      </AdminSection>

      <AdminSection title="Редактирование">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setKind(tab.id);
                  setEditing(false);
                  setQ("");
                }}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  kind === tab.id
                    ? "bg-accent text-white"
                    : "border border-line text-ink-muted hover:border-accent/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по коду или названию…"
              className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent sm:max-w-md"
            />
            <button
              type="button"
              disabled={busy}
              onClick={startCreate}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Добавить
            </button>
          </div>

          {editing && (
            <div className="rounded-2xl border border-line bg-bg-soft/40 p-4">
              {kind === "currencies" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="XML-код"
                    value={currencyForm.code}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({ ...s, code: v.toUpperCase() }))
                    }
                  />
                  <Field
                    label="ID"
                    value={String(currencyForm.id)}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({ ...s, id: Number(v) || 0 }))
                    }
                  />
                  <Field
                    label="Название"
                    value={currencyForm.name}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({ ...s, name: v }))
                    }
                  />
                  <Field
                    label="EN"
                    value={currencyForm.nameEn}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({ ...s, nameEn: v }))
                    }
                  />
                  <Field
                    label="Viewname"
                    value={currencyForm.viewname}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({ ...s, viewname: v }))
                    }
                  />
                  <Field
                    label="Group ID"
                    value={String(currencyForm.groupId)}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({
                        ...s,
                        groupId: Number(v) || 0,
                      }))
                    }
                  />
                  <Field
                    label="Rank"
                    value={String(currencyForm.rank)}
                    onChange={(v) =>
                      setCurrencyForm((s) => ({
                        ...s,
                        rank: Number(v) || 9999,
                      }))
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={currencyForm.cash}
                      onChange={(e) =>
                        setCurrencyForm((s) => ({
                          ...s,
                          cash: e.target.checked,
                        }))
                      }
                    />
                    Наличные
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={currencyForm.crypto}
                      onChange={(e) =>
                        setCurrencyForm((s) => ({
                          ...s,
                          crypto: e.target.checked,
                        }))
                      }
                    />
                    Крипта
                  </label>
                </div>
              )}

              {kind === "cities" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="Код"
                    value={cityForm.code}
                    onChange={(v) =>
                      setCityForm((s) => ({ ...s, code: v.toUpperCase() }))
                    }
                  />
                  <Field
                    label="ID"
                    value={String(cityForm.id)}
                    onChange={(v) =>
                      setCityForm((s) => ({ ...s, id: Number(v) || 0 }))
                    }
                  />
                  <Field
                    label="Город"
                    value={cityForm.name}
                    onChange={(v) => setCityForm((s) => ({ ...s, name: v }))}
                  />
                  <Field
                    label="EN"
                    value={cityForm.nameEn}
                    onChange={(v) => setCityForm((s) => ({ ...s, nameEn: v }))}
                  />
                  <Field
                    label="Код страны"
                    value={cityForm.countryCode}
                    onChange={(v) =>
                      setCityForm((s) => ({
                        ...s,
                        countryCode: v.toUpperCase(),
                      }))
                    }
                  />
                  <Field
                    label="Страна"
                    value={cityForm.countryName}
                    onChange={(v) =>
                      setCityForm((s) => ({ ...s, countryName: v }))
                    }
                  />
                </div>
              )}

              {kind === "countries" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="ISO"
                    value={countryForm.code}
                    onChange={(v) =>
                      setCountryForm((s) => ({ ...s, code: v.toUpperCase() }))
                    }
                  />
                  <Field
                    label="ID"
                    value={String(countryForm.id)}
                    onChange={(v) =>
                      setCountryForm((s) => ({ ...s, id: Number(v) || 0 }))
                    }
                  />
                  <Field
                    label="Название"
                    value={countryForm.name}
                    onChange={(v) =>
                      setCountryForm((s) => ({ ...s, name: v }))
                    }
                  />
                  <Field
                    label="EN"
                    value={countryForm.nameEn}
                    onChange={(v) =>
                      setCountryForm((s) => ({ ...s, nameEn: v }))
                    }
                  />
                </div>
              )}

              {kind === "groups" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="ID"
                    value={String(groupForm.id)}
                    onChange={(v) =>
                      setGroupForm((s) => ({ ...s, id: Number(v) || 0 }))
                    }
                  />
                  <Field
                    label="Название"
                    value={groupForm.name}
                    onChange={(v) => setGroupForm((s) => ({ ...s, name: v }))}
                  />
                  <Field
                    label="EN"
                    value={groupForm.nameEn}
                    onChange={(v) =>
                      setGroupForm((s) => ({ ...s, nameEn: v }))
                    }
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Сохранить в БД
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink-muted"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-ink-muted">
            Показано {visible.length}
            {items.length > visible.length
              ? ` из ${items.length} (уточните поиск)`
              : items.length
                ? ` · всего ${items.length}`
                : ""}
          </p>

          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                Ничего не найдено
              </p>
            ) : (
              visible.map((row) => {
                const key =
                  kind === "groups"
                    ? `g-${(row as GroupRow).id}`
                    : (row as { code: string }).code;
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      {kind === "currencies" && (
                        <>
                          <p className="font-mono text-sm font-semibold text-accent">
                            {(row as CurrencyRow).code}
                          </p>
                          <p className="text-sm text-ink">
                            {(row as CurrencyRow).name}
                            {(row as CurrencyRow).cash ? " · cash" : ""}
                            {(row as CurrencyRow).crypto ? " · crypto" : ""}
                          </p>
                        </>
                      )}
                      {kind === "cities" && (
                        <>
                          <p className="font-mono text-sm font-semibold text-accent">
                            {(row as CityRow).code}
                          </p>
                          <p className="text-sm text-ink">
                            {(row as CityRow).name}
                            {(row as CityRow).countryName
                              ? ` · ${(row as CityRow).countryName}`
                              : ""}
                          </p>
                        </>
                      )}
                      {kind === "countries" && (
                        <>
                          <p className="font-mono text-sm font-semibold text-accent">
                            {(row as CountryRow).code}
                          </p>
                          <p className="text-sm text-ink">
                            {(row as CountryRow).name}
                          </p>
                        </>
                      )}
                      {kind === "groups" && (
                        <>
                          <p className="font-mono text-sm font-semibold text-accent">
                            #{(row as GroupRow).id}
                          </p>
                          <p className="text-sm text-ink">
                            {(row as GroupRow).name}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(row)}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(row)}
                        className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </AdminSection>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
