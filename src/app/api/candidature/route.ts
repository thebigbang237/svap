import { NextResponse } from "next/server";
import { candidatureSchema } from "@/lib/validations/candidature";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import {
  sendCandidatureReceivedEmail,
  sendAdminNotificationEmail,
} from "@/lib/resend/client";
import type { CandidatureEmailData } from "@/lib/resend/types";

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

  const emailData: CandidatureEmailData = {
    id,
    prenom: parsed.data.prenom,
    nom: parsed.data.nom,
    email: parsed.data.email,
    telephone: parsed.data.telephone,
    pays: parsed.data.pays,
    secteur: parsed.data.secteur,
    pack: parsed.data.pack,
    visaHistorique: parsed.data.visaHistorique,
    casierJudiciaire: parsed.data.casierJudiciaire,
    motivation: parsed.data.motivation,
    locale,
  };

  // Run both emails concurrently and never let a Resend failure block the
  // response — the DB insert already succeeded, so the applicant's
  // submission is safe regardless of whether either email goes out.
  const [receivedResult, adminResult] = await Promise.allSettled([
    sendCandidatureReceivedEmail(emailData),
    sendAdminNotificationEmail(emailData),
  ]);

  if (receivedResult.status === "rejected") {
    console.error(
      "Failed to send candidature received email:",
      receivedResult.reason,
    );
  }
  if (adminResult.status === "rejected") {
    console.error(
      "Failed to send admin notification email:",
      adminResult.reason,
    );
  }

  return NextResponse.json({ success: true, id });
}
