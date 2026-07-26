"use client";

import { useEffect, useRef } from "react";

function sendTrafficEvent(id: string, event: "view" | "click") {
  const payload = JSON.stringify({ id, event });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/exchangers/track",
        new Blob([payload], { type: "application/json" }),
      );
      if (ok) return;
    }
  } catch {
    // fall through
  }
  void fetch("/api/exchangers/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

/** Клик «Перейти на сайт» */
export function ExchangerOutboundLink({
  exchangerId,
  href,
  className,
  children,
}: {
  exchangerId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => sendTrafficEvent(exchangerId, "click")}
    >
      {children}
    </a>
  );
}

/** Просмотр страницы обменника */
export function ExchangerPageViewBeacon({ exchangerId }: { exchangerId: string }) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    sendTrafficEvent(exchangerId, "view");
  }, [exchangerId]);
  return null;
}
