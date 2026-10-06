import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { parseArticleForm } from "@/lib/validations/article";
import { storeThumbnail, removeThumbnail } from "@/lib/admin/article-thumbnail";
import type { ArticleRow } from "@/lib/supabase/types";

/**
 * Creates a press item.
 *
 * Multipart rather than JSON because the thumbnail travels with the fields —
 * one request, one row, one object, no half-created article waiting for an
 * image that never arrives.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = parseArticleForm(form);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const file = form.get("thumbnail");
  let thumbnailPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const stored = await storeThumbnail(file, parsed.data.mediaName);
    if (!stored.ok) {
      return NextResponse.json({ error: stored.error }, { status: 400 });
    }
    thumbnailPath = stored.path;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("articles")
    .insert({
      media_name: parsed.data.mediaName,
      title: parsed.data.title,
      caption: parsed.data.caption ?? null,
      url: parsed.data.url,
      thumbnail_path: thumbnailPath,
      published_at: parsed.data.publishedAt,
      is_published: parsed.data.isPublished,
    })
    .select("*")
    .single<ArticleRow>();

  if (error || !data) {
    // The row is what makes the image reachable, so a failed insert must not
    // leave the object behind in a public bucket.
    await removeThumbnail(thumbnailPath);
    console.error("Failed to create article:", error?.message);
    return NextResponse.json(
      { error: "L'article n'a pas pu être enregistré." },
      { status: 500 },
    );
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "article.create",
    entityType: "article",
    entityId: data.id,
    request,
    metadata: { mediaName: data.media_name, url: data.url },
  });

/**
 * The news page is cached for an hour (`revalidate` in
 * app/[locale]/actualites/page.tsx). Without this, an article published here
 * would not appear for up to that long, and the obvious fix — shortening the
 * window — costs ISR writes around the clock to serve a change made a few
 * times a season. The route pattern plus `type: "page"` refreshes all three
 * locales at once.
 */
  revalidatePath("/[locale]/actualites", "page");

  return NextResponse.json({ success: true, article: data });
}
