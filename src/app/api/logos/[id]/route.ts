import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-auth";
import { logoFilePath } from "@/lib/logo";
import { getExchangerById } from "@/lib/store";

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

  try {
    const file = logoFilePath(ex.id, ex.logo.format);
    const bytes = await fs.readFile(file);
    const contentType =
      ex.logo.format === "svg" ? "image/svg+xml; charset=utf-8" : "image/png";

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isAdmin
          ? "no-store"
          : "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
