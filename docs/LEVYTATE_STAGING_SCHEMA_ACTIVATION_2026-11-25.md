# LevyTate isolated Supabase Staging — schema activation (25 November 2026)

## State and ownership

- Staging project: `levytate-staging` (`njyxfjkzbprowhnuwcud`), active in `eu-west-2` under the existing `AI-Apprenticeships` Free organisation. Supabase quoted **US$0/month** for project creation; no plan upgrade or cloud branch.
- Shared `mpr-consulting` project `lzwcahdgchrkeulmlfqv` and unrelated inactive `ai-apprenticeships` project were **not modified**.
- The user entered three staging-only Vercel environment variables through the secure UI. Read-only metadata verified each is marked **Sensitive**, targeting only **Preview** on `codex/levytate-free-staging-20261124`: `SUPABASE_SERVICE_ROLE_KEY`, `LEVYTATE_BETA_SESSION_SECRET`, `LEVYTATE_PROVIDER_SESSION_SECRET`. **Values were never read, copied, logged or committed by the engineering workflow.** Presence does not establish that the credentials are valid or that the Preview has picked them up.
- Four pre-existing Preview branch variables remain scoped to the same branch: `NEXT_PUBLIC_SUPABASE_URL=https://njyxfjkzbprowhnuwcud.supabase.co`, `LEVYTATE_BETA_LOGIN_ENABLED=false`, `LEVYTATE_PROVIDER_DELIVERY_ENABLED=false`, `LEVYTATE_REQUESTS_ENABLED=false`.
- Vercel Deployment Protection remains active. No Production environment variable, Production alias, customer record or external email was touched.

## Exact 30 staging-only schema migrations

On the previously empty staging project only:

1. Reviewed `006_create_levytate_production_foundation.sql` applied as `levytate_20261027174133_foundation`.
2. Exact, hash-locked generated convergence from **29** manifest sources applied as `levytate_20261027190000_fresh_convergence`, with SHA-256 **`3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204`**, matching `supabase/bootstrap/manifest.json`. Restricted `038` was excluded.
3. All **26 release migration** files were retrieved from exact reviewed source commit `ca4e62c0d3cc8d2a3f3de99e68680dcd61dae1a5`, applied in manifest order under `lt_<version>_<name>` labels.
4. The two previously locally validated provider SQL candidates `supabase/candidates/provider-delivery-v1.sql` and `supabase/candidates/provider-delivery-progress-v2.sql` applied to **this isolated staging project only** as `lt_staging_provider_delivery_v1` and `lt_staging_provider_progress_v2`. They remain **unapproved for the shared project or Production**.

The generated convergence SQL is retained in the separate engineering branch `codex/levytate-hosted-schema-plan-20261125` for review; its **SHA-256 was independently checked against the original bootstrap manifest before migration**. No vendor or customer secrets are in the generated SQL.

## Verified hosted database controls

Read-only SQL and Supabase migration listing observed:

- PostgreSQL major version **17**; **30 migration ledger entries**; **137 public application tables**; **all 137 with RLS enabled**.
- **0 organisations**, **0 Auth users**, **0 Storage objects**, no customer or fictional personal data.
- Both provider-delivery tables exist; anonymous browser roles cannot select provider reports or invoke the approval RPC; authenticated browser role cannot directly select provider grants.
- The old four-argument provider approval RPC is **absent**; the guarded five-argument employer/revision version is **present** and available to the server-side `service_role` only.
- Restricted pastoral migration `038` remains absent.
- Supabase security adviser: **4 WARN mutable-function-search-path** notices and **48 INFO RLS-enabled/no-policy** notices, requiring focused review before real customers. The no-policy tables may intentionally deny client access. The warnings must not be mistaken for audited production security approval.

## Deployment and acceptance gate

Pushing this *documentation-only* commit to the dedicated Preview branch triggers a new Vercel build **after** the staging-only credentials were entered. Record its exact SHA and deployment ID, observe `READY` and inspect the environment **names / branch metadata only**, not secrets. Vercel `READY` verifies build, not successful authenticated runtime.

**No hosted user workflow has passed yet.** Keep beta login, Requests and provider delivery disabled until staged test identity + controlled inbox plan, runtime service-role compatibility, signed cookies, Auth callback, real two-tenant boundary, rate limiting and privacy review are independently verified. Do not create real employer records, use any customer email address or enable autonomous/premium AI.

Recommended next checkpoint: use a fresh isolated Auth test account and captured test inbox inside this staging project; verify protected preview runtime uses this database and that sign-in/roles, provider consent and learner MI operate end-to-end. Do not copy any Production key into staging.

## Release decision

**Staging schema: activated and structurally verified. Protected Preview runtime / hosted end-to-end: NOT YET ACCEPTED. Real client pilot: NO-GO.** Existing Core and Add-ons remain preserved; all production-facing draft PRs remain unmerged.
