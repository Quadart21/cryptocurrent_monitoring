/** Lightweight decimals helper — no BestChange JSON in the client bundle. */
export function currencyDecimals(code: string): number {
  const upper = code.toUpperCase();
  if (upper.startsWith("CASH")) return 0;
  if (upper === "BTC" || upper.startsWith("BTC")) return 6;
  if (upper === "ETH" || upper.startsWith("ETH")) return 5;
  if (
    upper.includes("RUB") ||
    upper.includes("UAH") ||
    upper.includes("KZT") ||
    upper.includes("BYN") ||
    upper.includes("USD") ||
    upper.includes("EUR")
  ) {
    return 2;
  }
  if (
    upper.startsWith("USDT") ||
    upper.startsWith("USDC") ||
    upper.startsWith("DAI")
  ) {
    return 2;
  }
  // Unknown codes: crypto-ish default
  if (/^[A-Z0-9]+$/.test(upper) && upper.length <= 10) return 4;
  return 2;
}
