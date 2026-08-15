import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { personalInfoSchema } from "@/lib/validations/phase2";
import { encryptField, fieldSuffix } from "@/lib/crypto/field";

/**
 * Étape 1 — complete personal information.
 *
 * Upsert rather than insert: a candidate correcting a typo on a step they
 * already submitted is ordinary behaviour, not an error.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "phase2.errors.session" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = personalInfoSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Same lock as the page guard, enforced server-side.
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (progress?.locked) {
    return NextResponse.json({ error: "errors.locked" }, { status: 409 });
  }

  const { error } = await supabase.from("phase2_applications").upsert(
    {
      // From the signed session cookie, never from the request body — a
      // candidate must not be able to write into someone else's dossier by
      // supplying an id.
      candidature_id: session.cid,

      prenoms: data.prenoms,
      nom_famille: data.nomFamille,
      date_naissance: data.dateNaissance,
      lieu_naissance: data.lieuNaissance,
      nationalite: data.nationalite,

      // Sealed at the application layer; only the last two characters stay
      // readable, for phone support. See lib/crypto/field.ts.
      passeport_numero_encrypted: encryptField(data.passeportNumero),
      passeport_numero_suffix: fieldSuffix(data.passeportNumero),
      passeport_expiration: data.passeportExpiration,

      telephone: data.telephone,
      adresse: data.adresse,
      profession: data.profession,
      employeur: data.employeur,

      contact_urgence_nom: data.contactUrgenceNom,
      contact_urgence_lien: data.contactUrgenceLien,
      contact_urgence_telephone: data.contactUrgenceTelephone,
    },
    { onConflict: "candidature_id" },
  );

  if (error) {
    // Never log `data` here — it carries the passport number in plaintext.
    console.error("Failed to save Phase-2 personal information:", error.message);
    return NextResponse.json({ error: "phase2.errors.server" }, { status: 500 });
  }

  return NextResponse.json({ success: true, next: "/documents/evaluation" });
}
