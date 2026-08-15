import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import { loadPhase2Progress } from "@/lib/phase2/steps";
import { casierMetadataSchema } from "@/lib/validations/phase2";

/**
 * Reference details for the criminal record extract (§14 Étape 3): issue
 * date, number, place and issuing body.
 *
 * Stored on the document row rather than in its own table — they describe
 * that specific file, and a replacement extract carries its own reference.
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "errors.session" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = casierMetadataSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Same lock as the page guard, enforced server-side.
  const progress = await loadPhase2Progress(supabase, session.cid);
  if (progress?.locked) {
    return NextResponse.json({ error: "errors.locked" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("phase2_documents")
    .update({
      casier_date: parsed.data.casierDate,
      casier_numero: parsed.data.casierNumero,
      casier_lieu: parsed.data.casierLieu,
      casier_structure: parsed.data.casierStructure,
    })
    .eq("candidature_id", session.cid)
    .eq("kind", "casier_judiciaire")
    .select("id");

  if (error) {
    console.error("Failed to save criminal record metadata:", error.message);
    return NextResponse.json({ error: "errors.server" }, { status: 500 });
  }

  // The reference details describe a file that has to exist first — saving
  // them against nothing would leave a dossier that looks complete in the
  // admin while holding no document.
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "errors.casierFileFirst" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
