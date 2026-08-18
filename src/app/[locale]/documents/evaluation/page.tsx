import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { RiskAssessmentForm } from "@/components/forms/RiskAssessmentForm";

export default async function Phase2EvaluationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("evaluation", locale);

  return (
    <Phase2StepShell step="evaluation" steps={progress.steps}>
      <RiskAssessmentForm />
    </Phase2StepShell>
  );
}
