"use client";

type Props = {
  exchangers: number;
  pairs: number;
  lastSyncAt: string | null;
};

export function OverviewCards({ exchangers, pairs, lastSyncAt }: Props) {
  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString("ru-RU")
    : "ожидание";

  return (
    <div className="card animate-rise relative overflow-hidden p-5">
      <div className="absolute -right-8 -top-10 size-36 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--promo-to)] opacity-30 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-ink-muted">Мониторинг сейчас</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">
              {pairs.toLocaleString("ru-RU")}
            </p>
            <p className="mt-1 text-sm text-ink-muted">активных направлений</p>
          </div>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] px-2.5 py-1 text-xs font-semibold text-ok">
            live
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-bg-soft/70 p-3">
            <p className="text-xs text-ink-muted">Обменники</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {exchangers}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-bg-soft/70 p-3">
            <p className="text-xs text-ink-muted">Синхронизация</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {syncLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
