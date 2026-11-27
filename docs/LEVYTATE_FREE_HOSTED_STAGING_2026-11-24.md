# LevyTate free hosted staging — separate project, first checkpoint (24 November 2026)

**Provisioned:** `levytate-staging`, Supabase project ref `njyxfjkzbprowhnuwcud`, organisation `AI-Apprenticeships` (`vmcdvnscpljcdmoxlilz`), **London `eu-west-2`**, `ACTIVE_HEALTHY`. An authoritative Supabase quote confirmed **US$0/month** for the Free project before creation; the user explicitly chose this organisation and the £0 route.

**Isolated by construction:** this is a **new standalone Supabase project**, NOT a Supabase development branch of shared `mpr-consulting` (`lzwcahdgchrkeulmlfqv`). Post-create observation: **zero public application tables, zero applied migrations**. No customer/Auth/Storage data was copied. The unrelated `ai-apprenticeships` project remains inactive and was not modified or repurposed. Free projects may pause from inactivity and have no automatic managed backups; treat this as development/fictional acceptance only.

## Protected Preview pairing — partial, fail closed

The existing Vercel project `levytate-wren` (`prj_NO1rAvQ8mrAeeeabgZGPVVUJTsB5`) retains its existing domains and deployment protection (`all_except_custom_domains`). The dedicated **`codex/levytate-free-staging-20261124`** Git branch has exactly four additional branch-scoped **Preview** variables:

| Variable | Branch-only setting |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://njyxfjkzbprowhnuwcud.supabase.co` |
| `LEVYTATE_PROVIDER_DELIVERY_ENABLED` | `false` |
| `LEVYTATE_REQUESTS_ENABLED` | `false` |
| `LEVYTATE_BETA_LOGIN_ENABLED` | `false` |

**No Production variable was updated.** These variables are only for this one protected Git preview branch; neither shared nor Production Supabase keys may be copied to this project.

**Critical limitation:** the Supabase connector can retrieve the separate public URL and publishable keys, but does **not** expose the project's secret/server credential. Therefore **`SUPABASE_SERVICE_ROLE_KEY` remains intentionally UNCONFIGURED**. The app cannot establish a fully authenticated hosted workspace until a newly generated staging-only credential is securely entered into **this branch's Preview environment** by an authorised operator through the Supabase and Vercel dashboards. Do not paste keys into ChatGPT, PRs, logs, command arguments, or files. The user must complete that protected UI action; no alternative credential must be substituted. Use distinct staging-only `LEVYTATE_BETA_SESSION_SECRET` and `LEVYTATE_PROVIDER_SESSION_SECRET` as required.

An already Ready Vercel Preview is not sufficient proof of backend configuration. After the credentials and approved schema are present, **redeploy the reviewed SHA** to get an immutable Preview whose runtime has the correct branch-scoped values. Independently observe the deployed `NEXT_PUBLIC_SUPABASE_URL` and project reference; verify the exact commit SHA, no real emails, deployment protection, and Production aliases unchanged.

## Schema / data acceptance gate

The reviewed local test chain is two fresh-project bootstrap migrations (anchor + generated, hash-locked convergence) followed by **26 reviewed release migrations = 28 total**, then the separately reviewed Provider Delivery V1 and Progress V2 candidates. The user has approved an isolated $0 staging project, **not** unreviewed changes to the shared database.

Before any application DDL, explicitly approve the exact fresh-project migration plan, source hashes and separate target project ID. The restricted migration `038` must remain unapplied; do not use `--include-all`. Provider V1/V2 are still candidate SQL, not approved hosted migrations. Obtain a separate staging backup and isolated recovery plan; Free has no automatic managed backup.

After approved schema activation, first seed **two entirely fictional employer tenants** through the dedicated staging entrypoint, using distinct synthetic provider identities and captured test email. Never import the shared project, employee names or real contacts.

## Staging snapshot gate

Use `validateLevyTateFreeStagingProvisioning()` from `lib/levytate/free-staging-provisioning.mjs` for strict, credential-free baseline metadata. It accepts only the project ref, organisation, region, zero initial tables/migrations, four branch-only env names and protected Preview. **PASS means provisioning isolation only**; it never means actual Auth, database schema, hosted acceptance, commercial readiness or signed GO.

### Current status

- Project provisioning: **PASS**, $0/month quoted
- Original two Supabase projects: **unchanged**
- Separate branch-scoped public Preview URL and disabled features: **CONFIGURED**
- Server-only staging credentials: **BLOCKED — authorised secure dashboard setup required**
- Schema migrations: **NOT RUN** (no cloud mutations)
- Protected Preview deploy and its precise backend pairing: **must verify exact branch commit**
- Two fictional tenant hosted end-to-end acceptance / recovery: **NOT RUN**
- Live customer use: **NO-GO**
