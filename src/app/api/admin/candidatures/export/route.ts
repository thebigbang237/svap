import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseCandidaturesFilters,
  buildCandidaturesQuery,
} from "@/lib/admin/candidatures-query";
import { PAYS_LABELS, SECTEUR_LABELS, PACK_LABELS } from "@/lib/resend/labels";
import { STATUS_LABELS_FR } from "@/lib/constants/admin-options";
import type { CandidatureRow } from "@/lib/supabase/types";

// This GET route has no dynamic segment, so without this it's a candidate
// for static optimization — same cookies()-signal concern as admin/layout.
export const dynamic = "force-dynamic";

const COLUMNS: { header: string; value: (row: CandidatureRow) => string }[] = [
  { header: "Prénom", value: (r) => r.prenom },
  { header: "Nom", value: (r) => r.nom },
  { header: "Email", value: (r) => r.email },
  { header: "Téléphone", value: (r) => r.telephone },
  { header: "Pays", value: (r) => PAYS_LABELS.fr[r.pays] ?? r.pays },
  { header: "Secteur", value: (r) => SECTEUR_LABELS.fr[r.secteur] ?? r.secteur },
  { header: "Pack", value: (r) => PACK_LABELS.fr[r.pack] ?? r.pack },
  { header: "Statut", value: (r) => STATUS_LABELS_FR[r.status] ?? r.status },
  { header: "Date de soumission", value: (r) => new Date(r.created_at).toLocaleString("fr-FR") },
  { header: "Notes internes", value: (r) => r.notes_admin ?? "" },
];

function toCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  const filters = parseCandidaturesFilters(searchParams);

  const supabase = createAdminClient();
  const { data: rows } = await buildCandidaturesQuery(supabase, filters).returns<
    CandidatureRow[]
  >();

  const lines = [
    COLUMNS.map((c) => toCsvField(c.header)).join(","),
    ...(rows ?? []).map((row) =>
      COLUMNS.map((c) => toCsvField(c.value(row))).join(","),
    ),
  ];

  // Leading BOM so Excel opens the UTF-8 file (accented characters) correctly.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidatures-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
