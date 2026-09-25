import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import {
  ReconciliationTable,
  type PendingSettlement,
} from "@/components/admin/ReconciliationTable";

/**
 * Règlements à vérifier — the other half of accepting Paiement Pro's word.
 *
 * Their notification is the only signal that a card payment succeeded: the
 * status API does not report our transactions, and the `hashcode` is not a
 * merchant signature (their support, in writing). We therefore let the
 * candidate through on the notification alone, which means a payer who
 * replayed their own reference would also get through.
 *
 * This page is where that is caught. Each row is checked against the Paiement
 * Pro back office and either confirmed or reversed. pawaPay and Stripe
 * settlements never appear here — their callbacks are signed, so there is
 * nothing for a human to add.
 */
export default async function ReconciliationPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, candidature_id, provider_ref, method, amount_local, amount_usd, currency, completed_at",
    )
    .eq("settlement_source", "callback_unverified")
    .eq("status", "paye")
    .is("reconciled_at", null)
    .order("completed_at", { ascending: false })
    .limit(200)
    .returns<Omit<PendingSettlement, "candidate">[]>();

  const rows = payments ?? [];

  // Second query rather than a join, as in the review queue: PostgREST
  // embedding across schemas is fiddly, and this is one cheap `in` lookup.
  const { data: candidates } = await supabase
    .from("candidatures")
    .select("id, prenom, nom, email")
    .in(
      "id",
      rows.map((r) => r.candidature_id),
    )
    .returns<{ id: string; prenom: string; nom: string; email: string }[]>();

  const byId = new Map((candidates ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-blue-dark">
          Règlements à vérifier
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-dim">
          Paiements par carte ou PayPal validés sur la seule notification de
          Paiement Pro, qui ne peut pas être authentifiée. Le candidat a déjà
          poursuivi son dossier. Retrouvez chaque référence dans le back-office
          Paiement Pro : « Confirmer » si la transaction y figure,
          « Introuvable » sinon — le dossier repasse alors à l&apos;étape de
          paiement. {rows.length} en attente.
        </p>
      </div>

      {admin?.profile.role === "super_admin" ? (
        <ReconciliationTable
          rows={rows.map((row) => ({
            ...row,
            candidate: byId.get(row.candidature_id) ?? null,
          }))}
        />
      ) : (
        <p className="border border-ink-dim/20 bg-white p-8 text-sm text-ink-dim">
          La vérification des règlements est réservée aux
          super-administrateurs.
        </p>
      )}
    </div>
  );
}
