import { NextResponse } from "next/server";
import { getGapsnapRole, isWorkerRole } from "@/lib/runtime-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public health for web / LB. Does not expose secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    role: getGapsnapRole(),
    pollers: isWorkerRole(),
  });
}
