# LevyTate Core — training-provider delivery collaboration V1

**Branch:** `codex/levytate-provider-delivery-v1-20261123`  
**Status:** PREVIEW/LOCAL IMPLEMENTATION ONLY; production disabled. The new SQL is a reviewed **candidate**, not an approved migration or live feature.

## Product purpose

Retain existing provider Opportunities functionality, but add a separate Core delivery workspace. An organisation can opt to share its selected provider's assigned active apprentices and programmes with approved provider users, receive evidenced updates, and accept or reject reports without duplicate introductory data entry.

Two distinct concerns must not be conflated:

1. **Provider Requests**: employers invite suppliers to competitive opportunities. Remains an optional commercial module with existing request-level permissions.
2. **Provider Delivery**: employers already working with the provider share their selected programmes and assigned learners for ongoing progress reporting. This is Core and is not conditioned on buying Requests.

## Experience built

- Platform Admin still provisions and revokes existing provider memberships independently (no new identity system).
- Employer Admin or Apprenticeship Lead explicitly enables or revokes a grant for each selected provider. The employer sees a permission explanation that names learner-identifying data.
- Provider logins remain role/identity-bound. The provider sees only employers with current grants, only the programmes selected by each employer, and only active learners assigned to that exact provider and selected programme.
- Providers submit dated learner progress (%) and summary/next-review evidence, or programme capacity/delivery notes.
- Submissions are source-attributed, request-key idempotent, auditable, and enter the employer's **My Providers** Core review queue.
- Employer review accepts/rejects the proposed evidence. Accepted submissions are labelled **provider-reported and employer-acknowledged**, not equivalent to provider MIS, DAS funding, formal apprenticeship evidence, qualification outcomes or the official learner progress record.
- Explicit revocation immediately stops later provider reads and submissions for that employer. Earlier submissions and audit evidence are retained for authorised employer review.

**Important remaining functionality:** an accepted provider learner report is not yet promoted into the authoritative learner progress and review command ledger. That requires a second, separately verified atomic acceptance-to-learner-command path to avoid duplicate entries or lost updates. Do not claim end-to-end synchronised learner progress until this passes.

## Data and security boundaries

Server/API access requires all of:

- `LEVYTATE_PROVIDER_DELIVERY_ENABLED=true` in an approved **local or Vercel Preview** environment; Production is hard-denied regardless of flag;
- `levytate_organisation_capabilities.provider_delivery_enabled=true` for the employer, off by default;
- an active employer selection for the relevant provider and programme;
- an explicit, currently active `levytate_provider_delivery_grants` grant authorised by the employer Lead/Admin;
- an active, identity-bound provider membership for provider operations; or an active employer membership with the correct Lead/Admin role for grant and review actions.

The API validates input and protects authenticated writes by same-origin, bounded body and rate limiting. SQL candidate RPCs recheck actor role/membership, current employer-provider relationship, target ownership, response version/idempotency, and record state. New tables enforce RLS and deny browser access; SQL functions are executable only by server-side `service_role`. Providers never receive broad employer accounts or platform administration authority.

The dedicated provider report UI sends only programme/learner record IDs and factual evidence. No sensitive pastoral transcripts, assessment detail, finance or another training provider's data is made available. All source dates are explicit. Employer approval does not silently modify official programme catalogues, learner eligibility, reviews, completion or financial totals.

## Deployment boundary and testing

- SQL candidate: `supabase/candidates/provider-delivery-v1.sql` is **not** in `supabase/release-migrations/manifest.json` or the 28 reviewed baseline. It must not be applied to the shared Supabase project.
- Local CI uses a disposable PostgreSQL 17 environment and fictional employer/provider records to run candidate SQL and denial/idempotency tests in a **rolled-back** transaction, followed by the previous 203-check Core browser suite.
- The connector is gated off in the live UI; the protected preview will not show the new navigation until a separately authorised, isolated backend and capabilities are set up.
- Do not expose real customer employee names, invite real providers, enable Microsoft tenants, change Production environment variables, deploy migrations, create paid infrastructure or merge this draft as part of this task.
- Before a first real pilot: independent review, correct consent/lawful bases, customer DPA, tenant-role and identity acceptance, backup/restore plan, isolated hosted test and product-owner release approval.

## Acceptance and next sprint

1. Confirm SQL candidate local transaction checks, cross-tenant denials and unchanged authoritative learner progress.
2. Complete the provider proposal → employer acceptance → **atomic learner progress promotion** workflow with no duplicates and test the resulting dashboard refresh.
3. Run genuine browser sign-in as a provider with an approved delivery grant and a second provider denied. Existing Core browser runs currently cover the employer roles but do **not** cover this new provider route.
4. Validate provider session expiry/revocation during submission, current role and new employer consent, then execute the full protected Preview acceptance.
5. Only then publish the Core feature for approved users.
