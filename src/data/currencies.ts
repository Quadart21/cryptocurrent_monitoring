import type { Currency } from "./types";

export const currencies: Currency[] = [
  { code: "BTC", name: "Bitcoin", kind: "crypto", symbol: "₿", decimals: 6 },
  { code: "ETH", name: "Ethereum", kind: "crypto", symbol: "Ξ", decimals: 5 },
  { code: "USDT", name: "Tether TRC20", kind: "crypto", symbol: "₮", decimals: 2 },
  { code: "USDC", name: "USD Coin", kind: "crypto", symbol: "$", decimals: 2 },
  { code: "LTC", name: "Litecoin", kind: "crypto", symbol: "Ł", decimals: 4 },
  { code: "XMR", name: "Monero", kind: "crypto", symbol: "ɱ", decimals: 4 },
  { code: "RUB", name: "Сбербанк RUB", kind: "bank", symbol: "₽", decimals: 0 },
  { code: "TINK", name: "Т-Банк RUB", kind: "bank", symbol: "₽", decimals: 0 },
  { code: "SBP", name: "СБП RUB", kind: "bank", symbol: "₽", decimals: 0 },
  { code: "USD", name: "USD Cash", kind: "fiat", symbol: "$", decimals: 2 },
];

export const popularPairs: [string, string][] = [
  ["BTC", "RUB"],
  ["USDT", "RUB"],
  ["ETH", "RUB"],
  ["RUB", "USDT"],
  ["BTC", "USDT"],
  ["USDT", "SBP"],
];

export function getCurrency(code: string): Currency | undefined {
  return currencies.find((c) => c.code === code);
}
