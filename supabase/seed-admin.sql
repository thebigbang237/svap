-- Grant admin access to an existing Supabase Auth user.
--
-- NOT a migration — this is a one-off you run by hand, per environment, and
-- it is deliberately not automated: an admin account can read every
-- candidate's passport scan and issue refunds, so creating one should be a
-- deliberate act with a named person behind it.
--
-- ---------------------------------------------------------------------------
-- Before running this
-- ---------------------------------------------------------------------------
-- The user must already exist in Supabase Auth. There is no sign-up flow in
-- the admin panel by design. Create the account first:
--
--   Supabase Dashboard → Authentication → Users → Add user
--     • Email: the person's real work address
--     • Password: set one, and tick "Auto Confirm User"
--
-- Then replace the email below and run this in the SQL editor.
-- ---------------------------------------------------------------------------

insert into svap.admin_profiles (id, full_name, role)
select
  id,
  -- Shown in the admin header and written into the audit log, so make it a
  -- real name rather than "admin" — the whole point of the log is knowing
  -- which human opened a dossier.
  'REPLACE WITH FULL NAME',
  -- 'super_admin' can reveal decrypted passport numbers and issue refunds.
  -- 'reviewer' can do everything else: read dossiers, open document scans,
  -- see risk scores, change statuses. Start people as reviewer.
  'super_admin'
from auth.users
where email = 'REPLACE@WITH.EMAIL'
on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role;

-- Verify it took. An empty result means the email didn't match any auth user.
select p.id, p.full_name, p.role, u.email
from svap.admin_profiles p
join auth.users u on u.id = p.id;
