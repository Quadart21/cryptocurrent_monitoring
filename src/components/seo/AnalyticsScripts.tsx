import Script from "next/script";

type Props = {
  googleAnalyticsId?: string;
  yandexMetricaId?: string;
  gtmId?: string;
};

function metrikaCounterId(raw: string): number | string {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : raw;
}

/** Inline Metrika snippet — plain <script> so Yandex HTML check finds the counter. */
export function YandexMetrikaSnippet({ counterId }: { counterId: string }) {
  const ym = counterId.trim();
  if (!ym) return null;
  const ymId = metrikaCounterId(ym);
  const code = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${JSON.stringify(ymId)}, "init", {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`;

  return (
    <>
      <script id="gapsnap-ym" dangerouslySetInnerHTML={{ __html: code }} />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${ym}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}

/** Inject GA4 / GTM when IDs are configured (consent-gated via ConsentAwareAnalytics). */
export function AnalyticsScripts({
  googleAnalyticsId,
  gtmId,
}: Omit<Props, "yandexMetricaId">) {
  const ga = googleAnalyticsId?.trim();
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
    </>
  );
}
