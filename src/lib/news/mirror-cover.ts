import "server-only";

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function coversDir(): string {
  return path.join(process.cwd(), ".data", "news-covers");
}

export function newsCoverPublicPath(filename: string): string {
  return `/api/news-covers/${encodeURIComponent(filename)}`;
}

export function newsCoverFilenameFromPublicUrl(url: string): string | null {
  const u = url.trim();
  const m = u.match(/^\/api\/news-covers\/([^/?#]+)$/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export async function writeNewsCoverFile(
  filename: string,
  bytes: Buffer,
): Promise<boolean> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return false;
  if (!bytes.length || bytes.length > MAX_BYTES) return false;
  const dir = coversDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), bytes);
  return true;
}

/**
 * After worker mirrors a cover, push bytes to the public web node so
 * `/api/news-covers/*` resolves there too.
 */
export async function pushNewsCoverToWeb(input: {
  filename: string;
  bytes: Buffer;
}): Promise<void> {
  const base = (process.env.WEB_INTERNAL_URL?.trim() || "").replace(/\/$/, "");
  const secret = process.env.WORKER_INTERNAL_SECRET?.trim() || "";
  if (!base || !secret) return;
  if (!/^[a-zA-Z0-9._-]+$/.test(input.filename)) return;

  try {
    const res = await fetch(`${base}/api/internal/news-cover`, {
      method: "PUT",
      headers: {
        "x-gapsnap-worker-secret": secret,
        "content-type": "application/octet-stream",
        "x-gapsnap-cover-name": input.filename,
      },
      body: new Uint8Array(input.bytes),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        `[gapsnap] news cover push to web HTTP ${res.status} ${input.filename}`,
      );
    }
  } catch (err) {
    console.warn(`[gapsnap] news cover push to web failed`, err);
  }
}

/** On web: if local file missing, pull from worker and cache. */
export async function pullNewsCoverFromWorker(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const base = (process.env.WORKER_URL?.trim() || "").replace(/\/$/, "");
  const secret = process.env.WORKER_INTERNAL_SECRET?.trim() || "";
  if (!base || !secret) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;

  try {
    const res = await fetch(
      `${base}/api/internal/news-cover?name=${encodeURIComponent(filename)}`,
      {
        headers: { "x-gapsnap-worker-secret": secret },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;
    await writeNewsCoverFile(filename, buf);
    const lower = filename.toLowerCase();
    const contentType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : lower.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
    return { bytes: buf, contentType };
  } catch (err) {
    console.warn(`[gapsnap] news cover pull from worker failed`, err);
    return null;
  }
}

function safeKey(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  if (cleaned) return cleaned;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function sniffExt(buf: Buffer, contentType: string, sourceUrl: string): string | null {
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (EXT_BY_TYPE[ct]) return EXT_BY_TYPE[ct]!;

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return ".jpg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return ".png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }
  if (buf.length >= 6) {
    const head = buf.toString("ascii", 0, 6);
    if (head === "GIF87a" || head === "GIF89a") return ".gif";
  }

  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    const m = pathname.match(/\.(jpe?g|png|webp|gif)$/);
    if (m) return m[0] === ".jpeg" ? ".jpg" : m[0]!;
  } catch {
    /* ignore */
  }
  return null;
}

export function isLocalNewsCoverUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith("/api/news-covers/") || u.startsWith("/uploads/news/");
}

export function isExternalHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Download a remote RSS/cover image onto the server and return a local public URL.
 * Returns null if download/validation fails (caller should not keep the remote URL).
 */
export async function mirrorNewsCover(input: {
  sourceUrl: string;
  key: string;
}): Promise<string | null> {
  const sourceUrl = input.sourceUrl.trim();
  if (!isExternalHttpUrl(sourceUrl)) {
    return isLocalNewsCoverUrl(sourceUrl) ? sourceUrl : null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; GapSnapBot/1.0; +https://gapsnap.org)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        `[gapsnap] news cover download HTTP ${res.status} for ${sourceUrl}`,
      );
      return null;
    }

    const len = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(len) && len > MAX_BYTES) {
      console.warn(`[gapsnap] news cover too large (${len}) ${sourceUrl}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) {
      console.warn(`[gapsnap] news cover empty/too large ${sourceUrl}`);
      return null;
    }

    const ext = sniffExt(buf, res.headers.get("content-type") ?? "", sourceUrl);
    if (!ext) {
      console.warn(`[gapsnap] news cover unsupported type ${sourceUrl}`);
      return null;
    }

    const filename = `${safeKey(input.key)}${ext}`;
    const dir = coversDir();
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, filename);
    await fs.writeFile(full, buf);

    // Keep web node in sync when pollers run on a dedicated worker.
    void pushNewsCoverToWeb({ filename, bytes: buf });

    const publicUrl = newsCoverPublicPath(filename);
    console.info(`[gapsnap] news cover mirrored → ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.warn(`[gapsnap] news cover mirror failed ${sourceUrl}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readNewsCoverFile(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  const full = path.join(coversDir(), filename);
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
