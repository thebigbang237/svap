-- Phase 2 — verification dossier (§14 of the specification).
--
-- Split across four tables rather than widened onto svap.candidatures, for
-- three reasons: the sensitivity tier is completely different (passport
-- numbers, criminal records, biometrics vs. a marketing-grade application
-- form), the retention rules will differ, and a per-table grant lets the
-- admin UI show a dossier's progress without every query dragging the
-- most sensitive columns along with it.

-- ---------------------------------------------------------------------------
-- Étape 1 — Complete personal information
-- ---------------------------------------------------------------------------

create table svap.phase2_applications (
  candidature_id uuid primary key references svap.candidatures(id) on delete cascade,

  -- As printed on the identity document, which is not necessarily what was
  -- typed in Phase 1 — that difference is itself a verification signal, so
  -- both are kept.
  prenoms text not null,
  nom_famille text not null,
  date_naissance date not null,
  lieu_naissance text not null,
  nationalite text not null,

  -- AES-256-GCM at the application layer, not plaintext.
  --
  -- Supabase encrypts at rest already, but that only defends the disk: a
  -- leaked service-role key, an over-broad admin query or a stray log line
  -- all return plaintext. A passport number is the single most
  -- identity-theft-useful field in this schema and is needed only at
  -- verification time, so it stays sealed until then.
  passeport_numero_encrypted text not null,
  -- Last two characters, plaintext, so the admin can confirm a candidate is
  -- talking about the right document over the phone without decrypting.
  passeport_numero_suffix text,
  passeport_expiration date not null,

  telephone text not null,
  adresse text not null,

  profession text not null,
  employeur text not null,

  contact_urgence_nom text not null,
  contact_urgence_lien text not null,
  contact_urgence_telephone text not null,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.phase2_applications
  add constraint phase2_profession_check
  check (profession in (
    'dirigeant_3ans','salarie_cdi','cadre','independant','cdd',
    'etudiant_ecole_fonction_publique','sans_emploi',
    'etudiant_fin_cycle_sans_contrat'
  ));

-- A passport that expires before the trip is a hard blocker for the visa
-- application, so catch it at entry rather than at verification.
alter table svap.phase2_applications
  add constraint phase2_passeport_future
  check (passeport_expiration > current_date);

-- ---------------------------------------------------------------------------
-- Étape 2 — Risk assessment
-- ---------------------------------------------------------------------------

create table svap.risk_assessments (
  candidature_id uuid primary key references svap.candidatures(id) on delete cascade,

  refus_entree_pays_etranger boolean not null,
  depassement_visa boolean not null,
  refus_usa_count text not null,
  attaches_familiales text not null,
  activite_pays text not null,
  voyages_hors_afrique text not null,
  patrimoine text not null,
  famille_usa text not null,

  engagements_retour text not null,
  motivation_retour text not null,
  certification_honneur boolean not null,

  -- Computed from the answers above. Stored rather than derived on read so a
  -- later change to the weighting cannot silently rewrite the score a human
  -- reviewer actually saw when they made a decision.
  score int,
  -- The per-factor breakdown behind `score`. §8 asks for "revue humaine pour
  -- les cas limites", and a reviewer cannot sanity-check a bare number.
  score_breakdown jsonb,

  -- Answers that contradict Phase 1 — e.g. refusals declared here that don't
  -- match what was declared then. Not a rejection on its own; a flag for the
  -- human reviewer.
  consistency_flags text[] not null default '{}',

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.risk_assessments
  add constraint risk_refus_usa_check check (refus_usa_count in ('aucun','1','2','3')),
  add constraint risk_attaches_check check (attaches_familiales in ('conjoint_enfants','famille_proche','non')),
  add constraint risk_activite_check check (activite_pays in ('entreprise_declaree','biens_immobiliers','emploi_cdi','non')),
  add constraint risk_voyages_check check (voyages_hors_afrique in ('europe','amerique_nord','asie_moyen_orient','jamais')),
  add constraint risk_patrimoine_check check (patrimoine in ('proprietaire','locataire_revenus_stables','heberge','aucun_actif')),
  add constraint risk_famille_usa_check check (famille_usa in ('aucune','eloignee','immediate')),
  -- The declaration is the point of the field; false is not a valid answer.
  add constraint risk_certification_check check (certification_honneur = true);

-- ---------------------------------------------------------------------------
-- Étape 3 — Documents
-- ---------------------------------------------------------------------------
-- Only metadata lives here. The files themselves go to a private Storage
-- bucket, reachable exclusively through short-lived signed URLs minted
-- server-side for an authenticated admin.

create table svap.phase2_documents (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references svap.candidatures(id) on delete cascade,

  kind text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null,
  -- Lets an identical file uploaded under two identities be detected, and
  -- proves a file wasn't swapped after review.
  sha256 text,

  uploaded_at timestamptz not null default now(),

  -- Criminal record extract only (§14 Étape 3).
  casier_date date,
  casier_numero text,
  casier_lieu text,
  casier_structure text
);

alter table svap.phase2_documents
  add constraint phase2_documents_kind_check
  check (kind in ('id_recto','id_verso','selfie_liveness','casier_judiciaire'));

-- One current file per kind per candidature: re-uploading replaces rather
-- than accumulating, so a reviewer is never guessing which of three selfies
-- is the real one.
create unique index idx_svap_phase2_documents_unique
  on svap.phase2_documents(candidature_id, kind);

-- ---------------------------------------------------------------------------
-- Étape 4 — Consents
-- ---------------------------------------------------------------------------
-- One row per consent rather than a set of booleans: these are the record
-- that a specific permission was granted at a specific moment, and §8's
-- audit obligations mean the *when* and *from where* matter as much as the
-- *whether*.

create table svap.phase2_consents (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references svap.candidatures(id) on delete cascade,
  kind text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text
);

alter table svap.phase2_consents
  add constraint phase2_consents_kind_check
  check (kind in (
    'verification_tiers','certification_honneur','conditions_generales',
    'fraude_signalement','traitement_donnees'
  ));

create unique index idx_svap_phase2_consents_unique
  on svap.phase2_consents(candidature_id, kind);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- No anonymous policy anywhere: a Phase-2 candidate holds a signed session
-- cookie, not a Supabase identity, so every read and write goes through the
-- service role behind the server routes. Admin SELECT is granted so the
-- review UI works under the ordinary authenticated client.
--
-- phase2_applications is deliberately NOT granted to reviewers — the
-- passport column lives there. Admin surfaces read it through a server route
-- that decrypts explicitly and logs the access.

alter table svap.phase2_applications enable row level security;
alter table svap.risk_assessments enable row level security;
alter table svap.phase2_documents enable row level security;
alter table svap.phase2_consents enable row level security;

create policy "Admins can view risk assessments"
  on svap.risk_assessments for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can view document metadata"
  on svap.phase2_documents for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can view consents"
  on svap.phase2_consents for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create trigger trg_svap_phase2_applications_updated_at
  before update on svap.phase2_applications
  for each row execute function svap.set_updated_at();

create trigger trg_svap_risk_assessments_updated_at
  before update on svap.risk_assessments
  for each row execute function svap.set_updated_at();
