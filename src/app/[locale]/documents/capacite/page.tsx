import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { FinancialDossierForm } from "@/components/forms/FinancialDossierForm";

/**
 * Étape 5 — capacity dossier, for the packs that carry one.
 *
 * A pack without a requirement has no such step, so `canAccessStep` refuses
 * it inside the guard and the candidate is redirected to where they actually
 * stand — no branch is needed here.
 */
export default async function Phase2CapacitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("capacite", locale);

  return (
    <Phase2StepShell step="capacite" steps={progress.steps}>
      <FinancialDossierForm
        pack={progress.candidature.pack}
        uploaded={progress.documentKinds}
      />
    </Phase2StepShell>
  );
}
