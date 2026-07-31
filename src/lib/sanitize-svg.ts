/** Allow-list SVG sanitizer for achievement icons, logos, and ad rasterization. */

const FORBIDDEN_TAGS_STRICT =
  /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|style)\b[^>]*>/gi;

/** Keep `<style>` — needed for banner SVGs before sharp rasterizes them. */
const FORBIDDEN_TAGS_ALLOW_STYLE =
  /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>/gi;

const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
/** Blocks javascript/vbscript and HTML data URIs; keeps data:image/* for embedded assets. */
const DANGEROUS_URI =
  /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*("|')\s*(?:javascript|vbscript)\s*:/gi;
const DANGEROUS_DATA_HTML =
  /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*("|')\s*data:text\/html/gi;
/** Stricter: also strip any data: URI (icons/logos without embeds). */
const DANGEROUS_URI_STRICT =
  /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*("|')\s*(?:javascript|data|vbscript)\s*:/gi;

export type SanitizeSvgOptions = {
  /** Default 20_000 (icons). Use a higher limit for ad banners. */
  maxLength?: number;
  /** Keep `<style>` tags (safe when rasterizing with sharp, not for inline HTML). */
  allowStyle?: boolean;
  /**
   * Allow `data:image/*` embeds (Figma/Illustrator banners).
   * Default false for inline HTML icons; true for ad rasterization.
   */
  allowDataImages?: boolean;
};

export type SanitizeSvgFailureReason =
  | "empty"
  | "not_svg"
  | "script"
  | "too_large"
  | "broken";

export type SanitizeSvgResult =
  | { ok: true; svg: string }
  | { ok: false; reason: SanitizeSvgFailureReason };

function stripPass(
  svg: string,
  allowStyle: boolean,
  allowDataImages: boolean,
): string {
  return svg
    .replace(allowStyle ? FORBIDDEN_TAGS_ALLOW_STYLE : FORBIDDEN_TAGS_STRICT, "")
    .replace(EVENT_ATTR, "")
    .replace(allowDataImages ? DANGEROUS_URI : DANGEROUS_URI_STRICT, " data-blocked=")
    .replace(DANGEROUS_DATA_HTML, " data-blocked=")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/<!\s*DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    // Illustrator / Affinity private blobs — useless for rasterize, inflate size.
    .replace(/<i:pgf[\s\S]*?<\/i:pgf>/gi, "")
    .replace(/<sodipodi:namedview\b[^>]*>[\s\S]*?<\/sodipodi:namedview>/gi, "");
}

export function sanitizeSvgDetailed(
  input: string,
  options?: SanitizeSvgOptions,
): SanitizeSvgResult {
  const maxLength = options?.maxLength ?? 20_000;
  const allowStyle = options?.allowStyle ?? false;
  const allowDataImages = options?.allowDataImages ?? false;
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };

  let svg = raw;
  // Prefer outermost SVG: greedy match to last </svg>
  const match = raw.match(/<svg\b[\s\S]*<\/svg>/i);
  if (match) svg = match[0];
  if (!/^<svg\b/i.test(svg)) return { ok: false, reason: "not_svg" };

  for (let i = 0; i < 6; i += 1) {
    const next = stripPass(svg, allowStyle, allowDataImages);
    if (next === svg) break;
    svg = next;
  }

  if (
    /<script\b/i.test(svg) ||
    /javascript:/i.test(svg) ||
    /<foreignObject\b/i.test(svg)
  ) {
    return { ok: false, reason: "script" };
  }
  if (svg.length > maxLength) return { ok: false, reason: "too_large" };
  if (!/^<svg\b/i.test(svg)) return { ok: false, reason: "broken" };

  if (!/\sxmlns=/.test(svg)) {
    svg = svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return { ok: true, svg };
}

export function sanitizeAchievementSvg(
  input: string,
  options?: SanitizeSvgOptions,
): string | null {
  const result = sanitizeSvgDetailed(input, options);
  return result.ok ? result.svg : null;
}

export function svgSanitizeErrorMessage(reason: SanitizeSvgFailureReason): string {
  switch (reason) {
    case "empty":
      return "SVG-файл пустой";
    case "not_svg":
      return "В файле нет корневого тега <svg>…</svg>";
    case "script":
      return "SVG содержит script/foreignObject — экспортируйте «SVG flattened» без скриптов";
    case "too_large":
      return "SVG слишком тяжёлый (много встроенных картинок). Сохраните как PNG/WebP";
    case "broken":
      return "SVG повреждён после очистки. Сохраните как PNG/WebP";
    default:
      return "Некорректный SVG";
  }
}
