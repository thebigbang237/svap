-- Phase-1 rework: the full §13 field set, the new candidature lifecycle, and
-- the stored result of automatic pre-selection.
--
-- See docs/flow-edition-2026.md §2 for why only four criteria gate this stage,
-- and §3/§7 for the capacity cap the `complet` status records.

-- ---------------------------------------------------------------------------
-- New Phase-1 columns (§13)
-- ---------------------------------------------------------------------------
-- Added nullable because rows submitted under the old 10-field form cannot
-- have values for them. New submissions are made complete by the Zod schema
-- and the NOT NULL-equivalent CHECKs below, which are scoped to rows created
-- after this migration.

alter table svap.candidatures
  add column if not exists age int,
  add column if not exists ville text,
  add column if not exists marie boolean,
  add column if not exists enfants boolean,
  add column if not exists source text,
  add column if not exists delegue_nom text,
  add column if not exists lien_pays text,
  add column if not exists consent_exactitude boolean not null default false,
  add column if not exists consent_communications boolean not null default false;

alter table svap.candidatures
  add constraint candidatures_age_check
  check (age is null or (age >= 18 and age <= 120)) not valid;

alter table svap.candidatures
  add constraint candidatures_source_check
  check (source is null or source in
    ('delegue','connaissance','reseaux_sociaux','autre')) not valid;

-- The delegate's name is only meaningful when the candidate came via a
-- delegate. Enforcing it here stops the conditional field from being
-- populated out of context by a crafted request.
alter table svap.candidatures
  add constraint candidatures_delegue_nom_check
  check (delegue_nom is null or source = 'delegue') not valid;

-- ---------------------------------------------------------------------------
-- casier_judiciaire: free text -> enum
-- ---------------------------------------------------------------------------
-- Was a free-text field ("Aucun", "néant", "RAS", ...). It now gates automatic
-- pre-selection, so it has to be a value the code can branch on.
--
-- Only an explicit, unambiguous negative is migrated to 'non'. Anything else
-- is left untouched rather than guessed: reading an ambiguous string as "clean
-- record" would auto-pre-select someone the criteria may exclude, which is the
-- one direction this must never fail in.

update svap.candidatures
set casier_judiciaire = 'non'
where lower(btrim(casier_judiciaire)) in
  ('non','aucun','aucune','néant','neant','ras','no','none','vierge',
   'casier vierge','non - casier vierge','aucun casier');

alter table svap.candidatures
  add constraint candidatures_casier_judiciaire_check
  check (casier_judiciaire in ('non','oui')) not valid;

-- ---------------------------------------------------------------------------
-- visa_historique: now mandatory for new rows, constrained
-- ---------------------------------------------------------------------------
-- Values were already migrated to the new answer set in 0005.

alter table svap.candidatures
  add constraint candidatures_visa_historique_check
  check (visa_historique is null or visa_historique in
    ('aucun_jamais','aucun_obtenu','refus_1_3','refus_4_plus')) not valid;

-- ---------------------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------------------
-- The old set was a generic review workflow (en_attente / preselection /
-- accepte / refuse / liste_attente). The new one tracks a two-phase funnel,
-- so the distinctions that matter are different: "failed a gate" and "pack was
-- full" are both non-advancing but are not the same outcome, and the Phase-2
-- stages need to be visible for support to answer "where is my dossier".
--
-- liste_attente -> complet: the closest equivalent. Both mean eligible but
-- without a seat.

alter table svap.candidatures
  drop constraint if exists candidatures_status_check;

update svap.candidatures set status = case status
  when 'preselection'   then 'preselectionne'
  when 'accepte'        then 'valide'
  when 'refuse'         then 'rejete'
  when 'liste_attente'  then 'complet'
  else status
end;

alter table svap.candidatures
  add constraint candidatures_status_check
  check (status in (
    'en_attente','preselectionne','non_eligible','complet','code_envoye',
    'phase2_en_cours','phase2_paye','verification','valide','rejete','expire'
  ));

-- ---------------------------------------------------------------------------
-- Pre-selection audit
-- ---------------------------------------------------------------------------
-- Why the automatic gate decided what it decided, and when. Kept separate from
-- `status` because status moves on through Phase 2 while the Phase-1 verdict
-- must stay legible: support needs to answer "why was I not pre-selected"
-- months later, and re-deriving it from rules that may since have changed
-- would give the wrong answer.

alter table svap.candidatures
  add column if not exists preselection_reason text,
  add column if not exists preselection_at timestamptz;

alter table svap.candidatures
  add constraint candidatures_preselection_reason_check
  check (preselection_reason is null or preselection_reason in
    ('age','casier_judiciaire','visa_refusals','pack_full')) not valid;

-- Drives the capacity cap: the count of currently pre-selected candidatures
-- per pack is read on every submission, so it needs to be cheap.
create index if not exists idx_svap_candidatures_pack_status
  on svap.candidatures(pack, status);
