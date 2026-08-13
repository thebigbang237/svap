import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/constants/program";
import {
  MAX_UPLOAD_BYTES,
  STORAGE_BUCKET,
  contentHash,
  retentionDate,
  sniffMimeType,
  storagePath,
} from "@/lib/phase2/upload";

/**
 * Étape 4 — document upload.
 *
 * Files are relayed through this route rather than uploaded straight to
 * Storage from the browser. That costs a hop, and buys the only place where
 * the real file type can be checked against its bytes before anything is
 * written — see lib/phase2/upload.ts.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Payment gates this step. Enforced server-side, not just by the page
  // guard: a direct POST here would otherwise bypass the UI entirely and
  // deposit identity documents for a dossier that never paid.
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }
  if (!progress.hasPaid) {
    return NextResponse.json({ error: "errors.paymentRequired" }, { status: 402 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "errors.noFile" }, { status: 400 });
  }
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "errors.invalidKind" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "errors.fileSize" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The declared Content-Type is ignored entirely; only the bytes count.
  const sniffed = sniffMimeType(buffer);
  if (!sniffed.ok) {
    return NextResponse.json(
      {
        error:
          sniffed.reason === "heic_unsupported"
            ? "errors.heicUnsupported"
            : "errors.fileType",
      },
      { status: 415 },
    );
  }

  // A liveness selfie must be a photograph. A PDF here means either a
  // misunderstanding or an attempt to pass off a scan as a live capture.
  if (kind === "selfie_liveness" && sniffed.mime === "application/pdf") {
    return NextResponse.json({ error: "errors.selfieMustBeImage" }, { status: 415 });
  }

  const path = storagePath(session.cid, kind as DocumentKind, sniffed.mime);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: sniffed.mime, upsert: false });

  if (uploadError) {
    console.error("Document upload failed:", uploadError.message);
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  // Replacing an existing document of the same kind: capture the old path
  // first so the superseded object can be removed rather than orphaned in
  // the bucket, holding personal data nothing references any more.
  const { data: previous } = await supabase
    .from("phase2_documents")
    .select("storage_path")
    .eq("candidature_id", session.cid)
    .eq("kind", kind)
    .maybeSingle<{ storage_path: string }>();

  const { error: metaError } = await supabase.from("phase2_documents").upsert(
    {
      candidature_id: session.cid,
      kind,
      storage_path: path,
      mime_type: sniffed.mime,
      size_bytes: buffer.byteLength,
      sha256: contentHash(buffer),
      uploaded_at: new Date().toISOString(),
      purge_after: retentionDate().toISOString(),
    },
    { onConflict: "candidature_id,kind" },
  );

  if (metaError) {
    // Roll back the object: metadata is what makes a file findable, so an
    // orphaned upload is unreviewable data sitting in a private bucket.
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    console.error("Document metadata write failed:", metaError.message);
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  if (previous?.storage_path && previous.storage_path !== path) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([previous.storage_path]);
    // Non-fatal: the new file is recorded and reviewable. A leftover object
    // is a retention problem, not a correctness one, so log and move on.
    if (error) {
      console.error("Failed to remove superseded document:", error.message);
    }
  }

  return NextResponse.json({ success: true, kind });
}
