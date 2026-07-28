import type { Metadata } from "next";
import Script from "next/script";
import { Manrope, Unbounded } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ConditionalShell } from "@/components/shell/ConditionalShell";
import { AnalyticsScripts } from "@/components/seo/AnalyticsScripts";
import { JsonLd } from "@/components/seo/JsonLd";
import { getOrganizationJsonLd, getRootMetadata } from "@/lib/seo";
import { buildWebSiteJsonLd } from "@/lib/seo-jsonld";
import { getSeoSettings } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

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
        <AnalyticsScripts
          googleAnalyticsId={seo.googleAnalyticsId}
          yandexMetricaId={seo.yandexMetricaId}
          gtmId={seo.gtmId}
        />
        <JsonLd data={[org, website].filter(Boolean) as object[]} />
        <ThemeProvider>
          <ConditionalShell>{children}</ConditionalShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
