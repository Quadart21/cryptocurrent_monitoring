import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  addReviewReply,
  listReviewReplies,
  setReviewThreadClosed,
} from "@/lib/review-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("reviews", request.method);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("reviewId");
  if (!id) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }
  const replies = await listReviewReplies(id);
  return NextResponse.json({ replies });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("reviews", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: string;
    reviewId?: string;
    reply?: string;
    closed?: boolean;
  };

  if (!body.reviewId) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }

  if (body.action === "close" || body.action === "open") {
    const review = await setReviewThreadClosed(
      body.reviewId,
      body.action === "close",
    );
    if (!review) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ review });
  }

  try {
    const reply = await addReviewReply({
      reviewId: body.reviewId,
      role: "admin",
      body: body.reply ?? "",
    });
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
