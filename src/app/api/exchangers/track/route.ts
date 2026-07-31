import { NextResponse } from "next/server";
import {
  flushExchangerTraffic,
  queueExchangerTrafficEvent,
} from "@/lib/exchanger-metrics";
import { recordExchangerTrafficEvents } from "@/lib/exchanger-traffic-events";
import {
  assertContentLength,
  clientIp,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackBody = {
  id?: string;
  event?: "view" | "click";
  path?: string;
  referrer?: string;
  events?: Array<{
    id: string;
    event: "view" | "click";
    count?: number;
    path?: string;
    referrer?: string;
  }>;
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
      : body.id && (body.event === "view" || body.event === "click")
        ? [
            {
              id: body.id,
              event: body.event,
              count: 1,
              path: body.path,
              referrer: body.referrer,
            },
          ]
        : [];

  if (!batch.length) {
    return NextResponse.json({ error: "events required" }, { status: 400 });
  }

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const headerReferrer = request.headers.get("referer") ?? "";

  const detailRows: Array<{
    exchangerId: string;
    event: "view" | "click";
    ip: string;
    userAgent: string;
    path: string;
    referrer: string;
  }> = [];

  for (const item of batch.slice(0, 40)) {
    const id = String(item.id ?? "").trim();
    if (!id) continue;
    if (item.event !== "view" && item.event !== "click") continue;
    const count = Math.min(20, Math.max(1, Number(item.count) || 1));
    queueExchangerTrafficEvent(id, item.event, count);
    // Log one detailed row per beacon (not inflated by count spam)
    detailRows.push({
      exchangerId: id,
      event: item.event,
      ip,
      userAgent,
      path: String(item.path ?? "").trim(),
      referrer: String(item.referrer ?? headerReferrer).trim(),
    });
  }

  if (detailRows.length) {
    void recordExchangerTrafficEvents(detailRows).catch((err) => {
      console.error("[gapsnap] traffic event log failed", err);
    });
  }

  if (batch.some((e) => e.event === "click")) {
    void flushExchangerTraffic();
  }

  return NextResponse.json({ ok: true });
}
