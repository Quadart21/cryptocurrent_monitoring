import type { BannerCheckJson } from "@/db/schema";

export type BannerCheckStatus = BannerCheckJson["status"];

export function emptyBannerCheck(): BannerCheckJson {
  return {
    status: "pending",
    lastCheckAt: null,
    lastSeenAt: null,
    missingSince: null,
    consecutiveMisses: 0,
    lastError: null,
    lastNotifiedAt: null,
    lastOwnerWarnedAt: null,
    ownerWarnCount: 0,
  };
}

export function normalizeBannerCheck(
  value: BannerCheckJson | null | undefined,
): BannerCheckJson {
  if (!value || typeof value !== "object") return emptyBannerCheck();
  return {
    status:
      value.status === "ok" ||
      value.status === "missing" ||
      value.status === "error" ||
      value.status === "pending"
        ? value.status
        : "pending",
    lastCheckAt: value.lastCheckAt ?? null,
    lastSeenAt: value.lastSeenAt ?? null,
    missingSince: value.missingSince ?? null,
    consecutiveMisses: Number(value.consecutiveMisses ?? 0) || 0,
    lastError: value.lastError ?? null,
    lastNotifiedAt: value.lastNotifiedAt ?? null,
    lastOwnerWarnedAt: value.lastOwnerWarnedAt ?? null,
    ownerWarnCount: Number(value.ownerWarnCount ?? 0) || 0,
  };
}

export function newBannerToken(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `gs_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Public badge image URL for a token. */
export function bannerImageUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/badge/${encodeURIComponent(token)}`;
}

/** HTML snippet exchangers must place on their site. */
export function bannerEmbedHtml(input: {
  siteUrl: string;
  token: string;
  slug: string;
}): string {
  const base = input.siteUrl.replace(/\/$/, "");
  const href = `${base}/?utm_source=badge&utm_medium=partner&utm_campaign=${encodeURIComponent(input.slug)}`;
  const img = bannerImageUrl(base, input.token);
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" data-gapsnap-badge="${input.token}"><img src="${img}" alt="GapSnap — мониторинг обменников" width="88" height="31" /></a>`;
}

/** True if HTML of partner site contains our badge marker. */
export function htmlHasGapSnapBanner(html: string, token: string): boolean {
  if (!html || !token) return false;
  const needle = token.trim();
  if (!needle) return false;
  if (html.includes(`data-gapsnap-badge="${needle}"`)) return true;
  if (html.includes(`data-gapsnap-badge='${needle}'`)) return true;
  if (html.includes(`/badge/${needle}`)) return true;
  return false;
}

export function bannerStatusLabel(status: BannerCheckStatus): string {
  switch (status) {
    case "ok":
      return "Баннер найден";
    case "missing":
      return "Баннер не найден";
    case "error":
      return "Ошибка проверки";
    default:
      return "Ожидает проверки";
  }
}
