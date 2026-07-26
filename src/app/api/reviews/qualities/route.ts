import { NextResponse } from "next/server";
import { listQualityTags } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tags = await listQualityTags({ activeOnly: true });
  return NextResponse.json({ tags });
}
