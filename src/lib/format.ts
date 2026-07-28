export function formatAmount(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  let maxFrac = decimals;
  // Fiat→crypto unit rates (e.g. ACRUB→BTC ≈ 1e-7) must not round to "0".
  if (value !== 0 && Math.abs(value) < 5 * 10 ** -decimals) {
    const needed = Math.ceil(-Math.log10(Math.abs(value))) + 1;
    maxFrac = Math.min(12, Math.max(decimals, needed));
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(value);
}

/** Unit exchange rate: adaptive precision so tiny crypto rates stay readable. */
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
  const needed = Math.ceil(-Math.log10(abs)) + 2;
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.min(12, Math.max(8, needed)),
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
