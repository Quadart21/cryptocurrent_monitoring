import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { getSeoSettings, updateSeoSettings } from "@/lib/store";
import type { SeoSettings } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json({ seo: await getSeoSettings() });
}

export async function PUT(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  let body: Partial<SeoSettings>;
  try {
    body = (await request.json()) as Partial<SeoSettings>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const seo = await updateSeoSettings(body);
  return NextResponse.json({ seo });
}
