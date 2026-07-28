import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { runBannerChecks } from "@/lib/banner-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  let exchangerId: string | undefined;
  try {
    const body = (await request.json()) as { exchangerId?: string };
    exchangerId = body.exchangerId?.trim() || undefined;
  } catch {
    exchangerId = undefined;
  }

  try {
    const result = await runBannerChecks({ exchangerId });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось проверить баннеры";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
