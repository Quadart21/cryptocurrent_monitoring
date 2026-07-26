export function formatAmount(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
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
