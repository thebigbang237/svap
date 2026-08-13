import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { decryptField } from "@/lib/crypto/field";

/**
 * Decrypts and returns a candidate's passport number.
 *
 * Deliberately a separate, explicit, POST-only action rather than a field on
 * the detail page. The number is sealed at rest precisely so that reading it
 * is a decision someone makes and the system records — not a side effect of
 * opening a dossier.
 *
 * super_admin only. The `reviewer` role can assess a dossier, see the
 * document scans and the risk breakdown, and reach a decision without ever
 * needing the raw number — so it isn't theirs to read.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidatureId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.profile.role !== "super_admin") {
    // 403 rather than 404: the reviewer knows the dossier exists, and
    // pretending otherwise would just send them to support.
    return NextResponse.json(
      { error: "Réservé aux super-administrateurs." },
      { status: 403 },
    );
  }

  const { candidatureId } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("phase2_applications")
    .select("passeport_numero_encrypted")
    .eq("candidature_id", candidatureId)
    .maybeSingle<{ passeport_numero_encrypted: string }>();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let passportNumber: string;
  try {
    passportNumber = decryptField(data.passeport_numero_encrypted);
  } catch (error) {
    // A decryption failure means the key rotated without a re-encryption
    // pass, or the ciphertext was tampered with. Both need a human.
    console.error("Passport decryption failed:", (error as Error).message);
    return NextResponse.json(
      { error: "Déchiffrement impossible. Vérifiez FIELD_ENCRYPTION_KEY." },
      { status: 500 },
    );
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "passport.reveal",
    entityType: "candidature",
    entityId: candidatureId,
    request,
  });

  return NextResponse.json({ passportNumber });
}
