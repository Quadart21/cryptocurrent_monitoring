/** Keep only a safe inline SVG for achievement icons. */
export function sanitizeAchievementSvg(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let svg = raw;
  // Allow pasting a full document — keep the first <svg>…</svg>
  const match = raw.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (match) svg = match[0];
  if (!/^<svg\b/i.test(svg)) return null;

  // Strip dangerous bits
  svg = svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "");

  if (!/^<svg\b/i.test(svg) || svg.length > 20_000) return null;
  return svg;
}
