import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/admin/audit";
import { reissueAccessCode } from "@/lib/access-code/issue";
import { sendAccessCodeEmail } from "@/lib/resend/client";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * Re-sends a candidate's access code, from the admin.
 *
 * The candidate-facing "Renvoyer le code" asks for a name and email that
 * match the dossier, which is right for a public form and useless for the
 * person who writes to support *because* something doesn't match — a married
 * name, a typo at Phase 1, a dead mailbox. Without this, that conversation
 * had no ending: the code is hashed and genuinely unrecoverable, so nobody,
 * including an administrator, can read it back out.
 *
 * It mints a NEW code and invalidates the old one, exactly as the public flow
 * does. Both roles may do it: this is support work, not a disclosure — the
 * code goes to the address already on the dossier and nowhere else.
 */

/** Statuses that legitimately hold a code. Mirrors the public route, plus
 *  `preselectionne` — a dossier whose code the cron has not yet sent, which
 *  an administrator may want to push out by hand. */
const RESENDABLE = [
  "preselectionne",
  "code_envoye",
  "expire",
  "phase2_en_cours",
  "phase2_paye",
  "verification",
  "valide",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("id, prenom, nom, email, locale, status")
    .eq("id", id)
    .maybeSingle<
      Pick<CandidatureRow, "id" | "prenom" | "nom" | "email" | "locale" | "status">
    >();

  if (!candidature) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  if (!RESENDABLE.includes(candidature.status)) {
    return NextResponse.json(
      {
        error:
          "Ce dossier ne détient pas de code d'accès (non pré-sélectionné, ou décision déjà rendue).",
      },
      { status: 409 },
    );
  }

  const { data: existing } = await supabase
    .from("access_codes")
    .select("resend_count")
    .eq("candidature_id", candidature.id)
    .maybeSingle<{ resend_count: number }>();

  let expiresAt: Date;

  try {
    const issued = await reissueAccessCode(
      supabase,
      candidature.id,
      existing?.resend_count ?? 0,
    );
    expiresAt = issued.expiresAt;

    await sendAccessCodeEmail({
      prenom: candidature.prenom,
      email: candidature.email,
      code: issued.code,
      expiresAt: issued.expiresAt,
      locale: candidature.locale,
    });
  } catch (error) {
    console.error("Admin resend of access code failed:", error);
    return NextResponse.json(
      { error: "L'envoi a échoué. Réessayez dans un instant." },
      { status: 502 },
    );
  }

  // A reissue after expiry puts the dossier back in play, same as the public
  // flow. Scoped so a dossier further along is never rewound.
  if (candidature.status === "expire") {
    await supabase
      .from("candidatures")
      .update({ status: "code_envoye" })
      .eq("id", candidature.id)
      .eq("status", "expire");
  }

  await recordAudit({
    actorId: admin.userId,
    actorEmail: admin.profile.full_name,
    action: "access_code.resend",
    entityType: "candidature",
    entityId: candidature.id,
    request,
    metadata: {
      email: candidature.email,
      previousStatus: candidature.status,
      resendCount: (existing?.resend_count ?? 0) + 1,
    },
  });

  return NextResponse.json({
    success: true,
    email: candidature.email,
    expiresAt: expiresAt.toISOString(),
  });
}
