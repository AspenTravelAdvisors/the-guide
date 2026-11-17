// GA4 on every page. Mounted once from the root layout, beside Vercel Analytics.
//
// The measurement library loads with next/script after hydration. The config
// that queues commands and sets the cross-domain linker is a separate inline
// script in <head> (see gaBootstrapSource): next/script's beforeInteractive
// strategy is not emitted as a parser-blocking script when the tag lives in a
// child of the layout, and a page_view fired from the route tracker would
// otherwise land on the dataLayer before `config`.
//
// This app sends no Content-Security-Policy (next.config.ts, vercel.json, and
// the live response). A future policy has to allow script from
// https://www.googletagmanager.com and connect/img to
// https://www.google-analytics.com, https://*.google-analytics.com, and
// https://*.analytics.google.com, or the tag will fail closed.

import Script from "next/script";
import { Suspense } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/ga";
import GoogleAnalyticsRouteTracker from "./GoogleAnalyticsRouteTracker";

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <link rel="preconnect" href="https://www.googletagmanager.com" />
      <link rel="preconnect" href="https://www.google-analytics.com" />
      <Script
        id="ga4-gtag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsRouteTracker />
      </Suspense>
    </>
  );
}
