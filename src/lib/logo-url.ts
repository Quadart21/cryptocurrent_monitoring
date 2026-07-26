import type { ExchangerLogo } from "@/lib/store-types";

export function logoPublicUrl(
  exchangerId: string,
  logo: ExchangerLogo | null | undefined,
): string | null {
  if (!logo) return null;
  return `/api/logos/${encodeURIComponent(exchangerId)}?v=${encodeURIComponent(logo.updatedAt)}`;
}
