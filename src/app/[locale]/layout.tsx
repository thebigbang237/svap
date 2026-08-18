import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing, getDirection } from "@/i18n/routing";
// Side-effect import: registers every @font-face. Self-hosted, so nothing is
// fetched from a third party at build time or at runtime.
import "@/lib/fonts";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";
import { DeadlineWidget } from "@/components/marketing/DeadlineWidget";
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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-sky text-ink">
        <NextIntlClientProvider messages={messages}>
          <Topbar />
          <main className="flex flex-1 flex-col pt-24">{children}</main>
          <Footer />
          {/* Mounted once for the whole tree; it hides itself on the
              application and Phase-2 routes rather than each page opting in. */}
          <DeadlineWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

// Per-locale font loading is no longer done here: each @fontsource stylesheet
// declares `unicode-range` per subset, so the browser downloads only the
// files it actually needs to render the page. Same saving, one less thing to
// keep in sync.
