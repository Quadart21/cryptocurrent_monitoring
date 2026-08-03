import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { mailMessages, mailThreads } from "@/db/schema";
import { getEmailSettings } from "@/lib/email/service";
import {
  resolveMailboxIdentity,
  sendResendEmail,
} from "@/lib/resend-mail";
import { findExchangersByOwnerEmail } from "@/lib/store";

export type MailThreadRow = {
  id: string;
  contactEmail: string;
  contactName: string;
  subject: string;
  lastMessageAt: string;
  unreadCount: number;
  exchangerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailMessageRow = {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  resendEmailId: string | null;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  createdAt: string;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extract bare address from `Name <user@host>` or plain email. */
export function parseEmailAddress(raw: string): {
  email: string;
  name: string;
} {
  const s = (raw ?? "").trim();
  const angle = s.match(/^(.*?)<([^>]+)>\s*$/);
  if (angle) {
    return {
      name: angle[1].replace(/^["']|["']$/g, "").trim(),
      email: normEmail(angle[2]),
    };
  }
  return { email: normEmail(s), name: "" };
}

function mapThread(row: typeof mailThreads.$inferSelect): MailThreadRow {
  return {
    id: row.id,
    contactEmail: row.contactEmail,
    contactName: row.contactName ?? "",
    subject: row.subject ?? "",
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount ?? 0,
    exchangerId: row.exchangerId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: typeof mailMessages.$inferSelect): MailMessageRow {
  return {
    id: row.id,
    threadId: row.threadId,
    direction: row.direction === "outbound" ? "outbound" : "inbound",
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    subject: row.subject ?? "",
    textBody: row.textBody ?? "",
    htmlBody: row.htmlBody ?? "",
    resendEmailId: row.resendEmailId ?? null,
    messageIdHeader: row.messageIdHeader ?? null,
    inReplyTo: row.inReplyTo ?? null,
    createdAt: row.createdAt,
  };
}

export async function listMailThreads(limit = 50): Promise<MailThreadRow[]> {
  await runMigrations();
  const db = getDb();
  const rows = await db
    .select()
    .from(mailThreads)
    .orderBy(desc(mailThreads.lastMessageAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map(mapThread);
}

export async function getMailThread(
  id: string,
): Promise<{ thread: MailThreadRow; messages: MailMessageRow[] } | null> {
  await runMigrations();
  const db = getDb();
  const [thread] = await db
    .select()
    .from(mailThreads)
    .where(eq(mailThreads.id, id))
    .limit(1);
  if (!thread) return null;
  const messages = await db
    .select()
    .from(mailMessages)
    .where(eq(mailMessages.threadId, id))
    .orderBy(mailMessages.createdAt);
  return { thread: mapThread(thread), messages: messages.map(mapMessage) };
}

export async function markThreadRead(id: string): Promise<void> {
  await runMigrations();
  const db = getDb();
  await db
    .update(mailThreads)
    .set({ unreadCount: 0, updatedAt: new Date().toISOString() })
    .where(eq(mailThreads.id, id));
}

async function findThreadByContact(
  email: string,
): Promise<typeof mailThreads.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(mailThreads)
    .where(eq(mailThreads.contactEmail, normEmail(email)))
    .orderBy(desc(mailThreads.lastMessageAt))
    .limit(1);
  return row ?? null;
}

async function resolveExchangerId(email: string): Promise<string | null> {
  try {
    const matches = await findExchangersByOwnerEmail(normEmail(email));
    return matches[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function ingestInboundEmail(input: {
  resendEmailId: string;
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  contactName?: string;
}): Promise<{ threadId: string; messageId: string; created: boolean }> {
  await runMigrations();
  const db = getDb();
  const now = new Date().toISOString();
  const parsed = parseEmailAddress(input.from);
  const from = parsed.email;
  if (!from || !from.includes("@")) {
    throw new Error("Некорректный from во входящем письме");
  }
  const toAddress =
    parseEmailAddress(input.to[0] ?? "").email || "inbox";
  const contactName = (input.contactName ?? "").trim() || parsed.name;

  // Dedupe by Resend id
  if (input.resendEmailId) {
    const [existing] = await db
      .select()
      .from(mailMessages)
      .where(eq(mailMessages.resendEmailId, input.resendEmailId))
      .limit(1);
    if (existing) {
      return {
        threadId: existing.threadId,
        messageId: existing.id,
        created: false,
      };
    }
  }

  let thread = await findThreadByContact(from);
  let created = false;
  if (!thread) {
    const exchangerId = await resolveExchangerId(from);
    const id = newId("mth");
    const [inserted] = await db
      .insert(mailThreads)
      .values({
        id,
        contactEmail: from,
        contactName,
        subject: input.subject.trim() || "(без темы)",
        lastMessageAt: now,
        unreadCount: 1,
        exchangerId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    thread = inserted;
    created = true;
  } else {
    await db
      .update(mailThreads)
      .set({
        lastMessageAt: now,
        unreadCount: sql`${mailThreads.unreadCount} + 1`,
        subject: input.subject.trim() || thread.subject,
        contactName: contactName || thread.contactName || "",
        updatedAt: now,
      })
      .where(eq(mailThreads.id, thread.id));
  }

  const messageId = newId("msg");
  await db.insert(mailMessages).values({
    id: messageId,
    threadId: thread.id,
    direction: "inbound",
    fromAddress: from,
    toAddress,
    subject: input.subject.trim() || "(без темы)",
    textBody: input.textBody || "",
    htmlBody: input.htmlBody || "",
    resendEmailId: input.resendEmailId || null,
    messageIdHeader: input.messageIdHeader ?? null,
    inReplyTo: input.inReplyTo ?? null,
    createdAt: now,
  });

  return { threadId: thread.id, messageId, created };
}

export async function replyToThread(input: {
  threadId: string;
  bodyText: string;
  bodyHtml?: string;
  fromEmail?: string;
}): Promise<MailMessageRow> {
  await runMigrations();
  const db = getDb();
  const text = input.bodyText.trim();
  if (text.length < 1) throw new Error("Введите текст ответа");

  const [thread] = await db
    .select()
    .from(mailThreads)
    .where(eq(mailThreads.id, input.threadId))
    .limit(1);
  if (!thread) throw new Error("Диалог не найден");

  const prior = await db
    .select()
    .from(mailMessages)
    .where(eq(mailMessages.threadId, thread.id))
    .orderBy(desc(mailMessages.createdAt))
    .limit(5);

  const lastInbound = prior.find((m) => m.direction === "inbound");
  const lastAny = prior[0];
  const inReplyTo =
    lastInbound?.messageIdHeader || lastAny?.messageIdHeader || undefined;
  const references = prior
    .map((m) => m.messageIdHeader)
    .filter(Boolean)
    .reverse()
    .join(" ");

  const settings = await getEmailSettings();
  const identity = resolveMailboxIdentity(
    input.fromEmail || lastInbound?.toAddress || settings.fromEmail,
  );
  const subject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject || "сообщение"}`;

  const html =
    input.bodyHtml?.trim() ||
    `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${escapeHtml(text)}</div>`;

  const sent = await sendResendEmail({
    to: thread.contactEmail,
    subject,
    html,
    text,
    from: identity.email,
    name: identity.name,
    reply: identity.email,
    tag: "mailbox-reply",
    inReplyTo,
    references: references || undefined,
  });

  const now = new Date().toISOString();
  const messageId = newId("msg");

  const [row] = await db
    .insert(mailMessages)
    .values({
      id: messageId,
      threadId: thread.id,
      direction: "outbound",
      fromAddress: identity.email,
      toAddress: thread.contactEmail,
      subject,
      textBody: text,
      htmlBody: html,
      resendEmailId: sent.id,
      messageIdHeader: null,
      inReplyTo: inReplyTo ?? null,
      createdAt: now,
    })
    .returning();

  await db
    .update(mailThreads)
    .set({
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: now,
    })
    .where(eq(mailThreads.id, thread.id));

  return mapMessage(row);
}

export async function startOutboundThread(input: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  fromEmail?: string;
}): Promise<{ thread: MailThreadRow; message: MailMessageRow }> {
  await runMigrations();
  const db = getDb();
  const to = normEmail(input.to);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Некорректный email получателя");
  }
  const subject = input.subject.trim() || "(без темы)";
  const text = input.bodyText.trim();
  if (text.length < 1) throw new Error("Введите текст письма");

  const identity = resolveMailboxIdentity(input.fromEmail);
  const html =
    input.bodyHtml?.trim() ||
    `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${escapeHtml(text)}</div>`;

  const sent = await sendResendEmail({
    to,
    subject,
    html,
    text,
    from: identity.email,
    name: identity.name,
    reply: identity.email,
    tag: "mailbox-compose",
  });

  const now = new Date().toISOString();
  let thread = await findThreadByContact(to);
  if (!thread) {
    const exchangerId = await resolveExchangerId(to);
    const id = newId("mth");
    const [inserted] = await db
      .insert(mailThreads)
      .values({
        id,
        contactEmail: to,
        contactName: "",
        subject,
        lastMessageAt: now,
        unreadCount: 0,
        exchangerId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    thread = inserted;
  } else {
    await db
      .update(mailThreads)
      .set({
        lastMessageAt: now,
        subject,
        updatedAt: now,
        unreadCount: 0,
      })
      .where(eq(mailThreads.id, thread.id));
  }

  const messageId = newId("msg");
  const [row] = await db
    .insert(mailMessages)
    .values({
      id: messageId,
      threadId: thread.id,
      direction: "outbound",
      fromAddress: identity.email,
      toAddress: to,
      subject,
      textBody: text,
      htmlBody: html,
      resendEmailId: sent.id,
      messageIdHeader: null,
      inReplyTo: null,
      createdAt: now,
    })
    .returning();

  return { thread: mapThread(thread), message: mapMessage(row) };
}

export async function mailboxUnreadTotal(): Promise<number> {
  await runMigrations();
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${mailThreads.unreadCount}), 0)` })
    .from(mailThreads);
  return Number(row?.n ?? 0);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
