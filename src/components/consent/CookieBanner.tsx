"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useConsent } from "@/components/consent/ConsentProvider";

export function CookieBanner() {
  const pathname = usePathname();
  const { ready, consent, acceptAll, acceptNecessary } = useConsent();
  const [title, setTitle] = useState("Мы используем cookies");
  const [body, setBody] = useState(
    "Необходимые cookies нужны для работы сайта. Аналитические — только с вашего согласия.",
  );

  const hiddenPath =
    pathname === "/cabinet" ||
    pathname.startsWith("/cabinet/") ||
    pathname === "/trulala" ||
    pathname.startsWith("/trulala/");

  useEffect(() => {
    if (hiddenPath) return;
    let cancelled = false;
    void fetch("/api/legal/banner", { next: { revalidate: 60 } })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: { bannerTitle?: string; bannerBody?: string } | null) => {
          if (cancelled || !data) return;
          if (data.bannerTitle) setTitle(data.bannerTitle);
          if (data.bannerBody) setBody(data.bannerBody);
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hiddenPath]);

  if (hiddenPath || !ready || consent) return null;

  return (
    <div
      role="dialog"
      aria-label="Согласие на cookies"
      className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[1.5rem] border border-line bg-bg-elevated/95 p-4 shadow-[var(--card-shadow)] backdrop-blur-md sm:flex-row sm:items-end sm:p-5">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display text-base font-semibold text-ink">
            {title}
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
          <p className="text-xs text-ink-muted">
            <Link
              href="/cookies"
              className="text-accent underline-offset-2 hover:underline"
            >
              Политика cookies
            </Link>
            {" · "}
            <Link
              href="/privacy"
              className="text-accent underline-offset-2 hover:underline"
            >
              Конфиденциальность
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          <button
            type="button"
            onClick={acceptAll}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            Принять все
          </button>
          <button
            type="button"
            onClick={acceptNecessary}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-accent/40 hover:text-ink"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
