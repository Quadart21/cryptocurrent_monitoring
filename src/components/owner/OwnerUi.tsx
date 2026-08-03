"use client";

import type { ReactNode } from "react";
import { toneClass } from "@/components/owner/owner-utils";

export function OwnerBadge({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(tone)}`}
    >
      {children}
    </span>
  );
}

export function OwnerStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-elevated p-4 shadow-[0_1px_0_rgba(23,21,31,0.04)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function OwnerSectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-bg-elevated p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function OwnerCopyButton({
  text,
  label = "Скопировать",
  doneLabel = "Скопировано",
}: {
  text: string;
  label?: string;
  doneLabel?: string;
}) {
  return (
    <button
      type="button"
      className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold"
      onClick={async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.textContent;
          btn.textContent = doneLabel;
          window.setTimeout(() => {
            btn.textContent = prev;
          }, 1600);
        } catch {
          btn.textContent = "Не удалось скопировать";
          window.setTimeout(() => {
            btn.textContent = label;
          }, 1600);
        }
      }}
    >
      {label}
    </button>
  );
}

export function OwnerEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-bg-soft/40 px-4 py-8 text-center sm:px-6">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
    </div>
  );
}
