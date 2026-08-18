// French display labels for Phase-2 review surfaces. The admin UI is
// French-only by design (see admin-options.ts), so these don't go through
// next-intl.

export const DOCUMENT_KIND_LABELS_FR: Record<string, string> = {
  // Étape 4 — identity
  id_recto: "Pièce d'identité — recto",
  id_verso: "Pièce d'identité — verso",
  selfie_liveness: "Selfie de vivacité",
  casier_judiciaire: "Extrait de casier judiciaire",
  // Étape 5 — capacity, pack-specific
  attestation_bancaire: "Caution / attestation bancaire",
  releve_bancaire: "Relevé bancaire (2 derniers mois)",
  origine_fonds: "Justificatif d'origine des fonds",
  assurance_voyage: "Assurance voyage",
  preuve_billet: "Preuve de financement du billet",
  resume_projet: "Résumé du projet",
  preuves_avancement: "Preuves d'avancement du projet",
};

export const CONSENT_KIND_LABELS_FR: Record<string, string> = {
  verification_tiers: "Vérification par prestataires tiers",
  certification_honneur: "Certification sur l'honneur",
  conditions_generales: "Conditions générales et confidentialité",
  fraude_signalement: "Reconnaissance fraude / signalement",
  traitement_donnees: "Traitement des données personnelles",
};

export const PROFESSION_LABELS_FR: Record<string, string> = {
  dirigeant_3ans: "Dirigeant d'entreprise (> 3 ans)",
  salarie_cdi: "Salarié CDI",
  cadre: "Cadre",
  independant: "Indépendant",
  cdd: "Salarié CDD",
  etudiant_ecole_fonction_publique: "Étudiant — école fonction publique",
  sans_emploi: "Sans emploi",
  etudiant_fin_cycle_sans_contrat: "Étudiant fin de cycle sans contrat",
};

export const RISK_ANSWER_LABELS_FR: Record<string, string> = {
  // refus_usa_count
  aucun: "Aucun",
  // attaches_familiales
  conjoint_enfants: "Conjoint et/ou enfants",
  famille_proche: "Famille proche",
  non: "Aucune",
  // activite_pays
  entreprise_declaree: "Entreprise déclarée",
  biens_immobiliers: "Biens immobiliers",
  emploi_cdi: "Emploi stable CDI",
  // voyages
  europe: "Europe",
  amerique_nord: "Amérique du Nord",
  asie_moyen_orient: "Asie / Moyen-Orient",
  jamais: "Jamais",
  // patrimoine
  proprietaire: "Propriétaire immobilier",
  locataire_revenus_stables: "Locataire, revenus bancaires stables",
  heberge: "Hébergé(e)",
  aucun_actif: "Aucun actif significatif",
  // famille_usa
  aucune: "Aucune famille aux USA",
  eloignee: "Famille éloignée",
  immediate: "Famille immédiate",
};

/** Each scoring factor, in the reviewer's language. */
export const RISK_FACTOR_LABELS_FR: Record<string, string> = {
  refus_entree: "Refus d'entrée dans un pays étranger",
  depassement_visa: "Dépassement de durée de visa",
  refus_usa: "Refus de visa USA",
  attaches_familiales: "Attaches familiales",
  activite_pays: "Activité dans le pays",
  patrimoine: "Patrimoine et actifs",
  famille_usa: "Famille aux États-Unis",
  voyages: "Historique de voyages",
  engagement_ecrit: "Qualité des engagements écrits",
};

export const RISK_BAND_LABELS_FR: Record<string, string> = {
  faible: "Risque faible",
  modere: "Risque modéré",
  eleve: "Risque élevé",
};

export const RISK_BAND_CLASSES: Record<string, string> = {
  faible: "bg-blue/10 text-blue-dark",
  modere: "bg-terracotta/10 text-terracotta",
  eleve: "bg-terracotta text-white",
};

/**
 * Contradictions between the Phase-1 and Phase-2 declarations. Worded as
 * prompts for a reviewer rather than verdicts — none of these is a rejection
 * on its own, and a candidate may simply have misread the earlier banded
 * question.
 */
export const CONSISTENCY_FLAG_LABELS_FR: Record<string, string> = {
  refus_usa_contradiction:
    "Refus de visa déclarés en Phase 2 alors que la Phase 1 n'en déclarait aucun.",
  refus_usa_understated:
    "Aucun refus déclaré en Phase 2 alors que la Phase 1 en déclarait 1 à 3.",
  voyage_amerique_sans_visa_usa:
    "Voyage en Amérique du Nord déclaré sans demande de visa USA (possible via Canada/Mexique).",
};

export const PAYMENT_STATUS_LABELS_FR: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  paye: "Payé",
  echoue: "Échoué",
  annule: "Annulé",
  rembourse: "Remboursé",
};

export const AUDIT_ACTION_LABELS_FR: Record<string, string> = {
  "document.view": "Consultation d'un document",
  "dossier.download": "Téléchargement du dossier complet",
  "passport.reveal": "Affichage d'un n° de passeport",
  "candidature.status": "Changement de statut",
  "candidature.export": "Export CSV",
  "payment.refund": "Remboursement",
  "access_code.resend": "Renvoi de code d'accès",
  "claim.decision": "Décision prime visa",
  "article.create": "Publication d'un article",
  "article.update": "Modification d'un article",
  "article.delete": "Suppression d'un article",
};

export const label = (table: Record<string, string>, key: string | null) =>
  (key && table[key]) || key || "—";
