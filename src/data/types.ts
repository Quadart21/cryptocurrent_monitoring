export type CurrencyKind = "crypto" | "fiat" | "bank";

export type Currency = {
  code: string;
  name: string;
  kind: CurrencyKind;
  symbol: string;
  decimals: number;
};

export type ExchangerStatus = "online" | "offline" | "busy";

export type Exchanger = {
  id: string;
  slug: string;
  name: string;
  rating: number;
  reviews: number;
  ageYears: number;
  verified: boolean;
  status: ExchangerStatus;
  website: string;
  description: string;
};

export type RateOffer = {
  id: string;
  exchangerId: string;
  from: string;
  to: string;
  rate: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  avgMinutes: number;
};
