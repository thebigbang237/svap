import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

/**
 * The prerendered public pages, in every locale.
 *
 * Nothing here reads the request, so Next builds this once and serves
 * /sitemap.xml as a static file — no function invocation per crawl.
 *
 * Deliberately absent: `/candidature/complet` and the other Phase-1 outcome
 * pages (statuses a candidate is sent to, not pages to land on from a
 * search), Phase 2 (`/documents/*`) and `/admin`.
 *
 * The production domain is written out rather than read from
 * NEXT_PUBLIC_SITE_URL: a sitemap fetched from a preview deployment must
 * still point search engines at the real site.
 */
const SITE_URL = "https://www.siliconvalleyafricaprogram.com";

const PAGES = [
  "",
  "/admission",
  "/packs",
  "/agenda",
  "/delegues",
  "/actualites",
  "/faq",
  "/confiance",
  "/candidature",
  // Must match DOCUMENTS in legal/[document]/page.tsx. With dynamicParams
  // off there, a document missing from that list is a 404 listed here.
  "/legal/mentions-legales",
  "/legal/confidentialite",
  "/legal/conditions-generales",
  "/legal/primes",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    PAGES.map((page) => ({ url: `${SITE_URL}/${locale}${page}` })),
  );
}
