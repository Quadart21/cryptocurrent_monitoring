/** Client-safe amount helpers for the exchange calculator. */

export function defaultAmountFor(code: string): number {
  const upper = code.toUpperCase();
  if (upper.includes("BTC")) return 0.1;
  if (upper.includes("ETH")) return 1;
  if (upper.includes("XMR") || upper.includes("LTC")) return 2;
  if (upper.includes("RUB") || upper.includes("CASHRUB")) return 50_000;
  if (upper.includes("UAH")) return 10_000;
  if (upper.includes("KZT")) return 200_000;
  if (upper.startsWith("USDT") || upper.startsWith("USDC") || upper.includes("USD"))
    return 1000;
  if (upper.includes("EUR")) return 1000;
  return 1;
}

/** Quick-pick chips around a sensible default for the currency. */
export function amountPresetsFor(code: string): number[] {
  const base = defaultAmountFor(code);
  if (base >= 10_000) {
    return uniquePositive([base / 5, base / 2, base, base * 2]);
  }
  if (base >= 100) {
    return uniquePositive([base / 2, base, base * 2, base * 5]);
  }
  if (base >= 1) {
    return uniquePositive([base / 2, base, base * 2, base * 5]);
  }
  return uniquePositive([base / 2, base, base * 2, base * 5]);
}

function uniquePositive(values: number[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) continue;
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function offerFitsAmount(
  amount: number,
  offer: {
    minAmount: number;
    maxAmount: number;
    rate: number;
    reserve: number;
  },
): { ok: boolean; reason: "min" | "max" | "reserve" | null } {
  if (!(amount > 0)) return { ok: true, reason: null };
  if (Number.isFinite(offer.minAmount) && offer.minAmount > 0 && amount < offer.minAmount) {
    return { ok: false, reason: "min" };
  }
  if (
    Number.isFinite(offer.maxAmount) &&
    offer.maxAmount > 0 &&
    amount > offer.maxAmount
  ) {
    return { ok: false, reason: "max" };
  }
  const receive = amount * offer.rate;
  if (
    Number.isFinite(offer.reserve) &&
    offer.reserve > 0 &&
    receive > offer.reserve
  ) {
    return { ok: false, reason: "reserve" };
  }
  return { ok: true, reason: null };
}
