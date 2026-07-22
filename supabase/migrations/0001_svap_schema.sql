create schema if not exists svap;

create table svap.candidatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text not null,
  pays text not null,
  secteur text not null,
  pack text not null check (pack in ('laureat','boursier','invite','ambassadeur','delegue')),
  visa_historique text,
  casier_judiciaire text not null,
  motivation text not null,
  locale text not null default 'fr' check (locale in ('fr','en')),
  status text not null default 'en_attente'
    check (status in ('en_attente','preselection','accepte','refuse','liste_attente')),
  notes_admin text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  payment_status text default 'non_requis'
    check (payment_status in ('non_requis','en_attente','paye','echoue')),
  payment_amount numeric,
  payment_reference text
);

create index idx_svap_candidatures_status on svap.candidatures(status);
create index idx_svap_candidatures_pack on svap.candidatures(pack);
create index idx_svap_candidatures_created_at on svap.candidatures(created_at desc);

create table svap.admin_profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text not null default 'reviewer' check (role in ('super_admin','reviewer')),
  created_at timestamptz not null default now()
);

alter table svap.candidatures enable row level security;
alter table svap.admin_profiles enable row level security;

create policy "Anyone can submit a candidature"
  on svap.candidatures for insert
  with check (true);

create policy "Admins can view all candidatures"
  on svap.candidatures for select
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can update candidatures"
  on svap.candidatures for update
  using (exists (select 1 from svap.admin_profiles where admin_profiles.id = auth.uid()));

create policy "Admins can view own profile"
  on svap.admin_profiles for select
  using (auth.uid() = id);

create or replace function svap.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_svap_candidatures_updated_at
  before update on svap.candidatures
  for each row execute function svap.set_updated_at();
