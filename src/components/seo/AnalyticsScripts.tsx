import Script from "next/script";

type Props = {
  googleAnalyticsId?: string;
  yandexMetricaId?: string;
  gtmId?: string;
};

/** Inject GA4 / Yandex Metrika / GTM when IDs are configured in SEO admin. */
export function AnalyticsScripts({
  googleAnalyticsId,
  yandexMetricaId,
  gtmId,
}: Props) {
  const ga = googleAnalyticsId?.trim();
  const ym = yandexMetricaId?.trim();
  const gtm = gtmId?.trim();

  return (
    <>
      {gtm ? (
        <Script id="gapsnap-gtm" strategy="afterInteractive">{`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtm}');`}</Script>
      ) : null}

      {ga ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script id="gapsnap-ga4" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga}');`}</Script>
        </>
      ) : null}

      {ym ? (
        <Script id="gapsnap-ym" strategy="afterInteractive">{`
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${JSON.stringify(Number(ym) || ym)}, "init", {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}</Script>
      ) : null}
    </>
  );
}
