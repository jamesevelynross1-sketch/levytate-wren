# LevyTate environment-name contract

## Purpose

`LEVYTATE_ENVIRONMENT_MANIFEST.json` is the credential-free release contract for the variable **names** required by each LevyTate deployment environment. It contains no values and can be checked in CI without injecting Preview or Production credentials.

The launch-critical deployed environments require these names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEVYTATE_BETA_SESSION_SECRET`

Development has no required names because repository build, lint and static tests must remain credential-free. Running the authenticated LevyTate journey locally still requires an explicitly approved non-Production backend and the same three names as Preview.

## CI check

Run the structural contract check with no environment or secret input:

```sh
node scripts/validate-levytate-environment-manifest.mjs
```

This verifies the manifest schema, environment set, sorted and unique variable names, and the launch-critical Preview/Production safety floor. The validator never reads runtime environment variables.

## Check an environment inventory

Capture only configured variable names from the approved hosting control plane. Do not export, copy or paste values. Store the names-only evidence outside the repository in this exact shape:

```json
{
  "environment": "production",
  "names": [
    "LEVYTATE_BETA_SESSION_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ]
}
```

Then compare it to the committed contract:

```sh
node scripts/validate-levytate-environment-manifest.mjs \
  --environment production \
  --names-file /approved/evidence/production-environment-names.json
```

The inventory schema accepts only `environment` and `names`. Files containing a `values` field or any other field fail closed, and the validator reports variable names and counts only.

## Evidence boundary

A passing names check proves presence by name only. It does not prove that:

- a secret value is strong, independent, current or correctly scoped;
- Preview points to isolated non-Production database, Auth, Storage, email and scheduled-job targets;
- hosted Auth redirect and delivery settings are correct;
- an optional capability is approved or safely configured;
- readiness is healthy; or
- an environment is approved for real employer data.

Those checks remain separate launch gates in `LEVYTATE_CLIENT_ACCEPTANCE.md`. In particular, the Production session secret must be independently generated and stored through approved secret management, and no script in this workflow may print or persist its value.

`CRON_SECRET` and provider-refresh secrets are not part of the core manifest while the Product and Release Owners decide which scheduled jobs belong in LevyTate Production. Add a variable to the required list only with the reviewed feature/configuration decision that makes it mandatory.
