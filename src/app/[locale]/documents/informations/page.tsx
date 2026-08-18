import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { PersonalInfoForm } from "@/components/forms/PersonalInfoForm";

export default async function Phase2InformationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("informations", locale);

  return (
    <Phase2StepShell step="informations" steps={progress.steps}>
      {/* Pre-fills the two names from Phase 1 as a starting point. They are
          asked again because §14 wants them exactly as printed on the
          identity document, which is not always what was typed weeks
          earlier — and that difference is itself a verification signal. */}
      <PersonalInfoForm
        defaultValues={{
          prenoms: progress.candidature.prenom,
          nomFamille: progress.candidature.nom,
        }}
      />
    </Phase2StepShell>
  );
}
