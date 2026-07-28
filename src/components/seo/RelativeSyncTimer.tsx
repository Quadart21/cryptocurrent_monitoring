"use client";

import { useEffect, useState } from "react";

export function RelativeSyncTimer({
  syncedAt,
}: {
  syncedAt: string | null | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!syncedAt) {
    return <span className="text-xs text-ink-muted">Нет данных синка</span>;
  }

  const ts = Date.parse(syncedAt);
  if (!Number.isFinite(ts)) {
    return <span className="text-xs text-ink-muted">Обновление…</span>;
  }

  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  let label: string;
  if (sec < 5) label = "только что";
  else if (sec < 60) label = `${sec} сек назад`;
  else if (sec < 3600) label = `${Math.floor(sec / 60)} мин назад`;
  else label = `${Math.floor(sec / 3600)} ч назад`;

  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
      <span className="live-dot size-2 rounded-full bg-ok" />
      Обновлено {label}
    </span>
  );
}
