-- Phase-2 access codes (§5 of the specification).
--
-- Design note on timing: the code is *generated at send time*, not at Phase-1
-- submission. The specification only fixes when it is delivered ("envoyé 72
-- heures après le dépôt"), not when it is minted, and generating late means
-- the plaintext exists solely in memory during the send. There is therefore
-- nowhere in this schema — encrypted or otherwise — that a readable code is
-- stored, which is what "jamais affiché en clair dans l'admin" actually
-- requires.

create table svap.access_codes (
  id uuid primary key default gen_random_uuid(),

  -- "Un seul code par candidature" — enforced by the unique constraint
  -- rather than by convention. A resend rotates this row's hash in place, so
  -- the previous code stops working the moment a new one is issued.
  candidature_id uuid not null unique references svap.candidatures(id) on delete cascade,

  -- HMAC-SHA256(pepper, normalised code), never the code itself.
  --
  -- Deterministic rather than per-row salted, because the portal identifies a
  -- candidate by name + code and never by email — there is no other key to
  -- look the row up by, so the hash has to be indexable. The server-side
  -- pepper (ACCESS_CODE_PEPPER) is what keeps a leaked database from being
  -- brute-forced offline: without it the hashes are not attackable even
  -- though the code space is small enough to enumerate.
  code_hash text not null unique,

  issued_at timestamptz not null default now(),
  -- 14 days from issue, per §5.
  expires_at timestamptz not null,
  -- Set when the code is exchanged for a session. Non-null ⇒ spent.
  redeemed_at timestamptz,

  last_sent_at timestamptz,
  resend_count int not null default 0,

  -- Nudges before expiry. Nullable so the cron can find un-notified rows.
  reminder_7d_sent_at timestamptz,
  reminder_12d_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_svap_access_codes_expires_at on svap.access_codes(expires_at);
create index idx_svap_access_codes_candidature on svap.access_codes(candidature_id);

-- ---------------------------------------------------------------------------
-- Attempt log (§5 "Les tentatives invalides sont limitées et journalisées",
-- §8 "Journaux d'audit complets sur chaque accès")
-- ---------------------------------------------------------------------------
-- Stores the HMAC of the *attempted* code, not the code and not the attempted
-- name. Hashing the attempt still lets us count failures against one specific
-- code (someone grinding a known code) separately from failures across many
-- (someone enumerating), which is the distinction rate limiting needs — while
-- keeping the log free of both secrets and third-party personal data.

create table svap.access_code_attempts (
  id bigserial primary key,
  code_hash text,
  ip inet,
  user_agent text,
  success boolean not null,
  created_at timestamptz not null default now()
);

-- Both indexes are descending on time: every rate-limit query asks "how many
-- failures in the last hour", i.e. reads the newest rows first.
create index idx_svap_attempts_ip_time
  on svap.access_code_attempts(ip, created_at desc);
create index idx_svap_attempts_code_time
  on svap.access_code_attempts(code_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Both tables are enabled with NO anonymous policy, deliberately. A Phase-2
-- candidate has no Supabase session — they authenticate with a name and a
-- code — so every read and write here goes through the service role behind
-- the server routes. Enabling RLS without policies makes that explicit and
-- fails closed if the anon key is ever used against these tables by mistake.

alter table svap.access_codes enable row level security;
alter table svap.access_code_attempts enable row level security;

create policy "Admins can view access code metadata"
  on svap.access_codes for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can view access attempts"
  on svap.access_code_attempts for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create trigger trg_svap_access_codes_updated_at
  before update on svap.access_codes
  for each row execute function svap.set_updated_at();
