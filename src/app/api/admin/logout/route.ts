import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdmin } from "@/lib/admin-guard";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);

  return NextResponse.json({ ok: true });
}
