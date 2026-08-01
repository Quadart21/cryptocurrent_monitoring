import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope, Unbounded } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ConditionalShell } from "@/components/shell/ConditionalShell";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentAwareAnalytics } from "@/components/consent/ConsentAwareAnalytics";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { AnalyticsScripts, YandexMetrikaSnippet } from "@/components/seo/AnalyticsScripts";
import { JsonLd } from "@/components/seo/JsonLd";
import { getOrganizationJsonLd, getRootMetadata } from "@/lib/seo";
import { buildWebSiteJsonLd } from "@/lib/seo-jsonld";
import { getPublicAds } from "@/lib/public-ads";
import { getApiEnabled } from "@/lib/public-api/settings";
import { getBrandLogoUrl, getSeoSettings } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c12" },
  ],
};

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-sora",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  return getRootMetadata();
}

const themeInit = `(function(){try{var t=localStorage.getItem('gapsnap-theme')||localStorage.getItem('cryptomon-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}else{document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = await getSeoSettings();
  const org = await getOrganizationJsonLd();
  const website = buildWebSiteJsonLd(seo);
  const initialAds = await getPublicAds();
  const brandLogoUrl = await getBrandLogoUrl();
  const apiEnabled = await getApiEnabled();

  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${unbounded.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans text-ink">
        <Script id="gapsnap-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        {/* Metrika in initial HTML so Yandex counter verification can find it. */}
        <YandexMetrikaSnippet counterId={seo.yandexMetricaId} />
        <JsonLd data={[org, website].filter(Boolean) as object[]} />
        <ThemeProvider>
          <ConsentProvider>
            <ConsentAwareAnalytics
              googleAnalyticsId={seo.googleAnalyticsId}
              gtmId={seo.gtmId}
            />
            <ConditionalShell
              initialAds={initialAds}
              brandLogoUrl={brandLogoUrl}
              apiEnabled={apiEnabled}
              contactEmail={seo.contactEmail}
              contactTelegram={seo.contactTelegram}
            >
              {children}
            </ConditionalShell>
            <CookieBanner />
          </ConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
