import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { STORAGE_BUCKET } from "@/lib/phase2/upload";

/**
 * Mints a short-lived signed URL for one identity document.
 *
 * The bucket is private and has no read policy for anyone but admins, so this
 * route is the only path to a candidate's passport scan or liveness selfie.
 * Two properties matter:
 *
 *  - the URL expires in 60 seconds, so a link pasted into a chat, a bug
 *    report or a browser history is useless by the time anyone follows it;
 *  - every mint is written to the audit log before the URL is returned.
 *
 * §8 promises "journaux d'audit complets sur chaque accès". This is where
 * that promise is actually kept.
 */
const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: document } = await supabase
    .from("phase2_documents")
    .select("id, candidature_id, kind, storage_path, mime_type")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      candidature_id: string;
      kind: string;
      storage_path: string;
      mime_type: string;
    }>();

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    console.error("Failed to sign document URL:", error?.message);
    return NextResponse.json({ error: "Signing failed" }, { status: 500 });
  }

  // Logged before the URL leaves the server, so an access is recorded even
  // if the response never reaches the browser.
  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "document.view",
    entityType: "phase2_document",
    entityId: document.id,
    request,
    metadata: {
      candidatureId: document.candidature_id,
      kind: document.kind,
    },
  });

  return NextResponse.json({
    url: signed.signedUrl,
    mimeType: document.mime_type,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
