import { sanitizeAchievementSvg } from "@/lib/sanitize-svg";
import {
  clearExchangerLogoData,
  setExchangerLogoData,
} from "@/lib/store";

export const LOGO_MAX_BYTES = 512 * 1024;

export type LogoFormat = "svg" | "png";

export type SavedLogo = {
  format: LogoFormat;
  updatedAt: string;
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(buf: Buffer): boolean {
  if (buf.length < 33) return false;
  return PNG_SIG.every((b, i) => buf[i] === b);
}

/** PNG must have an alpha channel (RGBA / grey+alpha) or a tRNS chunk. */
export function pngHasTransparency(buf: Buffer): boolean {
  if (!isPng(buf)) return false;

  // IHDR color type at offset 25
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;

  // Scan chunks for tRNS
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") return true;
    if (type === "IEND") break;
    offset += 12 + length; // len + type + data + crc
  }
  return false;
}

export async function validateAndPrepareLogo(
  file: File | null | undefined,
): Promise<{ format: LogoFormat; bytes: Buffer } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("Логотип слишком большой (макс. 512 КБ)");
  }

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  const looksSvg =
    type.includes("svg") ||
    name.endsWith(".svg") ||
    buf.toString("utf8", 0, Math.min(buf.length, 256)).includes("<svg");

  if (looksSvg) {
    const text = buf.toString("utf8");
    const svg = sanitizeAchievementSvg(text);
    if (!svg) {
      throw new Error("Некорректный SVG. Вставьте валидный SVG-файл");
    }
    return { format: "svg", bytes: Buffer.from(svg, "utf8") };
  }

  const looksPng =
    type === "image/png" || name.endsWith(".png") || isPng(buf);

  if (looksPng) {
    if (!isPng(buf)) {
      throw new Error("Файл должен быть настоящим PNG");
    }
    if (!pngHasTransparency(buf)) {
      throw new Error(
        "PNG должен быть с прозрачным фоном (альфа-канал или tRNS)",
      );
    }
    return { format: "png", bytes: buf };
  }

  throw new Error("Логотип: только SVG или PNG с прозрачным фоном");
}

export async function saveExchangerLogo(
  exchangerId: string,
  prepared: { format: LogoFormat; bytes: Buffer },
): Promise<SavedLogo> {
  return setExchangerLogoData(exchangerId, prepared);
}

export async function deleteExchangerLogo(exchangerId: string): Promise<void> {
  await clearExchangerLogoData(exchangerId);
}

export { logoPublicUrl } from "@/lib/logo-url";
