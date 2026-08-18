"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DocumentKind } from "@/lib/constants/program";
import { CheckIcon, CrossIcon } from "@/components/marketing/icons";
import { errorClasses, labelClasses } from "./fields";

/**
 * Downscale and re-encode before upload.
 *
 * Mobile data across the six participating markets is expensive and slow, and
 * a modern phone camera produces 4–8 MB per shot. Compressing to a long edge
 * of 2000px at JPEG q0.82 keeps an identity document comfortably legible
 * while typically landing under 500 KB — the difference between an upload
 * that completes on a 3G connection and one that times out.
 *
 * The canvas round-trip also converts iPhone HEIC to JPEG, since iOS Safari
 * can decode HEIC into a canvas even though the server won't accept the
 * container.
 *
 * PDFs pass through untouched — a criminal record extract is often a PDF,
 * and rasterising it would destroy the text layer a reviewer needs.
 */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

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
    if (!blob) return file;

    // Only keep the compressed version if it actually helped — re-encoding a
    // small, already-optimised scan can make it bigger.
    if (blob.size >= file.size && file.type === "image/jpeg") return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    // Any decode failure (unsupported container, memory pressure on an old
    // phone) falls back to the original. The server validates either way.
    return file;
  }
}

export interface DocumentSlotProps {
  kind: DocumentKind;
  /** Already uploaded on a previous visit. */
  initiallyUploaded?: boolean;
  optional?: boolean;
  /** Overrides the default optional marker, which reads "(si carte
   * d'identité)" — right for the ID verso, wrong for anything else. */
  optionalLabel?: string;
  /** "environment" for documents, "user" for the selfie. */
  capture?: "environment" | "user";
  acceptPdf?: boolean;
  onUploaded?: (kind: DocumentKind) => void;
}

export function DocumentSlot({
  kind,
  initiallyUploaded = false,
  optional = false,
  optionalLabel,
  capture = "environment",
  acceptPdf = false,
  onUploaded,
}: DocumentSlotProps) {
  const t = useTranslations("phase2.pieces");
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploaded, setUploaded] = useState(initiallyUploaded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const accept = acceptPdf
    ? "image/jpeg,image/png,image/webp,image/heic,application/pdf"
    : "image/jpeg,image/png,image/webp,image/heic";

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);

    try {
      const prepared = await compressImage(file);
      const body = new FormData();
      body.append("file", prepared);
      body.append("kind", kind);

      const res = await fetch("/api/documents/pieces", { method: "POST", body });
      const json: { error?: string } | null = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "errors.server");
        return;
      }

      setUploaded(true);
      setFileName(prepared.name);
      onUploaded?.(kind);
    } catch {
      setError("errors.network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={[
        "border p-6 transition-colors",
        uploaded ? "border-terracotta bg-white" : "border-ink-dim/20 bg-white",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <span className={labelClasses}>
            {t(`kinds.${kind}.label`)}
            {optional && (
              <span className="ms-2 normal-case tracking-normal text-ink-dim">
                {optionalLabel ?? t("optional")}
              </span>
            )}
          </span>
          <p className="mt-2 text-sm leading-relaxed text-ink-mid">
            {t(`kinds.${kind}.help`)}
          </p>
        </div>
        {uploaded ? (
          <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-terracotta" />
        ) : (
          <CrossIcon className="mt-1 h-5 w-5 shrink-0 text-ink-dim/40" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so re-selecting the same file still fires a change event.
          e.target.value = "";
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="border border-blue-dark px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-dark transition-colors hover:bg-blue-dark hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          {busy ? t("uploading") : uploaded ? t("replace") : t("choose")}
        </button>

        {fileName && !busy && (
          <span className="text-xs text-ink-dim" dir="ltr">
            {fileName}
          </span>
        )}
        {uploaded && !fileName && !busy && (
          <span className="text-xs text-ink-dim">{t("alreadyUploaded")}</span>
        )}
      </div>

      {error && (
        <p className={`${errorClasses} mt-3`} role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
