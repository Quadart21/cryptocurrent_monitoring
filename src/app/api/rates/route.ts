import { NextResponse } from "next/server";
import { queryRates } from "@/lib/rates-query";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await queryRates({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    mode: searchParams.get("mode") === "cash" ? "cash" : "online",
  });
  return NextResponse.json(result);
}
