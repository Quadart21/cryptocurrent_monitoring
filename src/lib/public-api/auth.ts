import "server-only";

import { createHash, randomBytes } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { apiClients, type ApiClientStatus } from "@/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";

export type ApiClientRow = {
  id: string;
  name: string;
  email: string;
  website: string;
  purpose: string;
  status: ApiClientStatus;
  keyPrefix: string | null;
  keyHash: string | null;
  rateLimitPerSec: number;
  lastUsedAt: string | null;
  createdAt: string;
  moderatedAt: string | null;
  adminNote: string;
};

function mapClient(row: typeof apiClients.$inferSelect): ApiClientRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    website: row.website,
    purpose: row.purpose,
    status: row.status as ApiClientStatus,
    keyPrefix: row.keyPrefix,
    keyHash: row.keyHash,
    rateLimitPerSec: row.rateLimitPerSec,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    moderatedAt: row.moderatedAt,
    adminNote: row.adminNote,
  };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Generate opaque key: gs_ + 32 bytes base64url. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `gs_${randomBytes(24).toString("base64url")}`;
  return {
    key,
    prefix: key.slice(0, 12),
    hash: hashApiKey(key),
  };
}

export function newApiClientId(): string {
  return `api_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export async function listApiClients(): Promise<ApiClientRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiClients)
    .orderBy(desc(apiClients.createdAt));
  return rows.map(mapClient);
}

export async function countPendingApiClients(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(apiClients)
    .where(eq(apiClients.status, "pending"));
  return Number(row?.n ?? 0);
}

export async function getApiClientById(id: string): Promise<ApiClientRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(apiClients)
    .where(eq(apiClients.id, id))
    .limit(1);
  return row ? mapClient(row) : null;
}

export async function createApiClientApplication(input: {
  name: string;
  email: string;
  website: string;
  purpose: string;
}): Promise<ApiClientRow> {
  const db = getDb();
  const now = new Date().toISOString();
  const [row] = await db
    .insert(apiClients)
    .values({
      id: newApiClientId(),
      name: input.name,
      email: input.email,
      website: input.website,
      purpose: input.purpose,
      status: "pending",
      createdAt: now,
      adminNote: "",
    })
    .returning();
  return mapClient(row!);
}

export async function approveApiClient(
  id: string,
  adminNote?: string,
): Promise<{ client: ApiClientRow; plainKey: string } | null> {
  const db = getDb();
  const current = await getApiClientById(id);
  if (!current) return null;
  if (current.status === "approved" && current.keyHash) {
    return null;
  }

  const generated = generateApiKey();
  const now = new Date().toISOString();
  const [row] = await db
    .update(apiClients)
    .set({
      status: "approved",
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      moderatedAt: now,
      ...(adminNote !== undefined ? { adminNote } : {}),
    })
    .where(eq(apiClients.id, id))
    .returning();
  if (!row) return null;
  return { client: mapClient(row), plainKey: generated.key };
}

export async function setApiClientStatus(
  id: string,
  status: "rejected" | "revoked" | "pending",
  adminNote?: string,
): Promise<ApiClientRow | null> {
  const db = getDb();
  const patch: Partial<typeof apiClients.$inferInsert> = {
    status,
    moderatedAt: new Date().toISOString(),
  };
  if (adminNote !== undefined) patch.adminNote = adminNote;
  if (status === "revoked" || status === "rejected") {
    patch.keyHash = null;
    patch.keyPrefix = null;
  }
  const [row] = await db
    .update(apiClients)
    .set(patch)
    .where(eq(apiClients.id, id))
    .returning();
  return row ? mapClient(row) : null;
}

export async function touchApiClientLastUsed(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(apiClients)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiClients.id, id));
}

/**
 * Resolve path apiKey → approved client. Applies per-key rate limit.
 * Returns Response on auth/rate failure, otherwise the client.
 */
export async function authenticateApiKey(
  apiKey: string,
): Promise<
  | { ok: true; client: ApiClientRow }
  | { ok: false; response: Response }
> {
  const key = apiKey.trim();
  if (!key || key.length < 8 || key.length > 128) {
    return {
      ok: false,
      response: Response.json({ error: "invalid api key" }, { status: 401 }),
    };
  }

  const db = getDb();
  const hash = hashApiKey(key);
  const [row] = await db
    .select()
    .from(apiClients)
    .where(and(eq(apiClients.keyHash, hash), eq(apiClients.status, "approved")))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      response: Response.json({ error: "invalid api key" }, { status: 401 }),
    };
  }

  const client = mapClient(row);
  const limit = Math.max(1, Math.min(100, client.rateLimitPerSec || 10));
  const limited = rateLimit(`v2:key:${client.id}`, limit, 1000);
  if (!limited.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: "rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      ),
    };
  }

  // Fire-and-forget lastUsed (don't block response)
  void touchApiClientLastUsed(client.id).catch(() => {});

  return { ok: true, client };
}

export async function withApiAuth(
  apiKey: string,
  handler: (client: ApiClientRow) => Promise<Response> | Response,
): Promise<Response> {
  const auth = await authenticateApiKey(apiKey);
  if (!auth.ok) return auth.response;
  return handler(auth.client);
}
