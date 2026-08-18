# Funnel spec — Édition 2026

The end-to-end candidate flow, resolved to the level a state machine can be built from.
Companion to [plan-edition-2026.md](plan-edition-2026.md); source is §2, §5, §13 and §14 of
the client's specification.

> **Superseded in part — client session of 2026-08-17.** Three decisions in this document
> were reversed or resolved by the client and are now implemented differently: verification
> fees are **not refundable**; pre-selection caps are **removed** (a pack's `places` is the
> number admitted at the end, not a quota at the door); and Phase 2 gained a **pack-specific
> capacity step**. Each affected section below carries a note. See §10.

---

## 1. The flow, end to end

```
  ┌─ PHASE 1 ──────────────────────────────────────────────────────────┐
  │  Free eligibility form (20 fields, no payment, no account)         │
  │              │                                                     │
  │              ▼                                                     │
  │  Automatic pre-selection — server-side, 4 hard gates               │
  │         ┌────┴────┐                                                │
  │    ineligible   eligible                                           │
  │         │          │                                               │
  │         ▼          ▼                                               │
  │   rejected    code generated (hashed), scheduled for T+72h         │
  │   (no fee,         │                                               │
  │    re-apply        ▼                                               │
  │    next edition)  email: SVAP-XXXX-XXXX + QR, valid 14 days        │
  └────────────────────┼───────────────────────────────────────────────┘
                       ▼
  ┌─ PHASE 2 ── /documents ── gated on full name + code ───────────────┐
  │  Étape 0  portal: name + code  →  exchanges code for a session     │
  │  Étape 1  personal information + risk questionnaire                │
  │  Étape 2  payment (pack fee)          ← see §4, order changed      │
  │  Étape 3  identity documents + criminal record                     │
  │  Étape 4  capacity dossier (pack-specific — Délégué skips it)      │
  │  Étape 5  consents                                                 │
  └────────────────────┼───────────────────────────────────────────────┘
                       ▼
             verifications launch automatically
             (identity, documents, criminal record, risk scoring)
                       │
              ┌────────┴─────────┐
       verification fails   verification passes
              │                   │
              ▼                   ▼
      fraud → rejected,      DECISION — differs per pack, see §3
      no prime due                │
      (fees never refunded)       ▼
                          validated → invitation letter,
                          embassy confirmation letter, visa support
```

Phase 1 is free for every pack. No fee is ever charged before pre-selection. That is the
document's founding principle and it constrains everything downstream.

---

## 2. What "automatic pre-selection" can actually decide

The specification lists eligibility criteria under §2, but they are not all the same kind of
thing. Only four are mechanically checkable from the Phase-1 form:

| Criterion | Auto-checkable | How |
|---|---|---|
| Resident/national of the 6 countries | ✅ | The form only offers those six, so this is satisfied by construction |
| Age ≥ 18 | ✅ | `age >= 18`, all packs (client decision, 2026-08-11) |
| Clean criminal record | ✅ | Self-declared `casier_judiciaire = non` |
| Fewer than 4 US visa refusals | ✅ | `visa_historique != refus_4_plus` |
| "Motivation sincère à participer et à contribuer à sa communauté" | ❌ | Qualitative |
| "Volonté confirmée de retour dans son pays d'origine" | ❌ | Qualitative |
| "Personnes cherchant uniquement un visa … sans engagement réel" | ❌ | Qualitative |

So the automatic gate is:

```ts
eligible =
     age >= 18
  && casierJudiciaire === "non"
  && visaHistorique !== "refus_4_plus"
  && paysIsParticipating   // always true given the form's options
```

The three **critères de sélection** (Motivation · Impact du voyage · Retour au pays) are
explicitly qualitative and cannot gate Phase 1. They belong to the dossier review in §3 —
which is consistent with the document itself, since §2 says scholarship allocation is
"non automatique" and "sur dossier après étude approfondie".

Two design consequences:

- **Evaluate server-side, at submit only.** No live "you are disqualified" as the user
  types. Live disqualification teaches the applicant exactly which answer to change, and
  the three gating questions are all self-declared. Server-side evaluation at submit,
  cross-checked against the Phase-2 answers later, is both better UX and harder to game.
- **A rejection is not a dead end.** Copy per §9: no fee was charged at Phase 1, and the
  dossier stays eligible for future editions.

---

## 3. The decision stage differs per pack — and this is where the money problem is

Pre-selection is automatic for everyone. What happens *after* verification is not:

| Pack | Seats | Post-verification decision | Source |
|---|---|---|---|
| Business Visitor | 104 | Automatic if criteria met | §4 "Sélection automatique si critères remplis" |
| VIP Visitor | 21 | Automatic (inherits Business Visitor) | §4 |
| Lauréat | 12 | **Human review, competitive** | §2 "attribution non automatique", "après étude approfondie" |
| Boursier | 63 | **Human review, competitive** | §2 "Sélection sur dossier — attribution non automatique" |
| Délégué | 60 | Unspecified — presumed human review | — |

### ⚠️ Open issue: paying for a seat that may not exist — RESOLVED 2026-08-17

Pre-selection is automatic and unlimited. Seats are not. Nothing in the specification stops
2,000 people from being pre-selected for **12** Lauréat places, each paying the $20
verification fee, with 1,988 of them losing.

The refund policy does not cover this case. It refunds "rejet administratif ou d'éligibilité"
— but a candidate who passed verification and simply wasn't chosen was neither
administratively rejected nor ineligible. As written, they pay and get nothing back.

The same shape applies to Business Visitor: 104 seats, automatic selection, $330 each. If
500 people pay, 396 have paid $330 for a seat that does not exist.

Three options were put to the client — a capacity gate, a non-selection refund, or explicit
disclosure. **Resolved 2026-08-17: the client chose disclosure and rejected the other two.**

1. ~~**Capacity gate.**~~ Rejected. A pack's `places` is the number of participants admitted
   once the verified dossiers are ranked, not a quota applied at submission. Nobody is turned
   away for applying late, and `preselectionCapMultiplier` is gone from `PACK_SPECS`.
2. ~~**Explicit non-selection refund.**~~ Rejected. Verification fees are non-refundable in
   every case: they pay for work performed as soon as payment clears. What the programme
   commits to paying out instead is the visa-refusal prime — see §9.
3. **Explicit disclosure.** Adopted, and now carrying the entire weight. That is why the
   payment step states both facts (fee ≠ seat, fee not refundable) in the page body rather
   than in the terms, and why /confiance leads its fee table with the same sentence.

---

## 4. Phase 2 — recommended step order

The specification puts payment at Étape 1, before any form. That satisfies "paiement requis
AVANT le lancement des vérifications", but it is the worst possible position for both
conversion and data protection:

- Asking for $330 before the candidate has invested any effort maximises abandonment.
- Anyone who pays and then abandons the form has to be refunded manually.

Collecting *everything* before payment has the opposite problem: you end up storing passport
scans, liveness selfies and criminal-record extracts for people who never paid — a real
data-minimisation liability under the very policy §8 commits to.

**Recommended split**, which respects the spec's actual constraint (nothing verifies before
payment) while fixing both problems:

| Step | Content | Why here |
|---|---|---|
| 0 | Portal: full name + access code | Gate |
| 1 | Personal information + risk questionnaire | Low-sensitivity text. Builds commitment before the ask, and is cheap to hold. |
| 2 | **Payment** | Committed candidate, and still strictly before verification |
| 3 | Identity documents, liveness selfie, criminal record | Highest-sensitivity data, only ever stored for candidates who paid |
| 4 | Consents | Immediately before verifications launch, so consent is contemporaneous |
| → | Verifications launch + receipt email | Per §14 |

If the client insists on payment at Étape 1 as written, that is workable — but the manual
refund load for paid-then-abandoned dossiers should be budgeted for.

---

## 5. ⚠️ Single-use code vs. a multi-step form

The specification says the access code is **"à usage unique"**. Taken literally with a
five-step Phase 2, the first candidate who closes their tab, loses signal mid-upload, or
switches from laptop to phone to take the selfie is **permanently locked out** of a process
they have already paid for.

Mobile document capture makes this near-certain, not hypothetical: a candidate will start on
desktop and move to their phone for the ID photos.

**Design:** the code is single-use *as a credential*, not as a session.

- Entering name + code once **exchanges** the code for a signed, short-lived session
  (httpOnly cookie, ~72h, bound to the candidature id and marked as consuming that code).
- The code is marked consumed at exchange, so it can never be redeemed by anyone else — the
  spec's actual intent (non-reusable, non-shareable) is preserved.
- The candidate resumes from any step while the session is alive.
- If the session expires before completion, a re-entry path issues a fresh session on
  re-verification, without the code becoming shareable.
- Each step is persisted as it is completed, so nothing is lost on refresh.

---

## 6. UX decisions

### Phase 1 form — 20 fields

Three short steps with a progress indicator rather than one long page: (1) identity &
contact, (2) profile & pack, (3) motivation, country ties & consents. Draft saved to
`localStorage` so a refresh or a dropped connection doesn't cost the whole form. Mobile-first
throughout — the overwhelming majority of traffic in these six markets is phone traffic.

Motivation is capped at **150 words** with a live counter (the current site says "300 mots
max" and enforces a 50-*character* minimum; both are wrong).

### The 72-hour wait

A mandated dead zone in the funnel. Mitigations:

- Immediate confirmation email stating explicitly *when* the code arrives.
- The success page shows the concrete expected date/time, not "within 72 hours".
- A "Renvoyer le code" path visible on both the email and `/documents`.

### Portal entry — name matching will generate support tickets

"Nom complet exactement tel qu'indiqué sur la candidature Phase 1" cannot be implemented as
a literal string comparison. Normalise both sides before comparing: trim, collapse internal
whitespace, case-fold, strip diacritics (`Koffi Békalé` vs `koffi bekale`), and accept the
given/family name in either order. Anything stricter turns every accented name in Morocco,
Cameroon and Egypt into a support ticket.

The QR code in the email should deep-link to `/documents?code=…` so the code is pre-filled —
the candidate still types their name, which preserves the two-factor property. One tap from
email on mobile.

Failed attempts: rate-limit per code **and** per IP, log every attempt per §8, and return an
identical error whether or not the code exists — never leak code existence.

### Document capture

Camera-first on mobile (`capture="environment"` for documents, `capture="user"` for the
liveness selfie), client-side compression before upload — mobile data is expensive and slow
across all six markets — plus explicit good/bad example images. Server-side validation of
MIME type, dimensions and size regardless of what the client did.

### Payment

Method selection is country-aware, driven by `COUNTRY_PAYMENT` in
`src/lib/constants/program.ts`: Cameroun, Kenya and Ghana lead with mobile money (pawaPay);
Morocco, Egypt and South Africa are card-only (Stripe). Show the local-currency amount
alongside USD, locked at checkout creation.

pawaPay collections are **asynchronous** — a USSD push the candidate approves on their
handset, which can take minutes. That needs a real waiting state with status polling, a
"payment pending" email if they close the tab, and resolution driven by webhook rather than
by the browser.

### Expiry

14-day code validity with reminders at day 7 and day 12, plus a "request a new code" flow
subject to the additional identity verification §12 calls for.

---

## 7. Decisions

### Approved — 2026-08-12

| Topic | Decision |
|---|---|
| **Single-use code** (§5) | Code is single-use *as a credential*. Name + code exchanges it for a signed short-lived session and marks the code consumed; the candidate resumes from any step. |
| **Capacity** (§3) | ~~Cap pre-selections per pack~~ — **superseded 2026-08-17**. No cap at all: `places` is the number admitted after verification. Disclosure at the payment step is now the only mechanism, so it is stated in the page body, not the terms. |
| **Refunds** (§9) | **Superseded 2026-08-17.** Verification fees are non-refundable in every case. The admin reversal survives for billing errors only. What the programme commits to instead is the visa-refusal prime (Lauréat $1,000 / Boursier $500 / VIP $4,500; Business Visitor and Délégué none). |
| **Capacity dossier** (new) | Phase 2 gained Étape 5, pack-specific: project summary for Lauréat; + $5,000 attestation, flight funding and insurance for Boursier; full trip cost (≈ $13,940 / ≈ $20,940), bank attestation, 2 months of statements, source of funds and insurance for Business/VIP. Délégué skips it. The programme never receives these amounts. |
| **Auto-pre-selection scope** (§2) | Three mechanical gates only (capacity was the fourth, now removed). The three qualitative *critères de sélection* move to post-verification dossier review. Evaluated server-side at submit — never live as the candidate types. |
| **Phase 2 order** (§4) | Reordered: portal → personal info + risk questionnaire → **payment** → documents → consents. Verifications still launch only after payment. |
| **Name matching** (§6) | Normalised comparison — trim, collapse whitespace, case-fold, strip diacritics, accept either name order. |
| **pawaPay** (§6) | Asynchronous by design: real waiting state, resolved by webhook, never by the browser. |

### ~~Capacity multipliers~~ — removed 2026-08-17

This section described `PACK_SPECS[pack].preselectionCapMultiplier` (1.25× seats for the
automatic packs, 2× for the competitive ones) and the eligible-but-full outcome at the cap.
The client rejected capping outright: applications stay open on every pack, and the seat
count is applied only when the verified dossiers are ranked.

The field and `preselectionCap()` are gone. The `complet` status and the `pack_full` reason
are retained — rows written before the change still hold them, and an administrator may
still close a pack by hand once its seats are awarded.

### Still open

1. **Délégué decision stage** — human review like the scholarships, or automatic? Currently
   modelled as competitive (`kind: "role"` → 2× cap).
2. ~~**Business Visitor visa-refusal prime**~~ — **resolved 2026-08-17**: the omission is
   intentional. The three packs carrying a prime are Lauréat, Boursier and VIP Visitor.
3. **Code timing** — fixed T+72h send, or "within 72h" as an SLA? Being built configurable,
   so this does not block W4.
