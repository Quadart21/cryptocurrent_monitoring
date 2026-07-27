import { getSeoSettings } from "@/lib/store";
import { buildRobotsTxt } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getSeoSettings();
  return new Response(buildRobotsTxt(seo), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
