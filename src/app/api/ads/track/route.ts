import { NextResponse } from "next/server";
import { flushAdMetrics, queueAdEvent } from "@/lib/ad-metrics";
import { assertContentLength } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackBody = {
  id?: string;
  event?: "impression" | "click";
  events?: Array<{ id: string; event: "impression" | "click"; count?: number }>;
};

export async function POST(request: Request) {
  const tooBig = assertContentLength(request, 32_768);
  if (tooBig) return tooBig;

  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const batch =
    Array.isArray(body.events) && body.events.length
      ? body.events
      : body.id && (body.event === "impression" || body.event === "click")
        ? [{ id: body.id, event: body.event, count: 1 }]
        : [];

  if (!batch.length) {
    return NextResponse.json({ error: "events required" }, { status: 400 });
  }

  for (const item of batch.slice(0, 40)) {
    const id = String(item.id ?? "").trim();
    if (!id) continue;
    if (item.event !== "impression" && item.event !== "click") continue;
    const count = Math.min(20, Math.max(1, Number(item.count) || 1));
    queueAdEvent(id, item.event, count);
  }

  // Clicks flush sooner so admin sees them quickly
  if (batch.some((e) => e.event === "click")) {
    void flushAdMetrics();
  }

  return NextResponse.json({ ok: true });
}
