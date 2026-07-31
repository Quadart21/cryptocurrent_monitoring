import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { listExchangerTrafficEvents } from "@/lib/exchanger-traffic-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("exchangers", "GET");
  if (denied) return denied;

  const url = new URL(request.url);
  const exchangerId = url.searchParams.get("exchangerId")?.trim() ?? "";
  if (!exchangerId) {
    return NextResponse.json({ error: "exchangerId required" }, { status: 400 });
  }

  const event = url.searchParams.get("event") as "view" | "click" | "all" | null;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const sinceDays = Number(url.searchParams.get("sinceDays") ?? 30);

  const result = await listExchangerTrafficEvents({
    exchangerId,
    event: event === "view" || event === "click" ? event : "all",
    limit,
    offset,
    sinceDays,
  });

  return NextResponse.json(result);
}
