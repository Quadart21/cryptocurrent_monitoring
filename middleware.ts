import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH, isValidAdminSession } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Page is always reachable — shows login form or panel
  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) {
    return NextResponse.next();
  }

  // Login endpoint is public (still under /api/admin)
  if (pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    const session = request.cookies.get("cm_ops")?.value;
    if (!(await isValidAdminSession(session))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/trulala", "/trulala/:path*", "/api/admin/:path*"],
};
