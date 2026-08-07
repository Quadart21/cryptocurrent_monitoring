/** Parse allow/block lists: codes (BTC) and pairs (BTC-SBPRUB or BTC:SBPRUB). */
export type PairFilter = {
  codes: Set<string>;
  pairs: Set<string>;
};

export function parsePairFilter(raw: string): PairFilter {
  const codes = new Set<string>();
  const pairs = new Set<string>();
  for (const part of (raw || "").split(/[,;\n]+/)) {
    const token = part.trim().toUpperCase();
    if (!token) continue;
    const m = token.match(/^([A-Z0-9]+)[:\-]([A-Z0-9]+)$/);
    if (m) {
      pairs.add(`${m[1]}:${m[2]}`);
      continue;
    }
    if (/^[A-Z0-9]+$/.test(token)) codes.add(token);
  }
  return { codes, pairs };
}

export function pairFilterActive(filter: PairFilter): boolean {
  return filter.codes.size > 0 || filter.pairs.size > 0;
}

/** Allowlist: if active, pair must match a code or exact pair. */
export function pairAllowed(
  from: string,
  to: string,
  allow: PairFilter,
  block: PairFilter,
): boolean {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  const key = `${f}:${t}`;

  if (pairFilterActive(block)) {
    if (block.pairs.has(key) || block.codes.has(f) || block.codes.has(t)) {
      return false;
    }
  }

  if (!pairFilterActive(allow)) return true;
  return allow.pairs.has(key) || allow.codes.has(f) || allow.codes.has(t);
}
