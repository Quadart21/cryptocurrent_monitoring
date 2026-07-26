export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFeedPoller } = await import("@/lib/sync-feeds");
    startFeedPoller();
  }
}
