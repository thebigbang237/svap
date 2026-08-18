/**
 * Press coverage — shared rules for the public page and the admin editor.
 *
 * Everything here is about one thing: an article row points *outwards*. The
 * programme hosts a thumbnail and a caption; the article itself lives on the
 * publisher's site and is never reproduced. See supabase/migrations/0016.
 *
 * Constants and pure functions only — the admin editor is a client component
 * and imports from here, so a Supabase client at module scope would ship
 * supabase-js to the browser to build a URL string. The reader lives in
 * articles-reader.ts instead.
 */

export const ARTICLES_BUCKET = "svap-articles";

/** Matches the bucket's `file_size_limit`. A card thumbnail, not a hero. */
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

export const THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Public URL for a stored thumbnail.
 *
 * Built by hand rather than through `storage.getPublicUrl` so it can be called
 * from a plain render without a client — the bucket is public and the path
 * shape is fixed, so there is nothing to negotiate.
 */
export function thumbnailUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${ARTICLES_BUCKET}/${path}`;
}

/**
 * Rejects anything that isn't a plain http(s) link.
 *
 * This value is rendered as an `href` on a public page, so `javascript:` or
 * `data:` here would be stored XSS against every visitor — entered by an
 * authenticated admin, which is precisely the account whose mistakes reach
 * furthest. The database CHECK enforces the same rule; this is the copy that
 * produces a usable error message.
 */
export function isSafeArticleUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** `Le Monde` → `lemonde`, for a readable object key. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    // Combining diacritical marks, left behind by the NFD decomposition.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
