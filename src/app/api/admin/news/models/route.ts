import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { codexConfigured, listCodexModels } from "@/lib/ai/codex-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("blog", "GET");
  if (denied) return denied;
  if (!codexConfigured()) {
    return NextResponse.json(
      { error: "CODEX_API_KEY не задан", models: [] },
      { status: 400 },
    );
  }
  try {
    const models = await listCodexModels();
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "models failed";
    return NextResponse.json({ error: message, models: [] }, { status: 502 });
  }
}
