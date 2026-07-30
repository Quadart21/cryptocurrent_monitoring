import { Topbar } from "@/components/shell/Topbar";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";
import { Footer } from "@/components/Footer";
import { SiteAdsChrome } from "@/components/ads/SiteAds";
import type { PublicAd } from "@/components/ads/ads-context";

export function AppShell({
  children,
  initialAds = [],
}: {
  children: React.ReactNode;
  initialAds?: PublicAd[];
}) {
  return (
    <div className="mobile-shell-pad relative z-10 flex min-h-screen flex-col overflow-x-clip">
      <Topbar />
      <SiteAdsChrome initialAds={initialAds}>
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
          {children}
        </div>
      </SiteAdsChrome>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
