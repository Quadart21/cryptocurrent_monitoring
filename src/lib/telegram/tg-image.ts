import "server-only";

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;

function imagesDir(): string {
  return path.join(process.cwd(), ".data", "tg-images");
}

export function tgImagePublicPath(filename: string): string {
  return `/api/tg-images/${encodeURIComponent(filename)}`;
}

export function tgImageFilenameFromUrl(url: string): string | null {
  const u = url.trim();
  try {
    const pathOnly = u.startsWith("http")
      ? new URL(u).pathname
      : u.split("?")[0] ?? u;
    const m = pathOnly.match(/^\/api\/tg-images\/([^/]+)$/);
    if (!m?.[1]) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export function isLocalTgImageUrl(url: string): boolean {
  return tgImageFilenameFromUrl(url) !== null;
}

async function pushTgImageToWeb(input: {
  filename: string;
  bytes: Buffer;
}): Promise<void> {
  const base = (process.env.WEB_INTERNAL_URL?.trim() || "").replace(/\/$/, "");
  const secret = process.env.WORKER_INTERNAL_SECRET?.trim() || "";
  if (!base || !secret) return;
  if (!/^[a-zA-Z0-9._-]+$/.test(input.filename)) return;

  try {
    const res = await fetch(`${base}/api/internal/tg-image`, {
      method: "PUT",
      headers: {
        "x-gapsnap-worker-secret": secret,
        "content-type": "application/octet-stream",
        "x-gapsnap-tg-image-name": input.filename,
      },
      body: new Uint8Array(input.bytes),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        `[gapsnap] tg-image push to web HTTP ${res.status} ${input.filename}`,
      );
    }
  } catch (err) {
    console.warn(`[gapsnap] tg-image push to web failed`, err);
  }
}

export async function writeTgImageFile(
  filename: string,
  bytes: Buffer,
): Promise<boolean> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return false;
  if (!bytes.length || bytes.length > MAX_BYTES) return false;
  const dir = imagesDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), bytes);
  return true;
}

export async function readTgImageFile(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  const full = path.join(imagesDir(), filename);
  try {
    const bytes = await fs.readFile(full);
    const lower = filename.toLowerCase();
    const contentType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : lower.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/** Re-encode to JPEG for smaller Telegram uploads, then persist under `.data/tg-images`. */
export async function saveGeneratedTgImage(input: {
  bytes: Buffer;
  seed?: string;
}): Promise<{ filename: string; publicPath: string }> {
  let out: Buffer;
  try {
    out = await sharp(input.bytes)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    out = input.bytes;
  }
  if (!out.length || out.length > MAX_BYTES) {
    throw new Error("Сгенерированная картинка слишком большая");
  }

  const hash = createHash("sha1")
    .update(input.seed ?? "")
    .update(out)
    .digest("hex")
    .slice(0, 16);
  const ext =
    out[0] === 0xff && out[1] === 0xd8
      ? ".jpg"
      : out[0] === 0x89 && out[1] === 0x50
        ? ".png"
        : ".jpg";
  const filename = `tg_${Date.now().toString(36)}_${hash}${ext}`;
  const ok = await writeTgImageFile(filename, out);
  if (!ok) throw new Error("Не удалось сохранить картинку");

  void pushTgImageToWeb({ filename, bytes: out });

  return { filename, publicPath: tgImagePublicPath(filename) };
}
