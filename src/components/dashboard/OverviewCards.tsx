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
    <div className="card animate-rise p-5">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-ink-muted">Мониторинг сейчас</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">
              {pairs.toLocaleString("ru-RU")}
            </p>
            <p className="mt-1 text-sm text-ink-muted">активных направлений</p>
          </div>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">
            онлайн
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-bg-soft p-3">
            <p className="text-xs text-ink-muted">Обменники</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {exchangers}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-bg-soft p-3">
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
