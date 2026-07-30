import "server-only";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { getDb, getPool } from "@/db/index";
import { ensureMissingAdTariffs, ensureSeeded } from "@/db/seed";

let migratePromise: Promise<void> | null = null;

export async function runMigrations(): Promise<void> {
  if (migratePromise) return migratePromise;

  migratePromise = (async () => {
    const db = getDb();
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    await migrate(db, { migrationsFolder });
    await ensureSeeded(db);
    await ensureMissingAdTariffs(db);
    const { ensureBootstrapAdmin } = await import("@/lib/admin-users");
    await ensureBootstrapAdmin();
  })().catch((error) => {
    migratePromise = null;
    throw error;
  });

  return migratePromise;
}

export async function closeDbPool(): Promise<void> {
  const pool = getPool();
  await pool.end();
}
