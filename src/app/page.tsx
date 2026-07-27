import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PageSkeleton } from "@/components/shell/PageSkeleton";
import { getDashboardCatalog } from "@/lib/bestchange/dashboard-catalog";
import { queryRates } from "@/lib/rates-query";
import { listExchangers } from "@/lib/store";

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
  const catalog = getDashboardCatalog();
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

  const [rates, exchangers] = await Promise.all([
    queryRates({ from, to, mode, city: city || undefined }),
    listExchangers({ publicOnly: true }),
  ]);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard
        catalog={catalog}
        initialFrom={from}
        initialTo={to}
        initialMode={mode}
        initialCity={city}
        initialOffers={rates.offers}
        initialLastSyncAt={rates.lastGlobalSyncAt}
        initialPairCount={rates.activePairCount}
        initialExchangerCount={exchangers.length}
      />
    </Suspense>
  );
}
