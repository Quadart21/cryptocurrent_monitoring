import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { parseAchievementRule } from "@/lib/achievement-rules";
import {
  countAchievementRuleMatches,
  recomputeAllAchievements,
} from "@/lib/achievements-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await assertAdminResource("achievements", request.method);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    rule?: unknown;
    dryRun?: boolean;
  };

  if (body.action === "preview") {
    const rule = parseAchievementRule(body.rule);
    if (!rule) {
      return NextResponse.json(
        { error: "Укажите корректное правило" },
        { status: 400 },
      );
    }
    const matches = await countAchievementRuleMatches(rule);
    return NextResponse.json({ matches });
  }

  const result = await recomputeAllAchievements({
    dryRun: body.dryRun === true,
  });
  return NextResponse.json(result);
}
