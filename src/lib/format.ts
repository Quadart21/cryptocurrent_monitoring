import { currencyDecimals } from "@/lib/bestchange/currency-decimals";

function fractionDigitsFor(value: number, preferred: number): number {
  if (!Number.isFinite(value) || value === 0) return preferred;
  const abs = Math.abs(value);
  // Prefer currency decimals, but bump precision so non-zero never shows as "0".
  if (abs >= 1 || abs >= 5 * 10 ** -preferred) return preferred;
  const needed = Math.ceil(-Math.log10(abs)) + 1;
  return Math.min(12, Math.max(preferred, needed));
}

export function formatAmount(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigitsFor(value, decimals),
  }).format(value);
}

/** Amount in a known currency code — adaptive so tiny crypto never collapses to 0. */
export function formatCurrencyAmount(value: number, code: string): string {
  return formatAmount(value, currencyDecimals(code));
}

/** Unit exchange rate (to per 1 from): adaptive for any pair. */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
      value,
    );
  }
  if (abs >= 1) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(
      value,
    );
  }
  // Fiat→crypto unit rates (≈1e-7…1e-3): keep enough significant digits.
  const needed = Math.ceil(-Math.log10(abs)) + 2;
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.min(12, Math.max(6, needed)),
  }).format(value);
}

export function formatReserve(value: number, symbol: string): string {
  if (value >= 1_000_000) {
    return `${formatAmount(value / 1_000_000, 1)} млн ${symbol}`;
  }
  if (value >= 1_000) {
    return `${formatAmount(value / 1_000, 1)} тыс. ${symbol}`;
  }
  return `${formatAmount(value, 0)} ${symbol}`;
}

/** XML min/max (`minamount`/`maxamount` or `frommin`/`frommax`) as «от … / до …». */
export function formatVolumeLimits(
  minAmount: number,
  maxAmount: number,
  code: string,
): { from: string; to: string } | null {
  const hasMin = Number.isFinite(minAmount) && minAmount > 0;
  const hasMax = Number.isFinite(maxAmount) && maxAmount > 0;
  if (!hasMin && !hasMax) return null;
  return {
    from: hasMin ? formatCurrencyAmount(minAmount, code) : "—",
    to: hasMax ? formatCurrencyAmount(maxAmount, code) : "—",
  };
}

export function formatRating(value: number, reviewCount?: number): string {
  if (reviewCount === 0 || (reviewCount === undefined && value <= 0)) {
    return "—";
  }
  return value.toFixed(2).replace(".", ",");
}

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

/** «с мая 2025» */
export function formatWorkingSince(iso: string | null | undefined): string {
  if (!iso) return "дата уточняется";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "дата уточняется";
  const month = MONTHS_GENITIVE[d.getUTCMonth()] ?? "";
  return `с ${month} ${d.getUTCFullYear()}`;
}
