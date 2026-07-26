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

export function formatRating(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
