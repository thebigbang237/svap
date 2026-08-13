import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DocumentKind } from "@/lib/constants/program";

/**
 * Server-side validation for Phase-2 document uploads.
 *
 * The governing rule: never trust anything the client says about a file. The
 * declared `Content-Type` on a multipart part is attacker-controlled, the
 * filename is decorative, and the extension means nothing. Everything below
 * is derived from the bytes themselves.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const STORAGE_BUCKET = "svap-documents";

/** Retention window for identity documents, per the §8 erasure commitment. */
export const DOCUMENT_RETENTION_DAYS = 365;

/**
 * Magic-byte signatures for the formats a phone camera or scanner produces.
 *
 * SVG is pointedly absent despite being an image: it's XML, it can carry
 * script, and browsers render it in-origin — a hostile SVG served back to an
 * admin reviewing a dossier is a stored-XSS vector against the one account
 * that can read every candidate's passport.
 */
const SIGNATURES: {
  mime: string;
  offset: number;
  bytes: number[];
  /** Additional marker further into the file, for container formats. */
  marker?: { offset: number; ascii: string };
}[] = [
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // WebP and HEIC are both ISO base media containers: the type lives in a
  // 'ftyp'-style box rather than at byte zero.
  {
    mime: "image/webp",
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    marker: { offset: 8, ascii: "WEBP" },
  },
  {
    mime: "image/heic",
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70],
    marker: { offset: 8, ascii: "heic" },
  },
  {
    mime: "image/heif",
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70],
    marker: { offset: 8, ascii: "mif1" },
  },
];

/** MIME types the bucket accepts. HEIC is sniffed but rejected — see below. */
const ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type SniffResult =
  | { ok: true; mime: string }
  | { ok: false; reason: "unknown_format" | "heic_unsupported" };

/**
 * Determines the real type from the leading bytes.
 *
 * HEIC gets its own rejection reason rather than a generic one: iPhones
 * default to it, it is by far the most likely legitimate upload to fail, and
 * "convert to JPEG" is actionable advice where "unsupported file" is not.
 * (The client-side canvas pass normally converts it before it reaches here.)
 */
export function sniffMimeType(buffer: Buffer): SniffResult {
  for (const sig of SIGNATURES) {
    const head = buffer.subarray(sig.offset, sig.offset + sig.bytes.length);
    if (head.length !== sig.bytes.length) continue;
    if (!sig.bytes.every((b, i) => head[i] === b)) continue;

    if (sig.marker) {
      const marker = buffer
        .subarray(sig.marker.offset, sig.marker.offset + sig.marker.ascii.length)
        .toString("ascii");
      if (marker !== sig.marker.ascii) continue;
    }

    if (sig.mime === "image/heic" || sig.mime === "image/heif") {
      return { ok: false, reason: "heic_unsupported" };
    }
    return ACCEPTED.has(sig.mime)
      ? { ok: true, mime: sig.mime }
      : { ok: false, reason: "unknown_format" };
  }
  return { ok: false, reason: "unknown_format" };
}

/**
 * Storage path for a document.
 *
 * Partitioned by candidature so a dossier's files can be deleted or exported
 * as a unit, but the filename itself is a random UUID: a predictable name
 * would make an object enumerable to anyone who learned the bucket layout,
 * and the extension is derived from the *sniffed* type, not the upload's.
 */
export function storagePath(
  candidatureId: string,
  kind: DocumentKind,
  mime: string,
): string {
  const extension =
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[
      mime
    ] ?? "bin";
  return `${candidatureId}/${kind}-${randomUUID()}.${extension}`;
}

/**
 * Content hash, stored alongside the metadata.
 *
 * Two uses: proving a reviewed file wasn't swapped afterwards, and detecting
 * the same document submitted under two different identities — which is the
 * cheapest documentary-fraud signal available.
 */
export function contentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function retentionDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + DOCUMENT_RETENTION_DAYS * 86_400_000);
}
