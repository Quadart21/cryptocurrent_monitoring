import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  getFeedScoutSettings,
  handleFeedScoutUpdate,
  type TelegramUpdate,
} from "@/lib/feed-scout/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  try {
    const settings = await getFeedScoutSettings();
    const secret = settings.webhookSecret.trim();
    if (secret) {
      const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (!safeEqual(header, secret)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    const update = (await request.json()) as TelegramUpdate;
    // Process inline so Telegram gets errors; keep under maxDuration.
    await handleFeedScoutUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[feed-scout webhook]", error);
    // Always 200 to Telegram after auth so it does not retry forever on app bugs.
    return NextResponse.json({ ok: true });
  }
}
