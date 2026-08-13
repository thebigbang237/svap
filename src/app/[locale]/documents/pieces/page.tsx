import { guardPhase2Step } from "@/lib/phase2/guard";
import { Phase2StepShell } from "@/components/forms/Phase2StepShell";
import { DocumentsForm } from "@/components/forms/DocumentsForm";

export default async function Phase2PiecesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const progress = await guardPhase2Step("pieces", locale);

  // Which slots are already filled comes from the database, so a candidate
  // who uploaded their ID on a laptop and returns on a phone for the selfie
  // sees the first slot already ticked.
  return (
    <Phase2StepShell step="pieces">
      <DocumentsForm uploaded={progress.documentKinds} />
    </Phase2StepShell>
  );
}
