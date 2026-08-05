import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  deleteFeedScoutWebhook,
  getFeedScoutAdminSnapshot,
  grantFeedScoutWorkerLinks,
  listFeedScoutSubmissions,
  listFeedScoutWorkers,
  retryAllFailedFeedScoutPayouts,
  retryFeedScoutPayout,
  setFeedScoutWebhook,
  setFeedScoutWorkerQuota,
  setFeedScoutWorkerRemaining,
  setFeedScoutWorkerStatus,
  testFeedScoutBot,
  testFeedScoutXrocket,
  updateFeedScoutSettings,
  updateFeedScoutWorkerNote,
  zeroAllFeedScoutQuotas,
} from "@/lib/feed-scout/service";
import type { FeedScoutWorkerStatus } from "@/lib/feed-scout/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const denied = await assertAdminResource("feed_scout", request.method);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "snapshot";

  try {
    if (view === "snapshot") {
      return NextResponse.json(await getFeedScoutAdminSnapshot());
    }
    if (view === "workers") {
      return NextResponse.json({ workers: await listFeedScoutWorkers() });
    }
    if (view === "submissions") {
      const limit = Number(searchParams.get("limit") ?? 100);
      return NextResponse.json({
        submissions: await listFeedScoutSubmissions(limit),
      });
    }
    return NextResponse.json({ error: "unknown view" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const denied = await assertAdminResource("feed_scout", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: string;
    settings?: {
      botToken?: string;
      xrocketPayKey?: string;
      payoutAmount?: number;
      payoutCurrency?: string;
      enabled?: boolean;
      rotateWebhookSecret?: boolean;
    };
    workerId?: string;
    status?: FeedScoutWorkerStatus;
    linkQuota?: number | null;
    addLinks?: number;
    remaining?: number;
    adminNote?: string;
    submissionId?: string;
  };

  try {
    if (body.action === "settings" && body.settings) {
      const settings = await updateFeedScoutSettings(body.settings);
      return NextResponse.json({ settings });
    }

    if (body.action === "testBot") {
      const connection = await testFeedScoutBot();
      const snapshot = await getFeedScoutAdminSnapshot();
      return NextResponse.json({ connection, settings: snapshot.settings });
    }

    if (body.action === "testXrocket") {
      const xrocket = await testFeedScoutXrocket();
      return NextResponse.json({ xrocket });
    }

    if (body.action === "setWebhook") {
      const result = await setFeedScoutWebhook();
      const snapshot = await getFeedScoutAdminSnapshot();
      return NextResponse.json({ result, webhook: snapshot.webhook });
    }

    if (body.action === "deleteWebhook") {
      const result = await deleteFeedScoutWebhook();
      const snapshot = await getFeedScoutAdminSnapshot();
      return NextResponse.json({ result, webhook: snapshot.webhook });
    }

    if (
      body.action === "setWorkerStatus" &&
      body.workerId &&
      (body.status === "active" || body.status === "banned")
    ) {
      const worker = await setFeedScoutWorkerStatus(body.workerId, body.status);
      if (!worker) {
        return NextResponse.json({ error: "worker not found" }, { status: 404 });
      }
      return NextResponse.json({ worker });
    }

    if (body.action === "setWorkerQuota" && body.workerId) {
      const raw = body.linkQuota;
      const linkQuota =
        raw === null || raw === undefined ? null : Number(raw);
      if (linkQuota !== null && (!Number.isFinite(linkQuota) || linkQuota < 0)) {
        return NextResponse.json({ error: "invalid linkQuota" }, { status: 400 });
      }
      const worker = await setFeedScoutWorkerQuota(
        body.workerId,
        linkQuota === null ? null : Math.floor(linkQuota),
      );
      if (!worker) {
        return NextResponse.json({ error: "worker not found" }, { status: 404 });
      }
      return NextResponse.json({ worker });
    }

    if (body.action === "grantLinks" && body.workerId) {
      const worker = await grantFeedScoutWorkerLinks(
        body.workerId,
        Number(body.addLinks),
      );
      if (!worker) {
        return NextResponse.json({ error: "worker not found" }, { status: 404 });
      }
      return NextResponse.json({ worker });
    }

    if (body.action === "setRemaining" && body.workerId) {
      const worker = await setFeedScoutWorkerRemaining(
        body.workerId,
        Number(body.remaining),
      );
      if (!worker) {
        return NextResponse.json({ error: "worker not found" }, { status: 404 });
      }
      return NextResponse.json({ worker });
    }

    if (body.action === "setWorkerNote" && body.workerId) {
      const worker = await updateFeedScoutWorkerNote(
        body.workerId,
        body.adminNote ?? "",
      );
      if (!worker) {
        return NextResponse.json({ error: "worker not found" }, { status: 404 });
      }
      return NextResponse.json({ worker });
    }

    if (body.action === "zeroAllQuotas") {
      const count = await zeroAllFeedScoutQuotas();
      return NextResponse.json({ count });
    }

    if (body.action === "retryAllFailed") {
      const result = await retryAllFailedFeedScoutPayouts();
      return NextResponse.json({ result });
    }

    if (body.action === "retryPayout" && body.submissionId) {
      const submission = await retryFeedScoutPayout(body.submissionId);
      if (!submission) {
        return NextResponse.json(
          { error: "submission not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ submission });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
