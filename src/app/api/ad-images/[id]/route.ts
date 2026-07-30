import { NextResponse } from "next/server";
import sharp from "sharp";
import { AD_MEDIA_CONTENT_TYPES } from "@/lib/ad-image-url";
import { getAdById, getAdImageBytes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const LONG_CACHE =
  "public, max-age=31536000, immutable, stale-while-revalidate=86400";

async function maybeWebp(
  bytes: Buffer,
  format: string,
  accept: string | null,
  maxWidth: number,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (format === "gif" || format === "mp4" || format === "webm") return null;
  if (format === "webp" || format === "avif") return null;
  if (!accept?.includes("image/webp")) return null;
  if (format !== "jpeg" && format !== "png") return null;

  const out = await sharp(bytes)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return { bytes: out, contentType: "image/webp" };
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ad = await getAdById(id);
  if (!ad?.image) {
    return new NextResponse("Not found", { status: 404 });
  }

  const image = await getAdImageBytes(ad.id);
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  const accept = request.headers.get("accept");
  // 2× typical banner width keeps retina sharp without shipping originals.
  const converted = await maybeWebp(
    Buffer.from(image.bytes),
    image.format,
    accept,
    2400,
  ).catch(() => null);

  if (converted) {
    return new NextResponse(new Uint8Array(converted.bytes), {
      headers: {
        "Content-Type": converted.contentType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; media-src 'self'; sandbox",
        "Cache-Control": LONG_CACHE,
        Vary: "Accept",
      },
    });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": AD_MEDIA_CONTENT_TYPES[image.format],
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; media-src 'self'; sandbox",
      "Cache-Control": LONG_CACHE,
      Vary: "Accept",
    },
  });
}
