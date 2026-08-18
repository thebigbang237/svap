import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { parseArticleForm } from "@/lib/validations/article";
import { storeThumbnail, removeThumbnail } from "@/lib/admin/article-thumbnail";
import type { ArticleRow } from "@/lib/supabase/types";

/** Edits a press item. A new thumbnail replaces the old one, which is then
 *  removed from the bucket rather than left orphaned. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle<ArticleRow>();

  if (!existing) {
    return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  }

  const file = form.get("thumbnail");
  let thumbnailPath = existing.thumbnail_path;

  if (file instanceof File && file.size > 0) {
    const stored = await storeThumbnail(file, parsed.data.mediaName);
    if (!stored.ok) {
      return NextResponse.json({ error: stored.error }, { status: 400 });
    }
    thumbnailPath = stored.path;
  }

  const { data, error } = await supabase
    .from("articles")
    .update({
      media_name: parsed.data.mediaName,
      title: parsed.data.title,
      caption: parsed.data.caption ?? null,
      url: parsed.data.url,
      thumbnail_path: thumbnailPath,
      published_at: parsed.data.publishedAt,
      is_published: parsed.data.isPublished,
    })
    .eq("id", id)
    .select("*")
    .single<ArticleRow>();

  if (error || !data) {
    // Roll the new object back: the row still points at the old one.
    if (thumbnailPath !== existing.thumbnail_path) {
      await removeThumbnail(thumbnailPath);
    }
    console.error("Failed to update article:", error?.message);
    return NextResponse.json(
      { error: "L'article n'a pas pu être modifié." },
      { status: 500 },
    );
  }

  // Only once the row is committed — do this earlier and a failed update
  // leaves the article pointing at an image that no longer exists.
  if (thumbnailPath !== existing.thumbnail_path) {
    await removeThumbnail(existing.thumbnail_path);
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "article.update",
    entityType: "article",
    entityId: data.id,
    request,
    metadata: {
      mediaName: data.media_name,
      isPublished: data.is_published,
      urlChanged: existing.url !== data.url,
    },
  });

  return NextResponse.json({ success: true, article: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle<ArticleRow>();

  if (!existing) {
    return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  }

  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete article:", error.message);
    return NextResponse.json(
      { error: "L'article n'a pas pu être supprimé." },
      { status: 500 },
    );
  }

  await removeThumbnail(existing.thumbnail_path);

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "article.delete",
    entityType: "article",
    entityId: id,
    request,
    metadata: { mediaName: existing.media_name, title: existing.title },
  });

  return NextResponse.json({ success: true });
}
