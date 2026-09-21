"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import {
  META_PIXEL_ID,
  META_PIXEL_SCRIPT,
  isTrackedPath,
  trackPageView,
} from "@/lib/analytics/meta-pixel";

/**
 * Mounted once in the locale layout. Reports a PageView per navigation on the
 * routes that are safe to report, and loads Meta's script only once the
 * visitor reaches one — someone arriving straight into Phase 2 from their
 * access-code email never downloads it at all.
 *
 * No <noscript> image fallback: it would render on every route, including the
 * untracked ones, and every form on this site needs JavaScript anyway.
 */
export function MetaPixel() {
  const locale = useLocale();
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);

  useEffect(() => {
    // Keyed with the locale: /fr/packs → /en/packs is a new page view even
    // though the locale-stripped pathname is unchanged.
    if (tracked) trackPageView(`/${locale}${pathname}`);
  }, [locale, pathname, tracked]);

  if (!META_PIXEL_ID || !tracked) return null;

  // Unmounting this on an untracked route does not unload the script — nothing
  // can — but it stays inert there: no PageView is fired, and automatic
  // events are disabled.
  return <Script id="meta-pixel" src={META_PIXEL_SCRIPT} strategy="afterInteractive" />;
}
