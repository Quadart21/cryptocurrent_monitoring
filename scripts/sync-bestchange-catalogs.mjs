import { syncCatalogs } from "./lib/bestchange-catalogs.mjs";

async function main() {
  const writeSrc = process.env.SYNC_WRITE_SRC !== "0";
  console.log("Fetching BestChange catalogs…");
  const result = await syncCatalogs({ writeSrc });
  console.log("Saved catalogs:", result.counts);
  console.log("Output dirs:", result.outDirs.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
