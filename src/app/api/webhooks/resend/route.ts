import { NextResponse } from "next/server";
import { ingestInboundEmail } from "@/lib/email/mailbox";
import { getResendClient } from "@/lib/resend-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend inbound + delivery webhooks.
 * Configure endpoint: https://<site>/api/webhooks/resend
 * Events: email.received (required for inbox), optionally delivered/bounced.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[];
      subject?: string;
      message_id?: string;
    };
  };

  if (secret) {
    try {
      const resend = getResendClient();
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: request.headers.get("svix-id") ?? "",
          timestamp: request.headers.get("svix-timestamp") ?? "",
          signature: request.headers.get("svix-signature") ?? "",
        },
        webhookSecret: secret,
      }) as typeof event;
    } catch (error) {
      console.error("[gapsnap] resend webhook verify failed", error);
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
  } else {
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      return NextResponse.json({ error: "bad json" }, { status: 400 });
    }
  }

  if (event.type === "email.received" && event.data?.email_id) {
    try {
      const resend = getResendClient();
      const { data: email, error } = await resend.emails.receiving.get(
        event.data.email_id,
      );
      if (error || !email) {
        console.error("[gapsnap] resend receiving.get failed", error);
        return NextResponse.json({ ok: false }, { status: 502 });
      }

      const from =
        event.data.from ||
        (typeof email.from === "string" ? email.from : "") ||
        "";
      const to = Array.isArray(event.data.to)
        ? event.data.to
        : Array.isArray(email.to)
          ? email.to
          : [];

      await ingestInboundEmail({
        resendEmailId: event.data.email_id,
        from,
        to,
        subject: event.data.subject || email.subject || "(без темы)",
        textBody: email.text || "",
        htmlBody: email.html || "",
        messageIdHeader: event.data.message_id || email.message_id || null,
      });
    } catch (error) {
      console.error("[gapsnap] inbound ingest failed", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
