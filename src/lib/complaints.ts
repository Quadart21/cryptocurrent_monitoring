import "server-only";

import { createHash, randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { complaints, exchangers } from "@/db/schema";
import { addBlacklistItem } from "@/lib/store";
import type { Complaint, ComplaintStatus } from "@/lib/store-types";

function mapComplaint(row: typeof complaints.$inferSelect): Complaint {
  return {
    id: row.id,
    exchangerId: row.exchangerId,
    exchangerSlug: row.exchangerSlug,
    exchangerName: row.exchangerName,
    email: row.email,
    body: row.body,
    orderId: row.orderId ?? "",
    relatedReviewId: row.relatedReviewId,
    status: row.status as ComplaintStatus,
    adminNote: row.adminNote ?? "",
    createdAt: row.createdAt,
    moderatedAt: row.moderatedAt,
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

export async function listComplaints(options?: {
  status?: ComplaintStatus | "open";
}): Promise<Complaint[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(complaints)
    .orderBy(desc(complaints.createdAt));
  let mapped = rows.map(mapComplaint);
  if (options?.status === "open") {
    mapped = mapped.filter(
      (c) =>
        c.status === "pending" ||
        c.status === "in_progress" ||
        c.status === "awaiting_email",
    );
  } else if (options?.status) {
    mapped = mapped.filter((c) => c.status === options.status);
  }
  return mapped;
}

export async function addComplaint(input: {
  exchangerId: string;
  email: string;
  body: string;
  orderId?: string;
  relatedReviewId?: string | null;
  confirmTokenHash: string;
  confirmExpiresAt: string;
}): Promise<Complaint> {
  const db = getDb();
  const [ex] = await db
    .select()
    .from(exchangers)
    .where(eq(exchangers.id, input.exchangerId))
    .limit(1);
  if (!ex) throw new Error("Обменник не найден");
  if (ex.status !== "active" && ex.status !== "error") {
    throw new Error("Жалобы принимаются только на активные обменники");
  }

  const body = input.body.trim();
  if (body.length < 20 || body.length > 4000) {
    throw new Error("Текст жалобы: от 20 до 4000 символов");
  }

  const id = `cmp_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const [row] = await db
    .insert(complaints)
    .values({
      id,
      exchangerId: ex.id,
      exchangerSlug: ex.slug,
      exchangerName: ex.name,
      email: input.email.trim().toLowerCase(),
      body,
      orderId: (input.orderId ?? "").trim(),
      relatedReviewId: input.relatedReviewId ?? null,
      status: "awaiting_email",
      adminNote: "",
      createdAt: new Date().toISOString(),
      moderatedAt: null,
      emailVerifiedAt: null,
      confirmTokenHash: input.confirmTokenHash,
      confirmExpiresAt: input.confirmExpiresAt,
    })
    .returning();

  return mapComplaint(row);
}

export async function confirmComplaintEmail(
  rawToken: string,
): Promise<Complaint | null> {
  const token = rawToken.trim();
  if (!token || token.length < 16) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const now = new Date().toISOString();
  const [row] = await db
    .select()
    .from(complaints)
    .where(
      and(
        eq(complaints.confirmTokenHash, tokenHash),
        eq(complaints.status, "awaiting_email"),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.confirmExpiresAt && row.confirmExpiresAt < now) {
    await db.delete(complaints).where(eq(complaints.id, row.id));
    return null;
  }
  const [updated] = await db
    .update(complaints)
    .set({
      status: "pending",
      emailVerifiedAt: now,
      confirmTokenHash: null,
      confirmExpiresAt: null,
    })
    .where(eq(complaints.id, row.id))
    .returning();
  return updated ? mapComplaint(updated) : null;
}

export async function updateComplaint(
  id: string,
  patch: {
    status?: ComplaintStatus;
    adminNote?: string;
  },
): Promise<Complaint | null> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(complaints)
    .where(eq(complaints.id, id))
    .limit(1);
  if (!current) return null;

  const nextStatus = patch.status ?? (current.status as ComplaintStatus);
  const [row] = await db
    .update(complaints)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.adminNote !== undefined
        ? { adminNote: patch.adminNote.trim() }
        : {}),
      moderatedAt:
        patch.status && patch.status !== "pending" && patch.status !== "awaiting_email"
          ? new Date().toISOString()
          : current.moderatedAt,
    })
    .where(eq(complaints.id, id))
    .returning();

  if (nextStatus === "resolved_blacklist" && current.status !== "resolved_blacklist") {
    try {
      await addBlacklistItem({
        name: current.exchangerName,
        reason: `Жалоба пользователя: ${current.body.slice(0, 280)}`,
        reports: 1,
        exchangerId: current.exchangerId,
      });
    } catch (error) {
      // already blacklisted is fine
      if (!(error instanceof Error && error.message === "ALREADY_BLACKLISTED")) {
        console.error("[gapsnap] complaint → blacklist failed", error);
      }
    }
  }

  return row ? mapComplaint(row) : null;
}

export async function deleteComplaint(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(complaints)
    .where(eq(complaints.id, id))
    .returning({ id: complaints.id });
  return result.length > 0;
}

export async function countPendingComplaints(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: complaints.id })
    .from(complaints)
    .where(eq(complaints.status, "pending"));
  return rows.length;
}
