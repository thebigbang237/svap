import { z } from "zod";
import { isSafeArticleUrl } from "@/lib/articles";

/**
 * A press item, as typed by an administrator.
 *
 * Messages are French display text rather than i18n keys: unlike the candidate
 * forms, the admin interface is French-only by design (see admin-options.ts).
 */
export const articleSchema = z.object({
  mediaName: z
    .string()
    .trim()
    .min(1, { error: "Le nom du média est requis." })
    .max(120, { error: "Nom du média trop long (120 caractères maximum)." }),

  title: z
    .string()
    .trim()
    .min(1, { error: "Le titre est requis." })
    .max(300, { error: "Titre trop long (300 caractères maximum)." }),

  caption: z
    .string()
    .trim()
    .max(600, { error: "Chapô trop long (600 caractères maximum)." })
    .optional(),

  url: z
    .string()
    .trim()
    .min(1, { error: "Le lien vers l'article est requis." })
    .max(2000, { error: "Lien trop long." })
    // Checked as a URL *and* as a scheme: this value becomes an href on a
    // public page, so anything but http(s) is a stored-XSS vector.
    .refine(isSafeArticleUrl, {
      error: "Lien invalide. Utilisez une adresse commençant par https://",
    }),

  publishedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date de publication invalide." }),

  isPublished: z.boolean(),
});

export type ArticleInput = z.infer<typeof articleSchema>;

/** Parses the multipart body both admin routes receive. */
export function parseArticleForm(form: FormData) {
  return articleSchema.safeParse({
    mediaName: String(form.get("mediaName") ?? ""),
    title: String(form.get("title") ?? ""),
    caption: String(form.get("caption") ?? "") || undefined,
    url: String(form.get("url") ?? ""),
    publishedAt: String(form.get("publishedAt") ?? ""),
    isPublished: form.get("isPublished") === "true",
  });
}
