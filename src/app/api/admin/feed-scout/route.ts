import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  deleteFeedScoutWebhook,
  getFeedScoutAdminSnapshot,
  listFeedScoutSubmissions,
  listFeedScoutWorkers,
  retryFeedScoutPayout,
  setFeedScoutWebhook,
  setFeedScoutWorkerStatus,
  testFeedScoutBot,
  testFeedScoutXrocket,
  updateFeedScoutSettings,
} from "@/lib/feed-scout/service";
import type { FeedScoutWorkerStatus } from "@/lib/feed-scout/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
