# Local native startup migration gate

This procedure applies only to a new, isolated temporary PostgreSQL 17 acceptance runtime using the reviewed Supabase CLI 2.122.1 and current 28 migration chain. It does not authorise hosted execution. Production, the shared project, migration038, resets, migration repair, seeds and role imports remain excluded.

On 16 November 2026, the old creator put 28 reviewed migrations into the active project before `stack start`. CLI 2.122.1 applied them during startup, before the planned explicit dry-run. The existing `PpTKRn` runtime and its genuine ledger were preserved; its first application must remain recorded as lacking a pre-application dry-run. This change does not retrospectively repair or relabel that evidence.

The revised creator stores all 28 hash-checked files under `reviewed-project/supabase/migrations`, outside the active CLI project. The active `project/supabase/migrations` starts empty. The startup wrapper rejects SQL anywhere under active `project/supabase`, including nested files, and rejects symlinks. It records the native stack identity and private-state hash after successful startup. That record explicitly does **not** claim that the database has been checked empty.

The source identities are fixed to the reviewed release manifest `8685dbf196c76f7881017f7523a0f1bee412e0da2b6fded393271cc9de2a146f`, bootstrap manifest `f12810747526e66d45789840549be88046c14b8a152fc583f4897dc09e4718b6`, and 28 verified SQL files. A newly changed, even internally consistent manifest requires a separate review and gate update.

The creator records the installed CLI binary hash after requiring version2.122.1; subsequent checks require the same executable bytes and include that hash in the dry-run receipt binding. This protects against an accidental executable replacement after preparation. It does not replace verification against the official published CLI archive before installation.

## Explicit sequence

Use an exclusively owned idle runtime. Install the published-checksum-verified CLI binary there first. The following commands assume `RELEASE_LOCAL_RUNTIME` names that fresh `/private/tmp/levytate-release-runtime.*` directory on macOS. Offline Linux CI uses the corresponding `/tmp/levytate-release-runtime.*` prefix; only these two absolute prefixes are accepted, with real-path and symlink checks retained. Do not point them at an existing acceptance runtime or set hosted credentials.

```sh
node scripts/release-create-native-runtime.mjs
node scripts/release-start-local-stack.mjs
RELEASE_RUNTIME_QUIESCENT=true node scripts/release-stage-native-migrations.mjs stage
RELEASE_RUNTIME_QUIESCENT=true node scripts/release-stage-native-migrations.mjs dry-run
```

Stage performs a read-only live check before activating any SQL. It requires the exact guarded stack record, loopback PostgreSQL 17, no application relations/functions/types or application schemas, no migration ledger entries, no Auth users/identities/sessions, and no Storage buckets/objects. Managed schemas are explicitly allowlisted; unknown schemas fail closed. It repeats the empty check after copying the exact reviewed files. No SQL is executed by stage.

The gate also calls supported `stack status --output-format json` using the same isolated native environment and exact project workdir. CLI 2.122.1 startup returns a top-level `id`; its status response returns `identity.id`. The gate requires this exact structured status contract and rejects legacy or mixed identifier shapes. It privately compares the current runtime, stack identifier and database endpoint against the guarded startup record before staging, dry-run and apply, repeating the check at each final command boundary. This prevents a stale private state file from approving one empty database while the CLI targets another. Endpoint and credential values are never included in errors or evidence.

The untouched native database also contains the managed `_realtime` and `pgbouncer` schemas. The exact pinned CLI binary includes the former's schema creation; the verified PostgreSQL17.11.0.006 public archive creates the latter in `share/supabase-cli/migrations/init-scripts/00-schema.sql`. These two explicit names are allowed. Similar unknown names, including `pgclient` and `pgx`, remain rejected; the reserved system prefix is checked literally as `pg_`, not SQL's wildcard pattern `pg_%`.

Dry-run invokes only `db push --local --skip-vault --dry-run` with the generated project as its workdir. It requires exactly 28 scheduled filenames in their reviewed order, with no missing, duplicate, renamed, extra, seed or role SQL. It repeats the live empty check and records a restricted receipt containing safe hashes and filenames, not raw CLI output or credentials. Disabled-migration and up-to-date responses are not accepted as a first bootstrap dry-run.

Review the successful dry-run evidence before issuing the separate apply command:

```sh
RELEASE_RUNTIME_QUIESCENT=true node scripts/release-stage-native-migrations.mjs apply
```

Apply refuses without a matching successful dry-run receipt less than 30 minutes old. It rechecks exact source bytes, generated config, private stack identity, active files and the live empty database immediately before `db push --local --skip-vault --yes`. It then runs the existing exact ledger/catalogue/security verifier and requires empty Auth, Storage-object, employer and People counts. It never resets, restores, repairs or fabricates migration history on failure.

The old `release-local-command.mjs bootstrap-dry-run` and `bootstrap` entries delegate to this gate. There is no automatic stage or apply. `--skip-vault` excludes the CLI's otherwise separate Vault-secret update in both dry-run and apply.

## Restart and failure boundaries

Active SQL remains after apply or a failed attempt, so the guarded startup wrapper deliberately refuses a restart. To preserve the reviewed files outside the active project before a restart, use:

```sh
RELEASE_RUNTIME_QUIESCENT=true node scripts/release-stage-native-migrations.mjs deactivate
```

Deactivate moves only an exact reviewed migration directory to a timestamped preserved directory. Unknown contents, changed hashes, symlinks or unexpected SQL elsewhere in the active project cause refusal. It changes no database, ledger or config. A partially staged directory is also refused and requires inspection; the helper does not delete unknown contents. After deactivation a normal restart can use the empty active directory. A database already bootstrapped is intentionally ineligible for another fresh stage/apply cycle.

The historical `release-prepare-native-runtime.mjs` produces the old active-SQL layout and does not produce the new source evidence. The startup gate rejects it; it is not the supported creator for this procedure.

These helpers assume exclusive, quiescent ownership of the temporary project and use the shared acceptance lock. Filesystem checks reject observed symlinks and bound regular-file reads using `O_NOFOLLOW` and `fstat`. They do not claim protection against a malicious process concurrently replacing parent directories or forging restricted evidence. Do not use unguarded direct CLI startup while SQL is active: CLI 2.122.1 can apply it automatically.

## Verification status

The original independent regression used the real creator and startup wrapper with a fake CLI that only enumerated its input; it observed 28 active SQL files and failed the expected-zero assertion. The unchanged regression passes with this change. Unit tests exercise stage/dry-run/apply ordering, exact source identities, non-empty database rejection, changed config/state/SQL, unexpected SQL, receipt expiry and deactivation using explicitly mocked database/CLI boundaries. After the actual native-contract corrections,37 owner tests and49 independent tests passed. These offline tests are separate from native database and hosted acceptance.

On16November2026 a separately authorised fresh native PostgreSQL17.11 stack started with zero active application SQL. Initial preflight failures exposed the status DTO and two managed-schema differences documented above; both failures left zero active SQL and were retained. After independent source review, staging and the actual dry-run passed with exactly28 reviewed migrations scheduled. The final read-only check still found zero application relations/functions/types/schemas, Auth users/identities/sessions, and Storage buckets/objects. The application migration ledger remained absent. The literal-prefix check was also exercised using a read-only PostgreSQL `VALUES` query: it includes unknown `pgclient` and `pgx` names while excluding actual `pg_` system names.

[The sanitized proof](evidence/LEVYTATE_LOCAL_STARTUP_GATE_2026-11-16.json) preserves the initial failures, exact schedule and pre-apply empty metadata. The first proof stopped at dry-run. After separate review and authorisation, one guarded local apply completed while that receipt was current. Its post-verifier confirmed the real28-entry ledger,135/135 RLS tables, zero browser table/function grants, four private buckets and038 absent, with no Auth users, employers, People or Storage objects. Nine read-only Data API checks passed, including service reads, anonymous denials and the required release28 contract. No fixtures or Auth requests were created.

An independent schema-only comparison with the accepted local28 catalogue is pending; the new runtime is retained without reset, repair or repeat apply. The existing acceptance runtime is available to the verifier only for the separately authorised read-only schema comparison; its data and app remain untouched. No hosted project was accessed or changed by this proof.
