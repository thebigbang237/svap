import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ebGaramond, inter } from "@/lib/fonts";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";

export const metadata: Metadata = {
  title: "Silicon Valley Africa Program",
  description:
    "Le pont d'excellence entre l'innovation africaine et l'écosystème tech de la Silicon Valley.",
};

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
      className={`${ebGaramond.variable} ${inter.variable} h-full antialiased`}
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
