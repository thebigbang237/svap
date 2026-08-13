# SVAP — Runbook

How to get the system running, what each moving part does, and the test flows to
walk before launch.

---

## 1. What the migrations are, and why they exist

`supabase/migrations/*.sql` are **ordered, one-time SQL scripts** that build the
database. The application code assumes the schema they produce: if a migration
hasn't run, the matching feature fails at runtime rather than at build time.

They are numbered and must run **in order**, because later ones depend on tables
and constraints created by earlier ones. Each is written to run exactly once —
re-running is not safe unless the file explicitly says so.

| # | File | What it creates | Without it |
|---|---|---|---|
| 0001 | `svap_schema` | `candidatures`, `admin_profiles`, RLS, `updated_at` trigger | Nothing works |
| 0002–0004 | grants, unique email index | Anonymous insert permission, one application per email | Form submits fail, or duplicates get through |
| 0005 | `program_model_2026` | 5 packs (renames `invite`→`business_visitor`, `ambassadeur`→`vip_visitor`), 6 countries, 12 sectors, `ar` locale | Pack selection rejected by the DB check constraint |
| 0006 | `phase1_rework` | The 20 Phase-1 columns, `casier_judiciaire` as an enum, the 11-status lifecycle, pre-selection audit columns | Phase-1 submissions fail |
| 0007 | `access_codes` | `access_codes` (hash only), `access_code_attempts` | Codes can't be issued or redeemed |
| 0008 | `phase2` | `phase2_applications`, `risk_assessments`, `phase2_documents`, `phase2_consents` | Phase 2 can't save anything |
| 0009 | `documents_storage` | Private `svap-documents` bucket, admin-only read policy, `purge_after` | Document uploads fail |
| 0010 | `payments` | `payments`, `payment_events` (idempotency), `visa_refusal_claims` | Checkout and webhooks fail |
| 0011 | `audit_log` | Append-only admin audit trail | Document views and refunds go unrecorded |

### Running them on an empty database

```bash
# 1. Point the CLI at your project (once)
supabase link --project-ref <your-project-ref>

# 2. Apply everything, in order
supabase db push

# 3. Confirm all 11 landed
supabase migration list
```

**Or by hand:** open the Supabase SQL editor and paste each file **in numeric
order**, 0001 → 0011, one at a time. Stop at the first error rather than
continuing — a partially applied migration set is worse than none.

### ⚠️ Step 4: expose the `svap` schema — nothing works without this

Every table lives in the **`svap` schema**, not `public`. Migration 0002 grants
the roles `USAGE` on it, but PostgREST additionally refuses to serve any schema
that isn't on its exposed list, and that list is **dashboard configuration, not
SQL** — no migration can set it.

> **Supabase Dashboard → Project Settings → API → Exposed schemas**
> Add `svap` alongside `public`, then save.

Skip this and every query fails with *"The schema must be one of the following"*
even though the tables exist and the grants are correct. It is the single most
likely reason a correctly-migrated project appears completely broken.

### Step 5: create your admin account

There is no sign-up flow in the admin panel, deliberately — an admin can read
every candidate's passport scan and issue refunds.

1. **Dashboard → Authentication → Users → Add user.** Use a real work email, set
   a password, tick **Auto Confirm User**.
2. Open `supabase/seed-admin.sql`, replace the email and full name, and run it
   in the SQL editor.

Start colleagues as `reviewer`; only give `super_admin` to people who genuinely
need to decrypt passport numbers and issue refunds.

### Step 6: verify the storage bucket exists

Migration 0009 creates the private `svap-documents` bucket. Confirm under
**Storage** in the dashboard that it exists and is **not** public. If it's
missing, 0009 didn't run.

### Two things worth knowing

**Some constraints were added `NOT VALID` on purpose** (countries, sectors,
ages). That means they apply to new and updated rows but don't reject existing
ones. There is no honest way to convert a Nigerian applicant from a previous
edition into a Ghanaian one, so old rows keep their real values for the audit
trail. Once legacy rows are archived, you can enforce retroactively:

```sql
alter table svap.candidatures validate constraint candidatures_pays_check;
```

**Migration 0005 rewrites data, not just structure.** It maps old pack names to
new ones and old visa-history answers to the new answer set. Take a database
snapshot before running it on anything with real applications in it.

---

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill it in. Generate every secret
with `openssl rand -hex 32`.

| Variable | Purpose | If missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | Public client | Nothing works |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes | Form submits, Phase 2 and payments all fail |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` | Transactional email | No emails go out; the app still works |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails | Links point at localhost |
| **`ACCESS_CODE_PEPPER`** | Hashes access codes | Codes can't be issued or verified — throws loudly |
| **`PHASE2_SESSION_SECRET`** | Signs the Phase-2 session cookie | Nobody can enter Phase 2 |
| **`CRON_SECRET`** | Authenticates the cron endpoint | **Codes are silently never sent** (route returns 404) |
| **`FIELD_ENCRYPTION_KEY`** | Encrypts passport numbers (32 bytes hex) | Phase-2 personal info can't be saved |
| `PAWAPAY_API_TOKEN`, `PAWAPAY_WEBHOOK_SECRET`, `PAWAPAY_ENV` | Mobile money (CM/KE/GH) | Mobile money unavailable; callbacks rejected |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Cards (all 6 countries) | Card payment unavailable |
| `FX_RATES_USD` | USD → local conversion | Mobile-money checkout throws |

⚠️ **`FIELD_ENCRYPTION_KEY` and `ACCESS_CODE_PEPPER` are effectively permanent.**
Losing the first makes stored passport numbers unrecoverable; rotating the second
invalidates every outstanding access code. Back both up separately from the
database.

---

## 2b. Email inventory

Seven transactional emails, all wired. Resend is the only provider.

| Email | Trigger | Recipient | Languages |
|---|---|---|---|
| Candidature reçue | Phase-1 submit, **pre-selected only** | Applicant | fr/en/ar |
| Décision — non éligible | Phase-1 submit, failed a gate | Applicant | fr/en/ar |
| Décision — pack complet | Phase-1 submit, cap reached | Applicant | fr/en/ar |
| Nouvelle candidature | Every Phase-1 submit | `ADMIN_NOTIFICATION_EMAIL` | fr/en/ar |
| **Code d'accès** | Cron, 72h after pre-selection | Applicant | fr/en/ar |
| **Code expire bientôt** | Cron, day 7 and day 12 of 14 | Applicant | fr/en/ar |
| **Reçu de paiement** | Payment webhook, on settlement | Applicant | fr/en/ar |
| Décision — validé / rejeté | Admin changes status | Applicant | fr/en/ar |

Notes that matter:

- The access-code email contains **no QR code**. Gmail strips `data:` images,
  remote images are blocked by default, and hosting the QR at a URL would put
  the code into server logs. A large tappable deep link achieves the same thing
  and works everywhere.
- The expiry reminder deliberately contains **no code** — it isn't recoverable
  (only the hash is stored), and a reminder is a lower-trust context.
- Receipts are sent from the **webhook only**, never from the browser's return
  from a hosted payment page — that would issue receipts for payments that never
  completed.

**Resend setup:** verify your sending domain in Resend and set
`RESEND_FROM_EMAIL` to an address on it. The fallback (`onboarding@resend.dev`)
only delivers to your own Resend account address — fine for local testing, and
silently useless for real applicants.

---

## 3. Scheduled job

One cron entry drives the entire access-code lifecycle. `vercel.json` already
declares it:

```json
{ "crons": [{ "path": "/api/cron/access-codes", "schedule": "0 * * * *" }] }
```

On each run it: issues and emails codes for applications pre-selected more than
72h ago; sends expiry reminders at day 7 and day 12; and expires codes past their
14-day window. Every step is idempotent, so a double-fire cannot double-send.

**Vercel injects the auth header for you.** When `CRON_SECRET` is set as an
environment variable, Vercel sends `Authorization: Bearer $CRON_SECRET` on cron
invocations — which is exactly what the route checks. Nothing else to wire.

⚠️ **Hobby plan caps crons at once per day.** Codes would then go out up to 24h
after the 72h mark rather than within the hour. Functional, but the Pro plan is
what makes the "sous 72 heures" promise on the site literally true.

**The endpoint returns 404 to unauthenticated callers by design** — so if the
secret is wrong, it will look like nothing is wrong while no codes are ever sent.
Check the logs for `Cron access-codes run:` after the first scheduled run.

---

## 3b. Domain and deployment

Production domain: **`siliconvalleyafricaprogram.com`**
Current Vercel URL: `https://svap-zeta.vercel.app`

### Configure these against the final domain, not the Vercel URL

Attach the domain in **Vercel → Settings → Domains** *before* registering the
URLs below. Three of these are painful to change afterwards, and re-doing them
risks leaving one pointing at a dead host.

| Where | Value | Notes |
|---|---|---|
| Vercel env | `NEXT_PUBLIC_SITE_URL=https://siliconvalleyafricaprogram.com` | Drives `metadataBase`, hreflang, the access-code deep link and the admin email link |
| pawaPay dashboard | `https://siliconvalleyafricaprogram.com/api/payments/webhooks/pawapay` | Same URL for Deposits, Refunds, Payouts and Checkouts — the adapter handles all four |
| Stripe → Webhooks | `https://siliconvalleyafricaprogram.com/api/payments/webhooks/stripe` | Subscribe to `checkout.session.completed`, `.expired`, `.async_payment_succeeded`, `.async_payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` |
| Resend → Domains | `siliconvalleyafricaprogram.com` | Add the SPF/DKIM/DMARC records. Then `RESEND_FROM_EMAIL="Silicon Valley Africa <programme@siliconvalleyafricaprogram.com>"` |
| Supabase → Auth → URL config | Site URL + `https://siliconvalleyafricaprogram.com/**` in redirect allowlist | Otherwise admin login redirects fail in production |

### If you want to test on the Vercel URL first

Everything works on `https://svap-zeta.vercel.app` — set `NEXT_PUBLIC_SITE_URL`
to it and register the same paths. Then when the domain is attached, update:

1. `NEXT_PUBLIC_SITE_URL` in Vercel env → redeploy
2. pawaPay callback URLs (editable in their dashboard)
3. Stripe webhook endpoint — **create a new one and copy the new signing
   secret**; the secret is per-endpoint, so pointing the old one elsewhere
   isn't enough
4. Resend domain verification — this one is genuinely domain-bound. Emails sent
   from an unverified domain land in spam, so if you only do one thing against
   the real domain first, make it this one.

### Deploy

```bash
vercel --prod
```

Vercel builds with `pnpm build`. Set every variable from §2 in
**Settings → Environment Variables** first — a missing `ACCESS_CODE_PEPPER` or
`FIELD_ENCRYPTION_KEY` throws at request time, not at build time, so the deploy
will succeed and the feature will fail.

---

## 4. Local development

```bash
pnpm install
pnpm dev                    # http://localhost:3000

# Stripe webhooks locally (separate terminal):
stripe listen --forward-to localhost:3000/api/payments/webhooks/stripe
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

Before shipping anything:

```bash
npx tsc --noEmit      # types
pnpm build            # production build
```

---

## 5. Test flows

Walk these in order. Flows 1–3 need only the database and email; flow 4 onwards
needs payment sandboxes.

### Flow 1 — A candidate who should be rejected

1. Go to `/fr/candidature`.
2. Step 1: fill identity, set **age 17**.
3. The form should refuse to advance — the age gate is the one criterion shown
   inline, because it states a fact rather than judging the person.
4. Set age 25, continue.
5. Step 2: pick a country, city, sector, pack.
6. Step 3: set **"Avez-vous un casier judiciaire ?" → Oui**, fill the rest,
   tick both consents, submit.
7. ✅ Expect `/fr/candidature/non-eligible?reason=casier_judiciaire`, with copy
   naming the criminal-record criterion, and stating no fee was charged.
8. ✅ In the admin, the row shows status **Non éligible** with the reason stored.

Repeat with **"4 refus ou plus"** → expect `reason=visa_refusals`.

### Flow 2 — A candidate who should pass

1. Same form, all criteria met. Write 60+ words of motivation.
2. ✅ The word counter turns terracotta past 150 words and submission is blocked.
3. Submit within the limit.
4. ✅ Expect `/fr/candidature/success` with the 72h / 14-day messaging.
5. ✅ Applicant receives the "candidature reçue" email; admin receives the new
   application notification.
6. ✅ Admin shows status **Présélectionné**.

**Also test:** refresh mid-form → the draft is restored with a "Recommencer"
button, and the **consent boxes are deliberately not restored**. Submit the same
email twice → the second is rejected with a duplicate-email error.

### Flow 3 — Access code

1. Either wait 72h, or temporarily set `sendDelayHours: 0` in
   `src/lib/constants/program.ts`, then trigger the cron:
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/access-codes
   ```
2. ✅ Response reports `{ issued: 1 }`; the applicant receives a code email with
   a `SVAP-XXXX-XXXX` code and an "Ouvrir la page" deep link.
3. ✅ The admin dossier shows issue/expiry dates but **never the code itself** —
   there is no plaintext anywhere to show.
4. Go to `/fr/documents`. Enter the **wrong name** with the right code.
   ✅ Expect one generic error that doesn't reveal which half was wrong.
5. Repeat 5 times. ✅ Expect the rate-limit message.
6. Enter the correct name (**try it with different accents and in reverse
   order** — "bekale koffi" must work) and the code.
   ✅ You land on `/fr/documents/informations`.
7. Close the tab, reopen `/fr/documents`. ✅ You skip the gate — the session
   carries you straight to your step. This is the lockout fix; confirm it.
8. Test "Renvoyer le code" with a **non-existent email**. ✅ Expect the same
   confirmation message as a real one — it must not reveal who is an applicant.

### Flow 4 — Phase 2 up to payment

1. Fill personal information. ✅ Try a passport expiry **in the past** — rejected.
   Try a birth date under 18 — rejected.
2. ✅ Submitted, you reach `/documents/evaluation`.
3. Fill the risk questionnaire. ✅ Try a two-word answer in "Engagements
   garantissant le retour" — rejected as too short.
4. ✅ You reach `/documents/paiement`, which shows your pack's exact fee and
   states that it covers verification, **not** a place.
5. ✅ Try navigating directly to `/fr/documents/pieces` — you're bounced back to
   the payment step. Uploads cannot happen before payment.

### Flow 5 — Payment (sandbox)

**Card (any country):** choose "Carte bancaire" → redirected to Stripe Checkout
→ pay with `4242 4242 4242 4242`, any future expiry, any CVC.
✅ The webhook marks the payment `paye`, the dossier advances, and a receipt email
arrives. ✅ Confirm the receipt shows the reference and amount.

**Mobile money (Cameroun / Kenya / Ghana):** choose "Mobile Money", enter a
sandbox MSISDN → ✅ you get the "Vérifiez votre téléphone" waiting state, which
polls. ✅ Leave it past 5 minutes to see the timeout copy, which deliberately does
**not** say the payment failed.

**Critical negative test:** replay a webhook Stripe has already delivered
(`stripe events resend <event_id>`). ✅ The second delivery must be acknowledged
without double-crediting — check that `svap.payments` still shows one paid row.

### Flow 6 — Documents and consents

1. Upload the ID front. ✅ Try a **`.txt` renamed to `.jpg`** — rejected, because
   validation reads the bytes, not the extension.
2. ✅ Try an SVG — rejected (it's a stored-XSS vector, not a photo).
3. ✅ Try an iPhone HEIC — either auto-converted by the browser, or rejected with
   the "choose Most Compatible" instruction.
4. Upload selfie + criminal record, fill the record's reference fields.
   ✅ Try a date **older than 3 months** — rejected.
5. ✅ Try to continue with a document missing — blocked, naming which one.
6. Tick all five consents (✅ there is no "accept all" — that's deliberate) and
   submit. ✅ You reach `/documents/termine` and the dossier status becomes
   **Vérification**.

### Flow 7 — Admin

1. Sign in at `/admin/login`.
2. ✅ `/admin/revue` lists the dossier, sorted by risk score, with any Phase-1
   contradictions flagged.
3. Open the dossier. ✅ The risk panel shows the score **with its per-factor
   breakdown** — never a bare number.
4. ✅ The passport shows as `••••••XX`. As a **reviewer**, there's no reveal
   button. As a **super_admin**, click it → the number appears and a warning says
   the view was logged.
5. Open a document. ✅ It opens in a new tab via a link that expires in 60s.
6. ✅ `/admin/journal` now shows `document.view` and `passport.reveal` entries,
   highlighted, with your identity and IP.
7. As super_admin, refund the payment. ✅ Status becomes **Remboursé** and a
   `payment.refund` entry appears in the journal.

### Flow 8 — Languages

For each of `/fr`, `/en`, `/ar`:
- ✅ Every nav link resolves; no missing-translation errors in the console.
- ✅ On `/ar`, the page is right-to-left, headings use the Arabic font, and
  **prices, dates and the access code still read left-to-right**.
- ✅ The CTA arrow points left in Arabic, right in French and English.
- ✅ Submit the form in Arabic → the confirmation email arrives in Arabic, RTL.

---

## 6. Promoting staging → production

You are testing on `https://svap-zeta.vercel.app`. Here is the order to move to
`siliconvalleyafricaprogram.com` without breaking anything mid-flight.

### The decision that comes first: one Supabase project, or two?

**Use a separate Supabase project for production.** Not optional in my view:

- Your staging database will be full of test candidatures, fake passport
  numbers and sandbox payments. Launching on top of that means real applicants
  share a table with junk, and the pre-selection **capacity caps count test
  rows** — 24 test Lauréat applications would close the pack before a single
  real one arrived.
- Sandbox payment references would sit alongside live ones in the same
  `payments` table, making reconciliation guesswork.
- A staging service-role key leaking is then an embarrassment, not a breach of
  real passport data.

Creating one means running §1 again against the new project: migrations, expose
the `svap` schema, seed an admin, verify the bucket.

⚠️ **If you instead reuse the staging project, `ACCESS_CODE_PEPPER` and
`FIELD_ENCRYPTION_KEY` must carry over unchanged** — changing them orphans every
issued code and makes stored passport numbers undecryptable. With a fresh
project, generate fresh secrets.

### Order of operations

**1 — Domain**
Vercel → Settings → Domains → add `siliconvalleyafricaprogram.com`, follow the
DNS instructions, wait for the certificate.

**2 — Resend** *(start early; DNS propagation is the slow part)*
Add the domain in Resend, publish the SPF/DKIM/DMARC records, wait for
verification. Emails from an unverified domain go to spam.

**3 — Production Supabase project**
Run §1 end to end against it. Note the new URL, anon key and service-role key.

**4 — Environment variables** — set for the **Production** environment only in
Vercel. Preview keeps pointing at staging.

| Variable | Change |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://siliconvalleyafricaprogram.com` |
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Production project |
| `ACCESS_CODE_PEPPER`, `PHASE2_SESSION_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET` | Fresh values — `openssl rand -hex 32` each |
| `RESEND_FROM_EMAIL` | An address on the verified domain |
| `PAWAPAY_ENV` | `sandbox` → `live` |
| `PAWAPAY_API_TOKEN` / `PAWAPAY_WEBHOOK_SECRET` | Live credentials — **different from sandbox** |
| `STRIPE_SECRET_KEY` | `sk_test_…` → `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | From a **new live-mode endpoint**, see below |
| `FX_RATES_USD` | Current rates — see the warning in §2 |

**5 — Payment providers, in live mode**

- **Stripe:** switch the dashboard to live mode, create a webhook endpoint at
  `https://siliconvalleyafricaprogram.com/api/payments/webhooks/stripe`,
  subscribe to the four `checkout.session.*` events, copy the new signing
  secret. Test-mode and live-mode endpoints are separate objects with separate
  secrets.
- **pawaPay:** switch to the live environment, set all four callback URLs to
  `https://siliconvalleyafricaprogram.com/api/payments/webhooks/pawapay`,
  generate the live API token and webhook secret.

**6 — Supabase Auth**
Authentication → URL Configuration → Site URL
`https://siliconvalleyafricaprogram.com`, and add `.../**` to the redirect
allowlist. Otherwise admin login breaks in production.

**7 — Deploy and verify**

```bash
vercel --prod
```

Then, on the live domain:
- Submit one real application end to end and confirm the email arrives from the
  verified domain, not in spam.
- Force a cron run and confirm `Cron access-codes run:` appears in the logs.
- Make one real low-value payment (a $20 Lauréat fee) with a real card, confirm
  the receipt, then **refund it from the admin** to confirm that path works
  before you need it under pressure.

### After launch, before announcing

Check `svap.candidatures` contains **no test rows**. If any leaked in, delete
them — they consume pre-selection capacity that belongs to real applicants.

---

## 7. Before going live

- [ ] Replace `FX_RATES_USD` with a live rate feed — the manual table **will**
      go stale and either under- or over-charge candidates.
- [ ] Have counsel complete every block marked ⚠️ on the four `/legal/*` pages
      (jurisdiction, liability, DPO identity, hosting, retention).
- [ ] Get the Arabic translation professionally reviewed — the legal, refund and
      consent copy in particular.
- [ ] Switch `PAWAPAY_ENV` to `live` and swap Stripe test keys for live ones.
- [ ] Confirm Stripe underwriting has cleared the business — a rejection after
      launch would stop all card revenue.
- [ ] Verify the cron actually fired (check for `Cron access-codes run:` in logs).
- [ ] Decide the three open client questions: Business Visitor visa-refusal
      premium, Délégué decision stage, and fixed-72h vs. SLA code timing.
- [ ] Build a retention job that acts on `phase2_documents.purge_after`.
