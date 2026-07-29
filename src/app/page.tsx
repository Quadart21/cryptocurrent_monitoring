import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PageSkeleton } from "@/components/shell/PageSkeleton";
import { getDashboardCatalog } from "@/lib/bestchange/dashboard-catalog";
import { queryRates } from "@/lib/rates-query";

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

  const rates = await queryRates({
    from,
    to,
    mode,
    city: city || undefined,
  });

  return (
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
  );
}
