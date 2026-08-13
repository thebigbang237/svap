import {
  RISK_BAND_CLASSES,
  RISK_BAND_LABELS_FR,
  RISK_FACTOR_LABELS_FR,
  RISK_ANSWER_LABELS_FR,
  CONSISTENCY_FLAG_LABELS_FR,
  label,
} from "@/lib/constants/admin-labels";
import type { RiskAssessmentView } from "@/lib/admin/dossier";

/**
 * Risk assessment as a reviewer needs to read it.
 *
 * The total is shown with its full per-factor breakdown, never alone. §8 asks
 * for "revue humaine pour les cas limites", and a human cannot review a bare
 * number — they need to see that 18 of the points came from a declared visa
 * overstay and not from a weak paragraph.
 */
export function RiskScorePanel({ risk }: { risk: RiskAssessmentView }) {
  const band = risk.score_breakdown?.band ?? "faible";
  const factors = risk.score_breakdown?.factors ?? [];
  const bandReason = risk.score_breakdown?.bandReason;

  const answers: [string, string][] = [
    ["Refus d'entrée pays étranger", risk.refus_entree_pays_etranger ? "Oui" : "Non"],
    ["Dépassement de visa", risk.depassement_visa ? "Oui" : "Non"],
    ["Refus de visa USA", label(RISK_ANSWER_LABELS_FR, risk.refus_usa_count)],
    ["Attaches familiales", label(RISK_ANSWER_LABELS_FR, risk.attaches_familiales)],
    ["Activité dans le pays", label(RISK_ANSWER_LABELS_FR, risk.activite_pays)],
    ["Patrimoine", label(RISK_ANSWER_LABELS_FR, risk.patrimoine)],
    ["Famille aux USA", label(RISK_ANSWER_LABELS_FR, risk.famille_usa)],
    ["Voyages hors Afrique", label(RISK_ANSWER_LABELS_FR, risk.voyages_hors_afrique)],
  ];

  return (
    <div className="border border-ink-dim/20 bg-white p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-blue">
          Évaluation du risque de non-retour
        </h2>
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-3xl font-normal text-blue-dark">
            {risk.score ?? "—"}
            <span className="text-base text-ink-dim">/100</span>
          </span>
          <span
            className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              RISK_BAND_CLASSES[band] ?? "bg-sky-mid text-ink-mid"
            }`}
          >
            {label(RISK_BAND_LABELS_FR, band)}
          </span>
        </div>
      </div>

      {bandReason && (
        <p className="mb-6 border-s-2 border-terracotta bg-sky-mid/50 p-3 text-sm text-ink">
          Niveau relevé automatiquement :{" "}
          {label(RISK_FACTOR_LABELS_FR, bandReason)} — ce facteur seul justifie
          un examen attentif, quel que soit le total.
        </p>
      )}

      {risk.consistency_flags.length > 0 && (
        <div className="mb-6 border border-terracotta/40 bg-terracotta/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-terracotta">
            Incohérences avec la Phase 1
          </p>
          <ul className="space-y-2">
            {risk.consistency_flags.map((flag) => (
              <li key={flag} className="text-sm text-ink">
                {label(CONSISTENCY_FLAG_LABELS_FR, flag)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {factors.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Détail du score
          </p>
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.key} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 text-ink-mid">
                  {label(RISK_FACTOR_LABELS_FR, f.key)}
                </span>
                {/* Bar is relative to the factor's own maximum, so a reviewer
                    sees how heavily this answer scored within its category
                    rather than against the total. */}
                <span className="h-1.5 flex-1 bg-ink-dim/15">
                  <span
                    className={`block h-full ${f.points > 0 ? "bg-terracotta" : "bg-blue/30"}`}
                    style={{ width: `${f.max ? (f.points / f.max) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-end tabular-nums text-ink">
                  {f.points}/{f.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 border-t border-ink-dim/20 pt-6 sm:grid-cols-2">
        {answers.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {k}
            </p>
            <p className="text-sm text-ink">{v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-ink-dim/20 pt-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Engagements garantissant le retour
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">
            {risk.engagements_retour}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Motivation de retour
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">
            {risk.motivation_retour}
          </p>
        </div>
      </div>
    </div>
  );
}
