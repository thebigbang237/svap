import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing, getDirection, type Locale } from "@/i18n/routing";
import {
  ebGaramond,
  inter,
  notoKufiArabic,
  ibmPlexSansArabic,
} from "@/lib/fonts";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `/${locale}`,
      // hreflang, so a Moroccan searcher lands on /ar rather than /fr.
      // x-default points at the default locale's tree.
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [l, `/${l}`]),
        ),
        "x-default": `/${routing.defaultLocale}`,
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      // Everything RTL hangs off this one attribute: Tailwind's `rtl:`
      // variant, every logical property, and the browser's own bidi
      // resolution all read it.
      dir={getDirection(locale)}
      className={`${fontVariables(locale)} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sky text-ink">
        <NextIntlClientProvider messages={messages}>
          <Topbar />
          <main className="flex flex-1 flex-col pt-24">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/**
 * Only load the font files the locale actually renders in. Shipping the
 * Arabic faces to French readers (or vice versa) would roughly double the
 * font payload for no benefit — these scripts share no glyphs.
 *
 * globals.css maps --font-serif / --font-sans onto whichever pair is present.
 */
function fontVariables(locale: Locale): string {
  return locale === "ar"
    ? `${notoKufiArabic.variable} ${ibmPlexSansArabic.variable}`
    : `${ebGaramond.variable} ${inter.variable}`;
}
