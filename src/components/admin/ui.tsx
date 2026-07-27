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
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        {description ? (
          <div className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</div>
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
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
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
