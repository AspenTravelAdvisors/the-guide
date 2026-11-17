"use client";

// Sends a GA4 page_view on the first load and on every App Router navigation.
// The root layout does not remount, so gtag's own automatic page_view — which
// only runs when the document loads — would miss /hotels, /journeys/*, and the
// rest of the client transitions. useSearchParams is why this sits under
// <Suspense> in GoogleAnalytics.tsx.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { analyticsPagePath, gaPageView } from "@/lib/ga";

export default function GoogleAnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    const pagePath = analyticsPagePath(pathname || "/", query);
    // One frame later, document.title belongs to the page we just landed on.
    // Canceling the frame in cleanup also collapses React strict mode's
    // double-invoked effect into a single page_view.
    const handle = requestAnimationFrame(() => {
      gaPageView(pagePath);
    });
    return () => cancelAnimationFrame(handle);
  }, [pathname, query]);

  return null;
}
