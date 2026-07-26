import type { Metadata } from "next";
import Script from "next/script";
import { Manrope, Unbounded } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ConditionalShell } from "@/components/shell/ConditionalShell";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-sora",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Cryptomon — мониторинг обменников",
    template: "%s · Cryptomon",
  },
  description:
    "Сравнивайте курсы проверенных обменников криптовалют. XML-фиды, рейтинг и справочники BestChange.",
};

const themeInit = `(function(){try{var t=localStorage.getItem('cryptomon-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}else{document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${unbounded.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans text-ink">
        <Script id="cryptomon-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <ThemeProvider>
          <ConditionalShell>{children}</ConditionalShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
