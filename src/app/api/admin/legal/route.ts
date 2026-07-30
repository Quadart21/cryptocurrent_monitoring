import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { getLegalSettings, updateLegalSettings } from "@/lib/store";
import type { LegalSettings } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("legal", "GET");
  if (denied) return denied;
  return NextResponse.json({ legal: await getLegalSettings() });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("legal", request.method);
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
