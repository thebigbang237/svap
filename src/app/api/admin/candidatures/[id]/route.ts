import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStatusUpdateEmail } from "@/lib/resend/client";
import { STATUS_OPTIONS } from "@/lib/constants/admin-options";
import { recordAudit } from "@/lib/admin/audit";
import type { CandidatureStatus } from "@/lib/resend/types";
import type { CandidatureRow } from "@/lib/supabase/types";

const NOTIFIABLE_STATUSES: readonly string[] = [
  "preselection",
  "accepte",
  "refuse",
  "liste_attente",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { status, notesAdmin } = body as {
    status?: string;
    notesAdmin?: string;
  };

  if (status !== undefined && !(STATUS_OPTIONS as readonly string[]).includes(status)) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("candidatures")
    .select("*")
    .eq("id", id)
    .maybeSingle<CandidatureRow>();

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 },
    );
  }

  const statusChanged = status !== undefined && status !== existing.status;
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("candidatures")
    .update({
      status: status ?? existing.status,
      notes_admin: notesAdmin ?? existing.notes_admin,
      reviewed_by: admin.userId,
      reviewed_at: now,
    })
    .eq("id", id)
    .select("*")
    .single<CandidatureRow>();

  if (updateError || !updated) {
    console.error("Failed to update candidature:", updateError);
    return NextResponse.json(
      { success: false, error: "Update failed" },
      { status: 500 },
    );
  }

  if (statusChanged) {
    await recordAudit({
      actorId: admin.userId,
      actorEmail: admin.profile.full_name,
      action: "candidature.status",
      entityType: "candidature",
      entityId: updated.id,
      request,
      metadata: { from: existing.status, to: updated.status },
    });
  }

  if (statusChanged && NOTIFIABLE_STATUSES.includes(updated.status)) {
    sendStatusUpdateEmail(
      {
        id: updated.id,
        prenom: updated.prenom,
        nom: updated.nom,
        email: updated.email,
        telephone: updated.telephone,
        pays: updated.pays,
        secteur: updated.secteur,
        pack: updated.pack,
        visaHistorique: updated.visa_historique ?? undefined,
        casierJudiciaire: updated.casier_judiciaire,
        motivation: updated.motivation,
        locale: updated.locale,
      },
      updated.status as CandidatureStatus,
    ).catch((err) => {
      console.error("Failed to send status update email:", err);
    });
  }

  return NextResponse.json({ success: true, candidature: updated });
}
