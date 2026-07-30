"use client";

import { useEffect } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  pending: "На проверке",
  rejected: "Отклонён",
  error: "Ошибка",
  approved: "Одобрен",
  hidden: "Скрыт",
  verified: "Проверен",
  logo: "Есть логотип",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export type AdminTabItem<T extends string = string> = {
  id: T;
  label: string;
  badge?: number;
};

export function AdminTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<AdminTabItem<T>>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex flex-wrap gap-1 rounded-2xl border border-line bg-bg-soft/40 p-1"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            value === t.id
              ? "bg-accent text-white shadow-sm"
              : "text-ink-muted hover:bg-bg-soft hover:text-ink"
          }`}
        >
          {t.label}
          {typeof t.badge === "number" && t.badge > 0 ? (
            <span
              className={`ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-md px-1 text-[11px] font-semibold tabular-nums ${
                value === t.id ? "bg-white/20 text-white" : "bg-warn/20 text-warn"
              }`}
            >
              {t.badge > 99 ? "99+" : t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function AdminDrawer({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex h-full w-full ${widthClassName} flex-col border-l border-line bg-bg shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            Закрыть
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-ink-muted">
      <span>
        {Math.min(total, (page - 1) * pageSize + 1)}–
        {Math.min(total, page * pageSize)} из {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-line px-2.5 py-1.5 font-semibold disabled:opacity-40"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-line px-2.5 py-1.5 font-semibold disabled:opacity-40"
        >
          Далее
        </button>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminStatGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number; tone?: "warn" | "ok" }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card px-4 py-3">
          <p className="text-xs text-ink-muted">{item.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              item.tone === "warn"
                ? "text-warn"
                : item.tone === "ok"
                  ? "text-ok"
                  : "text-ink"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="border-b border-line bg-bg-soft/40 px-5 py-3.5">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active" || status === "approved" || status === "verified"
      ? "bg-ok/20 text-ok"
      : status === "pending" || status === "logo"
        ? "bg-warn/20 text-warn"
        : status === "rejected" || status === "error"
          ? "bg-danger/15 text-danger"
          : "bg-bg-soft text-ink-muted";

  return (
    <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}
