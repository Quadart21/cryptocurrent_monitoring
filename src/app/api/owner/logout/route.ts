import { NextResponse } from "next/server";
import { OWNER_COOKIE } from "@/lib/owner-auth";
import { assertOwner } from "@/lib/owner-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await assertOwner();
  if (auth.error) return auth.error;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
