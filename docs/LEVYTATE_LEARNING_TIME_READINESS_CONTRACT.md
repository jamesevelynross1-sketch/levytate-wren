# Learning Time release-readiness correction — 10 November 2026

The migration 24 release probe checked six application RPCs but omitted Learning
Time. A reachable older schema could therefore report public readiness as
operational even without the Manager personal Learning Time command contract.

## Reproduction and bounded change

- On a fresh dedicated local PostgreSQL 17 schema through migration 25, the old
  probe reported available after the mandatory Learning Time command was renamed.
  `tests/client-learning-readiness-missing-command.sql` passed its initial healthy
  assertion and failed the missing-command assertion with SQLSTATE `P0001`.
  The entire injection rolled back. No hosted failure injection occurred.
- The application adapter likewise accepted the old marker in a focused transport
  regression: four tests failed and 43 passed before the correction.
- New candidate `20261110085437_client_learning_time_readiness_contract.sql`
  has SHA256 `9caeae527c7a57ec75c9e3646434f818ced67adf45c5ddf026dfca9c4f1cbf0c`.
  The adapter now requires its exact version and `available: true`.
- The stable, security-invoker probe retains all six original RPC checks and
  original index/RLS/column invariants. It adds the Learning Time wrapper's
  service-only execution, private-helper restrictions, and evidence-table
  read/write privileges, including column-only grants.
- Exact SHA256 values of the three literal `pg_proc.prosrc` bodies identify the
  reviewed migration 25 implementation. They are a limited release-compatibility
  check, not proof of correctness or a replacement for behavioural/security
  tests. They do not hash `pg_get_functiondef` or catalogue serialization. Future
  approved routine changes must update the readiness contract deliberately.

Migration 25 remains byte-identical at SHA256
`209c8dedc643029186ea6959fc7d36982cad530d38e9d517935d186d69385d64`.
The approved convergence and historical migration files remain unchanged.
No business rows, capabilities or existing command grants are changed. The new
probe reads catalogues only and never invokes a mutation RPC or invents an actor.

## Local verification

Environment: dedicated `levytate_release_learning_readiness_review25`, PostgreSQL
17; official acceptance runtime fixtures, Auth, Storage and ledger untouched.
The candidate was applied there only after exact-hash source review.

| Check | Actual result |
| --- | --- |
| Unchanged missing-command regression | 2/2 PASS after candidate 26 |
| New missing/private/revoked/public/table/column ACL and recovery checks | 15/15 PASS |
| Prior release readiness invariants, version literal updated only | 8/8 PASS |
| Prior independent readiness assertions, version literal updated only | 5/5 PASS |
| Exact historical pre-25 routine bodies, individually and combined; read-only recovery | 5/5 PASS |
| Unchanged Manager-own SQL behaviour and cross-actor receipt rejection | 7/7 and 1/1 PASS |
| Health adapter, offline release builder and Manager service/render tests | 65/65 PASS |

The offline builder emits 26 migration files for the fresh baseline, hash-checks
the new candidate, and still excludes 038. It does not fabricate history or grant
permission to execute hosted migrations.

Hosted acceptance and real-client release approval remain separate. Application
readiness on the new code will fail closed until this reviewed contract exists;
an older healthy marker is intentionally insufficient. No Production promotion,
hosted migration, Learning Time activation or paid infrastructure change follows
from these local results.

References checked 10 November: [Supabase function security](https://supabase.com/docs/guides/database/functions),
[PostgreSQL 17 pg_proc](https://www.postgresql.org/docs/17/catalog-pg-proc.html),
[PostgreSQL 17 binary hashes](https://www.postgresql.org/docs/17/functions-binarystring.html).
