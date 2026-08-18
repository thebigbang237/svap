import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { financialDossierSchema } from "@/lib/validations/phase2";
import { financialRequirement } from "@/lib/constants/program";

/**
 * Étape 5 — the pack-specific capacity dossier.
 *
 * The pack is read from the candidature, never from the request: it decides
 * which fields are required and which documents must already be present, so
 * taking it from the client would let a VIP Visitor submit under a Lauréat's
 * (empty) requirements.
 *
 * Nothing here moves money. The declarations recorded are evidence that the
 * candidate can fund their own trip — see supabase/migrations/0015.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);

  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }
  if (progress.locked) {
    return NextResponse.json({ error: "errors.locked" }, { status: 409 });
  }
  // Étape 5 sits behind payment and the identity pieces. A direct POST that
  // skipped them would mark the step done for a dossier that never paid.
  if (!progress.hasPaid) {
    return NextResponse.json({ error: "errors.paymentRequired" }, { status: 402 });
  }

  const pack = progress.candidature.pack;
  const requirement = financialRequirement(pack);

  // A pack with no requirement has no step, so there is nothing to submit.
  if (!requirement) {
    return NextResponse.json({ error: "errors.notApplicable" }, { status: 409 });
  }

  const json = await request.json().catch(() => null);
  const parsed = financialDossierSchema(pack).safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Every mandatory piece for this pack must already be uploaded. Checked
  // against the database rather than the client's word — the browser form
  // performs the same check, but only this one is binding.
  const missing = requirement.documents
    .filter((doc) => doc.required && !progress.documentKinds.includes(doc.kind))
    .map((doc) => doc.kind);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "errors.documentsMissing", missing },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("phase2_financial").upsert(
    {
      candidature_id: session.cid,
      banque_emettrice: parsed.data.banqueEmettrice || null,
      montant_atteste_usd: parsed.data.montantAtteste ?? null,
      // The requirement as it stood at submission, so a later revision of the
      // framework can't rewrite what this candidate was measured against.
      montant_requis_usd: requirement.totalUsd ?? requirement.surfaceUsd,
      origine_fonds: parsed.data.origineFonds || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "candidature_id" },
  );

  if (error) {
    console.error("Failed to save financial dossier:", error.message);
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
