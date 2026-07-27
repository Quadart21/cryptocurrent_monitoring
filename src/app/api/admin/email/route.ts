import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  getEmailAdminSnapshot,
  getEmailSettings,
  listEmailLog,
  listEmailTemplates,
  resetEmailTemplate,
  sendRawAdminEmail,
  updateEmailSettings,
  updateEmailTemplate,
} from "@/lib/email/service";
import { EMAIL_TEMPLATE_VARS } from "@/lib/email/types";
import {
  smtpBzAddUnsubscribe,
  smtpBzCheckEmail,
  smtpBzGetDomains,
  smtpBzGetMessage,
  smtpBzGetMessages,
  smtpBzGetStats,
  smtpBzGetUser,
  smtpBzListUnsubscribe,
  smtpBzRemoveUnsubscribe,
} from "@/lib/smtp-bz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "snapshot";

  try {
    if (view === "snapshot") {
      const snapshot = await getEmailAdminSnapshot();
      return NextResponse.json({
        ...snapshot,
        templateVars: EMAIL_TEMPLATE_VARS,
      });
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
    if (view === "smtp-user") {
      const res = await smtpBzGetUser();
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-stats") {
      const res = await smtpBzGetStats();
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-domains") {
      const res = await smtpBzGetDomains();
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-messages") {
      const query: Record<string, string> = {};
      for (const key of [
        "limit",
        "offset",
        "from",
        "to",
        "tag",
        "status",
        "startDate",
        "endDate",
        "is_open",
        "is_unsubscribe",
      ]) {
        const v = searchParams.get(key);
        if (v) query[key] = v;
      }
      if (!query.limit) query.limit = "50";
      const res = await smtpBzGetMessages(query);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-message") {
      const id = searchParams.get("id") ?? "";
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const res = await smtpBzGetMessage(id);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-check") {
      const email = searchParams.get("email") ?? "";
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const res = await smtpBzCheckEmail(email);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }
    if (view === "smtp-unsubscribe") {
      const query: Record<string, string> = {};
      for (const key of ["limit", "offset", "address", "reason"]) {
        const v = searchParams.get(key);
        if (v) query[key] = v;
      }
      const res = await smtpBzListUnsubscribe(query);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
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
  };

  if (body.action === "settings" && body.settings) {
    const settings = await updateEmailSettings(body.settings);
    return NextResponse.json({ settings });
  }

  if (body.action === "template" && body.template?.id) {
    const template = await updateEmailTemplate(body.template.id, body.template);
    if (!template) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ template });
  }

  if (body.action === "reset-template" && body.template?.id) {
    const template = await resetEmailTemplate(body.template.id);
    if (!template) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ template });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
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
    addresses?: string;
    address?: string;
  };

  try {
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

    if (body.action === "unsubscribe-add") {
      const addresses = String(body.addresses ?? "").trim();
      if (!addresses) {
        return NextResponse.json({ error: "Укажите адреса" }, { status: 400 });
      }
      const res = await smtpBzAddUnsubscribe(addresses);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }

    if (body.action === "unsubscribe-remove") {
      const address = String(body.address ?? "").trim();
      if (!address) {
        return NextResponse.json({ error: "Укажите адрес" }, { status: 400 });
      }
      const res = await smtpBzRemoveUnsubscribe(address);
      return NextResponse.json({ ok: res.ok, status: res.status, data: res.json ?? res.text });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
