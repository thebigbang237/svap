# Legal pages — what is filled, what is outstanding

The legal pages used to publish a visible banner reading *"Section to be
completed by First Of All LLC's legal counsel before public launch"*. On a live
site that is worse than an omission: it tells every visitor, and any regulator
who looks, that the operator's own legal pages are a draft.

That banner is gone. Sections still marked `pending: true` in
`messages/{fr,en,ar}.json` are now **filtered out of the public page entirely**
(`src/app/[locale]/legal/[document]/page.tsx`). Nothing unfinished is shown.

**To publish one:** write the real `body` (and `items` if it needs a list) in
all three locales, then delete the `pending` flag. The section appears by
itself — no code change.

---

## Filled from the codebase (2026-09-11)

These are statements of fact about the running system, not legal
determinations, which is why they could be written without counsel.

| Page | Section | Source of truth |
|---|---|---|
| Mentions légales | Hébergement | `vercel.json`, `src/lib/supabase/*`, `src/lib/resend/*`, `src/lib/payments/registry.ts` |
| Confidentialité | Sous-traitants et destinataires des données | the same, enumerated per provider |

Named there: **Vercel Inc.** (site + admin), **Supabase Inc.** (database, uploaded
documents, backups), **Resend** (transactional email), **pawaPay** (Mobile Money),
**Paiement Pro** (card).

⚠️ If any of the six jurisdictions requires the host's **full postal address and
telephone number** — French law does, for example — those must be added to the
Hébergement section. Naming the company and country is what can be verified from
the code; the rest has to be copied from each provider's own legal notice.

---

## Outstanding — needs the client

Six sections. Each is hidden until answered.

### 1. Mentions légales → *Numéros d'immatriculation et représentant légal*

- [ ] Company registration number of First Of All LLC (and the issuing state/registry)
- [ ] Registration numbers of the two subsidiaries, if they are publishers of the site
- [ ] VAT / tax number, if any
- [ ] Full postal address of the registered office
- [ ] Name of the **directeur de la publication** (the person legally responsible for site content)
- [ ] A contact email or phone for legal notices

### 2. Confidentialité → *Délégué à la protection des données (DPO)*

- [ ] Is a DPO formally appointed? (The privacy policy currently asserts one is — see the risk note below.)
- [ ] Name of the DPO or of the person handling data-protection requests
- [ ] A direct contact address for exercising access / rectification / erasure rights

### 3. Confidentialité → *Durée de conservation* — **see the risk note below**

- [ ] Retention period for candidature data (as opposed to identity documents)
- [ ] What happens to a dossier after the edition closes: deleted, archived, or carried forward?

### 4. Confidentialité → *Transferts internationaux et base légale*

Counsel's call, not the client's alone:

- [ ] Legal basis for the processing (consent, contract performance, or both — likely differs between Phase 1 and Phase 2)
- [ ] Framework covering transfers out of the candidate's country of residence to US-hosted infrastructure
- [ ] Whether standard contractual clauses are in place with Vercel and Supabase

### 5. Conditions générales → *Responsabilité, droit applicable et juridiction compétente*

- [ ] Limitation of liability
- [ ] Force majeure
- [ ] Terms on modifying or cancelling the programme
- [ ] Governing law and competent court, for **each of the six countries** — consumer-protection rules generally prevent a US forum being imposed on a consumer in Morocco or Cameroon, so this is unlikely to be a single clause

### 6. Primes → *Réclamations et voies de recours*

- [ ] How a candidate contests a refused or late prime payment
- [ ] Contractual time limit for handling a claim
- [ ] Escalation route (mediation, arbitration, courts) per jurisdiction

---

## ⚠️ Risk note: two published claims the code does not currently support

Both sit in **non-pending** text, so they are live on the site right now.

### Automatic deletion of identity documents

The privacy policy states that identity documents are kept 12 months and then
**deleted automatically**. In the code, `src/app/api/documents/pieces/route.ts`
stamps a `purge_after` date on every upload — and **nothing ever reads it**.
There is no purge job (`src/app/api/cron/` holds only `access-codes` and
`payments`). Passport scans, ID photos, liveness selfies and criminal-record
extracts are retained indefinitely.

This is a promise to candidates about their most sensitive data, so the fix
should be the implementation rather than a softened sentence:

- a cron route that deletes storage objects and rows past `purge_after`
- wired to GitHub Actions like the other two jobs (Vercel Hobby caps cron at daily)

Until one exists, the sentence is inaccurate.

### An appointed DPO

The privacy policy and `/confiance` both state that a data protection officer
**is appointed**. If that is not yet true, the claim should come out until it
is — it is exactly the kind of statement a regulator checks first.

---

## Where the copy lives

| Page | Key in `messages/{fr,en,ar}.json` |
|---|---|
| Mentions légales | `legal.mentions-legales.sections` |
| Confidentialité | `legal.confidentialite.sections` |
| Conditions générales | `legal.conditions-generales.sections` |
| Primes | `legal.primes.sections` |

All three locales must be edited together — a section present in `fr` but absent
in `ar` will throw at render for Arabic visitors.
