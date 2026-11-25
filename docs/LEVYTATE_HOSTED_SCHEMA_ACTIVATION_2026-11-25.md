# LevyTate hosted staging schema — reviewed activation record

**25 November 2026 · STAGING ONLY · NO PRODUCTION CHANGE**

Target: newly created independent Free-plan Supabase project `njyxfjkzbprowhnuwcud` (`levytate-staging`, `eu-west-2`). Explicitly **not** the shared `mpr-consulting` project `lzwcahdgchrkeulmlfqv`.

## Schema source integrity

Source commit: `ca4e62c0d3cc8d2a3f3de99e68680dcd61dae1a5` (LevyTate Core, existing Add-ons, provider V1/V2 preserved).

- The baseline `supabase/migrations/006_create_levytate_production_foundation.sql` was applied to **staging**.
- The accompanying file `supabase/staging-generated/20261027190000_levytate_fresh_project_convergence.sql` was regenerated from all **29 source files** in `supabase/bootstrap/manifest.json`, in the exact original source order, using the same header / source markers as `scripts/build-fresh-supabase-bootstrap.mjs`.
- The whole output SHA-256 was verified as **`3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204`**, exactly matching the committed convergence manifest. This is not a modified or speculative migration.
- All **26** additional hash-locked `supabase/release-migrations/manifest.json` SQL files were applied in exact manifest order to the same staging project, then the separately locally verified **Provider Delivery V1** and **Provider Progress V2** candidates.
- Supabase confirmed **30 migration records**. Restricted migration `038` was not included; the old four-argument provider approval RPC has been replaced by the five-argument revision-pinned RPC. **No changes were made to the shared database.**

## Independent read-only staged schema checks

- PostgreSQL **17**; **137 public application tables**, all **137 RLS-enabled**.
- **0 employers, 0 Auth users, 0 Storage objects** before and after hosted rollback tests.
- Provider grant and report tables present, public browser privileges to view/manage them are denied, and the older approval RPC is absent.
- The new provider-approval RPC exists and is executable by service role only.
- Supabase security adviser currently reports 4 WARN mutable function search paths and 48 INFO RLS tables without policies. These are existing/known code patterns and **must be reviewed before real customer access**.

## Executed hosted SQL transaction tests

Two test modules, `scripts/test-provider-delivery-candidate.sql` and `scripts/test-provider-delivery-progress.sql`, were run against this live **staging-only** database with a temporary fictional internal catalogue, two fictional employers, synthetic apprenticeship lead identities, a selected provider/programme and one synthetic learner.

Because the deployed V2 SQL removes the superseded four-argument review function, the V1 test calls were adapted *at execution time only* to invoke the current five-argument function with a null expected learner revision for programme notes. Their original source files remain unchanged.

Both tests completed successfully inside a **BEGIN / ROLLBACK** transaction. Verified employer consent, cross-tenant denial, idempotent report submission and review, atomic provider-reported progress promotion, preserved target/variance, stale-revision rejection, missing baseline denial, withdrawn learner denial, grant revocation, audit/event linking and no duplicate progress after retry.

**Post-rollback verification:** 0 employers, 0 provider reports, 0 official learner progress records, 0 Auth users. No customer identities, real email invitations or test learner PII were persisted. Hosted SQL tests are a separate result from genuine hosted browser/SMTP Auth acceptance.

## Release boundary

This file is a generated/staging-only review artifact. Do not promote it, either provider candidate or its 30-migration staging ledger to the shared project. The 30 staging migrations' *applied migration names* differ from the repository's 28-migration local fixture naming and require explicit audit before any production schema strategy.

The separate protected Vercel Preview branch `codex/levytate-free-staging-20261124` contains three newly supplied staging-only secrets (names confirmed; values never inspected), but beta login, provider delivery and Requests remain switched off. A fresh protected deployment after setting those secrets must be verified before any hosted session attempt. **No real-client pilot has been authorised.**
