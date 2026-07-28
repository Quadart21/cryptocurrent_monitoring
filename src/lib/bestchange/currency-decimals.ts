/** Lightweight decimals helper — no BestChange JSON in the client bundle. */
export function currencyDecimals(code: string): number {
  const upper = code.toUpperCase();
  if (upper.startsWith("CASH")) return 0;

  // Stablecoins (check before fiat markers — USDT contains "USD")
  if (
    /^(USDT|USDC|DAI|BUSD|TUSD|USDP|FDUSD|PYUSD|EURC|EURT|UST|FRAX)/.test(
      upper,
    )
  ) {
    return 2;
  }

  // Fiat / bank / e-money codes (ACRUB, SBERRUB, CARDUSD, …)
  if (
    /(RUB|UAH|KZT|BYN|USD|EUR|GBP|TRY|GEL|AZN|CNY|PLN|THB|AED|AMD|UZS|KGS|TJS|MDL|CHF|JPY|CAD|AUD|NZD|SEK|NOK|DKK|CZK|HUF|RON|BGN|INR|IDR|VND|BRL|ARS|MXN|ZAR|KRW|HKD|SGD)/.test(
      upper,
    )
  ) {
    return 2;
  }

  // Crypto (BTC, ETH, LTC, XMR, SOL, …) and unknown ticker-like codes:
  // 8 decimals so fiat→crypto unit rates never round to 0.
  if (/^[A-Z0-9]+$/.test(upper) && upper.length <= 16) return 8;

  return 2;
}
