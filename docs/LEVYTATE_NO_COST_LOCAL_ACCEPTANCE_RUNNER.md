# No-cost local PostgreSQL acceptance runner (22 November 2026)

This workflow is a **disposable local migration and isolation checkpoint**, not full user-journey acceptance.

- Workflow: `.github/workflows/levytate-local-core-acceptance.yml`; Linux GitHub Actions runner, no Supabase cloud project, no production credentials, no paid model calls, no production alias changes.
- Pinned official Supabase CLI version `2.122.1` with archive SHA256 `3e54b98e5ead7be0a3b0753526833d4cc9a55304e4d57da0d72f1efc342738ea` from the official GitHub release.
- Starts a fresh native Supabase stack with **zero application migrations active**, then verifies the empty database is PostgreSQL 17, stages exactly 28 reviewed migrations, checks the precise dry-run list, applies only to the disposable local loopback database and verifies the ledger, tenants, Auth users, access grants and Storage metadata.
- PostgreSQL client path and runtime evidence validation accept the reviewed Linux runner path without weakening the localhost host restriction. Existing macOS behaviour is preserved.
- The native stack requires downloadable official service archives and runner resources; any failure is a real blocked/failing test and must **not** be reported as passed. The branch does not self-certify access to any hosted environment.
- No secret values or browser login links should appear in logs or be exported as artifacts. Runtime secrets are generated only inside the disposable runner; stack stop output is suppressed.
- After this runner passes, extend the existing local test tooling to cover two synthetic tenants and genuine captured-email sign-in/application/manager/lead/learner/finance workflows. Those flows are **NOT RUN** by this bootstrap workflow.
- This workflow runs on its explicitly named development branch; it will not auto-run against or deploy the default/Production branch.

## Second-stage genuine fictional Core journey

The workflow now also prepares two fictional employers, uses a local-only GoTrue email hook and Mailpit SMTP capture, runs the Next.js application on loopback, and attempts genuine browser logins for Employee, Line Manager and Apprenticeship Lead. The accepted scenario tests Employee application -> manager decision -> Lead final approval -> pre-enrolment -> employee declaration -> verified enrolment/withdrawal, together with finance import, scoped reads, second-tenant denial, session refresh and logout. Playwright is pinned to 1.57.0 and installed only into the disposable GitHub runner.

This is **a test attempt, not a declared success** until its exact GitHub run finishes with the scripted assertions. It never uses Microsoft, paid models, cloud Supabase projects or real mail recipients. Each service remains loopback-only and artifacts containing Auth state are not uploaded. Existing special native-Edge zoom restrictions are unchanged; only generic macOS/Linux native runner paths are broadened.
