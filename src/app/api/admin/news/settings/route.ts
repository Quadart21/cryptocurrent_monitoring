import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { DEFAULT_NEWS_REWRITE_PROMPT } from "@/lib/news/default-prompt";
import { getNewsSettings, updateNewsSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  const settings = await getNewsSettings();
  return NextResponse.json({
    settings,
    defaultPrompt: DEFAULT_NEWS_REWRITE_PROMPT,
    placeholders: [
      "{{title}}",
      "{{anons}}",
      "{{body}}",
      "{{tags}}",
      "{{sourceUrl}}",
      "{{siteName}}",
      "{{siteUrl}}",
    ],
  });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const body = (await request.json()) as {
    model?: string;
    rewritePrompt?: string;
    enabled?: boolean;
    resetPrompt?: boolean;
  };
  const settings = await updateNewsSettings({
    model: body.model,
    rewritePrompt: body.resetPrompt
      ? DEFAULT_NEWS_REWRITE_PROMPT
      : body.rewritePrompt,
    enabled: body.enabled,
  });
  return NextResponse.json({ settings });
}
