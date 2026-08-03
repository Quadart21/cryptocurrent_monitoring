"use client";

/** Shared prev/next pager for public + owner review lists. */
export function ReviewsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = Math.min(total, (page - 1) * pageSize + 1);
  const to = Math.min(total, page * pageSize);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-ink-muted ${className}`}
    >
      <span className="tabular-nums">
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-10 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Назад
        </button>
        <span className="min-w-[4.5rem] text-center text-xs tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-10 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
