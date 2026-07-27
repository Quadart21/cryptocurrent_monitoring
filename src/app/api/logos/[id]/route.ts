import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-auth";
import { getExchangerById, getExchangerLogoBytes } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ex = await getExchangerById(id);
  if (!ex?.logo) {
    return new NextResponse("Not found", { status: 404 });
  }

  const jar = await cookies();
  const isAdmin = await isValidAdminSession(jar.get(ADMIN_COOKIE)?.value);
  const publicOk = ex.status === "active" || ex.status === "error";
  if (!publicOk && !isAdmin) {
    return new NextResponse("Not found", { status: 404 });
  }

  const logo = await getExchangerLogoBytes(ex.id);
  if (!logo) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType =
    logo.format === "svg" ? "image/svg+xml; charset=utf-8" : "image/png";

  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": isAdmin
        ? "no-store"
        : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
