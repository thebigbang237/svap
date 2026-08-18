import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/marketing/PageHeader";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CTAButton } from "@/components/marketing/CTAButton";
import { ArrowRightIcon } from "@/components/marketing/icons";
import { createArticlesReader } from "@/lib/articles-reader";
import type { ArticleRow } from "@/lib/supabase/types";

/**
 * Press coverage.
 *
 * Every card leaves for the publisher. Nothing is reproduced on this domain —
 * see supabase/migrations/0016.
 *
 * No `revalidate` export: the whole `[locale]` tree renders per request in
 * this app, so declaring one here would promise caching that never happens.
 * The query is a single indexed read of a table with tens of rows.
 */

export default async function ActualitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tCommon = await getTranslations("common");
  const t = await getTranslations("actualites");

  let articles: ArticleRow[] = [];

  try {
    const supabase = createArticlesReader();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .returns<ArticleRow[]>();

    if (error) {
      console.error("Failed to load articles:", error.message);
    }
    articles = data ?? [];
  } catch (error) {
    // A marketing page must not 500 because the database is unreachable: the
    // empty state below is a perfectly good page.
    console.error("Failed to load articles:", error);
  }

  return (
    <>
      <PageHeader
        breadcrumbHome={tCommon("home")}
        breadcrumbCurrent={t("breadcrumbCurrent")}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />

      <section className="px-8 py-[120px]">
        <div className="mx-auto max-w-[1280px]">
          {articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  locale={locale}
                  readLabel={t("readOn")}
                />
              ))}
            </div>
          ) : (
            <p className="border border-ink-dim/20 bg-white p-10 text-center text-ink-mid">
              {t("empty")}
            </p>
          )}

          <div className="mt-16 border-t border-ink-dim/20 pt-8">
            <p className="text-xs leading-relaxed text-ink-dim">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-sky-mid px-8 py-[120px] text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 font-serif text-[32px] font-normal text-blue-dark sm:text-[42px]">
            {t("ctaTitle")}
          </h2>
          <CTAButton
            href="/candidature"
            variant="primary"
            icon={<ArrowRightIcon className="h-4 w-4" />}
          >
            {t("ctaLabel")}
          </CTAButton>
        </div>
      </section>
    </>
  );
}
