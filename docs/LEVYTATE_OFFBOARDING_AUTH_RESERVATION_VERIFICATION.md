# Independent local Auth reservation verification

2026-11-09. Candidate reviewed independently of its implementer:
`be6e19e2b909da2a0fa7a945395facb3b5c5287f`.

- Offboarding migration SHA-256: `db1224635e2e3f2c12e15c32999d99cf23fd03802be7aee6da17755b4451bed0`.
- Storage boundary migration SHA-256: `bbb3a2f1f2ce89b84ccecb53fddde0014baec945aea633a06dc1b97dc062032d`.
- Final environment: native local PostgreSQL 17, dedicated database `levytate_release_offboard_identity_review20b`.
- Result: **59 passed, 0 failed** using `scripts/release-offboarding-auth-reservations.mjs`.
- Node 22.23.4 syntax check, `npm run lint`, `npm run build` (109 pages), and `git diff --check` passed. Build reported the existing stale Browserslist dataset warning.
- Earlier timing-based run: 41 passed in separate `levytate_release_offboard_identity_review20`. The strengthened final run explicitly confirms each waiter is blocked by its competing transaction using `pg_blocking_pids`, then releases that transaction. Both databases retain synthetic evidence.

The fresh-database helper verified all 20 migration hashes before creation, copied managed schemas without rows, and applied the reviewed local chain. Its managed-schema copy excludes only the application-owned Storage lifecycle trigger, which the exact reviewed migration reinstalls after its public function exists. Auth users, Storage objects, employers, People and migration-ledger rows were all empty before test setup. Migration 038 is absent; no ledger rows were fabricated.

Coverage:

| Boundary | Independently observed result |
| --- | --- |
| Active provider subject and inactive provider email association | Captured Auth identity is retained. |
| Other tenant's current, inactive or retired association | Identity is retained, including after revocation and email change. |
| Binding commits before disposal reservation | Employer/provider subject and email-only races wait, then capture the committed association as retained. |
| Disposal reservation commits first | New employer/provider identity reuse waits and is denied with `PT409`, without a persisted binding. |
| Existing pending membership is rebound | Both employer/provider updates wait and are denied; original pending membership remains unchanged. |
| Sole target's retired binding | Former Auth subject remains present in the deletion inventory after live binding and email have changed. |
| Shared provider after tenant SQL disposal | Tenant is removed; provider membership and its Auth row survive. |
| Shared association removed after capture | Captured retained identity is never silently escalated to deletion. |
| Requester revoked or approver downgraded during a row-lock wait | The other executor's next disposal plan fails with `PT403`. |
| Unrelated administrator or revoked approving actor | Disposal is denied; failed `begin_delete` leaves no partial status, inventory or command receipt. |
| Privileges and isolation | Service/browser cannot mutate/read restricted retired bindings; Storage and migration ledger remain empty. |

Reproduce only in a fresh database created by `scripts/release-fresh-database.mjs` from this exact candidate, with the dedicated native runtime and `RELEASE_TEST_DATABASE=levytate_release_offboard_identity_review20b` (or a fresh suffix). Run:

```sh
RELEASE_LOCAL_RUNTIME=/private/tmp/levytate-release-runtime.K6eWSi \
RELEASE_TEST_DATABASE=levytate_release_offboard_identity_review20b \
node scripts/release-offboarding-auth-reservations.mjs
```

The harness reads the local connection privately in process and reports only test labels, SQLSTATE on failure and aggregate results. It creates synthetic Auth catalogue rows directly; it does not exercise real login, external email, Auth API deletion, encrypted export delivery, Storage API deletion or hosted acceptance. Lifecycle transitions use the real service-role RPCs; synthetic export-envelope metadata exists only to reach the SQL disposal boundary. No candidate SQL changes were necessary.

Hosted acceptance and real-client activation remain separate approvals. These results do not approve managed-schema installation, retained security tombstones, legal schedules or any Production operation.
