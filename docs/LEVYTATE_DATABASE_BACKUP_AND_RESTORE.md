# LevyTate Database Backup and Restore Runbook

## Purpose and go-live gates

This runbook covers a manual, encrypted-at-rest PostgreSQL backup and an isolated restore test for the LevyTate Supabase database. It does not replace Supabase managed backups.

Before any real employer or employee data is loaded:

- Supabase Pro must be active for the production project.
- Daily managed backup availability must be confirmed.
- Point-in-time recovery must remain disabled unless separately approved.
- The spend cap must remain enabled.
- A second Supabase project must not be activated or resized without approval.
- A fresh manual backup and successful restore validation must precede every schema migration until the migration baseline is repaired.

The Release Owner authorises a backup or restore exercise. The Database Owner performs it and records the evidence. Production restoration requires both roles to approve the target, recovery point, and customer-impact communication.

## Prerequisites

- PostgreSQL client and server tools at a version equal to or newer than the hosted PostgreSQL major version.
- The exact Supabase project reference independently confirmed in the dashboard.
- A secure local directory outside the repository, mode `0700`, on an encrypted Mac volume.
- A database password entered directly into a mode `0600` password file. Never put credentials in chat, command arguments, shell history, logs, documentation, or a connection URI copied into a ticket.
- Enough local space for both the archive and an isolated restored cluster.

Use the dashboard's direct database connection where IPv6 is available. Where it is not, use the documented IPv4 **Session Pooler** on port 5432 with the project-scoped database user. Never use the Transaction Pooler for `pg_dump` or `pg_restore` validation.

## Create the archive

Define task-specific paths without putting the password in an environment variable:

```sh
BACKUP_DIR="/secure/path/outside-the-repository"
BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/project-reference_${BACKUP_STAMP}.dump"
PASSFILE="/secure/temporary/path/database.pgpass"
install -d -m 700 "$BACKUP_DIR"
chmod 600 "$PASSFILE"
```

Confirm connectivity with `psql` using `PGPASSFILE`. Then create a custom-format archive:

```sh
PGPASSFILE="$PASSFILE" pg_dump \
  --host="SESSION_POOLER_HOST" \
  --port=5432 \
  --username="PROJECT_SCOPED_DATABASE_USER" \
  --dbname=postgres \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --file="$ARCHIVE" \
  2>"$ARCHIVE.pg_dump.log"
```

Include `supabase_migrations` only when that schema exists. Absence of that schema must be recorded as a migration-baseline limitation, not silently treated as success.

Restrict evidence files and validate the archive:

```sh
chmod 600 "$ARCHIVE" "$ARCHIVE.pg_dump.log"
shasum -a 256 "$ARCHIVE" >"$ARCHIVE.sha256"
chmod 600 "$ARCHIVE.sha256"
pg_restore --list "$ARCHIVE" >"$ARCHIVE.archive-list.txt"
chmod 600 "$ARCHIVE.archive-list.txt"
```

Review the dump log for warnings and errors. Record the client version, timestamp, duration, byte size, SHA-256 digest, included schemas, and archive object totals. Do not retain connection strings or credentials in evidence.

## Restore into an isolated local database

Use an ephemeral PostgreSQL cluster with network listening disabled. A disposable container is acceptable; a local cluster must use a temporary Unix socket and a non-default port.

1. Initialise the temporary cluster in a restricted directory.
2. Configure `listen_addresses=''` and a short, mode `0700` Unix-socket directory.
3. Start the cluster and create a dedicated restore-validation database.
4. Create non-login placeholder roles only when restored policies refer to managed Supabase roles, for example `service_role`.
5. A newly created local database may already contain an empty `public` schema. Drop that empty schema in the isolated database before restore; never do this against the hosted project.
6. Restore with fail-fast behaviour:

```sh
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="ISOLATED_RESTORE_DATABASE" \
  "$ARCHIVE"
```

The isolated server must have no TCP listener and no route or configuration that can write back to the hosted project.

## Validate the restore

Compare fresh, read-only live queries with the isolated restore. At minimum record counts for:

- organisations, users, employees, applications, enrolments, and learners
- providers and provider programmes
- operational actions and operational-action events
- authentication security and email-delivery events

Also compare catalog totals for schemas, tables, functions, triggers, foreign keys, unique constraints, indexes, RLS-enabled tables, forced-RLS tables, and policies. Verify representative partial unique indexes and authentication subject-binding constraints. Confirm the learner-lifecycle timestamp trigger function and the current authentication rate-limit and delivery-monitoring functions exist.

A restore is successful only when:

- `pg_restore` exits zero without unexpected warnings;
- every sampled live row count matches the restore;
- catalog and security-policy totals match live;
- the archive checksum is recorded; and
- any limitation is explicit.

## Cleanup and evidence retention

After validation:

1. Stop the isolated server.
2. Remove the temporary database cluster and socket directory.
3. Remove the password and `.pgpass` files immediately.
4. Confirm no credential appears in logs, shell history, Git, or retained documentation. If exposure is suspected, rotate the credential before continuing.
5. Retain only the restricted archive, checksum, archive list, dump/restore logs, and validation summary in the approved encrypted backup location.

Keep manual backups only for the period approved by the Database Owner. Disposal must delete every retained copy and record the archive name, checksum, deletion date, and authoriser. A restore incident must be escalated to the Release Owner before any production action; communications must state the recovery point, affected tenants, validation status, and rollback decision without exposing credentials or personal data.

## Migration-baseline boundary

A successful backup and restore proves recoverability; it does not repair Supabase migration history. Before recording historical migrations as applied, perform a separate schema-parity audit that maps every migration version to live tables, columns, constraints, indexes, functions, triggers, RLS settings, and policies. Only proven versions may then be repaired with the supported Supabase migration-repair command. Never replay historical migrations merely to populate the history table, and never mark an unverified migration as applied.
