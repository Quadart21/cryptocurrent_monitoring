import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { emailLog, emailSettings, emailTemplates } from "@/db/schema";
import {
  DEFAULT_EMAIL_SETTINGS,
  DEFAULT_EMAIL_TEMPLATES,
} from "@/lib/email/defaults";
import type {
  EmailLogRow,
  EmailSettings,
  EmailTemplate,
  EmailTemplateId,
} from "@/lib/email/types";
import { sendSmtpBzEmail, smtpBzConfigStatus } from "@/lib/smtp-bz";
import { getSeoSettings } from "@/lib/store";

export function renderTemplate(
  source: string,
  vars: Record<string, string>,
): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

export function siteBaseUrl(seoSiteUrl?: string): string {
  const fromEnv = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const fromSeo = (seoSiteUrl ?? "").trim().replace(/\/$/, "");
  if (fromSeo) return fromSeo;
  return "https://gapsnap.org";
}

async function ensureEmailDefaults(): Promise<void> {
  await runMigrations();
  const db = getDb();
  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.id, 1))
    .limit(1);
  if (!settings) {
    await db.insert(emailSettings).values({
      id: 1,
      fromEmail: DEFAULT_EMAIL_SETTINGS.fromEmail,
      fromName: DEFAULT_EMAIL_SETTINGS.fromName,
      replyTo: DEFAULT_EMAIL_SETTINGS.replyTo,
      notifyReviewConfirm: DEFAULT_EMAIL_SETTINGS.notifyReviewConfirm,
      notifyOwnerExchangerApproved:
        DEFAULT_EMAIL_SETTINGS.notifyOwnerExchangerApproved,
      notifyOwnerReviewApproved:
        DEFAULT_EMAIL_SETTINGS.notifyOwnerReviewApproved,
      updatedAt: new Date().toISOString(),
    });
  }

  const existing = await db.select({ id: emailTemplates.id }).from(emailTemplates);
  const have = new Set(existing.map((r) => r.id));
  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    if (have.has(tpl.id)) continue;
    await db.insert(emailTemplates).values({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      enabled: tpl.enabled,
      updatedAt: tpl.updatedAt,
    });
  }
}

function mapSettings(
  row: typeof emailSettings.$inferSelect | undefined,
): EmailSettings {
  if (!row) return { ...DEFAULT_EMAIL_SETTINGS };
  return {
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    replyTo: row.replyTo,
    notifyReviewConfirm: row.notifyReviewConfirm,
    notifyOwnerExchangerApproved: row.notifyOwnerExchangerApproved,
    notifyOwnerReviewApproved: row.notifyOwnerReviewApproved,
    updatedAt: row.updatedAt,
  };
}

function mapTemplate(row: typeof emailTemplates.$inferSelect): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subject: row.subject,
    html: row.html,
    text: row.text,
    enabled: row.enabled,
    updatedAt: row.updatedAt,
  };
}

function mapLog(row: typeof emailLog.$inferSelect): EmailLogRow {
  return {
    id: row.id,
    createdAt: row.createdAt,
    toAddress: row.toAddress,
    subject: row.subject,
    tag: row.tag,
    templateId: row.templateId,
    status: row.status as EmailLogRow["status"],
    error: row.error,
    providerRaw: row.providerRaw,
  };
}

export async function getEmailSettings(): Promise<EmailSettings> {
  await ensureEmailDefaults();
  const db = getDb();
  const [row] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.id, 1))
    .limit(1);
  return mapSettings(row);
}

export async function updateEmailSettings(
  patch: Partial<EmailSettings>,
): Promise<EmailSettings> {
  await ensureEmailDefaults();
  const current = await getEmailSettings();
  const next: EmailSettings = {
    fromEmail:
      typeof patch.fromEmail === "string"
        ? patch.fromEmail.trim()
        : current.fromEmail,
    fromName:
      typeof patch.fromName === "string"
        ? patch.fromName.trim() || "GapSnap"
        : current.fromName,
    replyTo:
      typeof patch.replyTo === "string" ? patch.replyTo.trim() : current.replyTo,
    notifyReviewConfirm:
      typeof patch.notifyReviewConfirm === "boolean"
        ? patch.notifyReviewConfirm
        : current.notifyReviewConfirm,
    notifyOwnerExchangerApproved:
      typeof patch.notifyOwnerExchangerApproved === "boolean"
        ? patch.notifyOwnerExchangerApproved
        : current.notifyOwnerExchangerApproved,
    notifyOwnerReviewApproved:
      typeof patch.notifyOwnerReviewApproved === "boolean"
        ? patch.notifyOwnerReviewApproved
        : current.notifyOwnerReviewApproved,
    updatedAt: new Date().toISOString(),
  };
  const db = getDb();
  await db
    .insert(emailSettings)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({
      target: emailSettings.id,
      set: { ...next },
    });
  return next;
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  await ensureEmailDefaults();
  const db = getDb();
  const rows = await db.select().from(emailTemplates);
  const byId = new Map(rows.map((r) => [r.id, mapTemplate(r)]));
  // Keep default order, then any extras
  const ordered: EmailTemplate[] = [];
  for (const d of DEFAULT_EMAIL_TEMPLATES) {
    ordered.push(byId.get(d.id) ?? d);
    byId.delete(d.id);
  }
  for (const extra of byId.values()) ordered.push(extra);
  return ordered;
}

export async function getEmailTemplate(
  id: string,
): Promise<EmailTemplate | null> {
  await ensureEmailDefaults();
  const db = getDb();
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  if (row) return mapTemplate(row);
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === id) ?? null;
}

export async function updateEmailTemplate(
  id: string,
  patch: Partial<
    Pick<EmailTemplate, "name" | "description" | "subject" | "html" | "text" | "enabled">
  >,
): Promise<EmailTemplate | null> {
  await ensureEmailDefaults();
  const db = getDb();
  const current = await getEmailTemplate(id);
  if (!current) return null;
  const next = {
    name: typeof patch.name === "string" ? patch.name.trim() : current.name,
    description:
      typeof patch.description === "string"
        ? patch.description.trim()
        : current.description,
    subject:
      typeof patch.subject === "string" ? patch.subject.trim() : current.subject,
    html: typeof patch.html === "string" ? patch.html : current.html,
    text: typeof patch.text === "string" ? patch.text : current.text,
    enabled:
      typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(emailTemplates)
    .values({ id, ...next })
    .onConflictDoUpdate({
      target: emailTemplates.id,
      set: next,
    });
  return { id, ...next };
}

export async function resetEmailTemplate(
  id: string,
): Promise<EmailTemplate | null> {
  const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === id);
  if (!def) return null;
  return updateEmailTemplate(id, {
    name: def.name,
    description: def.description,
    subject: def.subject,
    html: def.html,
    text: def.text,
    enabled: true,
  });
}

export async function listEmailLog(limit = 100): Promise<EmailLogRow[]> {
  await ensureEmailDefaults();
  const db = getDb();
  const rows = await db
    .select()
    .from(emailLog)
    .orderBy(desc(emailLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  return rows.map(mapLog);
}

async function writeLog(input: {
  to: string;
  subject: string;
  tag: string;
  templateId?: string | null;
  status: EmailLogRow["status"];
  error?: string | null;
  providerRaw?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(emailLog).values({
    id: `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    toAddress: input.to,
    subject: input.subject,
    tag: input.tag,
    templateId: input.templateId ?? null,
    status: input.status,
    error: input.error ?? null,
    providerRaw: input.providerRaw ?? null,
  });
}

export type SendTemplatedInput = {
  templateId: EmailTemplateId;
  to: string;
  vars: Record<string, string>;
  tag: string;
  /** Which settings toggle gates this send */
  gate?:
    | "notifyReviewConfirm"
    | "notifyOwnerExchangerApproved"
    | "notifyOwnerReviewApproved";
};

export async function sendTemplatedEmail(
  input: SendTemplatedInput,
): Promise<{ sent: boolean; skipped?: string }> {
  const settings = await getEmailSettings();
  if (input.gate && settings[input.gate] === false) {
    await writeLog({
      to: input.to,
      subject: `(skipped) ${input.templateId}`,
      tag: input.tag,
      templateId: input.templateId,
      status: "skipped",
      error: `Отключено в настройках: ${input.gate}`,
    });
    return { sent: false, skipped: input.gate };
  }

  const tpl = await getEmailTemplate(input.templateId);
  if (!tpl || !tpl.enabled) {
    await writeLog({
      to: input.to,
      subject: `(skipped) ${input.templateId}`,
      tag: input.tag,
      templateId: input.templateId,
      status: "skipped",
      error: "Шаблон выключен или не найден",
    });
    return { sent: false, skipped: "template_disabled" };
  }

  const seo = await getSeoSettings();
  const vars = {
    siteName: seo.siteName || "GapSnap",
    ...input.vars,
  };
  const subject = renderTemplate(tpl.subject, vars);
  const html = renderTemplate(tpl.html, vars);
  const text = renderTemplate(tpl.text, vars);
  const fromEmail = settings.fromEmail || process.env.SMTPBZ_FROM?.trim() || "";
  const fromName =
    settings.fromName || process.env.SMTPBZ_FROM_NAME?.trim() || "GapSnap";

  try {
    const result = await sendSmtpBzEmail({
      to: input.to,
      subject,
      html,
      text,
      tag: input.tag,
      from: fromEmail || undefined,
      name: fromName,
      reply: settings.replyTo || undefined,
    });
    await writeLog({
      to: input.to,
      subject,
      tag: input.tag,
      templateId: input.templateId,
      status: "sent",
      providerRaw: result.raw.slice(0, 2000),
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    await writeLog({
      to: input.to,
      subject,
      tag: input.tag,
      templateId: input.templateId,
      status: "failed",
      error: message,
    });
    throw error;
  }
}

export async function sendRawAdminEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
}): Promise<void> {
  const settings = await getEmailSettings();
  const fromEmail = settings.fromEmail || process.env.SMTPBZ_FROM?.trim() || "";
  const fromName =
    settings.fromName || process.env.SMTPBZ_FROM_NAME?.trim() || "GapSnap";
  try {
    const result = await sendSmtpBzEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tag: input.tag ?? "admin-manual",
      from: fromEmail || undefined,
      name: fromName,
      reply: settings.replyTo || undefined,
    });
    await writeLog({
      to: input.to,
      subject: input.subject,
      tag: input.tag ?? "admin-manual",
      status: "sent",
      providerRaw: result.raw.slice(0, 2000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    await writeLog({
      to: input.to,
      subject: input.subject,
      tag: input.tag ?? "admin-manual",
      status: "failed",
      error: message,
    });
    throw error;
  }
}

export async function getEmailAdminSnapshot() {
  const [settings, templates, log, seo] = await Promise.all([
    getEmailSettings(),
    listEmailTemplates(),
    listEmailLog(50),
    getSeoSettings(),
  ]);
  return {
    settings,
    templates,
    log,
    smtpEnv: smtpBzConfigStatus(),
    siteUrl: siteBaseUrl(seo.siteUrl),
    siteName: seo.siteName || "GapSnap",
  };
}
