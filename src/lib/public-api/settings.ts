import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { appMeta } from "@/db/schema";

async function ensureAppMetaRow(): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: appMeta.id })
    .from(appMeta)
    .where(eq(appMeta.id, 1))
    .limit(1);
  if (row) return;
  await db.insert(appMeta).values({ id: 1, apiEnabled: true }).onConflictDoNothing();
}

/** Public API master switch (docs, applications, /v2). Default: on. */
export async function getApiEnabled(): Promise<boolean> {
  await ensureAppMetaRow();
  const db = getDb();
  const [row] = await db
    .select({ apiEnabled: appMeta.apiEnabled })
    .from(appMeta)
    .where(eq(appMeta.id, 1))
    .limit(1);
  return row?.apiEnabled !== false;
}

export async function setApiEnabled(enabled: boolean): Promise<boolean> {
  await ensureAppMetaRow();
  const db = getDb();
  await db
    .insert(appMeta)
    .values({ id: 1, apiEnabled: enabled })
    .onConflictDoUpdate({
      target: appMeta.id,
      set: { apiEnabled: enabled },
    });
  return enabled;
}
