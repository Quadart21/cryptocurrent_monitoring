import "server-only";

import { randomBytes } from "crypto";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { exchangerTrafficEvents } from "@/db/schema";
import { runMigrations } from "@/db/migrate";

import { summarizeUserAgent } from "@/lib/exchanger-traffic-ua";

export type TrafficEventType = "view" | "click";

export type ExchangerTrafficEvent = {
  id: string;
  exchangerId: string;
  event: TrafficEventType;
  ip: string;
  userAgent: string;
  path: string;
  referrer: string;
  createdAt: string;
};

const RETENTION_DAYS = 90;
const MAX_EVENTS_PER_EXCHANGER = 20_000;

function mapEvent(
  row: typeof exchangerTrafficEvents.$inferSelect,
): ExchangerTrafficEvent {
  return {
    id: row.id,
    exchangerId: row.exchangerId,
    event: row.event === "click" ? "click" : "view",
    ip: row.ip || "unknown",
    userAgent: row.userAgent ?? "",
    path: row.path ?? "",
    referrer: row.referrer ?? "",
    createdAt: row.createdAt,
  };
}

function truncate(value: string, max: number): string {
  const v = value.trim();
  if (v.length <= max) return v;
  return v.slice(0, max);
}

export async function recordExchangerTrafficEvents(
  items: Array<{
    exchangerId: string;
    event: TrafficEventType;
    ip: string;
    userAgent?: string;
    path?: string;
    referrer?: string;
    createdAt?: string;
  }>,
): Promise<void> {
  if (!items.length) return;
  await runMigrations();
  const db = getDb();
  const now = new Date().toISOString();
  const values = items.slice(0, 40).map((item) => ({
    id: `te_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    exchangerId: item.exchangerId,
    event: item.event,
    ip: truncate(item.ip || "unknown", 64),
    userAgent: truncate(item.userAgent ?? "", 512),
    path: truncate(item.path ?? "", 256),
    referrer: truncate(item.referrer ?? "", 512),
    createdAt: item.createdAt ?? now,
  }));

  await db.insert(exchangerTrafficEvents).values(values);

  // Opportunistic prune for touched exchangers (cheap enough at track volume)
  const ids = [...new Set(values.map((v) => v.exchangerId))];
  for (const exchangerId of ids) {
    await pruneExchangerTrafficEvents(exchangerId);
  }
}

async function pruneExchangerTrafficEvents(
  exchangerId: string,
): Promise<void> {
  const db = getDb();
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db
    .delete(exchangerTrafficEvents)
    .where(
      and(
        eq(exchangerTrafficEvents.exchangerId, exchangerId),
        lt(exchangerTrafficEvents.createdAt, cutoff),
      ),
    );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exchangerTrafficEvents)
    .where(eq(exchangerTrafficEvents.exchangerId, exchangerId));

  if (Number(count) <= MAX_EVENTS_PER_EXCHANGER) return;

  const overflow = Number(count) - MAX_EVENTS_PER_EXCHANGER;
  const old = await db
    .select({ id: exchangerTrafficEvents.id })
    .from(exchangerTrafficEvents)
    .where(eq(exchangerTrafficEvents.exchangerId, exchangerId))
    .orderBy(asc(exchangerTrafficEvents.createdAt))
    .limit(overflow);
  if (!old.length) return;
  const { inArray } = await import("drizzle-orm");
  await db
    .delete(exchangerTrafficEvents)
    .where(
      inArray(
        exchangerTrafficEvents.id,
        old.map((r) => r.id),
      ),
    );
}

export async function listExchangerTrafficEvents(options: {
  exchangerId: string;
  event?: TrafficEventType | "all";
  limit?: number;
  offset?: number;
  sinceDays?: number;
}): Promise<{ events: ExchangerTrafficEvent[]; total: number }> {
  await runMigrations();
  const db = getDb();
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const sinceDays = Math.min(90, Math.max(1, options.sinceDays ?? 30));
  const since = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const filters = [
    eq(exchangerTrafficEvents.exchangerId, options.exchangerId),
    gte(exchangerTrafficEvents.createdAt, since),
  ];
  if (options.event === "view" || options.event === "click") {
    filters.push(eq(exchangerTrafficEvents.event, options.event));
  }

  const where = and(...filters);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(exchangerTrafficEvents)
    .where(where);

  const rows = await db
    .select()
    .from(exchangerTrafficEvents)
    .where(where)
    .orderBy(desc(exchangerTrafficEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return { events: rows.map(mapEvent), total: Number(total) || 0 };
}

export { summarizeUserAgent };
