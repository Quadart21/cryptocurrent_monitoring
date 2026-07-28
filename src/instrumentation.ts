export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("@/db/migrate");
    await runMigrations();

    const { ensureCatalogsHydrated } = await import(
      "@/lib/bestchange/catalog-store"
    );
    await ensureCatalogsHydrated();

    const { warnIfInsecureAdminConfig } = await import("@/lib/admin-auth");
    warnIfInsecureAdminConfig();
    const { startFeedPoller } = await import("@/lib/sync-feeds");
    startFeedPoller();
    const { startCatalogPoller } = await import(
      "@/lib/bestchange/sync-catalogs"
    );
    startCatalogPoller();
    const { startBannerCheckPoller } = await import("@/lib/banner-check");
    startBannerCheckPoller();
  }
}
