import "server-only";
import type { Dossier } from "./dossier";
import type { CandidatureRow } from "@/lib/supabase/types";
import {
  CONSENT_KIND_LABELS_FR,
  DOCUMENT_KIND_LABELS_FR,
  PROFESSION_LABELS_FR,
  RISK_ANSWER_LABELS_FR,
  RISK_BAND_LABELS_FR,
  RISK_FACTOR_LABELS_FR,
  CONSISTENCY_FLAG_LABELS_FR,
  PAYMENT_STATUS_LABELS_FR,
  label,
} from "@/lib/constants/admin-labels";
import { paysLabel, secteurLabel, packLabel, visaHistoriqueLabel } from "@/lib/resend/labels";

/**
 * Renders a dossier as a self-contained HTML document and as a CSV.
 *
 * HTML rather than a generated PDF: it needs no rendering dependency, opens
 * anywhere, and prints to PDF from any browser with `@page` rules already set
 * — which is what a reviewer actually does when a decision needs attaching to
 * a file. The CSV is the same data in a form Excel opens directly, for anyone
 * who wants to sort or filter across dossiers.
 */

export interface ExportInput {
  candidature: CandidatureRow;
  dossier: Dossier;
  passportNumber: string | null;
}

const escape = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("fr-FR") : "—";

const dateOnly = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "—";

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? "—" : value ? "Oui" : "Non";

/** [label, value] pairs, shared by both output formats so they can't diverge. */
function collectRows(input: ExportInput): [string, string][] {
  const { candidature: c, dossier: d, passportNumber } = input;
  const a = d.application;
  const r = d.risk;
  const rows: [string, string][] = [
    ["Référence", c.id],
    ["Statut", c.status],
    ["Date de candidature", date(c.created_at)],

    ["— PHASE 1 —", ""],
    ["Prénom", c.prenom],
    ["Nom", c.nom],
    ["Email", c.email],
    ["Téléphone", c.telephone],
    ["Âge", String(c.age ?? "—")],
    ["Pays", paysLabel("fr", c.pays)],
    ["Ville", c.ville ?? "—"],
    ["Secteur", secteurLabel("fr", c.secteur)],
    ["Pack", packLabel("fr", c.pack)],
    ["Casier judiciaire déclaré", c.casier_judiciaire],
    ["Refus de visa USA déclarés", c.visa_historique ? visaHistoriqueLabel("fr", c.visa_historique) : "—"],
    ["Marié(e)", yesNo(c.marie)],
    ["Enfants", yesNo(c.enfants)],
    ["Origine de la candidature", c.source ?? "—"],
    ["Nom du délégué", c.delegue_nom ?? "—"],
    ["Motivation", c.motivation],
    ["Lien au pays", c.lien_pays ?? "—"],
  ];

  if (a) {
    rows.push(
      ["— PHASE 2 · IDENTITÉ —", ""],
      ["Prénom(s) (pièce d'identité)", a.prenoms],
      ["Nom de famille (pièce d'identité)", a.nom_famille],
      ["Date de naissance", dateOnly(a.date_naissance)],
      ["Lieu de naissance", a.lieu_naissance],
      ["Nationalité", a.nationalite],
      [
        "N° de passeport",
        passportNumber ?? `•••••${a.passeport_numero_suffix ?? "??"} (déchiffrement impossible)`,
      ],
      ["Expiration du passeport", dateOnly(a.passeport_expiration)],
      ["Téléphone / WhatsApp", a.telephone],
      ["Adresse", a.adresse],
      ["Profession", label(PROFESSION_LABELS_FR, a.profession)],
      ["Employeur", a.employeur],
      [
        "Contact d'urgence",
        `${a.contact_urgence_nom} (${a.contact_urgence_lien}) — ${a.contact_urgence_telephone}`,
      ],
    );
  }

  if (r) {
    rows.push(
      ["— PHASE 2 · ÉVALUATION DU RISQUE —", ""],
      ["Score", `${r.score ?? "—"}/100 — ${label(RISK_BAND_LABELS_FR, r.score_breakdown?.band ?? null)}`],
      ["Refus d'entrée pays étranger", yesNo(r.refus_entree_pays_etranger)],
      ["Dépassement de visa", yesNo(r.depassement_visa)],
      ["Refus de visa USA", label(RISK_ANSWER_LABELS_FR, r.refus_usa_count)],
      ["Attaches familiales", label(RISK_ANSWER_LABELS_FR, r.attaches_familiales)],
      ["Activité dans le pays", label(RISK_ANSWER_LABELS_FR, r.activite_pays)],
      ["Patrimoine", label(RISK_ANSWER_LABELS_FR, r.patrimoine)],
      ["Famille aux USA", label(RISK_ANSWER_LABELS_FR, r.famille_usa)],
      ["Voyages hors Afrique", label(RISK_ANSWER_LABELS_FR, r.voyages_hors_afrique)],
      ["Engagements de retour", r.engagements_retour],
      ["Motivation de retour", r.motivation_retour],
      [
        "Incohérences avec la Phase 1",
        r.consistency_flags.length
          ? r.consistency_flags.map((f) => label(CONSISTENCY_FLAG_LABELS_FR, f)).join(" | ")
          : "Aucune",
      ],
    );
  }

  for (const p of d.payments) {
    rows.push([
      `Paiement ${p.provider}`,
      `${p.currency === "USD" ? `$${p.amount_usd}` : `${p.amount_local} ${p.currency} ($${p.amount_usd})`} — ${label(PAYMENT_STATUS_LABELS_FR, p.status)} — ${p.provider_ref}`,
    ]);
  }

  for (const consent of d.consents) {
    rows.push([
      `Consentement · ${label(CONSENT_KIND_LABELS_FR, consent.kind)}`,
      date(consent.accepted_at),
    ]);
  }

  if (c.notes_admin) rows.push(["Notes internes", c.notes_admin]);

  return rows;
}

export function buildDossierCsv(input: ExportInput): string {
  const field = (value: string) =>
    /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  return [
    "Champ;Valeur",
    ...collectRows(input).map(([k, v]) => `${field(k)};${field(v)}`),
  ].join("\r\n");
}

export function buildDossierHtml(input: ExportInput): string {
  const { candidature: c, dossier: d } = input;
  const rows = collectRows(input);

  const body = rows
    .map(([k, v]) => {
      // Section markers render as headings rather than as a labelled row.
      if (v === "" && k.startsWith("—")) {
        return `<tr class="section"><th colspan="2">${escape(k.replace(/—/g, "").trim())}</th></tr>`;
      }
      return `<tr><th>${escape(k)}</th><td>${escape(v).replace(/\n/g, "<br>")}</td></tr>`;
    })
    .join("\n");

  const factors = d.risk?.score_breakdown?.factors ?? [];
  const factorRows = factors
    .map(
      (f) =>
        `<tr><th>${escape(label(RISK_FACTOR_LABELS_FR, f.key))}</th><td>${f.points} / ${f.max}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Dossier ${escape(c.nom)} ${escape(c.prenom)} — SVAP 2026</title>
<style>
  @page { margin: 18mm; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #1A2A3A; line-height: 1.5; max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; }
  h1 { font-size: 1.6rem; color: #0D4F7C; margin-bottom: .25rem; }
  .ref { color: #6A8099; font-size: .8rem; margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th, td { text-align: left; vertical-align: top; padding: .55rem .75rem;
           border-bottom: 1px solid #D0E8F5; font-size: .875rem; }
  th { width: 34%; color: #3A5068; font-weight: 600; }
  tr.section th { background: #EAF4FB; color: #0D4F7C; text-transform: uppercase;
                  letter-spacing: .08em; font-size: .7rem; padding-top: 1rem; }
  h2 { font-size: 1rem; color: #0D4F7C; margin: 2rem 0 .75rem; }
  .warn { border-left: 3px solid #C9713D; background: #FDF6F2; padding: .75rem 1rem;
          font-size: .85rem; margin-bottom: 2rem; }
  /* Kept on screen and on paper: whoever handles this file needs to know what
     it contains before deciding where to store or send it. */
  .confidential { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #D0E8F5;
                  color: #6A8099; font-size: .75rem; }
</style>
</head>
<body>
  <h1>${escape(c.prenom)} ${escape(c.nom)}</h1>
  <p class="ref">Dossier ${escape(c.id)} · exporté le ${new Date().toLocaleString("fr-FR")}</p>

  <div class="warn">
    Ce document contient des données personnelles sensibles (identité, passeport,
    antécédents judiciaires). Sa diffusion est limitée aux personnes chargées de
    l'instruction du dossier.
  </div>

  <table>${body}</table>

  ${factorRows ? `<h2>Détail du score de risque</h2><table>${factorRows}</table>` : ""}

  <h2>Pièces jointes à cette archive</h2>
  <table>
    ${
      d.documents.length
        ? d.documents
            .map(
              (doc) =>
                `<tr><th>${escape(label(DOCUMENT_KIND_LABELS_FR, doc.kind))}</th><td>${escape(doc.mime_type)} · ${Math.round(doc.size_bytes / 1024)} Ko · transmis le ${date(doc.uploaded_at)}</td></tr>`,
            )
            .join("\n")
        : `<tr><td colspan="2">Aucune pièce transmise.</td></tr>`
    }
  </table>

  <p class="confidential">
    Silicon Valley Africa Program 2026 — First Of All LLC. Document interne.
  </p>
</body>
</html>`;
}
