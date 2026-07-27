import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapPgPool: Pool | undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it in .env (see .env.example).",
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalThis.__gapsnapPgPool) {
    globalThis.__gapsnapPgPool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
    });
  }
  return globalThis.__gapsnapPgPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Db = ReturnType<typeof getDb>;
