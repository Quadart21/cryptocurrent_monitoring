export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const {
    getGapsnapRole,
    shouldRunMigrations,
    shouldStartPollers,
  } = await import("@/lib/runtime-role");
  const role = getGapsnapRole();
  console.info(`[gapsnap] boot role=${role}`);

  if (shouldRunMigrations(role)) {
    const { runMigrations } = await import("@/db/migrate");
    await runMigrations();
  }

  // Catalog snapshot is needed on web for labels / search; cheap DB read.
  const { ensureCatalogsHydrated } = await import(
    "@/lib/bestchange/catalog-store"
  );
  await ensureCatalogsHydrated();

  const { warnIfInsecureAdminConfig } = await import("@/lib/admin-auth");
  warnIfInsecureAdminConfig();

  if (!shouldStartPollers(role)) {
    console.info(
      `[gapsnap] pollers disabled on role=${role} (set GAPSNAP_ROLE=worker|all to enable)`,
    );
    return;
  }

  const { startFeedPoller } = await import("@/lib/sync-feeds");
  startFeedPoller();
  const { startCatalogPoller } = await import(
    "@/lib/bestchange/sync-catalogs"
  );
  startCatalogPoller();
  const { startBannerCheckPoller } = await import("@/lib/banner-check");
  startBannerCheckPoller();
  const { startNewsPoller } = await import("@/lib/news/sync-news");
  startNewsPoller();
  const { startAchievementPoller } = await import("@/lib/achievements-auto");
  startAchievementPoller();
  const { startTelegramContentPoller } = await import(
    "@/lib/telegram/content/poller"
  );
  startTelegramContentPoller();
}
