import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { riskAssessmentSchema } from "@/lib/validations/phase2";
import {
  computeRiskScore,
  findConsistencyFlags,
} from "@/lib/phase2/risk-score";
import type { CandidatureRow } from "@/lib/supabase/types";

/**
 * Étape 2 — risk assessment.
 *
 * Scores server-side and stores the result with its breakdown. Computing it
 * here rather than on read means a later change to the weighting cannot
 * silently rewrite the number a human reviewer already acted on.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "phase2.errors.session" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = riskAssessmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { data: candidature } = await supabase
    .from("candidatures")
    .select("visa_historique")
    .eq("id", session.cid)
    .maybeSingle<Pick<CandidatureRow, "visa_historique">>();

  const { score, breakdown, band } = computeRiskScore(data);
  const flags = findConsistencyFlags(data, {
    visaHistorique: candidature?.visa_historique ?? null,
  });

  const { error } = await supabase.from("risk_assessments").upsert(
    {
      candidature_id: session.cid,

      refus_entree_pays_etranger: data.refusEntreePaysEtranger,
      depassement_visa: data.depassementVisa,
      refus_usa_count: data.refusUsaCount,
      attaches_familiales: data.attachesFamiliales,
      activite_pays: data.activitePays,
      voyages_hors_afrique: data.voyagesHorsAfrique,
      patrimoine: data.patrimoine,
      famille_usa: data.familleUsa,

      engagements_retour: data.engagementsRetour,
      motivation_retour: data.motivationRetour,
      certification_honneur: data.certificationHonneur,

      score,
      score_breakdown: { band, factors: breakdown },
      consistency_flags: flags,
    },
    { onConflict: "candidature_id" },
  );

  if (error) {
    console.error("Failed to save risk assessment:", error.message);
    return NextResponse.json({ error: "phase2.errors.server" }, { status: 500 });
  }

  // The score is deliberately NOT returned to the client. It is an internal
  // review aid, and showing a candidate "your non-return risk is 62/100"
  // would both invite gaming of the answers and read as a decision the site
  // has no standing to make.
  return NextResponse.json({ success: true, next: "/documents/paiement" });
}
