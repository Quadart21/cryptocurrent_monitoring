import { getCurrency } from "@/data/currencies";
import { getExchangerById } from "@/data/exchangers";
import { rateOffers } from "@/data/rates";
import type { Exchanger, RateOffer } from "@/data/types";

export type RankedOffer = RateOffer & {
  exchanger: Exchanger;
  receive: number;
  rank: number;
};

export function getOffersForPair(
  from: string,
  to: string,
  amount: number,
  options?: { onlineOnly?: boolean },
): RankedOffer[] {
  const onlineOnly = options?.onlineOnly ?? true;

  const rows = rateOffers
    .filter((o) => o.from === from && o.to === to)
    .map((o) => {
      const exchanger = getExchangerById(o.exchangerId);
      if (!exchanger) return null;
      if (onlineOnly && exchanger.status === "offline") return null;

      const receive = amount * o.rate;
      const withinLimits = amount >= o.minAmount && amount <= o.maxAmount;
      if (!withinLimits && amount > 0) {
        // still show, but could filter — keep visible with receive calc
      }

      return { ...o, exchanger, receive, rank: 0 };
    })
    .filter((o): o is RankedOffer => o !== null)
    .sort((a, b) => b.receive - a.receive || b.exchanger.rating - a.exchanger.rating);

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function defaultAmountFor(code: string): number {
  const c = getCurrency(code);
  if (!c) return 1;
  if (c.code === "BTC") return 0.1;
  if (c.code === "ETH") return 1;
  if (c.code === "XMR") return 2;
  if (c.kind === "bank" || c.code === "RUB") return 50_000;
  if (c.code === "USDT" || c.code === "USDC" || c.code === "USD") return 1000;
  return 1;
}
