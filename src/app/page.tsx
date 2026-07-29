import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { HomeMidAdSlot } from "@/components/ads/SiteAds";
import { HomeNewsStrip } from "@/components/home/HomeNewsStrip";
import { SeoContentBlocks } from "@/components/seo/SeoContentBlocks";
import { PageSkeleton } from "@/components/shell/PageSkeleton";
import { getDashboardCatalog } from "@/lib/bestchange/dashboard-catalog";
import { homeSeoSections } from "@/lib/seo-landing-content";
import { queryRates } from "@/lib/rates-query";
import { getSeoSettings, listBlogPosts } from "@/lib/store";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    mode?: string;
    city?: string;
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const catalog = await getDashboardCatalog();
  const sp = await searchParams;

  const mode = sp.mode === "cash" ? "cash" : "online";
  const from =
    sp.from?.trim().toUpperCase() ||
    (mode === "cash" ? catalog.defaultCashFrom : catalog.defaultOnlineFrom);
  const to =
    sp.to?.trim().toUpperCase() ||
    (mode === "cash" ? catalog.defaultCashTo : catalog.defaultOnlineTo);
  const city =
    mode === "cash"
      ? sp.city?.trim().toUpperCase() || catalog.defaultCity
      : "";

  const [rates, seo, posts] = await Promise.all([
    queryRates({
      from,
      to,
      mode,
      city: city || undefined,
    }),
    getSeoSettings(),
    listBlogPosts({ status: "published" }),
  ]);

  return (
    <div className="space-y-10 pb-4">
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard
          catalog={catalog}
          initialFrom={from}
          initialTo={to}
          initialMode={mode}
          initialCity={city}
          initialOffers={rates.offers}
        />
      </Suspense>

      <HomeMidAdSlot />

      <SeoContentBlocks
        className="border-t border-line/70 pt-10"
        sections={homeSeoSections(seo.siteName || "GapSnap")}
      />

      <HomeNewsStrip posts={posts.slice(0, 3)} />
    </div>
  );
}
