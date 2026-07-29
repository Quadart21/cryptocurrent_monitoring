import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { getLegalSettings, updateLegalSettings } from "@/lib/store";
import type { LegalSettings } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json({ legal: await getLegalSettings() });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  let body: Partial<LegalSettings>;
  try {
    body = (await request.json()) as Partial<LegalSettings>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const legal = await updateLegalSettings(body);
  return NextResponse.json({ legal });
}
