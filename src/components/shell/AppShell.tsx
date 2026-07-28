import { Topbar } from "@/components/shell/Topbar";
import { SiteAdsChrome } from "@/components/ads/SiteAds";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="relative z-10 min-h-screen overflow-x-clip">
      <Topbar />
      <SiteAdsChrome>
        <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </SiteAdsChrome>
    </div>
  );
}
