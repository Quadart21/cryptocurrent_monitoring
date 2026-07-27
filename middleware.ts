import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH, isValidAdminSession } from "@/lib/admin-auth";
import { OWNER_COOKIE, OWNER_PATH, parseOwnerCookie } from "@/lib/owner-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) {
    return NextResponse.next();
  }

  if (pathname === OWNER_PATH || pathname.startsWith(`${OWNER_PATH}/`)) {
    return NextResponse.next();
  }

  if (pathname === "/api/admin/login" || pathname === "/api/owner/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    const session = request.cookies.get("cm_ops")?.value;
    if (!(await isValidAdminSession(session))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/api/owner")) {
    const parsed = parseOwnerCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!parsed) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trulala",
    "/trulala/:path*",
    "/api/admin/:path*",
    "/cabinet",
    "/cabinet/:path*",
    "/api/owner/:path*",
  ],
};
