export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("@/db/migrate");
    await runMigrations();

    const { warnIfInsecureAdminConfig } = await import("@/lib/admin-auth");
    warnIfInsecureAdminConfig();
    const { startFeedPoller } = await import("@/lib/sync-feeds");
    startFeedPoller();
  }
}
