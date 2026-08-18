import { createAdminClient } from "@/lib/supabase/admin";
import { ArticlesManager } from "@/components/admin/ArticlesManager";
import type { ArticleRow } from "@/lib/supabase/types";

/**
 * Press coverage — the admin side of /actualites.
 *
 * Read with the service role rather than the anonymous reader the public page
 * uses: this list has to include the hidden items, which is exactly what the
 * RLS policy there exists to exclude.
 */
export default async function AdminArticlesPage() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .returns<ArticleRow[]>();

  if (error) {
    console.error("Failed to load articles for admin:", error.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-blue-dark">
          Actualités
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Les articles parus dans la presse. Chaque carte renvoie vers le site
          du média — aucun contenu n&apos;est reproduit sur le site du
          programme.
        </p>
      </div>

      <ArticlesManager articles={data ?? []} />
    </div>
  );
}
