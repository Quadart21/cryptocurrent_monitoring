import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  getMailThread,
  listMailThreads,
  mailboxUnreadTotal,
  markThreadRead,
  replyToThread,
  startOutboundThread,
} from "@/lib/email/mailbox";
import {
  listMailboxIdentities,
  resendConfigStatus,
} from "@/lib/resend-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("email", request.method);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "threads";
  const id = searchParams.get("id") ?? "";

  try {
    if (view === "threads") {
      const [threads, unread] = await Promise.all([
        listMailThreads(80),
        mailboxUnreadTotal(),
      ]);
      return NextResponse.json({
        threads,
        unread,
        provider: resendConfigStatus(),
        identities: listMailboxIdentities(),
      });
    }
    if (view === "thread") {
      if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      const data = await getMailThread(id);
      if (!data) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      await markThreadRead(id);
      const lastInbound = [...data.messages]
        .reverse()
        .find((m) => m.direction === "inbound");
      return NextResponse.json({
        ...data,
        identities: listMailboxIdentities(),
        suggestedFrom: lastInbound?.toAddress ?? null,
      });
    }
    return NextResponse.json({ error: "unknown view" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("email", request.method);
  if (denied) return denied;

  let body: {
    action?: string;
    threadId?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  try {
    if (body.action === "reply") {
      if (!body.threadId) {
        return NextResponse.json({ error: "threadId required" }, { status: 400 });
      }
      const message = await replyToThread({
        threadId: body.threadId,
        bodyText: String(body.text ?? ""),
        bodyHtml: body.html,
        fromEmail: body.from,
      });
      return NextResponse.json({ ok: true, message });
    }
    if (body.action === "compose") {
      const result = await startOutboundThread({
        to: String(body.to ?? ""),
        subject: String(body.subject ?? ""),
        bodyText: String(body.text ?? ""),
        bodyHtml: body.html,
        fromEmail: body.from,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
