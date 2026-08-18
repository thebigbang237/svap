-- Phase 2, Étape 5 — pack-specific capacity dossier.
--
-- Source: the client's "Cadre de vérification financière" (2026-08-17). Each
-- pack carries a different engagement, so each pack must evidence something
-- different before an invitation letter can be issued:
--
--   Lauréat          project dossier only — no financial requirement
--   Boursier         5 000 $ surface + flight funding + travel insurance
--   Business Visitor ≈ 13 940 $ (flight + 6 days on site)
--   VIP Visitor      ≈ 20 940 $ (the above + 7 000 $ sponsoring)
--   Délégué          nothing — the role is served at home
--
-- What this step is NOT: a payment. The programme neither collects nor holds
-- these amounts; the candidate books and pays their own flight, hotel and
-- transport directly. Only the verification fee (and, for VIP, the sponsoring
-- arranged offline after validation) ever reaches the programme. The copy
-- says so in as many words, and the schema keeps the two apart by having no
-- money column at all — only declarations and evidence.

-- ---------------------------------------------------------------------------
-- New document kinds
-- ---------------------------------------------------------------------------
-- Same table, same private bucket, same retention rule as the identity
-- pieces: a bank statement is no less sensitive than an ID scan, and a second
-- storage path would be a second thing to secure.

alter table svap.phase2_documents
  drop constraint if exists phase2_documents_kind_check;

alter table svap.phase2_documents
  add constraint phase2_documents_kind_check
  check (kind in (
    -- Étape 4 — identity
    'id_recto','id_verso','selfie_liveness','casier_judiciaire',
    -- Étape 5 — capacity
    'attestation_bancaire','releve_bancaire','origine_fonds',
    'assurance_voyage','preuve_billet','resume_projet','preuves_avancement'
  ));

-- ---------------------------------------------------------------------------
-- Declarations
-- ---------------------------------------------------------------------------

create table svap.phase2_financial (
  candidature_id uuid primary key references svap.candidatures(id) on delete cascade,

  -- "Banque de premier ordre" — the issuer of the attestation. The indicative
  -- per-country list is a business artefact validated with a local banking
  -- partner, so this stays free text and is checked by a human rather than
  -- constrained against a list the schema would have to chase.
  banque_emettrice text,

  -- Amount the attestation actually certifies, as declared by the candidate.
  -- Compared by the reviewer against `montant_requis_usd` and against the
  -- attached document; a mismatch is a review signal, not a rejection.
  montant_atteste_usd numeric(12,2),

  -- Requirement in force when the dossier was submitted. Stored rather than
  -- recomputed for the same reason risk_assessments.score is: a later change
  -- to the framework must not silently rewrite what the candidate was asked
  -- for, nor what the reviewer measured them against.
  montant_requis_usd numeric(12,2),

  -- "Déclaration et justificatif de l'origine des fonds": the written half.
  -- The justificatif itself is the `origine_fonds` document.
  origine_fonds text,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.phase2_financial
  add constraint phase2_financial_montants_positifs
  check (
    (montant_atteste_usd is null or montant_atteste_usd >= 0)
    and (montant_requis_usd is null or montant_requis_usd >= 0)
  );

comment on table svap.phase2_financial is
  'Étape 5 — declared financial/project capacity. Evidence of ability to self-fund the trip; never a payment to the programme.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- As everywhere else in Phase 2: candidates hold a signed session cookie, not
-- a Supabase identity, so every write goes through the service role behind a
-- server route. Admins read.

alter table svap.phase2_financial enable row level security;

create policy "Admins can view financial dossiers"
  on svap.phase2_financial for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

grant select on svap.phase2_financial to authenticated;

create trigger trg_svap_phase2_financial_updated_at
  before update on svap.phase2_financial
  for each row execute function svap.set_updated_at();
