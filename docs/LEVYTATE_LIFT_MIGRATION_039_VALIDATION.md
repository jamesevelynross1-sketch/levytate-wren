# LevyTate Lift migration 039 — isolated validation evidence

Date: 21 October 2026
Shared Supabase project: not contacted or modified
Migration status: proposed only; not applied to the shared ledger

## Baseline and method

- Confirmed repository ledger contains migration 038; the read-only shared ledger ends at 037.
- Restored the restricted `pre037` archive dated 20 October 2026 into a disposable local PostgreSQL cluster.
- Verified the archive against its retained SHA-256 checksum before relying on it.
- Configured the cluster with no TCP listener and a private temporary Unix socket.
- Applied migration 037 in the isolated restore to reproduce the current shared schema boundary.
- Deliberately skipped repository migration 038, because it is not present in the shared ledger.
- Applied proposed migration 039 twice with fail-fast execution.
- Stopped the database and deleted the temporary cluster, socket and logs after validation.

## Results

| Check | Result |
| --- | --- |
| Restore | Pass |
| Migration 037 prerequisite | Pass |
| Migration 039 first application | Pass |
| Migration 039 second application / idempotency | Pass |
| Lift tables | 17 |
| Lift tables with RLS enabled | 17 |
| Lift tables with RLS forced | 17 |
| Lift service-role policies | 17 |
| `lift_enabled` default | `false`, not nullable |
| Published pilot framework rows | 1 after both runs |
| Existing organisation + user + employee rows retained | 201 aggregate rows |
| Existing pastoral tables retained | 9 |
| Temporary isolated environment removed | Pass |

## Scope review

Migration 039 is additive. It adds one disabled-by-default organisation capability, one version registry and sixteen organisation-scoped journey/history tables. It does not delete, update or reinterpret existing employer, employee, application, learner, assessment, finance or pastoral records. Browser roles receive no table privileges; service-role policies accompany explicit server checks.

This evidence validates SQL execution and structural controls in an isolated restore. It does not authorise application to shared Supabase, enable a shared organisation or seed a shared demonstration workspace.
