import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { ConsentsForm } from "@/components/forms/ConsentsForm";

export default async function Phase2ConsentementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("consentements", locale);

  return (
    <Phase2StepShell step="consentements" steps={progress.steps}>
      <ConsentsForm />
    </Phase2StepShell>
  );
}
