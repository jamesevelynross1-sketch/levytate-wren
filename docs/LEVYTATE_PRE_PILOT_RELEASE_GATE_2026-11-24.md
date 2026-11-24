# LevyTate Core — pre-pilot release decision (24 November 2026)

**Release decision: NO-GO for a hosted customer pilot.** Development remains safe on the draft PR chain; the latest Provider Delivery V1 + Provider Progress V2 code has genuine local browser and SQL evidence. This document records explicit prerequisites, not permission to start a paid Supabase branch, send a real email, edit Vercel secrets or deploy to Production.

## Preserved release chain

| PR | Scope | Status |
| --- | --- | --- |
| [#10](https://github.com/jamesevelynross1-sketch/levytate-wren/pull/10) | Core / Add-on packaging; Microsoft 365 Copilot included in Core commercially, not automatically activated | Draft, unmerged |
| [#11](https://github.com/jamesevelynross1-sketch/levytate-wren/pull/11) | Explicit isolation metadata gate and fictional acceptance checklist | Draft, unmerged |
| [#12](https://github.com/jamesevelynross1-sketch/levytate-wren/pull/12) | Disposable PostgreSQL 17, Auth + browser Core acceptance | Draft, unmerged |
| [#13](https://github.com/jamesevelynross1-sketch/levytate-wren/pull/13) | Employer-granted provider collaboration and source-attributed reporting | Draft, unmerged |
| [#14](https://github.com/jamesevelynross1-sketch/levytate-wren/pull/14) | Employer-approved provider progress atomically becomes official learner progress | Draft, unmerged |
| This PR | Local encrypted disaster-recovery proof for all previous Core plus provider data; pre-pilot decision record | Draft, unmerged |

No feature files in those branches are approved for deletion. Only a deliberate, separately reviewed consolidation may reorder or combine the stacked draft PRs, and every commit/test SHA must remain traceable.

## Known actual evidence

- At revision `3c5d74b59367bec8826c7a95a7cef8de75c51a4d`, [disposable local browser run 45208142514](https://github.com/jamesevelynross1-sketch/levytate-wren/actions/runs/45208142514) completed **203 Core PASS / 0 FAIL / 1 expected BLOCKED** for real external-email delivery, plus **23 provider-specific PASS / 0 FAIL**. This includes provider OTP, employer grant, cross-tenant denial, actual provider progress, atomic employer acceptance, updated official learner API, replay idempotency and revocation.
- [GitHub launch gate 45208160743](https://github.com/jamesevelynross1-sketch/levytate-wren/actions/runs/45208160743) passed. These are local/source acceptance, not hosted/customer acceptance.
- A protected Vercel Preview of the above revision is `READY`. The Preview for that feature branch does **not** have an independently confirmed isolated Supabase backend or customer Auth configuration; its build state must not be used to claim hosted readiness.
- The connected Supabase account has one active shared `mpr-consulting` project, one separate `ai-apprenticeships` project currently marked inactive, and **zero branches**. The inactive unrelated project is not to be repurposed. Shared project schema remains behind the local 28-release-migration plus provider V1/V2 candidates.
- No new billable Supabase environment has been approved. The two new SQL candidates remain in `supabase/candidates` and **must not** be applied to the shared project without explicit release approval.

## New local recovery proof

This branch adds a Linux path to the existing Mac-verified `release-local-recovery.mjs`, while preserving its Mac behaviour. On a disposable local acceptance runner **after the 203 + 23 real browser checks** it:

1. Requires a loopback PostgreSQL 17 database with exactly the expected **two fictional employers and internal catalogue**, verifies the runtime fixture and rejects real workspaces.
2. Uses the existing AES-256-GCM/derived-key mechanism to write an encrypted local archive with restrictive permissions. Unencrypted archive bytes exist only inside the temporary test process, never in GitHub artifacts/logs.
3. Restores the archive into a *new* local database (never source) and compares table/RLS/Auth/Storage metadata and migration-ledger digest, plus counts and a SHA-256 content digest for provider submissions, official learner progress and audit decisions.
4. Rejects absent or changed provider progress evidence or any restore mismatch. Nothing is retained as a durable production backup.
5. Destroys all disposable test processes/databases at runner shutdown. This is a local product-operability demonstration, **not** a hosted Supabase/Storage restore, external mail or customer recovery guarantee.

**Latest recovery run status:** follow the exact new GitHub run outcome. A pending/failed check is *not* a PASS.

## Product release gates

| Gate | Requirement | As of 24 Nov |
| --- | --- | --- |
| Source and scoped Core/Add-on release | Review and consolidate selected stacked PRs without losing add-ons | NOT DONE |
| Local whole-product regression | Repeat current 203 Core + 23 provider + SQL checks on the final reviewed SHA | PASS on previous SHA; new candidate pending |
| Data recovery | Encrypted backup + **different database** restore including provider-led progress; separately verify private Storage object bytes and application retrieval | Local candidate in progress; Hosted NOT RUN |
| Environment isolation | Independently confirm exact Supabase project ref, no production data, migration fingerprint, Preview target/commit and Vercel Auth protection; use approval-gated branch or separate project | BLOCKED — no isolated hosted backend |
| Production credentials | Scoped server-only secrets, verified cookie/host mappings, independent branch variable inventory; no decrypting keys into chat/CI | NOT RUN |
| Auth and access | Real employer and provider email acceptance, sign-in recovery, tenant isolation, revocation, expiry, denial, throttling | Local PASS; hosted NOT RUN |
| Provider provenance and MI | Real provider report → employer approval → canonical progress → operational MI/export, no duplicate/update races | Local PASS; hosted NOT RUN |
| Compliance & privacy | Employer/provider terms, lawful basis, processors/subprocessors, DPA, privacy notice, retention, support roles and incident response | Product-owner review required |
| Production operations | Named owner for monitoring, incident rollback, restore tests, support SLAs; billing plan appropriate for commercial use and managed backups | NOT APPROVED |
| Microsoft 365 Copilot | Separate Entra consent/identity, customer-tenant/permission, read-only service access, Microsoft licences | Core package classification only; NOT ACTIVATED |
| Customer sign-off | One named employer approves safe test and first-client acceptance; signed release decision | NOT REQUESTED |

No P0 may be waived by saying a Vercel build is Ready or that local SQL tests passed.

## Supabase read-only security advisor observations

From the connected `mpr-consulting` project on **24 November 2026**:

- **5 WARN function-search-path-mutable notices**: review the exact function definitions/execute privileges before new hosted schema operations; do not apply a blanket `SECURITY DEFINER` patch. [Adviser rule](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- **1 WARN leaked-password-protection-disabled**: assess applicability to magic-link and any password-auth accounts; enable through an approved Auth/security change if relevant. [Password protections](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- **33 INFO RLS-enabled/no-policy notices**: these often represent deliberately server-only, deny-by-default tables, not proof of exposure. Review Data API grants, service-only patterns and any necessary RLS policies before opening provider portals. [Adviser rule](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

These notices were observed read-only; the current shared database was not modified.

## Hosting and cost choice — requires user decision later

Supabase Free permits local CLI development and at most two active Free projects, but managed cloud branching is Pro-only and Free does not include managed automatic backups. The account currently shows an unrelated inactive project; that is not consent to delete or repurpose it.

If a new separate staging environment becomes commercially necessary, obtain the user's **explicit choice of organisation, zero-cost project vs Pro branch, cost approval, lifetime/clean-up plan** before any provisioning. Do not expose connector project refs, API secrets or real workforce data to external CI artifacts. No hosted environment exists just because this document lists a future route.

## Release Owner acceptance

A pilot may proceed only after one final immutable SHA, independent security/data/privacy review, real guarded hosted acceptance, recovery evidence and a signed GO decision. Without these, keep provider delivery disabled in Production; keep PRs in review and all existing Core/Add-on features intact.
