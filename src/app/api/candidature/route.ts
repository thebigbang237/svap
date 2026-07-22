import { NextResponse } from "next/server";
import { candidatureSchema } from "@/lib/validations/candidature";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);

  if (!json || typeof json !== "object") {
    return NextResponse.json(
      { success: false, errors: { root: ["form.submitError"] } },
      { status: 400 },
    );
  }

  const { locale: rawLocale, ...formData } = json as Record<string, unknown>;
  const locale = (routing.locales as readonly string[]).includes(
    rawLocale as string,
  )
    ? (rawLocale as (typeof routing.locales)[number])
    : routing.defaultLocale;

  const parsed = candidatureSchema.safeParse(formData);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Generate the id ourselves: the "Anyone can submit a candidature" RLS
  // policy only grants INSERT, not SELECT, so requesting the row back via
  // .select() after insert would be blocked for anonymous submitters.
  const id = crypto.randomUUID();

  const { error } = await supabase.from("candidatures").insert({
    id,
    prenom: parsed.data.prenom,
    nom: parsed.data.nom,
    email: parsed.data.email,
    telephone: parsed.data.telephone,
    pays: parsed.data.pays,
    secteur: parsed.data.secteur,
    pack: parsed.data.pack,
    visa_historique: parsed.data.visaHistorique ?? null,
    casier_judiciaire: parsed.data.casierJudiciaire,
    motivation: parsed.data.motivation,
    locale,
  });

  if (error) {
    console.error("Failed to insert candidature:", error);
    return NextResponse.json(
      { success: false, errors: { root: ["form.submitError"] } },
      { status: 500 },
    );
  }

  // TODO: send a confirmation email via Resend, in `locale`, once the email
  // sending pipeline is wired up (next prompt).

  return NextResponse.json({ success: true, id });
}
