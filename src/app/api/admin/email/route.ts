import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  contactMatchesSegment,
  listEmailContacts,
  setEmailContactUnsubscribed,
  syncEmailContactsFromStore,
} from "@/lib/email/contacts";
import {
  broadcastEmail,
  getEmailAdminSnapshot,
  getEmailSettings,
  listEmailLog,
  listEmailTemplates,
  resetEmailTemplate,
  sendRawAdminEmail,
  updateEmailSettings,
  updateEmailTemplate,
} from "@/lib/email/service";
import { EMAIL_TEMPLATE_VARS, type BroadcastSegment } from "@/lib/email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEGMENTS = new Set<BroadcastSegment>(["all", "exchangers", "reviewers"]);

export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "snapshot";

  try {
    if (view === "snapshot") {
      const [snapshot, contacts] = await Promise.all([
        getEmailAdminSnapshot(),
        listEmailContacts(),
      ]);
      const active = contacts.filter((c) => !c.unsubscribed);
      return NextResponse.json({
        ...snapshot,
        templateVars: EMAIL_TEMPLATE_VARS,
        contacts,
        contactStats: {
          total: contacts.length,
          active: active.length,
          exchangers: active.filter((c) =>
            contactMatchesSegment(c, "exchangers"),
          ).length,
          reviewers: active.filter((c) =>
            contactMatchesSegment(c, "reviewers"),
          ).length,
          unsubscribed: contacts.filter((c) => c.unsubscribed).length,
        },
      });
    }
    if (view === "contacts") {
      return NextResponse.json({ contacts: await listEmailContacts() });
    }
    if (view === "log") {
      const limit = Number(searchParams.get("limit") ?? 100);
      return NextResponse.json({ log: await listEmailLog(limit) });
    }
    if (view === "templates") {
      return NextResponse.json({ templates: await listEmailTemplates() });
    }
    if (view === "settings") {
      return NextResponse.json({ settings: await getEmailSettings() });
    }

    return NextResponse.json({ error: "unknown view" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: string;
    settings?: Parameters<typeof updateEmailSettings>[0];
    template?: {
      id: string;
      name?: string;
      description?: string;
      subject?: string;
      html?: string;
      text?: string;
      enabled?: boolean;
    };
    email?: string;
    unsubscribed?: boolean;
  };

  try {
    if (body.action === "settings" && body.settings) {
      const settings = await updateEmailSettings(body.settings);
      return NextResponse.json({ settings });
    }

    if (body.action === "template" && body.template?.id) {
      const template = await updateEmailTemplate(body.template.id, body.template);
      if (!template) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    if (body.action === "reset-template" && body.template?.id) {
      const template = await resetEmailTemplate(body.template.id);
      if (!template) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    if (body.action === "contact-unsubscribe" && body.email) {
      const contact = await setEmailContactUnsubscribed(
        body.email,
        body.unsubscribed !== false,
      );
      if (!contact) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json({ contact });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    tag?: string;
    segment?: BroadcastSegment;
  };

  try {
    if (body.action === "sync-contacts") {
      const stats = await syncEmailContactsFromStore();
      return NextResponse.json({ ok: true, stats });
    }

    if (body.action === "broadcast") {
      const segment = body.segment ?? "all";
      if (!SEGMENTS.has(segment)) {
        return NextResponse.json({ error: "Неверный сегмент" }, { status: 400 });
      }
      const result = await broadcastEmail({
        segment,
        subject: String(body.subject ?? ""),
        html: String(body.html ?? ""),
        text: body.text,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (body.action === "test" || body.action === "send") {
      const to = String(body.to ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
      }
      const subject =
        String(body.subject ?? "").trim() ||
        (body.action === "test" ? "GapSnap: тестовое письмо" : "");
      if (!subject) {
        return NextResponse.json({ error: "Укажите тему" }, { status: 400 });
      }
      const html =
        String(body.html ?? "").trim() ||
        `<p>Тестовое письмо GapSnap отправлено ${new Date().toISOString()}</p>`;
      await sendRawAdminEmail({
        to,
        subject,
        html,
        text: body.text,
        tag: body.tag ?? (body.action === "test" ? "admin-test" : "admin-manual"),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
