import type { Metadata } from "next";
import Link from "next/link";
import { listExchangers } from "@/lib/store";
import { formatRating } from "@/lib/format";

export const metadata: Metadata = { title: "Обменники" };
export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  active: "Онлайн",
  error: "Ошибка фида",
  pending: "На проверке",
  rejected: "Отклонён",
};

export default async function ExchangersPage() {
  const exchangers = [...(await listExchangers({ publicOnly: true }))].sort(
    (a, b) => b.rating - a.rating,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Обменники
          </h1>
          <p className="mt-2 text-ink-muted">
            Курсы читаются из XML-фидов раз в минуту.
          </p>
        </div>
        <Link
          href="/apply"
          className="btn-primary inline-flex w-fit rounded-2xl px-4 py-2.5 text-sm font-semibold"
        >
          Добавить обменник
        </Link>
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {exchangers.map((ex, index) => (
          <Link
            key={ex.id}
            href={`/exchangers/${ex.slug}`}
            className="flex flex-col gap-3 px-5 py-4 transition hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-4">
              <span className="mt-1 w-6 tabular-nums text-sm text-ink-muted">
                {index + 1}
              </span>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white">
                {ex.name.slice(0, 1)}
              </div>
              <div>
                <p className="font-semibold text-ink">{ex.name}</p>
                <p className="mt-1 max-w-xl text-sm text-ink-muted">
                  {ex.description}
                </p>
              </div>
            </div>
            <div className="flex gap-4 pl-10 text-sm sm:pl-0">
              <span>★ {formatRating(ex.rating)}</span>
              <span className="text-ink-muted">{ex.pairCount} пар</span>
              <span className="text-ink-muted">
                {statusLabel[ex.status] ?? ex.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
