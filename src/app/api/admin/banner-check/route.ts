import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  runBannerChecks,
  unpublishForMissingBanner,
  warnOwnerBannerMissing,
} from "@/lib/banner-check";
import { maybeProxyToWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "check" | "warn" | "unpublish";
  exchangerId?: string;
  /** For unpublish: send email to owner (default true). */
  notifyOwner?: boolean;
  /** Bulk: list of exchanger ids for warn/unpublish. */
  exchangerIds?: string[];
};

export async function POST(request: Request) {
  const denied = await assertAdminResource("banners", request.method);
  if (denied) return denied;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const action = body.action ?? "check";
  const exchangerId = body.exchangerId?.trim() || undefined;
  const ids = [
    ...new Set(
      [
        ...(body.exchangerIds ?? []).map((id) => String(id).trim()),
        ...(exchangerId ? [exchangerId] : []),
      ].filter(Boolean),
    ),
  ];

  try {
    if (action === "check") {
      const proxied = await maybeProxyToWorker("banners", {
        exchangerId,
      });
      if (proxied.mode === "proxied") {
        const data = proxied.data as Record<string, unknown>;
        if (proxied.status >= 400) {
          return NextResponse.json(data, { status: proxied.status });
        }
        return NextResponse.json({
          success: true,
          action,
          via: "worker",
          ...data,
        });
      }
      const result = await runBannerChecks({ exchangerId });
      return NextResponse.json({ success: true, action, ...result });
    }

    if (action === "warn") {
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Укажите exchangerId или exchangerIds" },
          { status: 400 },
        );
      }
      const results = [];
      for (const id of ids) {
        results.push(await warnOwnerBannerMissing(id));
      }
      const okCount = results.filter((r) => r.ok).length;
      return NextResponse.json({
        success: okCount === results.length,
        action,
        results,
        okCount,
        failCount: results.length - okCount,
      });
    }

    if (action === "unpublish") {
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Укажите exchangerId или exchangerIds" },
          { status: 400 },
        );
      }
      const results = [];
      for (const id of ids) {
        results.push(
          await unpublishForMissingBanner(id, {
            notifyOwner: body.notifyOwner !== false,
          }),
        );
      }
      const okCount = results.filter((r) => r.ok).length;
      return NextResponse.json({
        success: okCount === results.length,
        action,
        results,
        okCount,
        failCount: results.length - okCount,
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось выполнить действие";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
