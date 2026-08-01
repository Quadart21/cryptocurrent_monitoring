export type ApiGroup = { id: number; name: string };

export type ApiCountry = { id: number; name: string; code: string };

export type ApiCity = {
  id: number;
  name: string;
  code: string;
  country: number;
};

export type ApiCurrency = {
  id: number;
  name: string;
  urlname: string;
  viewname: string;
  code: string;
  crypto: boolean;
  cash: boolean;
  ps: number;
  group: number;
};

export type ApiChanger = {
  id: number;
  name: string;
  langs: string[];
  urls: Record<string, string>;
  pages: Record<string, string>;
  reserve: number;
  reviews: {
    claim: number;
    closed: number;
    neutral: number;
    positive: number;
  };
  rating: number;
  active: boolean;
};

export type ApiPresence = {
  pair: string;
  best: number;
  count: number;
};

export type ApiExchangeRate = {
  changer: number;
  rate: number;
  rankrate: string;
  reserve: string;
  inmin: string;
  inmax: string;
  marks: string[];
};
