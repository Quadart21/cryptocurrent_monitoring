import type { RateOffer } from "./types";

/** Demo rates — approximate market levels for UI, not live quotes. */
export const rateOffers: RateOffer[] = [
  // BTC → RUB
  { id: "r1", exchangerId: "1", from: "BTC", to: "RUB", rate: 8_420_000, reserve: 42_000_000, minAmount: 0.005, maxAmount: 1.5, avgMinutes: 14 },
  { id: "r2", exchangerId: "2", from: "BTC", to: "RUB", rate: 8_395_000, reserve: 28_500_000, minAmount: 0.01, maxAmount: 2, avgMinutes: 11 },
  { id: "r3", exchangerId: "5", from: "BTC", to: "RUB", rate: 8_370_000, reserve: 15_200_000, minAmount: 0.003, maxAmount: 0.8, avgMinutes: 18 },
  { id: "r4", exchangerId: "6", from: "BTC", to: "RUB", rate: 8_350_000, reserve: 55_000_000, minAmount: 0.01, maxAmount: 3, avgMinutes: 16 },
  { id: "r5", exchangerId: "7", from: "BTC", to: "RUB", rate: 8_455_000, reserve: 9_800_000, minAmount: 0.002, maxAmount: 0.5, avgMinutes: 22 },
  { id: "r6", exchangerId: "9", from: "BTC", to: "RUB", rate: 8_360_000, reserve: 21_000_000, minAmount: 0.005, maxAmount: 1, avgMinutes: 13 },

  // USDT → RUB
  { id: "r7", exchangerId: "1", from: "USDT", to: "RUB", rate: 79.15, reserve: 38_000_000, minAmount: 50, maxAmount: 150_000, avgMinutes: 9 },
  { id: "r8", exchangerId: "3", from: "USDT", to: "RUB", rate: 79.42, reserve: 52_000_000, minAmount: 30, maxAmount: 200_000, avgMinutes: 7 },
  { id: "r9", exchangerId: "4", from: "USDT", to: "RUB", rate: 78.95, reserve: 18_000_000, minAmount: 100, maxAmount: 80_000, avgMinutes: 15 },
  { id: "r10", exchangerId: "7", from: "USDT", to: "RUB", rate: 79.55, reserve: 11_500_000, minAmount: 20, maxAmount: 50_000, avgMinutes: 12 },
  { id: "r11", exchangerId: "9", from: "USDT", to: "RUB", rate: 79.08, reserve: 33_000_000, minAmount: 50, maxAmount: 120_000, avgMinutes: 8 },
  { id: "r12", exchangerId: "10", from: "USDT", to: "RUB", rate: 79.28, reserve: 70_000_000, minAmount: 3000, maxAmount: 500_000, avgMinutes: 20 },

  // ETH → RUB
  { id: "r13", exchangerId: "2", from: "ETH", to: "RUB", rate: 312_400, reserve: 19_000_000, minAmount: 0.05, maxAmount: 40, avgMinutes: 12 },
  { id: "r14", exchangerId: "5", from: "ETH", to: "RUB", rate: 313_100, reserve: 12_400_000, minAmount: 0.03, maxAmount: 25, avgMinutes: 14 },
  { id: "r15", exchangerId: "1", from: "ETH", to: "RUB", rate: 311_800, reserve: 24_000_000, minAmount: 0.05, maxAmount: 50, avgMinutes: 13 },
  { id: "r16", exchangerId: "6", from: "ETH", to: "RUB", rate: 311_200, reserve: 30_000_000, minAmount: 0.1, maxAmount: 60, avgMinutes: 17 },

  // RUB → USDT
  { id: "r17", exchangerId: "3", from: "RUB", to: "USDT", rate: 0.01248, reserve: 420_000, minAmount: 5000, maxAmount: 2_000_000, avgMinutes: 8 },
  { id: "r18", exchangerId: "1", from: "RUB", to: "USDT", rate: 0.01241, reserve: 310_000, minAmount: 10_000, maxAmount: 1_500_000, avgMinutes: 10 },
  { id: "r19", exchangerId: "9", from: "RUB", to: "USDT", rate: 0.01245, reserve: 280_000, minAmount: 5000, maxAmount: 1_000_000, avgMinutes: 9 },
  { id: "r20", exchangerId: "4", from: "RUB", to: "USDT", rate: 0.01236, reserve: 190_000, minAmount: 15_000, maxAmount: 800_000, avgMinutes: 16 },

  // BTC → USDT
  { id: "r21", exchangerId: "2", from: "BTC", to: "USDT", rate: 106_350, reserve: 890_000, minAmount: 0.01, maxAmount: 5, avgMinutes: 10 },
  { id: "r22", exchangerId: "5", from: "BTC", to: "USDT", rate: 106_120, reserve: 540_000, minAmount: 0.005, maxAmount: 2, avgMinutes: 12 },
  { id: "r23", exchangerId: "6", from: "BTC", to: "USDT", rate: 105_980, reserve: 1_200_000, minAmount: 0.02, maxAmount: 8, avgMinutes: 15 },

  // USDT → SBP
  { id: "r24", exchangerId: "3", from: "USDT", to: "SBP", rate: 79.38, reserve: 41_000_000, minAmount: 30, maxAmount: 250_000, avgMinutes: 6 },
  { id: "r25", exchangerId: "1", from: "USDT", to: "SBP", rate: 79.12, reserve: 29_000_000, minAmount: 50, maxAmount: 180_000, avgMinutes: 8 },
  { id: "r26", exchangerId: "9", from: "USDT", to: "SBP", rate: 79.05, reserve: 22_000_000, minAmount: 40, maxAmount: 100_000, avgMinutes: 7 },

  // USDT → TINK
  { id: "r27", exchangerId: "9", from: "USDT", to: "TINK", rate: 79.18, reserve: 26_000_000, minAmount: 50, maxAmount: 150_000, avgMinutes: 8 },
  { id: "r28", exchangerId: "3", from: "USDT", to: "TINK", rate: 79.33, reserve: 35_000_000, minAmount: 30, maxAmount: 200_000, avgMinutes: 7 },

  // XMR → RUB
  { id: "r29", exchangerId: "8", from: "XMR", to: "RUB", rate: 16_850, reserve: 8_200_000, minAmount: 0.2, maxAmount: 40, avgMinutes: 25 },
  { id: "r30", exchangerId: "6", from: "XMR", to: "RUB", rate: 16_620, reserve: 6_500_000, minAmount: 0.5, maxAmount: 30, avgMinutes: 20 },
];
