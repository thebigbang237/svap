-- Press coverage — the /actualites page.
--
-- Deliberately NOT a blog. Every item is an article published elsewhere: the
-- card carries the outlet's name, the date, a title, a caption and a
-- thumbnail, and clicking it leaves for the publisher's own page. Nothing is
-- hosted or reproduced here, so there is no body column, no slug, no reading
-- view and no editorial workflow to maintain — which is also the only version
-- of this feature that raises no reproduction-rights question.

create table svap.articles (
  id uuid primary key default gen_random_uuid(),

  -- The outlet, as it should be credited on the card.
  media_name text not null,
  title text not null,
  caption text,

  -- Where the card goes. Constrained to http(s) because this URL is rendered
  -- as an href on a public page: `javascript:` in an admin-supplied link is
  -- stored XSS against every visitor.
  url text not null,

  -- Object key in the public `svap-articles` bucket. Null renders a text-only
  -- card rather than a broken image.
  thumbnail_path text,

  -- The date the outlet published, not the date the row was created — the
  -- card shows the former and the list is ordered by it.
  published_at date not null,

  -- Lets an item be staged, or pulled without losing it.
  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table svap.articles
  add constraint articles_url_http
  check (url ~* '^https?://');

create index idx_svap_articles_published
  on svap.articles(published_at desc)
  where is_published;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- The only table in this schema with an anonymous SELECT policy, and it is the
-- only one that should have one: these rows are press links intended for the
-- public. Unpublished rows stay invisible — the flag is a control, not a hint.
-- Writes remain service-role only, behind the admin routes.

alter table svap.articles enable row level security;

create policy "Anyone can read published articles"
  on svap.articles for select
  to anon, authenticated
  using (is_published);

grant select on svap.articles to anon, authenticated;

create trigger trg_svap_articles_updated_at
  before update on svap.articles
  for each row execute function svap.set_updated_at();

-- ---------------------------------------------------------------------------
-- Thumbnails
-- ---------------------------------------------------------------------------
-- Public bucket, unlike svap-documents: these images are rendered on a public
-- page by an <img> the browser fetches directly, so a signed URL would expire
-- mid-page for no gain. Nothing personal is ever uploaded here.
--
-- Uploaded through the admin route with the service role rather than from the
-- browser, so the file type is checked against its bytes exactly as candidate
-- documents are.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'svap-articles',
  'svap-articles',
  true,
  -- 2 MB: a card thumbnail, not a hero image.
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
-- Article writes change what the public site says, which is exactly the kind
-- of change that needs a name attached to it.

alter table svap.audit_log
  drop constraint if exists audit_log_action_check;

alter table svap.audit_log
  add constraint audit_log_action_check
  check (action in (
    'document.view',
    'dossier.download',
    'passport.reveal',
    'candidature.status',
    'candidature.export',
    'payment.refund',
    'access_code.resend',
    'claim.decision',
    'article.create',
    'article.update',
    'article.delete'
  ));
