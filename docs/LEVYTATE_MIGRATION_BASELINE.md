# LevyTate Migration Baseline

## Canonical history

The canonical LevyTate Production migration history starts at version `006_create_levytate_production_foundation.sql`.

Versions `001`–`004` belong to legacy subscriber and public-site infrastructure. Version `005` belongs to an undeployed stock-signal subsystem. Those files are preserved unchanged under `supabase/legacy-migrations/non-levytate/` for audit history, but they are not LevyTate Production migrations and must not be included in LevyTate database pushes.

The active baseline is:

```text
006 007 008 009 010 011 012 013 014 015 016 017 018 020 021 022
```

Version `019_create_employer_provider_relationships.sql` belongs to the isolated `wip/provider-relationships-s2b` work and is intentionally absent from the active branch and Production ledger.

## Evidence used

The baseline was established only after:

- a PostgreSQL custom-format backup was created outside Git;
- its SHA-256 checksum was verified;
- it restored successfully into an isolated local PostgreSQL database;
- live and restored row counts, catalog objects, RLS settings and policies matched;
- every active LevyTate migration was compared with the final evolved live schema; and
- the live migration ledger was confirmed empty before repair.

The supporting backup was captured at `2026-08-04 13:40:39 UTC` with SHA-256 `076c70696c495a8c7848d0be913a43a0a4f76bd73187d4befd76d84c4488dd29`. Backup contents and credentials are not stored in this repository.

## CLI linkage

Install the official stable Supabase CLI and initialise the repository with:

```sh
supabase init
supabase login
supabase link --project-ref PROJECT_REFERENCE
```

Authenticate through the supported browser flow where possible. If a temporary personal access token is required, enter it through a restricted local credential file outside Git and delete it immediately after login. Never put access tokens, database passwords or connection strings in chat, command history, repository files or documentation.

After linking, independently verify `supabase/.temp/project-ref` matches the intended project. The `.temp` directory is local state and must remain ignored.

## Baseline repair procedure

Migration repair changes only `supabase_migrations.schema_migrations`; it must never be used as a substitute for applying required schema SQL.

Before any repair:

1. Verify a current backup and checksum.
2. Prove each proposed version is represented in the final evolved live schema.
3. Run `supabase migration list --linked` and confirm there are no unexpected local or remote versions.
4. Stop if any version is missing, divergent or unexplained.

For a proven version, use the installed CLI's supported syntax:

```sh
supabase migration repair --status applied VERSION --linked
```

After repair, require exact local/remote agreement and run:

```sh
supabase migration list --linked
supabase db push --linked --dry-run
```

The dry run must report that the remote database is up to date. Never follow it with a non-dry-run push unless a separately approved new migration is intended.

Never run `supabase db reset --linked`. Never replay historical migration SQL merely to populate the ledger.

## Future migrations

1. Start from the latest active version and choose the next unused version; do not reuse `001`–`005` or `019`.
2. Keep each migration focused, deterministic and reviewable.
3. Test it against an isolated database and confirm rollback/recovery expectations.
4. Take and verify a secure manual backup before any hosted schema change while managed backup readiness remains a launch gate.
5. Review tables, columns, constraints, indexes, functions, triggers, grants, RLS and policies.
6. Run application type-check, lint, build and relevant regressions.
7. Review `supabase migration list --linked` before and after the approved push.
8. Retain migration checksums and deployment evidence.

Supabase Pro and confirmed daily managed backups are mandatory before any real employer or employee data is loaded. Point-in-time recovery remains disabled unless separately approved, the spend cap remains enabled, and no second project is activated or resized without approval.
