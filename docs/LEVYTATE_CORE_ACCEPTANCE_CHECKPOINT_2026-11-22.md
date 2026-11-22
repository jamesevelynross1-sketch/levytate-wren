# LevyTate Core — isolated acceptance checkpoint (22 November 2026)

**Current decision:** PREPARATION COMPLETE FOR REVIEW; **HOSTED ACCEPTANCE BLOCKED** until an independently verified isolated Supabase branch is approved and connected. No Production or shared Supabase changes are authorised by this checkpoint.

## Known and verified starting point

- Code candidate: `codex/levytate-core-addons-20261119`, reviewed commit `9adf4d1e5b96f9a1e5508bea662e5c5bedafe3f9` (before this checkpoint's own commit). PR #10 is draft. Preserve all Core and add-on modules.
- GitHub Actions on that commit passed, and the Vercel preview deployment `dpl_AZECuASZLr9RgLwSeaHxJppPX1JJ` reports Ready. This is **build evidence**, not hosted sign-in or tenant acceptance.
- Connected Supabase account shows the shared project `lzwcahdgchrkeulmlfqv` (`mpr-consulting`) and **zero development branches**. The shared project must never be used to inject fictional tenant data or test stateful failure cases.
- Supabase reports new branch compute at **US$0.01344/hour** (about US$0.32256 per 24 hours, excluding other possible charges). The branch-create operation requires explicit user cost approval. **No charge has been approved or incurred in this checkpoint.**
- Existing guarded local native Postgres 17 acceptance work and two-tenant browser tests are preserved, including the 28 reviewed release migrations, fixture generator and authentic local SMTP sign-in. Existing local evidence is dated; it is not new hosted acceptance.

## What this change introduces

A credential-free preflight validator:
`node scripts/validate-core-acceptance-target.mjs --file <locally-observed-evidence.json>`

It **rejects** a shared Supabase reference, a mismatch between claimed preview backend and separate branch backend, production/custom-domain testing, an unready/unprotected preview, a mismatched commit, real employer data, external email activation and migration 038 being applied.

The strict metadata input has no credential field, and neither its result nor its test output is a substitute for actual Supabase/Vercel read-only verification. Never commit a real backend configuration, secret, session, email or tenant data to GitHub. All required fields must be independently checked against authoritative connector/dashboard records by the release owner.

This change also adds six standalone Node tests to the GitHub release gate; they run without a database or live accounts. They prove the *safety-check behaviour*, not that any staging backend exists.

## Execute after hourly cost is explicitly approved

1. **Provision separate development branch** from the reviewed Supabase parent through the authorised connection; capture its actual project reference and healthy status. Do not select a paid project, alter main, or use earlier `afsccuikhocasgwyjrdw` references without verifying ownership and authority.
2. **Verify isolation** from the authoritative Supabase branch listing and a read-only check of zero fictional or real tenant records. Capture no credentials in evidence. Confirm default inherited migrations, and quarantine unapplied `038`; a branch does **not** automatically include the 26 newer release migrations.
3. **Prepare the schema change plan** under the existing `supabase/release-migrations/manifest.json`, including fresh backup/recovery evidence, hash review, no `--include-all`, no `038`, and separately authorised branch-only apply. Do not infer migration permission from creation of the branch.
4. **Connect an immutable protected Vercel Preview** only to that branch's Supabase project and separate Auth/Storage/email settings. Inspect the *configured* public Supabase URL and validate it matches the branch reference; keep Production aliases and all live variables unchanged. This requires approved Vercel environment configuration, not a code-only navigation change.
5. **Run the full first-client fictional workflow:** create two fresh employer tenants; generate Employee, Line Manager and Apprenticeship Lead identities using controlled captured emails; authenticate normally; application draft/submit -> manager approval -> lead approval -> pre-enrolment -> learner lifecycle; selected provider/programme read/update boundaries; finance CSV and evidence/report reconciliation; denial across two tenants; logout/session recovery; mobile viewport; controlled retry/duplicate/forged transition. Use existing local test infrastructure as reference but do not claim the local-only browser runner is already a hosted harness.
6. **Inspect evidence separately:** distinct PASS / FAIL / BLOCKED / NOT RUN for each mandatory case; exact preview artifact and Git SHA; tester, tenant anonymised references, dates, authorised source data; no secrets, session cookies, individual learner names or URLs containing tokens. Acceptance is a *release-owner decision*, never the consequence of green CI alone.

## Core acceptance mapping

| Area | Existing acceptance IDs | Evidence still required |
| --- | --- | --- |
| Staging, migration and custody | `CLA-ENV-09`, `CLA-DB-01`–`08` | Independent branch and isolation, migration hashes, restore, hosted environment |
| Authentication and tenant isolation | `CLA-AUTH-01`–`10`, `CLA-TEN-01`–`05` | Real (fictional identities) invitation, callback, read/write scoping, revocation |
| Employee and approvals | `CLA-APP-01`–`10` | Save, submit, manager decision, lead decision, one-active rule, replay and conflict |
| Enrolment / learner | `CLA-LRN-01`–`06` | One approved handover, independent persisted learner, review/withdrawal checks |
| People / provider catalogue | `CLA-PEO-01`–`06`, `CLA-CAT-01`–`05` | Cross-tenant manager checks, programme/provider selection and freshness |
| Finance / reporting / operations | `CLA-OPS-01`–`06` | Imported authoritative-period DAS data, totals, reporting and export evidence |
| Request and UI integrity | `CLA-RES-01`–`06` | Protected write bounds, retries, mobile and accessibility |
| Employer offboarding | `CLA-OFF-01`–`06` | Lifecycle controls, retention/export/revocation; no destructive test on shared |

**Known product gap outside this acceptance gate:** provider access currently supports responding to employer opportunities, not the complete provider-maintained programme/learner update flow. That remains a separately prioritised Core development task, not something to mark as accepted by testing the existing provider portal.

**Core Microsoft 365 Copilot:** commercially included, but live Entra tenancy activation remains separately approval-gated; a missing external Microsoft connection cannot be used to claim it passed acceptance.

## Exit condition

A safe, fictional, isolated, protected staging environment with independently verified current backend and schema; the mandatory Core scenario has actual hosted PASS evidence and zero unresolved P0 blockers. Until then, keep **NO-GO for real-employer data and invitations**. Preserve PR #10 and all existing add-on code.
