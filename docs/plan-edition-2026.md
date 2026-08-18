# SVAP — Édition 2026 rework plan

Derived from the client's specification document (First Of All LLC, "Silicon Valley Africa
Program — Édition 2026"), compared against the code at commit `3d0b453`.

**Bottom line:** the current site is a single-phase, paid-application marketing site for 4
packs across 15 countries. The spec describes a **two-phase, free-to-apply, code-gated
funnel** for 5 packs across 6 countries, with KYC document capture, payment, risk scoring,
and a trilingual (FR/EN/**AR-RTL**) front end. Most marketing copy, the entire application
flow, the database schema, and the admin tool need reworking. The visual design system,
the i18n plumbing, and the admin auth layer survive intact.

---

## 1. Blocking decisions (resolve with the client before building)

These are contradictions or gaps **inside the client's own document**. Each one changes
code, so they need answers before the relevant workstream starts.

### Resolved — 2026-08-17

A client session that reversed two decisions taken on 2026-08-11 and added one feature.
These supersede anything below that contradicts them.

| # | Issue | Decision |
|---|---|---|
| 6b | **Refunds** (reverses #6 below) | **Verification fees are NOT refundable**, in any case. They pay for work performed as soon as payment clears. The refund promise is removed from every public surface — payment step, receipt email, FAQ, /confiance, CGV, status emails. The super-admin reversal survives for billing errors only (double charge, wrong amount, provider incident, chargeback), relabelled "exceptionnel". |
| 4b | **Primes** (resolves #4 below) | What replaces the refund. Paid when a **validated** dossier is subsequently refused a US visa: Lauréat $1,000, Boursier $500, VIP Visitor $4,500. Business Visitor and Délégué carry none — the omission is intentional. Subject to documentary proof of the consular refusal and an internal audit, paid within 60 days. `svap.visa_refusal_claims` already models this. |
| 14 | **Pack places are an admission ceiling, not an application quota** | Nothing closes at the door. Every eligible candidate is pre-selected and may complete Phase 2; `places` is applied when the verified dossiers are ranked. `preselectionCapMultiplier` and `preselectionCap()` are removed, and the Phase-1 capacity COUNT query with them. The `complet` status and `pack_full` reason are retained for legacy rows and for a manual close. |
| 15 | **Pack-specific capacity dossier** (new Phase-2 step) | Per the client's "Cadre de vérification financière". Lauréat: project summary (+ optional evidence of progress). Boursier: $5,000 bank attestation, proof the flight can be funded, travel insurance, project summary. Business Visitor: ≈ $13,940 (flight $4,940 + $1,500 × 6 days) with bank attestation, source of funds, 2 months of statements, insurance. VIP Visitor: same pieces on ≈ $20,940 (+ $7,000 sponsoring). Délégué: nothing, step skipped. **The programme never receives these amounts** — the candidate books and pays their own travel. |
| 16 | **Press page** (new feature) | `/actualites` — cards (thumbnail, outlet, date, title, caption) that link out to the publisher. Not a blog: no body, no slug, no reading view, nothing reproduced on this domain. Admin CRUD with thumbnail upload to a public bucket; writes are audited. |

### Resolved — 2026-08-11

| # | Issue | Decision |
|---|---|---|
| 2 | Délégué age "17 à 65" vs. global 18+ | **18+ everywhere, no exceptions.** Délégué range becomes 18–65. Removes the guardian-consent problem entirely; auto-preselection needs no per-pack branch. |
| 3 | Délégué pay "4 mois (octobre, novembre, décembre)" | **3 months → $600 total.** Copy says "200 USD/mois pendant 3 mois (octobre, novembre, décembre)". |
| 5 | VIP $7,000 sponsoring | **Out of scope for the site.** Handled offline by the administration. The site collects only the $330 verification fee for VIP, like Business Visitor. The $7,000 stays in the pack description as disclosure, with no on-site payment path and no refund logic. |
| 6 | Refund policy self-contradiction | ~~**Phase-2 fees ARE refundable** on administrative or eligibility rejection.~~ **Superseded 2026-08-17 by #6b — fees are not refundable at all.** The Stripe/pawaPay refund capability is kept regardless, for billing errors and chargebacks. |
| 9 | Payment rails named in public copy | **pawaPay + Stripe confirmed.** Flutterwave stays as fallback *if* the account is approved; if not, pawaPay + Stripe are sufficient. §7 (trust table), §8, §14 and the FAQ must be rewritten to name the actual providers — the anti-fraud promise ("any payment outside the official site is fraud") only holds if the named rails match reality. |

### Still open

| # | Issue | Why it blocks |
|---|---|---|
| 1 | **Délégué has no pack card in §4** but appears in the fee table, the Phase-1 pack dropdown, and gets its own §6. | **Drafted** — see [copy-delegue-fr.md](copy-delegue-fr.md). Client approves text rather than answering an open question. Four sub-points still need a decision, listed at the end of that file (notably: how the 600 USD is paid, and whether "éligibilité garantie Lauréat 2027" means guaranteed *admission* or guaranteed *review*). |
| 4 | ~~**Business Visitor has no visa-refusal prime**~~ | **Resolved 2026-08-17 (#4b): intentional.** |
| 7 | **ID document**: Phase-2 intro says "recto/verso", Étape 3 table lists only "verso". | Building both unless told otherwise. |
| 8 | **Code timing**: "envoyé 72 heures après le dépôt" (fixed delay) vs FAQ "sous 72 heures" (SLA). | Scheduled job at T+72h vs. send-on-approval. Different infrastructure. |
| 10 | **Hero stats**: site says "250 Leaders / 10 Pays". Spec totals **200 participants** (12+63+104+21) + 60 delegates, across **6 countries**, **75 bourses** (site says 110). | Public numbers. Confirm the headline figures. |
| 11 | **Testimonial + media sections** are marked "À compléter avant publication avec des références réelles et vérifiables." | `/media` and the Onana testimonial ship as empty states until real assets arrive. Same for the certification claim ("reconnu par les chambres de commerce") and the OAPI/EUIPO/USPTO trademark claims — these are verifiable assertions on a page whose whole job is proving legitimacy. |
| 12 | Phase-1 asks refusals as "1 à 3 / 4 ou plus"; Phase-2 asks "Aucun / 1 / 2 / 3". | Intentional cross-check for inconsistency (fraud signal) — implementing it as one, but confirm. |
| 13 | Spec has **two "Étape 4"** sections (risk questionnaire + consents). | Renumbering to Étape 4 and Étape 5. No client input needed. |

---

## 2. Content model changes

A single source of truth in `src/lib/constants/program.ts` — packs, fees, places, countries,
sectors — consumed by the forms, the pack cards, the DB check constraints, and the emails.
Today these are duplicated between `candidature-options.ts` and `messages/*.json`.

### Packs — `invite` and `ambassadeur` are gone

| Slug | Name | Places | Phase-2 fee | Notes |
|---|---|---|---|---|
| `laureat` | Lauréat | 12 | $20 | Full scholarship incl. flight. Prime $1,000. |
| `boursier` | Boursier | 63 | $30 | Partial — flight at candidate's cost. Prime $500. |
| `delegue` | Délégué | 60 | $30 | Paid role (18–65), not a trip: $200/mo × 3 months = $600. See decision #1. |
| `business_visitor` | Business Visitor | 104 | $330 | Self-funded, auto-selected if eligible. |
| `vip_visitor` | VIP Visitor | 21 | $330 | $7,000 sponsoring disclosed in copy but **handled offline** — the site only ever charges $330. Prime $4,500. |

Migration: `invite` → `business_visitor`, `ambassadeur` → `vip_visitor` on existing rows.

### Countries — 15 → exactly 6

`zaf`, `mar`, `cmr`, `ken`, `gha`, `egy`. Drop Nigeria, Senegal, Côte d'Ivoire, Rwanda,
Ethiopia, DRC and the `other_*` catch-alls. The homepage hero flag row and the "10 Pays"
stat both reference the old list. Rationale for the copy: these are the countries still
broadly eligible for B1/B2.

### Sectors — 7 → 12

Banque & Finance, Tech & Digital, Télécoms, Commerce, Industrie, Agriculture, Énergie,
Santé, Immobilier & BTP, Conseil, Administration, Autre.

### Every "frais de candidature" claim is now wrong

`PackCard` renders "Frais de candidature : $50 / $30". Phase 1 is **free for all packs** —
this is the spec's stated founding principle and it appears on the pack cards, the packs
page, the candidature page, and the FAQ. All of it becomes "Candidature gratuite — frais de
vérification $X uniquement si pré-sélectionné."

### Pages

| Page | State |
|---|---|
| `/` | Rework stats, hero flags, bourse teaser (110 → 75), delegate section |
| `/admission` | Rewrite — eligible/ineligible profiles in the spec bear no resemblance to current copy |
| `/packs` | Rewrite — 5 packs, free Phase 1, new process steps |
| `/agenda` | Rewrite — spec's 6 days have different cities, times, and venues |
| `/candidature` | Rework — 10 fields → 20 |
| `/candidature/success` | Rework — 72h access-code messaging |
| `/documents` | **New** — Phase-2 portal (multi-step) |
| `/delegues` | **New** — §6 |
| `/faq` | **New** — 12 Q&As from §12 |
| `/confiance` | **New** — §7 + §8 |
| `/media` | **New** — §11, empty state until real assets |
| `/legal/{mentions,confidentialite,cgv,primes}` | **New** — §8 requires privacy reachable from every page. `remboursement` → `primes` on 2026-08-17, with the policy it documents |
| `/actualites` | **New (2026-08-17)** — press coverage, cards linking out to publishers |

---

## 3. Arabic + RTL

The codebase is unusually well-positioned: only **10 directional utility usages** across 5
files, so the RTL audit is small. The real work is fonts and bidi text.

1. **Routing** — `routing.ts` locales `['fr','en','ar']`, default `fr`. Add `messages/ar.json`.
2. **Direction** — `<html dir={locale === 'ar' ? 'rtl' : 'ltr'}>` in `[locale]/layout.tsx`.
   Tailwind v4's `rtl:` variant keys off this automatically.
3. **Fonts** — EB Garamond has **no Arabic glyphs**; Inter's Arabic coverage is not usable
   for body text. Add an Arabic pair (proposal: *Noto Kufi Arabic* display + *IBM Plex Sans
   Arabic* body) and rebind `--font-serif` / `--font-sans` under `[lang="ar"]` in
   `globals.css`. Arabic needs a slightly larger optical size and looser line-height than
   the Latin scale — the current `text-[32px]/[42px]` headings will look cramped.
4. **Logical properties** — convert the 10 hits in `PackCard`, `AgendaDayCard`,
   `admission/page`, `packs/page`, `candidature/page` to `ms-`/`me-`/`ps-`/`pe-`/
   `text-start`/`text-end`/`border-s`/`border-e`/`start-`/`end-`. Add an ESLint rule to
   keep them out going forward.
5. **Icons** — `ArrowRightIcon` points the wrong way in RTL. Add `rtl:-scale-x-100` to
   directional icons; leave `LockIcon`, `CrossIcon`, `MenuIcon` alone.
6. **Bidi isolation (easy to get wrong)** — the access code `SVAP-XXXX-XXXX`, email
   addresses, phone numbers, passport numbers, and USD amounts must be wrapped in
   `<span dir="ltr">` or they render scrambled inside Arabic paragraphs. This affects the
   Phase-2 portal, the emails, and the admin tool.
7. **Numerals** — recommend forcing Western digits (`numberingSystem: 'latn'`) for prices
   and codes via next-intl's formatter, so a candidate reading `٣٣٠` doesn't mistype it.
8. **LocaleSwitcher** — 3-way; its `/` separator and `mx-1` need the logical treatment.
9. **Metadata** — `layout.tsx` currently hardcodes a French title/description. Move to
   `generateMetadata` with per-locale copy and `alternates.languages` hreflang.
10. **Emails** — react-email templates need `dir="rtl"` and a *system* Arabic font stack;
    webfonts are unreliable in mail clients.

Translation volume: `messages/*.json` is 481 lines today and will roughly triple with the
new pages and the Phase-2 form. Budget for professional Arabic translation of ~1,400 lines
— machine translation of legal/refund/consent text is not defensible on a site whose
premise is trustworthiness.

---

## 4. Payments

### The coverage problem

pawaPay is mobile-money only and **covers 3 of your 6 countries**:

| Country | pawaPay mobile money | Card required? |
|---|---|---|
| Cameroun | ✅ MTN, Orange | optional |
| Kenya | ✅ M-Pesa | optional |
| Ghana | ✅ MTN, AirtelTigo, Vodafone | optional |
| **Maroc** | ❌ not supported | **mandatory** |
| **Égypte** | ❌ not supported | **mandatory** |
| **Afrique du Sud** | ❌ not supported | **mandatory** |

So card processing is not a nice-to-have — without it, half your target markets cannot pay
at all. Morocco, Egypt, and South Africa are also where the $330 packs will concentrate.

### Decided

**pawaPay (mobile money, CM/KE/GH) + Stripe Checkout (cards, all 6)**, behind a
provider-agnostic interface. **Flutterwave is the fallback for local card acquiring in
MA/EG/ZA — contingent on account approval**; if the account isn't granted, pawaPay + Stripe
ship as the complete solution. Build the abstraction either way so adding Flutterwave later
is a config change, not a refactor.

Since the site publicly names its payment rails as an anti-fraud guarantee, the FR/EN/AR
copy in §7, §8, §14 and the FAQ must name **pawaPay and Stripe** (plus Flutterwave only if
it actually goes live). Shipping copy that promises CinetPay/Flutterwave while charging via
Stripe would tell candidates their own legitimate payment looks like fraud.

Why Stripe as primary card rail: First Of All LLC is a US entity (Santa Fe), so USD
settlement is native; hosted Checkout keeps you in PCI SAQ-A, which is what satisfies the
spec's "Aucune donnée de carte bancaire stockée"; and the refunds API is a hard requirement
for the §9 refund policy.

Two risks to clear **before** writing integration code:

- **Stripe underwriting.** Visa/immigration-adjacent services with large upfront fees and
  a $7,000 tier attract review. Get the business pre-cleared with Stripe rather than
  discovering a rejection mid-build.
- **Card acceptance.** Many African-issued debit cards are domestically restricted and will
  decline on a US acquirer. This is exactly what Flutterwave/dLocal's local acquiring
  solves. Design for the fallback from day one.

Alternatives considered: **Flutterwave alone** could serve both rails and is what the spec
already promises publicly (no copy rewrite) — but it becomes a single point of failure for
all revenue. **Paystack** doesn't cover Morocco or Cameroon. **dLocal** is the best
technical fit for exactly this shape (US entity, local collection in all 6, USD settlement)
but is an enterprise contract with volume minimums.

### Architecture

```ts
interface PaymentProvider {
  id: "pawapay" | "stripe" | "flutterwave";
  supports(country: Country, method: PaymentMethod): boolean;
  createCheckout(input: CheckoutInput): Promise<{ redirectUrl?: string; providerRef: string }>;
  verifyWebhook(req: Request): Promise<WebhookEvent>;   // raw body — see below
  getStatus(providerRef: string): Promise<PaymentStatus>;
  refund(providerRef: string, amountUsd: number): Promise<RefundResult>;
}
```

Non-negotiables:

- **Never trust the client-side success redirect.** Status advances only on a verified
  webhook or a server-side `getStatus` poll.
- **Raw body for signature verification** — `await request.text()` in the webhook route
  handlers, before any JSON parsing.
- **Idempotency** via a `unique` constraint on `payment_events.provider_event_id`;
  providers retry, and double-crediting a verification fee is a support nightmare.
- **FX locking.** Fees are quoted in USD but pawaPay collects XAF/KES/GHS. Store
  `amount_usd`, `amount_local`, `currency`, `fx_rate`, `fx_locked_at` at checkout creation
  so the receipt matches what the candidate was shown.
- Webhook routes live at `/api/payments/webhooks/{pawapay,stripe}` and must be excluded
  from the `proxy.ts` matcher (it currently excludes `/api`, so this is already correct).

---

## 5. Application flow

> Fully specified in **[flow-edition-2026.md](flow-edition-2026.md)** — the state machine,
> what auto-pre-selection can and cannot decide, the per-pack decision stages, and the UX.
> Three structural issues surfaced there need resolving before W5/W6: seat capacity vs.
> unlimited automatic pre-selection, the single-use code locking candidates out of a
> multi-step form, and the position of the payment step.

### Phase 1 — free eligibility form

Fields go from 10 to 20. New: `age`, `ville`, `marie`, `enfants`, `source` (how they heard)
with a conditional `delegue_nom`, `lien_pays`, and two mandatory consent checkboxes.
`casier_judiciaire` becomes an enum (`non` / `oui`) instead of free text, and
`visa_historique` changes options entirely. Motivation is capped at 150 words (currently a
50-character minimum with a "300 mots max" label — both wrong).

**Auto-preselection** (spec §5: "toute candidature complète et satisfaisant les critères est
pré-sélectionnée"), evaluated server-side on submit:

```
eligible = age >= 18                       // all packs, no exceptions (decision #2)
        && casier_judiciaire == "non"
        && visa_refusals != "4_plus"
```

Délégué additionally caps at 65. A single uniform rule — no per-pack branching — which also
means no minors ever reach the Phase-2 document upload.

Ineligible → rejected with "reste éligible pour les éditions suivantes" messaging, no fee,
no code. Eligible → `preselectionne`, code scheduled for T+72h.

### Access codes

Format `SVAP-XXXX-XXXX`. Requirements from §5, all server-side:

- Generated from a CSPRNG, **stored as a hash only** — never plaintext in the DB, never
  displayed in the admin (the spec is explicit about this).
- Bound to full name + email; Phase-2 entry requires **both** name and code to match.
- Single use, **14-day expiry**, with a reminder email before expiry.
- "Renvoyer le code" flow, itself rate-limited.
- Attempt limiting (proposal: 5 per code per hour, 20 per IP per hour) with every attempt
  logged — the spec calls for this twice.
- QR code embedded in the email (encoding the portal URL + code).

### Phase 2 — `/documents`

Gate → **payment** → personal info → identity documents → risk questionnaire → consents.
Payment comes first by design ("Paiement requis AVANT le lancement des vérifications").

Document capture (ID recto/verso, liveness selfie, criminal record extract <3 months) is
the highest-sensitivity part of this build:

- Private Supabase Storage bucket; **no direct-to-bucket uploads with the anon key** —
  everything goes through a server route that validates MIME type, size, and ownership.
- Randomized storage paths; admin viewing via short-TTL signed URLs only.
- Passport number encrypted at the application layer (AES-GCM, key in env/KMS), not stored
  as plaintext alongside the scan.
- Explicit retention policy — the spec promises a right to erasure and a designated DPO.

Risk questionnaire (§Étape 4) produces a stored score. The spec mentions "Score de risque
attribué à chaque dossier"; the scoring weights aren't specified, so I'd implement a
transparent, admin-visible rubric rather than a black box, and cross-check the Phase-2
answers against Phase-1 for contradictions.

---

## 6. Database

Five migrations, additive where possible:

- `0005_phase1_rework` — pack constraint + data migration, 6-country constraint, `ar` locale,
  new Phase-1 columns, expanded status enum (`preselectionne`, `code_envoye`,
  `phase2_en_cours`, `phase2_paye`, `verification`, `valide`, `rejete`).
- `0006_access_codes` — `access_codes` (hash, expiry, used_at, resend_count) +
  `access_code_attempts` (rate limiting + audit).
- `0007_phase2` — `phase2_applications`, `phase2_documents`, `risk_assessments`, `consents`.
- `0008_payments` — `payments`, `payment_events` (unique provider event id),
  `visa_refusal_claims` (the prime payouts).
- `0009_audit` — append-only `audit_log` for every access and payment (§8 requirement).

RLS note: the current "Anyone can submit a candidature" insert-only policy works for Phase 1
and should stay. Phase-2 tables get **no anonymous policy at all** — access is via the
service role behind the code-gated server routes, since the candidate has no Supabase
session.

`src/lib/supabase/types.ts` is hand-written and will drift badly at this size. Switch to
generated types (`supabase gen types typescript`).

---

## 7. Admin

Currently a French-only list + detail view with status changes. Needs: Phase-2 review queue,
secure document viewer (signed URLs, and view events written to the audit log), payment and
refund tracking, access-code management (resend/revoke — never reveal), risk-score display,
prime/payout tracking for visa refusals, and an audit-log viewer. The `super_admin` /
`reviewer` role split already exists in `admin_profiles` but isn't enforced anywhere —
payouts and document access should be `super_admin`-only.

---

## 8. Sequencing

| # | Workstream | Depends on | Rough size |
|---|---|---|---|
| **W0** | Remaining client decisions §1, final FR copy, Stripe + pawaPay account approval (+ Flutterwave attempt) | — | partly unblocked |
| **W1** | `ar` locale, RTL, fonts, logical properties, `program.ts` constants | W0 (#10) | S–M |
| **W2** | Marketing pages rewrite + new pages | W0, W1 | M |
| **W3** | Phase-1 form, auto-preselection, migration `0005`, emails | W0 (#1) | M |
| **W4** | Access codes: generation, hashing, QR, expiry, resend, rate limit | W3, W0 (#8) | M |
| **W5** | Phase-2 portal, uploads, storage security, risk questionnaire | W4 | L |
| **W6** | Payment abstraction, pawaPay, Stripe, webhooks, receipts, refunds | account approvals only | L |
| **W7** | Admin rework | W5, W6 | M |
| **W8** | Encryption, retention, DPO page, CSP, rate limiting, security review | throughout | M |

W1 and W2 can run alongside W3/W4. W5 and W6 are the long poles and are largely
independent of each other until the Phase-2 payment step joins them.

Realistically **6–10 weeks** for one developer, with W0 starting immediately since the
client answers gate almost everything else.

---

## 9. Notes carried forward

- `AGENTS.md` warns this is a Next.js version with breaking changes from training data —
  read `node_modules/next/dist/docs/` before writing. Confirmed already: proxy config lives
  in `src/proxy.ts` (not `middleware.ts`), and `PageProps<'/[locale]'>` is the typed params
  convention.
- The design system is deliberately flat: zero border-radius except `rounded-full` pills
  (see the comment block in `globals.css`). New Phase-2 UI must match.
- The existing duplicate-email unique index (`0004`) means a candidate cannot re-apply.
  With a 14-day code expiry and a "request a new code" path, confirm that re-submission
  after expiry is meant to be blocked.
