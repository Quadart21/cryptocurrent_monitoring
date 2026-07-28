/** Pair URL helpers: /rates/usdttrc20-to-sbprub */

export function pairSlug(from: string, to: string): string {
  return `${from.trim()}-to-${to.trim()}`.toLowerCase();
}

export function parsePairSlug(
  slug: string,
): { from: string; to: string } | null {
  const raw = slug.trim().toLowerCase();
  const marker = "-to-";
  const idx = raw.indexOf(marker);
  if (idx <= 0) return null;
  const from = raw.slice(0, idx).toUpperCase();
  const to = raw.slice(idx + marker.length).toUpperCase();
  if (!from || !to || from.includes("-TO-") || !/^[A-Z0-9]+$/.test(from) || !/^[A-Z0-9]+$/.test(to)) {
    // allow alphanumeric codes only
    if (!from || !to) return null;
  }
  if (!/^[A-Z0-9]+$/.test(from) || !/^[A-Z0-9]+$/.test(to)) return null;
  return { from, to };
}

export function pairPath(from: string, to: string): string {
  return `/rates/${pairSlug(from, to)}`;
}
