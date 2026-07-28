import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { runMigrations } from "@/db/migrate";
import { emailContacts, exchangers, reviews } from "@/db/schema";
import type {
  BroadcastSegment,
  EmailContact,
  EmailContactSource,
} from "@/lib/email/types";

export type { BroadcastSegment, EmailContact, EmailContactSource };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

function mapContact(row: typeof emailContacts.$inferSelect): EmailContact {
  return {
    email: row.email,
    sources: (row.sources ?? []).filter(Boolean) as EmailContactSource[],
    label: row.label ?? "",
    exchangerIds: row.exchangerIds ?? [],
    unsubscribed: Boolean(row.unsubscribed),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function unique(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

export async function upsertEmailContact(input: {
  email: string;
  source: EmailContactSource;
  label?: string;
  exchangerId?: string;
}): Promise<EmailContact | null> {
  await runMigrations();
  const email = normalizeEmail(input.email);
  if (!email) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(emailContacts)
    .where(eq(emailContacts.email, email))
    .limit(1);

  if (!existing) {
    const [row] = await db
      .insert(emailContacts)
      .values({
        email,
        sources: [input.source],
        label: (input.label ?? "").trim(),
        exchangerIds: input.exchangerId ? [input.exchangerId] : [],
        unsubscribed: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return mapContact(row);
  }

  const sources = unique([...existing.sources, input.source]);
  const exchangerIds = unique([
    ...existing.exchangerIds,
    ...(input.exchangerId ? [input.exchangerId] : []),
  ]);
  const label = (input.label ?? "").trim() || existing.label || "";

  const [row] = await db
    .update(emailContacts)
    .set({
      sources,
      exchangerIds,
      label,
      updatedAt: now,
    })
    .where(eq(emailContacts.email, email))
    .returning();

  return mapContact(row);
}

export async function listEmailContacts(): Promise<EmailContact[]> {
  await runMigrations();
  const db = getDb();
  const rows = await db.select().from(emailContacts);
  return rows
    .map(mapContact)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function setEmailContactUnsubscribed(
  email: string,
  unsubscribed: boolean,
): Promise<EmailContact | null> {
  await runMigrations();
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const db = getDb();
  const [row] = await db
    .update(emailContacts)
    .set({
      unsubscribed,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailContacts.email, normalized))
    .returning();
  return row ? mapContact(row) : null;
}

/** Backfill contacts from exchangers.owner_email and reviews.email. */
export async function syncEmailContactsFromStore(): Promise<{
  exchangers: number;
  reviews: number;
  total: number;
}> {
  await runMigrations();
  const db = getDb();

  const [exRows, revRows] = await Promise.all([
    db
      .select({
        id: exchangers.id,
        name: exchangers.name,
        ownerEmail: exchangers.ownerEmail,
      })
      .from(exchangers),
    db
      .select({
        email: reviews.email,
        exchangerId: reviews.exchangerId,
        exchangerName: reviews.exchangerName,
      })
      .from(reviews),
  ]);

  let exCount = 0;
  for (const ex of exRows) {
    if (!ex.ownerEmail) continue;
    const saved = await upsertEmailContact({
      email: ex.ownerEmail,
      source: "exchanger",
      label: ex.name,
      exchangerId: ex.id,
    });
    if (saved) exCount += 1;
  }

  let revCount = 0;
  for (const rev of revRows) {
    if (!rev.email) continue;
    const saved = await upsertEmailContact({
      email: rev.email,
      source: "review",
      label: rev.exchangerName,
      exchangerId: rev.exchangerId,
    });
    if (saved) revCount += 1;
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailContacts);

  return { exchangers: exCount, reviews: revCount, total: n ?? 0 };
}

export function contactMatchesSegment(
  contact: EmailContact,
  segment: BroadcastSegment,
): boolean {
  if (segment === "all") return true;
  if (segment === "exchangers") return contact.sources.includes("exchanger");
  if (segment === "reviewers") return contact.sources.includes("review");
  return false;
}
