import { NextResponse } from "next/server";
import { AD_MEDIA_CONTENT_TYPES } from "@/lib/ad-image-url";
import { getAdById, getAdImageBytes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ad = await getAdById(id);
  if (!ad?.image) {
    return new NextResponse("Not found", { status: 404 });
  }

  const image = await getAdImageBytes(ad.id);
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": AD_MEDIA_CONTENT_TYPES[image.format],
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; media-src 'self'; sandbox",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
