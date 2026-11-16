# LevyTate Fresh-Project Bootstrap

Status: LG-01A review candidate, 27 October 2026. Local verification complete. No hosted schema change is authorised by this document.

## Decision

Fresh LevyTate Supabase projects use a separate, generated migration worktree. The historical files in `supabase/migrations` remain immutable and the shared Production ledger is not repaired, relabelled or replayed.

The generated worktree contains exactly two migrations:

1. `20261027174133_006_create_levytate_production_foundation.sql` — the exact SQL that already ran on isolated project `afsccuikhocasgwyjrdw`.
2. `20261027190000_levytate_fresh_project_convergence.sql` — one new migration assembled deterministically from the hash-locked sources in `supabase/bootstrap/manifest.json`.

The convergence SQL is SHA-256 `3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204`. Build and verify it with:

```sh
npm run validate:fresh-bootstrap
node scripts/build-fresh-supabase-bootstrap.mjs --output EMPTY_TEMP_DIRECTORY
```

Never point the generated worktree at the shared project `lzwcahdgchrkeulmlfqv`. Never use `--include-all`.

## Why 006, 007 and 009 are incompatible

Migration `006` is a valid Supabase-specific foundation and creates the core tables, RLS flags and three private Storage buckets. It does not create `marketing_description`, `industries_served` or `typical_job_roles`.

Migration `007` nevertheless reads those three columns while rebuilding provider programmes. A clean `006 → 007` replay therefore fails transactionally on `marketing_description`; fixing only that first error would expose the other two. Migration `008` then assumes the table created by `007`, so it is not an independent recovery step.

Migration `009` is the repository's deliberate current-schema catch-up. It creates or converges the core schema without those obsolete columns. The fresh baseline therefore executes exact `006`, skips `007` and `008`, and then uses `009` as the first convergence source. The historical files are not edited.

## Exact inclusion and exclusion

The convergence source order is:

```text
009
011 012 013 014 015 016 017 018
020 021 022 023 024 025 026 027 028 029
030 031 032 033 034 035 036 037
039
fresh_project_access_hardening.sql
```

Every source has a SHA-256 in `supabase/bootstrap/manifest.json`. The builder stops on any mismatch.

| Version | Treatment | Reason |
|---|---|---|
| `007` | Excluded | Broken legacy transform; its intended final schema is represented by `009`. |
| `008` | Excluded | Depends on `007`; its schema effect is represented by `009`. |
| `010` | Excluded | Stale destructive catalogue snapshot: 938 rows all marked approved, followed by deletion of rows absent from that snapshot. |
| `019` | Absent | Intentionally absent from the branch and approved ledgers. |
| `038` | Excluded | Approval-gated pastoral follow-up; intentionally unapplied. |
| `039` | Included | Its 19 Lift tables, capability extension and framework row are retained. |

Migration-owned data in `033`, `034`, `035`, `036` and `039` remains in the convergence SQL. The four Storage bucket insertions from `006`, `009` and `011` also remain; all buckets are private. This is not a schema-only squash.

### Catalogue data

The database standards catalogue is deliberately empty after bootstrap. The application retains its packaged fallback, so this does not create employer or workforce data. A separately approved catalogue artifact must resolve the three malformed empty-ID records in the current packaged JSON, declare its source/date, require unique non-empty IDs and references, report programme/status counts and carry a content hash. It must not contain an unreviewed blanket delete.

`supabase/config.toml` therefore disables automatic seeding. The previous configuration referenced a nonexistent `supabase/seed.sql`.

## Ledger treatment

The isolated project's only ledger row is:

```text
version: 20261027174133
name:    006_create_levytate_production_foundation
```

A read-only query found one stored statement with SHA-256 `876321865fd5efd9473c8863078c1d3cd2173927b737555c36266039fea16f35`, exactly matching the repository `006` file. The row is therefore a real anchor, not a repair target.

After separate approval, the existing isolated project can use the full generated worktree. The Supabase CLI will skip its matching `006` anchor and schedule only `20261027190000_levytate_fresh_project_convergence.sql`. No row for `007`, `008`, `009`, `010`, `019`, `038` or `039` is fabricated. The convergence row truthfully records the one composite SQL migration actually executed, including the effect of `039`.

A brand-new Supabase project runs both generated migrations. The shared Production project retains its existing legacy ledger and migration worktree unchanged.

## Required objects and access model

The active application structure is 113 public application tables: 111 `levytate_*` tables and the two provider-intelligence tables. It includes:

- core organisations, memberships, people, roles, applications, providers, programmes, enrolments, audit and files;
- guidance, learner lifecycle, operational actions and prospect access;
- employer authentication, distributed rate limiting, email delivery and terms evidence;
- provider intelligence, operational intelligence, levy finance and catalogue selections;
- Requests, Microsoft Copilot identity, configurable workflows and off-the-job learning;
- workforce assessments, pastoral foundation `037`, and Lift `039`.

The convergence preserves 257 validated foreign keys, valid indexes, triggers, constraints, required functions, RLS on all 113 tables and four private Storage buckets. The `038` action/event tables remain absent.

Data API rules are finalised by `supabase/bootstrap/fresh_project_access_hardening.sql`:

- `PUBLIC`, `anon` and `authenticated` receive no application-table privileges and no LevyTate function execution.
- `service_role` receives only explicit table DML, named RPC execution and the workflow-version CHECK validator required by direct inserts; it receives no `TRUNCATE`, `REFERENCES` or `TRIGGER` privileges.
- auth and pastoral rate-limit tables have no direct `service_role` table grant; their bounded security-definer RPCs are the only path.
- security events are insert-only; event/evidence tables do not receive update rights; reference frameworks are read-only.
- delete is limited to the eight replacement/rollback paths used by server modules.
- only the two required identity sequences grant `USAGE, SELECT`.
- trigger/constraint helpers are not callable through the Data API.
- security-definer functions use `pg_catalog, public`, while Data API roles cannot create objects in `public`.

Tenant isolation remains layered: browsers have no direct table access, RLS is enabled everywhere, the service credential remains server-only, and server routes derive organisation scope from the authenticated membership rather than browser input.

## Local replay evidence

The approved source was materialised and executed with the official Supabase CLI against two independent disposable PostgreSQL databases with Supabase Auth/Storage platform stubs:

1. empty platform database → exact `006` anchor → convergence;
2. empty platform database → exact `006` anchor in an anchor-only run → full-worktree dry run scheduled only convergence → convergence.

Both runs passed `supabase/bootstrap/verify_fresh_project.sql` and produced the same normalized catalogue signature. The committed `supabase/bootstrap/catalogue_signature.sql` query emits one canonical JSON line per application-owned table, column, constraint, index, policy, trigger, function and relevant ACL entry; run it with `psql -X -A -t -q -f` and hash the exact output bytes:

```text
catalogue objects: 4780
catalogue SHA-256: 53d14b971e5e5c2bf39f23804200e36139c34dc8dade690086e175bad8b37818
```

| Check | Both replays |
|---|---:|
| Application tables / RLS-enabled | 113 / 113 |
| Lift tables | 19 |
| Valid / invalid foreign keys | 257 / 0 |
| Invalid indexes | 0 |
| Browser table grants | 0 |
| Broad service DDL grants | 0 |
| Public/browser LevyTate function grants | 0 |
| Private / public LevyTate buckets | 4 / 0 |
| OTJ / assessment / Lift framework rows | 2 / 3 / 1 |
| Standards / organisations / users / employees | 0 / 0 / 0 / 0 |

The verifier also proved a `service_role` core write and the actual `levytate_consume_auth_rate_limit` operation inside a rolled-back transaction. Forged `authenticated` tenant context and `anon` reads were denied. Existing application regression suites cover server-owned organisation scoping and cross-tenant denial; hosted Data API and browser acceptance remain an approval-gated step.

The local test engine was PostgreSQL 18.4 because that is the installed disposable engine. The repository and hosted target remain PostgreSQL 17.6. Before hosted execution, repeat the same generated worktree on a clean Supabase/PostgreSQL 17 environment if the hosted isolated project's managed engine is not the acceptance target.

## Proposed hosted execution — separate approval required

No hosted DDL, reset, migration repair, credential activation or Preview reconfiguration is part of LG-01A.

If approved, the bounded execution against `afsccuikhocasgwyjrdw` is:

1. Re-read the ledger and require the exact `20261027174133` version, name, one-statement count and statement hash recorded above.
2. Materialise the hash-locked full worktree in an empty temporary directory.
3. Run `supabase db push --dry-run` against that isolated project and require **only** `20261027190000_levytate_fresh_project_convergence.sql` to be scheduled; stop on any other result.
4. Apply that one migration with the approved database owner. Do not reset and do not repair history.
5. Run `verify_fresh_project.sql`, Supabase security/performance advisors and Data API positive/negative tests.
6. Confirm `019` and `038` remain absent, `039` objects exist, four buckets remain private, and employer/workforce/Auth data remain empty except a separately approved fictional acceptance identity.
7. Only after database verification, activate the already-approved branch-scoped Preview credentials, redeploy the exact reviewed commit and run hosted login/readiness acceptance.

The shared Production project is never a target. Any future migration must use a timestamp greater than the convergence version and be represented as the same reviewed SQL in both the fresh-project worktree and the separately generated shared-history worktree. Until that dual-tree path has its own dry-run evidence, no `040+` migration is routine-safe.
