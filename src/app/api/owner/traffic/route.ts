import { NextResponse } from "next/server";
import { listExchangerTrafficEvents } from "@/lib/exchanger-traffic-events";
import { assertOwner } from "@/lib/owner-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await assertOwner();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const event = url.searchParams.get("event") as "view" | "click" | "all" | null;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const sinceDays = Number(url.searchParams.get("sinceDays") ?? 30);

  const result = await listExchangerTrafficEvents({
    exchangerId: auth.exchanger.id,
    event: event === "view" || event === "click" ? event : "all",
    limit,
    offset,
    sinceDays,
  });

  return NextResponse.json(result);
}
