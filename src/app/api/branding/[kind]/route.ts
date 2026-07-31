import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import {
  brandingContentType,
  isSiteAssetKind,
  type SiteAssetKind,
} from "@/lib/branding-url";
import { getSiteAssetBytes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ kind: string }> };

const FALLBACK_FILES: Partial<Record<SiteAssetKind, string>> = {
  logo: path.join("public", "gapsnap-mark.png"),
  icon: path.join("public", "branding", "default-icon.png"),
  apple_icon: path.join("public", "branding", "default-apple-icon.png"),
};

async function readFallback(
  kind: SiteAssetKind,
): Promise<{ format: "png"; bytes: Buffer } | null> {
  const rel = FALLBACK_FILES[kind];
  if (!rel) return null;
  try {
    const bytes = await readFile(path.join(process.cwd(), rel));
    return { format: "png", bytes };
  } catch {
    if (kind === "icon" || kind === "apple_icon") {
      try {
        const bytes = await readFile(
          path.join(process.cwd(), "public", "gapsnap-mark.png"),
        );
        return { format: "png", bytes };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { kind: kindRaw } = await params;
  if (!isSiteAssetKind(kindRaw)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const custom = await getSiteAssetBytes(kindRaw);
  if (custom) {
    return new NextResponse(new Uint8Array(custom.bytes), {
      headers: {
        "Content-Type": brandingContentType(custom.format),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  // favicon.ico slot: fall back to icon slot / default mark
  if (kindRaw === "favicon") {
    const icon = await getSiteAssetBytes("icon");
    if (icon) {
      return new NextResponse(new Uint8Array(icon.bytes), {
        headers: {
          "Content-Type": brandingContentType(icon.format),
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
  }

  if (kindRaw === "og_image") {
    return new NextResponse("Not found", { status: 404 });
  }

  const fallback = await readFallback(
    kindRaw === "favicon" ? "icon" : kindRaw,
  );
  if (!fallback) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(fallback.bytes), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
