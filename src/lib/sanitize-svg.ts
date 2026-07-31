/** Allow-list SVG sanitizer for achievement icons, logos, and ad rasterization. */

const FORBIDDEN_TAGS_STRICT =
  /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|style)\b[^>]*>/gi;

/** Keep `<style>` — needed for banner SVGs before sharp rasterizes them. */
const FORBIDDEN_TAGS_ALLOW_STYLE =
  /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>/gi;

const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URI =
  /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*("|')\s*(?:javascript|data|vbscript)\s*:/gi;

export type SanitizeSvgOptions = {
  /** Default 20_000 (icons). Use a higher limit for ad banners. */
  maxLength?: number;
  /** Keep `<style>` tags (safe when rasterizing with sharp, not for inline HTML). */
  allowStyle?: boolean;
};

function stripPass(svg: string, allowStyle: boolean): string {
  return svg
    .replace(allowStyle ? FORBIDDEN_TAGS_ALLOW_STYLE : FORBIDDEN_TAGS_STRICT, "")
    .replace(EVENT_ATTR, "")
    .replace(DANGEROUS_URI, " data-blocked=")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/<!\s*DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "");
}

export function sanitizeAchievementSvg(
  input: string,
  options?: SanitizeSvgOptions,
): string | null {
  const maxLength = options?.maxLength ?? 20_000;
  const allowStyle = options?.allowStyle ?? false;
  const raw = input.trim();
  if (!raw) return null;

  let svg = raw;
  const match = raw.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (match) svg = match[0];
  if (!/^<svg\b/i.test(svg)) return null;

  // Repeated passes defeat nested bypass tricks (javajavascript:script:)
  for (let i = 0; i < 6; i += 1) {
    const next = stripPass(svg, allowStyle);
    if (next === svg) break;
    svg = next;
  }

  if (
    /<script\b/i.test(svg) ||
    /javascript:/i.test(svg) ||
    /<foreignObject\b/i.test(svg)
  ) {
    return null;
  }
  if (!/^<svg\b/i.test(svg) || svg.length > maxLength) return null;

  // Force non-scriptable presentation defaults when possible
  if (!/\sxmlns=/.test(svg)) {
    svg = svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}
