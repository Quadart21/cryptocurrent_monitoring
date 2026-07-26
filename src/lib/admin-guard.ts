import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-auth";

export async function assertAdmin(): Promise<NextResponse | null> {
  const jar = await cookies();
  const session = jar.get(ADMIN_COOKIE)?.value;

  if (await isValidAdminSession(session)) {
    return null;
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
