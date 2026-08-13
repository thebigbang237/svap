import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { clientIp } from "@/lib/access-code/rate-limit";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { consentsSchema } from "@/lib/validations/phase2";
import { CONSENT_KINDS } from "@/lib/constants/program";

/**
 * Étape 5 — consents, and the end of the candidate's part in Phase 2.
 *
 * Recording consent means recording *when* and *from where*, not just
 * whether — §8's audit obligations are about being able to demonstrate later
 * that a specific permission was given at a specific moment.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = consentsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);

  if (!progress) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  // Re-checked server-side rather than trusting that the page guard ran.
  // Consents are what launches the paid verifications, so this is the last
  // point at which an incomplete dossier can still be caught.
  if (!progress.hasPaid) {
    return NextResponse.json({ error: "errors.paymentRequired" }, { status: 402 });
  }

  const required = ["id_recto", "selfie_liveness", "casier_judiciaire"];
  const missing = required.filter((k) => !progress.documentKinds.includes(k));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "errors.documentsMissing", missing },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error } = await supabase.from("phase2_consents").upsert(
    CONSENT_KINDS.map((kind) => ({
      candidature_id: session.cid,
      kind,
      accepted_at: now,
      ip,
      user_agent: userAgent,
    })),
    { onConflict: "candidature_id,kind" },
  );

  if (error) {
    console.error("Failed to record consents:", error.message);
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  // The dossier is now complete and the checks can begin. This is the
  // "lancement automatique des vérifications" the specification describes;
  // the third-party checks themselves are driven off this status.
  const { error: statusError } = await supabase
    .from("candidatures")
    .update({ status: "verification" })
    .eq("id", session.cid)
    .eq("status", "phase2_paye");

  if (statusError) {
    // The consents are recorded, which is the part that must not be lost.
    // A stuck status is recoverable by an admin; a missing consent is not.
    console.error("Failed to advance status to verification:", statusError.message);
  }

  return NextResponse.json({ success: true, next: "/documents/termine" });
}
