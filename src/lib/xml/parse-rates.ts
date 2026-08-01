import { XMLParser } from "fast-xml-parser";

export type ParsedRateItem = {
  from: string;
  to: string;
  in: number;
  out: number;
  /** out / in — сколько единиц `to` за 1 единицу `from` */
  rate: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  city?: string;
  param?: string;
  tofee?: string;
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  // BestChange feeds often use "0.0037 BTC" / "300 USDT" — take leading number.
  const raw = String(value).trim().replace(",", ".").replace(/\s+/g, " ");
  const match = raw.match(/^[-+]?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  isArray: (name) => name === "item",
});

/**
 * Parses monitoring XML export (`rates.xml` / `<rates><item>…`).
 * Supports classic `minamount`/`maxamount` and newer `frommin`/`frommax`.
 */
export function parseRatesXml(xml: string): ParsedRateItem[] {
  const doc = parser.parse(xml);
  const root = doc?.rates ?? doc?.Rates;
  if (!root) {
    throw new Error("Некорректный XML: нет корневого элемента <rates>");
  }

  const items = asArray(root.item ?? root.Item);
  if (!items.length) {
    throw new Error("В XML нет направлений (<item>)");
  }

  const result: ParsedRateItem[] = [];

  for (const raw of items) {
    const from = str(raw.from ?? raw.From).toUpperCase();
    const to = str(raw.to ?? raw.To).toUpperCase();
    const inAmount = num(raw.in ?? raw.In);
    const outAmount = num(raw.out ?? raw.Out);

    if (!from || !to || inAmount <= 0 || outAmount <= 0) continue;

    const minAmount = num(
      raw.minamount ?? raw.minAmount ?? raw.frommin ?? raw.fromMin,
      0,
    );
    const maxAmount = num(
      raw.maxamount ?? raw.maxAmount ?? raw.frommax ?? raw.fromMax,
      Number.POSITIVE_INFINITY,
    );

    result.push({
      from,
      to,
      in: inAmount,
      out: outAmount,
      rate: outAmount / inAmount,
      reserve: num(raw.amount ?? raw.Amount),
      minAmount,
      maxAmount: Number.isFinite(maxAmount) ? maxAmount : Number.POSITIVE_INFINITY,
      city: str(raw.city ?? raw.City) || undefined,
      param: str(raw.param ?? raw.Param) || undefined,
      tofee: str(raw.tofee ?? raw.toFee) || undefined,
    });
  }

  if (!result.length) {
    throw new Error("Не удалось разобрать ни одного валидного направления");
  }

  return result;
}
