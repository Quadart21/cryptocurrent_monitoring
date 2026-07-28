/** Client-safe default amount heuristics (no server-only catalog import). */
export function defaultAmountFor(code: string): number {
  const upper = code.toUpperCase();
  if (upper.includes("BTC")) return 0.1;
  if (upper.includes("ETH")) return 1;
  if (upper.includes("RUB") || upper.includes("CASH")) return 50_000;
  if (upper.startsWith("USDT") || upper.startsWith("USDC")) return 1000;
  return 1;
}
