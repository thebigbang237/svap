"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { thumbnailUrl } from "@/lib/articles";
import type { ArticleRow } from "@/lib/supabase/types";

/**
 * Press-item editor.
 *
 * Deliberately not a rich editor: an article row is five fields and a picture,
 * and the article itself is written and hosted by somebody else. Anything more
 * would be building a CMS for content that is not ours.
 */

const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.82;

/**
 * Downscales the thumbnail in the browser before it is sent.
 *
 * The same trick the candidate document upload uses, for a different reason:
 * here it is not the uploader's connection that matters but every visitor's.
 * A press logo dropped in at 4000px would otherwise be served, at full size,
 * to people on metered mobile data — this keeps the card image a card image.
 */
async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || (blob.size >= file.size && file.type === "image/jpeg")) {
      return file;
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    // PNG with transparency, an exotic container, an old browser: send the
    // original and let the server's magic-byte check decide.
    return file;
  }
}

const inputClasses =
  "w-full border border-ink-dim/30 px-3 py-2 text-sm text-ink placeholder:text-ink-dim/50 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta";
const labelClasses =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-mid";

interface FieldErrors {
  [field: string]: string[] | undefined;
}

function ArticleForm({
  article,
  onDone,
  onCancel,
}: {
  /** Absent when creating. */
  article?: ArticleRow;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    // A checkbox is simply absent when unchecked; the schema wants an explicit
    // boolean either way.
    form.set("isPublished", form.get("isPublished") === "on" ? "true" : "false");

    const file = fileRef.current?.files?.[0];
    if (file && file.size > 0) {
      form.set("thumbnail", await downscale(file));
    } else {
      form.delete("thumbnail");
    }

    try {
      const res = await fetch(
        article ? `/api/admin/articles/${article.id}` : "/api/admin/articles",
        { method: article ? "PATCH" : "POST", body: form },
      );

      const body: { error?: string; errors?: FieldErrors } | null = await res
        .json()
        .catch(() => null);

      if (!res.ok) {
        setFieldErrors(body?.errors ?? {});
        setError(body?.errors ? null : (body?.error ?? "Erreur d'enregistrement."));
        return;
      }

      onDone();
    } catch {
      setError("Connexion interrompue. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name: string) => fieldErrors[name]?.[0];

  const existingThumbnail = thumbnailUrl(article?.thumbnail_path ?? null);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses} htmlFor={`media-${article?.id ?? "new"}`}>
            Média
          </label>
          <input
            id={`media-${article?.id ?? "new"}`}
            name="mediaName"
            defaultValue={article?.media_name}
            placeholder="Jeune Afrique"
            className={inputClasses}
          />
          {fieldError("mediaName") && (
            <p className="mt-1 text-xs text-terracotta">{fieldError("mediaName")}</p>
          )}
        </div>

        <div>
          <label className={labelClasses} htmlFor={`date-${article?.id ?? "new"}`}>
            Date de publication
          </label>
          <input
            id={`date-${article?.id ?? "new"}`}
            name="publishedAt"
            type="date"
            defaultValue={article?.published_at}
            className={inputClasses}
          />
          {fieldError("publishedAt") && (
            <p className="mt-1 text-xs text-terracotta">
              {fieldError("publishedAt")}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClasses} htmlFor={`title-${article?.id ?? "new"}`}>
          Titre de l&apos;article
        </label>
        <input
          id={`title-${article?.id ?? "new"}`}
          name="title"
          defaultValue={article?.title}
          className={inputClasses}
        />
        {fieldError("title") && (
          <p className="mt-1 text-xs text-terracotta">{fieldError("title")}</p>
        )}
      </div>

      <div>
        <label className={labelClasses} htmlFor={`caption-${article?.id ?? "new"}`}>
          Chapô <span className="normal-case text-ink-dim">(facultatif)</span>
        </label>
        <textarea
          id={`caption-${article?.id ?? "new"}`}
          name="caption"
          rows={3}
          defaultValue={article?.caption ?? ""}
          placeholder="Deux ou trois lignes qui donnent envie de lire l'article."
          className={`${inputClasses} resize-none`}
        />
        {fieldError("caption") && (
          <p className="mt-1 text-xs text-terracotta">{fieldError("caption")}</p>
        )}
      </div>

      <div>
        <label className={labelClasses} htmlFor={`url-${article?.id ?? "new"}`}>
          Lien vers l&apos;article
        </label>
        <input
          id={`url-${article?.id ?? "new"}`}
          name="url"
          type="url"
          dir="ltr"
          defaultValue={article?.url}
          placeholder="https://..."
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-ink-dim">
          La carte ouvre cette adresse dans un nouvel onglet, sur le site du
          média. Aucun article n&apos;est reproduit ici.
        </p>
        {fieldError("url") && (
          <p className="mt-1 text-xs text-terracotta">{fieldError("url")}</p>
        )}
      </div>

      <div>
        <label className={labelClasses} htmlFor={`thumb-${article?.id ?? "new"}`}>
          Vignette{" "}
          <span className="normal-case text-ink-dim">
            (JPEG, PNG ou WebP — 2 Mo maximum)
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-4">
          {existingThumbnail && (
            /* eslint-disable-next-line @next/next/no-img-element --
               Supabase storage host; see ArticleCard. */
            <img
              src={existingThumbnail}
              alt=""
              className="h-16 w-28 border border-ink-dim/20 object-cover"
            />
          )}
          <input
            id={`thumb-${article?.id ?? "new"}`}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-ink-mid file:mr-4 file:border file:border-blue-dark file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-blue-dark"
          />
        </div>
        {article && (
          <p className="mt-1 text-xs text-ink-dim">
            Laissez vide pour conserver la vignette actuelle.
          </p>
        )}
      </div>

      <label className="flex items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={article?.is_published ?? true}
          className="h-4 w-4 accent-terracotta"
        />
        Visible sur la page Actualités
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-dim/20 pt-4">
        <button
          type="submit"
          disabled={busy}
          className="bg-terracotta px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-90 disabled:opacity-50"
        >
          {busy
            ? "Enregistrement..."
            : article
              ? "Enregistrer les modifications"
              : "Publier l'article"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-mid hover:text-ink"
          >
            Annuler
          </button>
        )}
        {error && <p className="text-sm text-terracotta">{error}</p>}
      </div>
    </form>
  );
}

export function ArticlesManager({ articles }: { articles: ArticleRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = () => {
    setCreating(false);
    setEditingId(null);
    router.refresh();
  };

  const remove = async (article: ArticleRow) => {
    if (
      !window.confirm(
        `Supprimer « ${article.title} » (${article.media_name}) ?\n\nLa carte disparaîtra immédiatement de la page Actualités.`,
      )
    ) {
      return;
    }

    setDeleting(article.id);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      window.alert("La suppression a échoué. Réessayez.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-ink-dim/20 bg-white p-6">
        {creating ? (
          <>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue">
              Nouvel article
            </h2>
            <ArticleForm onDone={refresh} onCancel={() => setCreating(false)} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="border border-blue-dark px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-blue-dark transition hover:bg-blue-dark hover:text-white"
          >
            Ajouter un article
          </button>
        )}
      </div>

      {articles.length === 0 ? (
        <p className="border border-ink-dim/20 bg-white p-6 text-sm text-ink-dim">
          Aucun article pour le moment. La page Actualités affiche un message
          d&apos;attente tant que cette liste est vide.
        </p>
      ) : (
        <ul className="space-y-4">
          {articles.map((article) => {
            const src = thumbnailUrl(article.thumbnail_path);
            return (
              <li
                key={article.id}
                className="border border-ink-dim/20 bg-white p-6"
              >
                {editingId === article.id ? (
                  <ArticleForm
                    article={article}
                    onDone={refresh}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-start gap-6">
                    {src ? (
                      /* eslint-disable-next-line @next/next/no-img-element --
                         Supabase storage host; see ArticleCard for why this
                         stays a plain <img>. */
                      <img
                        src={src}
                        alt=""
                        className="h-20 w-32 shrink-0 border border-ink-dim/20 object-cover"
                      />
                    ) : (
                      <div className="h-20 w-32 shrink-0 bg-sky-mid" />
                    )}

                    <div className="min-w-56 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide">
                        <span className="font-semibold text-terracotta">
                          {article.media_name}
                        </span>
                        <span className="text-ink-dim">
                          {new Date(article.published_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                        {!article.is_published && (
                          <span className="bg-ink-dim/10 px-2 py-0.5 text-ink-dim">
                            Masqué
                          </span>
                        )}
                      </div>
                      <p className="font-serif text-lg font-normal text-blue-dark">
                        {article.title}
                      </p>
                      {article.caption && (
                        <p className="mt-1 text-sm text-ink-mid">
                          {article.caption}
                        </p>
                      )}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        dir="ltr"
                        className="mt-2 inline-block break-all text-xs text-blue hover:underline"
                      >
                        {article.url}
                      </a>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(article.id)}
                        className="border border-blue px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue transition hover:bg-blue hover:text-white"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(article)}
                        disabled={deleting === article.id}
                        className="border border-ink-dim/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mid transition hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                      >
                        {deleting === article.id ? "..." : "Supprimer"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
