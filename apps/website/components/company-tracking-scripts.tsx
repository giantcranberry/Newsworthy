// Renders company retargeting/analytics tags as plain <script> elements so they
// are emitted in the server-rendered HTML and execute during page parse.
// next/script with strategy="afterInteractive" must NOT be used here: in the App
// Router it only emits a <link rel="preload"> during SSR and defers execution to
// client hydration, which leaves the pixels unfired on these pages.

export type CompanyTracking = {
  gtmId?: string
  googleAdsId?: string
  metaPixelId?: string
  redditPixelId?: string
  clarityId?: string
  hubspotId?: string
}

// IDs come from company-editable SEO settings and are interpolated into inline
// scripts, so only pass through values restricted to safe characters.
function safeId(id: unknown): string | null {
  return typeof id === "string" && /^[\w-]+$/.test(id) ? id : null
}

export default function CompanyTrackingScripts({
  tracking,
}: {
  tracking: CompanyTracking | null | undefined
}) {
  if (!tracking) return null

  const gtmId = safeId(tracking.gtmId)
  const googleAdsId = safeId(tracking.googleAdsId)
  const metaPixelId = safeId(tracking.metaPixelId)
  const redditPixelId = safeId(tracking.redditPixelId)
  const clarityId = safeId(tracking.clarityId)
  const hubspotId = safeId(tracking.hubspotId)

  return (
    <>
      {/* Google Tag Manager */}
      {gtmId && (
        <>
          <script
            id="gtm-script"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}
      {/* Google Ads remarketing */}
      {googleAdsId && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
          />
          <script
            id="google-ads-gtag"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleAdsId}');`,
            }}
          />
        </>
      )}
      {/* Meta (Facebook) Pixel */}
      {metaPixelId && (
        <>
          <script
            id="meta-pixel"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
      {/* Reddit Pixel */}
      {redditPixelId && (
        <script
          id="reddit-pixel"
          dangerouslySetInnerHTML={{
            __html: `!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js";t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${redditPixelId}');rdt('track','PageVisit');`,
          }}
        />
      )}
      {/* Microsoft Clarity */}
      {clarityId && (
        <script
          id="clarity-script"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`,
          }}
        />
      )}
      {/* HubSpot tracking */}
      {hubspotId && (
        <script
          id="hs-script-loader"
          async
          defer
          src={`https://js.hs-scripts.com/${hubspotId}.js`}
        />
      )}
    </>
  )
}
