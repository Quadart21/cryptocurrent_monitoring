"use client";

const sentImpressions = new Set<string>();

export function trackAdEvent(
  id: string,
  event: "impression" | "click",
): void {
  if (!id) return;
  if (event === "impression") {
    if (sentImpressions.has(id)) return;
    sentImpressions.add(id);
  }

  const payload = JSON.stringify({ id, event });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/ads/track",
        new Blob([payload], { type: "application/json" }),
      );
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/ads/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackAdClick(id: string) {
  trackAdEvent(id, "click");
}

export function trackAdImpression(id: string) {
  trackAdEvent(id, "impression");
}
