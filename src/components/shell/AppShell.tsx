import { Topbar } from "@/components/shell/Topbar";
import { Footer } from "@/components/Footer";
import { SiteAdsChrome } from "@/components/ads/SiteAds";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col overflow-x-clip">
      <Topbar />
      <SiteAdsChrome>
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
          {children}
        </div>
      </SiteAdsChrome>
      <Footer />
    </div>
  );
}
