import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffMimeType } from "@/lib/phase2/upload";
import {
  ARTICLES_BUCKET,
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_MIME_TYPES,
  slugify,
} from "@/lib/articles";

/**
 * Stores an article thumbnail and returns its object key.
 *
 * Goes through the same magic-byte check the candidate uploads use. The
 * uploader is an authenticated administrator rather than an anonymous
 * candidate, which lowers the likelihood of a hostile file but not the
 * consequence: this bucket is *public*, so anything accepted here is served
 * from the programme's own domain to anybody who asks.
 */
export type ThumbnailResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function storeThumbnail(
  file: File,
  mediaName: string,
): Promise<ThumbnailResult> {
  if (file.size === 0 || file.size > MAX_THUMBNAIL_BYTES) {
    return { ok: false, error: "Image trop volumineuse (2 Mo maximum)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMimeType(buffer);

  // PDF passes the shared sniffer — it is a valid candidate document — but is
  // not an image, so it is rejected here rather than there.
  if (!sniffed.ok || !THUMBNAIL_MIME_TYPES.includes(sniffed.mime)) {
    return {
      ok: false,
      error: "Format non pris en charge. Utilisez JPEG, PNG ou WebP.",
    };
  }

  const extension =
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
      sniffed.mime
    ] ?? "bin";
  const path = `${slugify(mediaName) || "media"}/${randomUUID()}.${extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(ARTICLES_BUCKET)
    .upload(path, buffer, { contentType: sniffed.mime, upsert: false });

  if (error) {
    console.error("Thumbnail upload failed:", error.message);
    return { ok: false, error: "L'image n'a pas pu être enregistrée." };
  }

  return { ok: true, path };
}

/**
 * Removes a superseded or deleted thumbnail.
 *
 * Non-fatal by design: the row is the source of truth, and an orphaned image
 * in a public bucket of press logos is housekeeping, not a data incident.
 */
export async function removeThumbnail(path: string | null): Promise<void> {
  if (!path) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(ARTICLES_BUCKET).remove([path]);

  if (error) {
    console.error("Failed to remove article thumbnail:", error.message);
  }
}
