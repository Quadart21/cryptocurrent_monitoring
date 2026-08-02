/**
 * Process role for multi-server deploys.
 *
 * - `web`    — public face: pages + APIs, no background pollers
 * - `worker` — pollers + heavy sync; should not be public
 * - `all`    — monolith (default, backwards compatible)
 *
 * Env: GAPSNAP_ROLE=web|worker|all
 */
export type GapsnapRole = "web" | "worker" | "all";

function parseRole(raw: string | undefined): GapsnapRole {
  const v = (raw ?? "all").trim().toLowerCase();
  if (v === "web" || v === "face" || v === "frontend") return "web";
  if (v === "worker" || v === "poller" || v === "jobs") return "worker";
  return "all";
}

export function getGapsnapRole(): GapsnapRole {
  return parseRole(process.env.GAPSNAP_ROLE);
}

export function isWebRole(role = getGapsnapRole()): boolean {
  return role === "web" || role === "all";
}

export function isWorkerRole(role = getGapsnapRole()): boolean {
  return role === "worker" || role === "all";
}

/** Background XML/news/banner/achievement pollers. */
export function shouldStartPollers(role = getGapsnapRole()): boolean {
  return isWorkerRole(role);
}

/**
 * Schema migrations on boot. Prefer web (or explicit flag) so two nodes
 * don't race Drizzle migrate. Worker can opt in with GAPSNAP_RUN_MIGRATIONS=1.
 */
export function shouldRunMigrations(role = getGapsnapRole()): boolean {
  const force = process.env.GAPSNAP_RUN_MIGRATIONS?.trim();
  if (force === "1" || force === "true" || force === "yes") return true;
  if (force === "0" || force === "false" || force === "no") return false;
  return role === "web" || role === "all";
}

/** Web should forward heavy sync to a dedicated worker when configured. */
export function workerProxyConfigured(): boolean {
  return Boolean(
    process.env.WORKER_URL?.trim() && process.env.WORKER_INTERNAL_SECRET?.trim(),
  );
}

export function workerInternalSecret(): string {
  return process.env.WORKER_INTERNAL_SECRET?.trim() || "";
}

export function workerBaseUrl(): string {
  return (process.env.WORKER_URL?.trim() || "").replace(/\/$/, "");
}
