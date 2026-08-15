import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { loadDossier } from "@/lib/admin/dossier";
import { decryptField } from "@/lib/crypto/field";
import { STORAGE_BUCKET } from "@/lib/phase2/upload";
import { buildDossierHtml, buildDossierCsv } from "@/lib/admin/dossier-export";
import { DOCUMENT_KIND_LABELS_FR } from "@/lib/constants/admin-labels";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * The whole dossier as a single zip: every uploaded document, plus a readable
 * summary of everything the candidate typed.
 *
 * Built for the reviewer who has to reach a decision — one click, one file,
 * openable offline, shareable with whoever signs off. Assembling it by hand
 * from ten 60-second signed URLs is the kind of friction that ends with people
 * emailing passport scans to each other instead.
 *
 * super_admin only. This is the largest single disclosure the system permits:
 * it decrypts the passport number and lifts every identity document out of
 * controlled storage in one go.
 */

/** Filesystem-safe, accent-free, and recognisable in a downloads folder. */
function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase() || "DOSSIER"
  );
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.profile.role !== "super_admin") {
    return NextResponse.json(
      { error: "Réservé aux super-administrateurs." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("*")
    .eq("id", id)
    .maybeSingle<CandidatureRow>();

  if (!candidature) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dossier = await loadDossier(supabase, id);

  // Decrypted for the export, because a reviewer preparing a visa file needs
  // the actual number. The `dossier.download` audit entry below is what makes
  // that disclosure accountable.
  let passportNumber: string | null = null;
  if (dossier.application) {
    try {
      const { data } = await supabase
        .from("phase2_applications")
        .select("passeport_numero_encrypted")
        .eq("candidature_id", id)
        .maybeSingle<{ passeport_numero_encrypted: string }>();
      if (data) passportNumber = decryptField(data.passeport_numero_encrypted);
    } catch (error) {
      // A key mismatch must not take the whole export down — the documents
      // are still worth having. The summary says the number is unreadable.
      console.error("Passport decryption failed during export:", error);
    }
  }

  const folder = `${slug(candidature.nom)}_${slug(candidature.prenom)}`;
  const files: Record<string, Uint8Array> = {};

  // Human-readable summary, and a spreadsheet-friendly copy of the same data.
  files[`${folder}/dossier.html`] = strToU8(
    buildDossierHtml({ candidature, dossier, passportNumber }),
  );
  files[`${folder}/donnees.csv`] = strToU8(
    // BOM so Excel opens the accented French correctly.
    "﻿" + buildDossierCsv({ candidature, dossier, passportNumber }),
  );

  // Documents, downloaded server-side rather than via signed URLs — the files
  // have to be inside the archive, not linked from it.
  const missing: string[] = [];
  for (const document of dossier.documents) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(document.storage_path);

    if (error || !data) {
      console.error(
        `Dossier export: could not read ${document.storage_path}`,
        error?.message,
      );
      missing.push(document.kind);
      continue;
    }

    const extension = EXTENSIONS[document.mime_type] ?? "bin";
    const name = slug(DOCUMENT_KIND_LABELS_FR[document.kind] ?? document.kind);
    files[`${folder}/${name}.${extension}`] = new Uint8Array(
      await data.arrayBuffer(),
    );
  }

  if (missing.length > 0) {
    // Recorded inside the archive rather than only in a log, so whoever opens
    // it later knows the set is incomplete instead of assuming a document was
    // never provided.
    files[`${folder}/PIECES-MANQUANTES.txt`] = strToU8(
      `Ces pièces sont référencées en base mais n'ont pas pu être lues depuis le stockage :\n\n` +
        missing
          .map((k) => `- ${DOCUMENT_KIND_LABELS_FR[k] ?? k}`)
          .join("\n") +
        `\n\nSignalez-le à l'équipe technique.\n`,
    );
  }

  const zip = zipSync(files, { level: 6 });

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "dossier.download",
    entityType: "candidature",
    entityId: id,
    request,
    metadata: {
      documentCount: dossier.documents.length,
      missing,
      passportIncluded: passportNumber !== null,
    },
  });

  return new NextResponse(zip as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="SVAP_${folder}.zip"`,
      "Content-Length": String(zip.byteLength),
      // Never let an intermediary hold a copy of a candidate's identity file.
      "Cache-Control": "no-store, private",
    },
  });
}
