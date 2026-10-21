# LevyTate Lift migration 039 — backup, restore and shared application evidence

Date: 21 October 2026
Shared Supabase project: `lzwcahdgchrkeulmlfqv`
Migration status: applied once on 21 October 2026 after explicit bounded approval

## Baseline and method

- Confirmed repository ledger contains migration 038 while the read-only shared ledger ended at 037.
- Created a fresh restricted custom-format archive immediately before migration 039: `lzwcahdgchrkeulmlfqv_20261021T132212Z_pre039.dump`.
- Verified its SHA-256 (`cceb1e684496e535fa3b1a0eebad665cd540f59fa1b8dbb1a13708fe354b585a`), 1,380,277-byte size, 1,383 archive entries and zero dump errors.
- Restored that fresh archive into a disposable local PostgreSQL 18 cluster.
- Verified the archive against its retained SHA-256 checksum before relying on it.
- Configured the cluster with no TCP listener and a private temporary Unix socket.
- Preserved the actual shared boundary at migration 037 and deliberately skipped repository migration 038.
- Applied proposed migration 039 twice with fail-fast execution.
- Exercised the production Lift server services through an isolated REST adapter backed by the restored PostgreSQL database.
- Tested a direct post-submission database overwrite and a post-release server save; both were denied while a separate addendum revision remained possible.
- Stopped the database and deleted the temporary cluster and socket after validation; restricted evidence remains outside Git.
- Reconfirmed immediately before shared execution that the ledger ended at 037, migration 038 and 039 counts were zero, and no Lift table or capability column existed.
- Temporarily excluded migration 038 from the CLI migration directory, verified 039 was the only pending migration, applied 039, then restored the untouched 038 file.
- Reconciled protected business-table row counts with the fresh archive and verified the approved SQL contains no business-data update/delete operation.

## Results

| Check | Result |
| --- | --- |
| Restore | Pass |
| Migration 037 prerequisite | Pass |
| Migration 039 first application | Pass |
| Migration 039 second application / idempotency | Pass |
| Shared migration ledger | Exactly one `039`; `038` remains absent |
| Lift tables | 19 |
| Lift tables with RLS enabled | 19 |
| Lift tables with RLS forced | 19 |
| Lift service-role policies | 19 |
| `lift_enabled` default | `false`, not nullable |
| Published pilot framework rows | 1 after both runs |
| Existing organisation + user + employee rows retained | 201 aggregate rows |
| Existing pastoral tables retained | 9 |
| Both submission orders | Pass |
| Lost-response retry and interrupted reconciliation recovery | Pass; no duplicate candidates or evidence |
| Five-contributor privacy-safe route | Pass; one route, five traceable memberships |
| Direct overwrite after submission/release | Denied; original text retained |
| Persisted decision, assumption, baseline and outcome evidence | Pass |
| Temporary isolated environment removed | Pass |
| Shared post-application security | 19/19 RLS, 19/19 forced RLS, 19 service-role policies, zero browser grants |
| Organisation capability immediately after migration | Zero organisations enabled |

## Scope review

Migration 039 is additive. It adds one disabled-by-default organisation capability, one version registry and eighteen organisation-scoped journey/history tables. Compared with the first proposal, it now separates private per-employee opportunity candidates from disclosed employer routes, records route membership and reviewed grouping criteria, adds campaign/framework/version/workflow boundaries, adds immutable manager-revision enforcement and explicit addendum metadata, and publishes questionnaire/interpretation version 1.1. It does not delete, update or reinterpret existing employer, employee, application, learner, assessment, finance or pastoral records. Browser roles receive no table privileges; service-role policies accompany explicit server checks.

Exact applied migration SHA-256: `f6a258053e9f3de9677bdc9329d17e97f32d3eef80996bd1a5bc165697af14f0`.

The separate bounded activation authorised only the existing Ground Control fictional validation workspace (`12000000-0000-4000-8000-000000000001`) for the protected `feature/operational-rbac` Preview. Production and every other organisation remain disabled. See `LEVYTATE_LIFT_PREVIEW_FIXTURE.md` for the idempotent fictional fixture manifest.
