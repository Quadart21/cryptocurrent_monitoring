import { Topbar } from "@/components/shell/Topbar";
import { SiteAdsChrome } from "@/components/ads/SiteAds";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="relative z-10 min-h-screen">
      <Topbar />
      <SiteAdsChrome>
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </SiteAdsChrome>
    </div>
  );
}
