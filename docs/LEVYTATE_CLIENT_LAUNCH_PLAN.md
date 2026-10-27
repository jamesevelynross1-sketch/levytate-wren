# LevyTate client launch plan

- Status: **NO-GO for real-employer invitations or real workforce data**
- Audit date: 27 October 2026
- Audited source: `59547ede9b1cd62496516065ad7c306320e8acff`
- Audit branch: `codex/client-launch-readiness`
- Production deployment inspected: `dpl_9EZh69HyoRNCdwDHzZjTVezkyKgJ`

Document revision: this report is created by the audit on a descendant documentation commit; the audited source SHA above does not itself contain this file. Use Git history for the report commit.

This is the current launch-control plan for the first paying employer. It replaces assumptions based on historic Preview acceptance with dated source, runtime, deployment and database evidence. It does not authorise a Production change, a real customer account, a database migration, a paid-plan change or legal sign-off.

## Executive decision

LevyTate has a substantial, role-scoped Client V1 implementation, but it is not safe or operable for a first real employer today.

The immediate Production entry path is unavailable: the deployed application is alive, but readiness returns `503` and the Production environment is missing the session-signing secret required to complete magic-link authentication. The deployment is also on Vercel Hobby, which Vercel documents as personal/non-commercial only, and the committed production dependency graph reports one critical and five high advisories.

Even after restoring sign-in, the default application and learner journey is not yet client-safe. The legacy workflow can bypass the required Employee → current Line Manager → Apprenticeship Lead sequence, the one-active-application rule is not atomic, learner creation can bypass final application approval, employee imports report success before persistence is confirmed, and user provisioning does not deliver a controlled invitation.

Production aliases are already public, but this is not evidence of launch readiness. Freeze real-client onboarding and keep all testing fictional until every P0 gate in this document is closed and independently accepted.

## Evidence and source-of-truth order

Do not let an implementation defect redefine intended scope. Use three distinct authorities:

1. Current runtime, deployed configuration by variable name, and read-only live database/catalogue evidence are authoritative for **what exists now**.
2. `docs/LEVYTATE_LAUNCH_SCOPE.md` is authoritative for **what should launch**. `docs/LEVYTATE_LIFT_PRODUCT.md` and `docs/LEVYTATE_PASTORAL_SUPPORT.md` define optional-module restrictions.
3. Signed product, commercial, legal/privacy, operational and client records are authoritative for **what is authorised**.

Dated exact-commit validation, including this audit and `docs/LEVYTATE_CLIENT_ACCEPTANCE.md`, establishes evidence strength. Product specification and backlog guide strategy/roadmap, not current implementation status. Historic acceptance, foundation, migration and readiness documents remain dated records only.

### Reconciled conflicts

| Topic | Current launch position | Stale or bounded evidence |
| --- | --- | --- |
| Runtime roles | Employee, Line Manager, Apprenticeship Lead, Employer Admin and Platform Admin | Product specification and People import still mention Department Head. Department Head is not an authenticated launch role. |
| Approval | Employee → current Line Manager → Apprenticeship Lead → enrolment; a published enabled workflow may replace the fallback | Historic feature acceptance did not prove the current default path is server-enforced. The audit found it is not. |
| Domains | `app.levytate.co.uk` is the authenticated product; apex and `www` are public marketing | MVP architecture and Production foundation retain older single-domain assumptions. Auth delivery names the app domain, but hosted-setting claims need current dashboard revalidation and transitional localhost/Preview allowlist entries need an expiry/risk decision. |
| Persistence | Real Client V1 is server/Supabase backed and must fail closed | Production foundation material still describes beta-cookie/local fallback behaviour. |
| Database ledger | Live ledger contains `006`–`018`, `020`–`037` and `039`; `019` is intentionally absent and `038` is deliberately unapplied | Migration baseline and old Client V1 acceptance stop at earlier migrations. A normal linked dry-run cannot be treated as green while `038` remains interleaved. |
| Lift | Controlled fictional Preview only; zero real organisations enabled | Migration `039` exists, but schema presence is not activation approval. |
| My Support | Disabled in Production and all real organisations; migration `038` remains unapplied | Design and isolated migration validation are not safeguarding or launch approval. |
| Historic acceptance | Useful regression evidence, not current Production approval | `LEVYTATE_CLIENT_V1_ACCEPTANCE.md` and Release 4 readiness refer to older commits, domains, ledgers and deleted Preview evidence. |
| Local work | The audit branch starts clean from the verified remote baseline | The original checkout retains the user's `.gitignore` edit and local documentation commit `ba036ad`; neither was discarded or silently included. |

### Superseded operational records

These files are retained for history and now carry a visible supersession banner. Do not follow their operational steps without reconciling them to this plan.

| Record | Why it is not current launch authority |
| --- | --- |
| `LEVYTATE_MIGRATION_BASELINE.md` | Stops at `022` and assumes a normal green dry-run; current live history reaches `039` with `038` intentionally unapplied |
| `LEVYTATE_CLIENT_V1_ACCEPTANCE.md` | Historic Client V1 evidence only, ledger through `027`, old domain/promotion procedure |
| `LEVYTATE_PRODUCTION_READINESS.md` | Migration checklist stops at `023`; unresolved external gates remain useful |
| `LEVYTATE_LAUNCH_READINESS.md` | Release 4 evidence for an older commit and a Preview deployment that was later deleted |
| `LEVYTATE_MVP_ARCHITECTURE.md` | Old single-domain/default-code/future-Auth architecture |
| `LEVYTATE_PRODUCTION_FOUNDATION.md` | Old beta-cookie/local-fallback/future-Auth foundation |

## Capabilities genuinely present

These capabilities exist in source and have useful automated evidence. “Present” does not mean accepted for real users while the P0 gates remain open.

| Capability | Current evidence | Launch condition still required |
| --- | --- | --- |
| Standalone LevyTate application | App/marketing host split, app-scoped cookies, MPR chrome bypass and demo-host isolation are implemented; 28 Vitest checks include host routing | Restore Production readiness and execute authenticated browser smoke against the exact accepted deployment artifact ID and SHA |
| Blank employer workspace | Platform Admin creation inserts a Client V1 organisation and initial membership without demo operational records | Controlled invitation, hosted Auth acceptance and fresh blank-workspace browser test |
| Role/tenant-scoped reads | Sessions resolve membership server-side; Employee and manager reads add own/direct-report scoping; cross-tenant scripts exist | Fresh two-tenant live read/write matrix for every launch role |
| Provider/programme catalogue and selections | Server validates canonical active records and organisation selections; directory validation passed 47/47 with the correct TypeScript loader | Await UI mutations, test failure/retry states, confirm scheduled refresh intent |
| Configurable workflow engine | Static/in-memory validation passed 73 assertions | Keep disabled unless published and accepted; repair the unsafe fallback path regardless |
| Finance import and evidence | Organisation/role scoping, 10,000-row bound, fingerprints and calculations passed 52/52 checks | Deployed import, retry, export/reconciliation and data-source acceptance |
| Employer insights | Server role scoping, partial-source degradation, disclosure controls and print output exist | Structured operational export and current authenticated/mobile acceptance |
| Learner operations | Learner lifecycle, reviews, progress, operations and intelligence services exist | Enforce approved-application handoff and distinguish historical import from enrolment |
| Contextual Copilot | Role-scoped, platform-first deterministic context; contextual validation passed 16/16 | Distributed throttling, prompt/tenant abuse tests and deployed role acceptance |
| Assessments and Learning Time | Versioning, privacy/suppression and optional capability tests pass | Organisation approval plus legal/DPIA gates; Learning Time remains optional |
| Lift and My Support controls | Source and static validation confirm Production fail-closed behaviour | Remain disabled; each requires a separate signed activation programme |

## P0 blockers

P0 means the first real employer must not be invited until the item is closed with evidence.

| ID | Blocker and evidence | Required closure evidence |
| --- | --- | --- |
| P0-01 | **Production cannot establish an authenticated LevyTate session.** App and `www` readiness return `503`. Production lacks `LEVYTATE_BETA_SESSION_SECRET`; callback completion requires it to sign the LevyTate session. | Independently generated Production secret stored through approved secret management; exact `https://app.levytate.co.uk/levytate/auth/callback`; approved immutable redeploy; readiness `200`; fictional magic-link → terms → app → refresh → logout journey; app-host-only cookie proof; separate denied identity |
| P0-02 | **Commercial hosting is on Vercel Hobby.** The connected project reports Hobby; the official [Hobby plan](https://vercel.com/docs/plans/hobby) and [fair-use guidance](https://vercel.com/docs/limits/fair-use-guidelines) restrict Hobby to non-commercial personal use and provide only one hour of runtime logs. | Product owner/budget owner approves an appropriate Pro or Enterprise plan; billing and support ownership recorded; plan change performed by an authorised human; monitoring/log-retention decision evidenced |
| P0-03 | **Production dependencies have known severe advisories.** The 27 October 2026 14:48 UTC `npm audit --omit=dev` result reports one critical and five high vulnerable production packages. Direct Next.js `15.5.18` includes potentially reachable request/image-runtime advisories; the Windows-only RCE is not reachable on Vercel Linux. Other aggregate findings still require path-by-path triage rather than automatic launch-critical classification. See the exact advisory table in `LEVYTATE_CLIENT_ACCEPTANCE.md`. | Supported patch versions selected; regression suite and build pass; current production audit has no critical/high finding or an accountable security owner records a time-bounded, reachability-backed mitigation exception |
| P0-04 | **Default application decisions are not constrained by a server state machine.** Lead/Admin can bypass manager steps and arbitrary status/owner values can be written when configurable workflows are not enabled. Evidence: `components/levytate-mvp/ApplicationsModule.tsx:35-49,176-193,285-336` and `lib/server/levytate-workspace.ts:693-780,1753-1790`. | Server-enforced fallback transition graph; actor/current-owner/direct-report checks; skip/reverse/replay/forged-state tests; UI only renders currently authorised decisions |
| P0-05 | **One active application is non-atomic.** The server performs SELECT then INSERT and the database has no active-application uniqueness constraint. Evidence: `lib/server/levytate-workspace.ts:711-713,782-800` and `supabase/migrations/006_create_levytate_production_foundation.sql:109-123`. | Additive, backup-gated database constraint or transaction-safe equivalent; concurrent-create test produces exactly one success; clear conflict recovery UI |
| P0-06 | **Approved application → learner/enrolment handoff is not enforced and can partially persist.** Learner creation can start at `enrolled`, accept no application, or link an unapproved/wrong-employee application; follow-on progress/review writes can fail after the learner is created. The legacy workspace `saveEnrolment` and `updateEnrolmentStatus` mutations also bypass final approval. Evidence: `components/levytate-mvp/LearnersModule.tsx:226-260`, `lib/server/levytate-learner-lifecycle.ts:575-621` and `lib/server/levytate-workspace.ts:675-684,2003+`. | Explicit pre-enrolment action from final approval; server verifies same employee, final-approved application and selected provider/programme; direct enrolled creation and legacy bypasses rejected or retired; partial-write reconciliation; separate privileged historical-import path if required |
| P0-07 | **People import/manual save can claim false success and create invalid or ambiguous records.** Import save promises are ignored and the modal closes immediately; manual/API save accepts unverified manager/role references and platform-role values; no organisation/email or employee-number uniqueness constraint exists. Evidence: `components/levytate-mvp/EmployeesModule.tsx:169-183`, `components/levytate-mvp/MvpWorkspaceStore.tsx:238-269`, `lib/server/levytate-workspace.ts:1507-1529` and `supabase/migrations/006_create_levytate_production_foundation.sql:41-57`. | Awaited/batched committed/failed/skipped results; retry-safe identifiers; database uniqueness; same-tenant manager/role/platform-role validation on CSV and manual/API saves; mixed-row, lost-response, refresh and resume tests; no success count before authoritative persistence |
| P0-08 | **Secure invitation/activation is incomplete.** Platform Admin provisioning creates an Auth identity and membership but intentionally sends no invitation. People and membership pairing is manual; Auth lookup is capped at the first 1,000 users; unknown stored roles normalise to Employee instead of failing closed. Hosted redirect/signup/delivery settings are not independently accepted. Evidence: `lib/server/levytate-client-workspace-admin.ts:118-130`, `components/levytate-mvp/ClientWorkspaceAdminModule.tsx:67-73` and `lib/levytate/mvp/rbac.ts:270-281`. | Approved invite/reinvite/revoke flow with generic public responses, delivery event state, deterministic Employee/Manager People pairing, pagination-safe directory lookup, environment-specific callback policy, supported-role validation, bounce/expiry handling and first-login acceptance |
| P0-09 | **Database and file custody/recovery are unproven.** Current Supabase paid plan and managed-backup state could not be independently confirmed; there is no current restore drill, named owners, approved RPO/RTO or retention evidence. The prior runbook omitted `supabase_migrations`, did not preserve owner/ACL fidelity and did not cover Storage object bytes. | Dashboard evidence of approved paid plan and managed backups; named owner/approver; RPO/RTO/retention; fresh encrypted owner/ACL-preserving backup including the migration ledger; checksums; isolated database and Storage-object restore with catalogue/count/security/ledger/byte verification, or file workflows disabled with zero client objects; `CLA-DB-01`–`05` pass |
| P0-10 | **Migration control is not routine-safe.** Live has applied/validated `039` but not `038`; linked dry-run raises the missing-remote-history condition and suggests `--include-all`, which a real push would use to apply the approval-gated My Support migration. | Signed canonical manifest through `039`, explicitly marking `019` absent, `038` unapplied and `039` already applied; hashes/object probes; an implemented and tested supported active-tree strategy before any `040+` migration; intended next-migration dry-run proves `038` is not scheduled; `CLA-DB-06`–`08` pass |
| P0-11 | **Current full client acceptance has not occurred, and Preview backend isolation is not evidenced.** No fresh blank and populated fictional employer completed the exact deployed mandatory journey across all roles, P0 retry/concurrency cases, mobile and cross-tenant denial—or any unwaived conditional journey—on a protected candidate proven to use isolated non-Production database/Auth/Storage/email services. | `CLA-ENV-09` plus every mandatory and unwaived conditional test in `LEVYTATE_CLIENT_ACCEPTANCE.md` passes on one immutable candidate; after approval, the non-disruptive subset passes on the exact promoted deployment artifact ID and SHA |
| P0-12 | **External operational, legal and privacy gates remain unsigned.** There is no external monitor, named incident/support owners or alert drill; DPA/DPIA/privacy/retention/subprocessor/support records remain drafts or unchecked. | Accountable human approvals, named contacts, external monitoring and recovery drill, signed client-acceptance authority to issue real invitations |
| P0-13 | **Core authenticated writes do not consistently enforce request-origin and body-size boundaries.** Workspace, Platform workspace and Finance mutations do not yet share the stricter exact-origin/CSRF and byte-bounded JSON controls used by newer modules. | Shared guard applied to every launch write route; sibling-origin, absent/invalid origin and oversized-body tests pass; legitimate app-origin retry remains functional |
| P0-14 | **The release gate cannot yet enforce the evidence required for a safe launch.** LevyTate is largely outside lint, validators are fragmented, branch/ruleset protection is absent and CI does not require lint/typecheck/build/launch suites or independent review. | Versioned required-check inventory; green test/lint/typecheck/build/launch suites; protected designated release branch; pinned Actions; independent approval; immutable Preview → promotion evidence |
| P0-15 | **Controlled employer offboarding and data lifecycle are not implemented or accepted end to end.** Individual membership revocation exists, but no current evidence proves organisation suspension, all-session/invitation shutdown, authoritative export, retention/legal-hold execution, Storage cleanup or approved tenant deletion without cross-tenant impact. | `CLA-OFF-01`–`06` pass with a fictional tenant; named data/service owners; approved retention/deletion/export schedule; two-person irreversible-action control; client communication and evidence record |

## P1 usability and supportability issues

P1 work should be resolved before the first employer where it affects the chosen journey, or have a named owner and dated workaround.

| ID | Issue | Disposition |
| --- | --- | --- |
| P1-01 | Canonical `www.levytate.co.uk/status` returns `404`; `app/status` redirects to it. `/levytate/status` exists. | Add the missing marketing-host rewrite and route regression tests in the first package; `CLA-ENV-05B` is conditional |
| P1-02 | Production cron schedules exist without `CRON_SECRET` or provider refresh secret, so scheduled routes reject requests. | Decide which MPR/LevyTate jobs belong in this project; configure approved active jobs or remove unintended schedules |
| P1-03 | Provider/programme selection and non-core mutation UX can ignore results or lose user context on failure. | Standardise busy/success/error/retry and authoritative refresh behaviour; `CLA-CAT-04`/broad `CLA-RES-01` are conditional, while core People/learner cases remain P0-06/P0-07 |
| P1-04 | Fixed eight-hour session has a refresh route but no app recovery flow; `401` becomes a generic save warning. | Refresh or redirect predictably, retain unsaved form state and test revoked/expired sessions; `CLA-AUTH-07` is conditional |
| P1-05 | Department Head remains in employee CSV/UI data options although it is not an authenticated launch role. | Remove it from launch import/UI or model it explicitly as a non-auth organisational attribute; fail-closed authenticated-role validation remains mandatory under P0-08 |
| P1-06 | Employer Insights has print output but no structured workforce/finance evidence export. | Define first-client export fields, disclosure rules and reconciliation tests; `CLA-OPS-05` is conditional on the first-client contract |
| P1-07 | Copilot throttling is in-memory and IP-based, so it is neither distributed nor fair behind an employer NAT. | Use an approved distributed limiter keyed to authorised identity/organisation plus bounded IP protection; `CLA-AI-05` is conditional |
| P1-08 | Database hardening backlog includes browser grants, unforced RLS, deprecated `auth.role()` policies, mutable search paths, two public Lift trigger functions and leaked-password protection disabled. | Review after backup gate; use a forward migration with explicit ACL/policy intent, performance tests and rollback decision |
| P1-09 | Release-history clarity is weak: two `READY`, `target=production` builds of the same SHA occurred about eight minutes apart. No staged-promotion evidence was found; deployment history alone does not establish what triggered the earlier build. | Under P0-14, adopt an explicit promotion record that identifies trigger, approver, accepted artifact and rollback candidate |
| P1-10 | Baseline ignores only `.env*.local`; the original checkout has a preserved broader `.env*` edit. `supabase/.temp` is protected only locally. | Review and intentionally transplant ignore hardening without merging the divergent local branch |
| P1-11 | Retained MPR/LevyTate Prospect OS storage uses shared service-role access and has no live `storage.objects` policies. | Keep as a separate explicit security programme; do not expand browser access or claim it resolved by this launch plan |
| P1-12 | Vercel project metadata reports Node `24.x`, while `package.json` pins `22.x` and observed Production functions run `nodejs22.x`. | Record Node 22 as the accepted runtime and reconcile the project-default drift before a future runtime upgrade |

## Explicitly deferred or separately gated

The following must not delay a controlled core launch unless the first client contract explicitly requires them:

- Department Head as an authenticated runtime role.
- General Reports navigation and complex governance/audit exports.
- Provider ranking, matching scores, marketplace transactions or autonomous sourcing.
- Requests unless separately enabled and accepted for the employer.
- Learning Time unless separately enabled and accepted for the employer.
- Microsoft tenant/Copilot integration and broad third-party integrations.
- Predictive analytics and autonomous Copilot write actions.
- Lift for real users.
- My Support/pastoral support for real users; migration `038` remains unapplied.
- Wholesale visual redesign. Only journey-blocking usability defects belong in launch work.

## Recommended sequence

| Stage | Outcome | Exit gate |
| --- | --- | --- |
| 0 — Freeze | No real invitations, real personal data, alias change, paid-plan change or shared migration | Product owner acknowledges NO-GO; fictional-data testing only |
| 1 — Secure Production entry and request boundary | LG-01 delivers supported dependencies, reachable status, enforceable CI and the controlled secret/hosting decision; LG-01B applies exact-origin and bounded-body controls to launch writes | LG-01 criteria and `CLA-RES-02` pass; Production readiness and fictional sign-in are green |
| 2 — Database custody and migration control | Paid-plan/backup evidence, isolated restore, canonical ledger and tested active migration tree | `CLA-DB-01`–`08` pass before LG-02 or any shared migration |
| 3 — Application integrity | Server fallback state machine, atomic one-active rule and explicit approved-application → pre-enrolment handoff | Concurrency/RBAC/skip/replay tests pass on the restored/migration-controlled baseline |
| 4 — Controlled onboarding | Create/import the authoritative People hierarchy first, then activate Employee/Manager memberships only after deterministic email pairing; Admin/Lead may activate without People | Blank employer can invite all roles and import a clean hierarchy without false success or duplicates |
| 5 — Operating evidence | Mandatory learner partial-write recovery and tenant offboarding, plus unwaived provider/programme UX, structured export, session recovery and distributed throttling | Mandatory role journeys and each unwaived conditional journey pass; reports/exports in scope reconcile to persisted evidence |
| 6 — Full fictional acceptance | Fresh blank and populated two-tenant browser run on desktop/mobile using isolated non-Production database/Auth/Storage/email services | `CLA-ENV-09` plus every mandatory and unwaived conditional acceptance case passes on an immutable protected candidate |
| 7 — External readiness | Monitoring/incident/support, DPA/DPIA/privacy/retention and client approval | Named accountable owners sign the gate record |
| 8 — Controlled cutover | Approved candidate promoted without rebuilding; exact artifact-ID-and-SHA steady-state smoke and monitored launch | Production Ready, acceptance record signed, rollback candidate recorded, real invitations explicitly authorised |

## First bounded implementation package — LG-01 secure Production entry

This package removes the earliest technical and commercial entry blockers without changing the database or broad product behaviour.

### User outcome

A fictional authorised user can receive a magic link, complete sign-in on `app.levytate.co.uk`, accept terms, load the authenticated app, refresh and log out while operators can see truthful health. The deployed dependency graph has no unaccepted critical/high runtime advisory.

### Engineering scope

1. Upgrade Next.js and affected production dependencies to supported patched versions, preserving the approved React/Next major versions.
2. If `CLA-ENV-05B` is unwaived, fix the `/status` host rewrite and add apex/`www`/app route tests; otherwise record the approved external-monitor/status workaround, owner and expiry.
3. Refresh the auth and Core Early Access static validators to follow shared helpers instead of brittle string placement.
4. Expand required CI to run `npm test`, full LevyTate lint, `npm run typecheck`, `npm run build`, host routing, health contracts and the selected launch validators.
5. Add a credential-free environment manifest that checks required variable names by environment without reading values.
6. Produce a protected Preview and evidence pack. Do not promote it in this package.

### Owner-controlled actions required after code review

- Approve and perform the Vercel plan change appropriate for commercial use. This is paid infrastructure and is not authorised by this plan.
- Generate and store an independent Production `LEVYTATE_BETA_SESSION_SECRET` without exposing its value.
- Decide which scheduled jobs belong in Production and configure only the required secrets, or remove the schedules in a reviewed code change.
- Provide controlled fictional test identities and access to verify Supabase redirect/delivery settings.
- Authorise the exact deployment and Production change window. No alias or promotion change is implicit.

### Acceptance criteria

- `npm audit --omit=dev` reports no critical/high production vulnerability, or each exception has accountable owner, vendor evidence and expiry date.
- Required CI is green on the exact commit and cannot be bypassed on the designated Production branch.
- Protected Preview is `Ready`; `/levytate/status` returns `200`. If `CLA-ENV-05B` is unwaived, canonical `https://www.levytate.co.uk/status` returns `200` after the reviewed host rewrite reaches Production and accurately reflects readiness; otherwise the signed workaround evidence is attached.
- After separately approved configuration/deployment: app and `www` liveness and readiness return `200`.
- A fictional approved user completes magic link → callback → terms → app → refresh → logout.
- A revoked or wrong-tenant identity fails closed; no session cookie is issued to the marketing parent domain.
- External monitor observes outage and recovery and alerts two named owners.

### Likely affected files

- `package.json`, `package-lock.json`
- `middleware.ts`, `lib/levytate/hosts.ts`
- `tests/host-routing.test.ts`
- `scripts/validate-secure-employer-auth-foundation.mjs`
- `scripts/validate-core-early-access-boundary.mjs`
- `.github/workflows/test.yml`
- credential-free health/auth runbooks under `docs/`

### Dependencies and rollback

There is no database migration in LG-01. A deployment rollback restores prior code and packaged dependencies; environment configuration persists unless it is separately and explicitly reverted. In particular, the session secret is not embedded in an artifact and remains configured across a code rollback. Because the prior code would restore known dependency/status defects, rollback is emergency-only. Record the previous deployment ID, revalidate it against the current environment configuration before approval, stop onboarding on failure, preserve audit evidence, revoke affected sessions if needed, verify with fictional identities, and raise an incident.

## Subsequent implementation packages

| Package | Main affected areas | Dependency | Recovery approach |
| --- | --- | --- | --- |
| LG-01B authenticated request boundary | `lib/server/bounded-json.ts`; `/api/levytate-workspace`, `/api/levytate-platform/workspaces`, `/api/levytate-finance` and every Appendix A write route; focused origin/body-limit tests | Approved exact app/staging origins and route-specific byte budgets; LG-01 host contract | Roll the app deployment; no database reversal; retain rejected-request metrics without bodies or credentials |
| LG-02 application integrity | `ApplicationsModule.tsx`, `lib/server/levytate-workspace.ts`, RBAC/workflow tests, additive migration for active-application uniqueness | Fresh backup and isolated restore; decision on existing duplicate data | Roll app deployment; retain additive constraint unless a separately approved forward migration is required |
| LG-03 enrolment handoff | `ApplicationsModule.tsx`, `LearnersModule.tsx`, `lib/server/levytate-learner-lifecycle.ts`, lifecycle API/tests | LG-02 final approval contract; historical-import policy | Disable handoff UI and roll app; do not delete learner/application evidence |
| LG-04 invitation and People onboarding | `levytate-client-workspace-admin.ts`, workspace admin UI/API, `EmployeesModule.tsx`, import/store code, Auth delivery/monitoring, additive uniqueness migration | Hosted Auth/email acceptance, backup gate, invitation copy and controller decision | Stop sends/imports, revoke memberships/sessions, preserve delivery/import audit; forward-correct partial rows |
| LG-05 conditional operational evidence | Unwaived provider/programme UX, structured Insights export, session recovery and distributed rate limit | Product/Release Owner confirms each condition or signs its customer-safe workaround/owner/expiry; accepted source periods/disclosure rules and monitoring store | Feature/capability off where available; retain authoritative imports and audit history |
| LG-06 database/security hardening | New reviewed migrations and Supabase settings | Completed restore drill, exact grants/policies, security approval | Forward migrations only unless database owner approves a verified recovery point |
| LG-07 tenant offboarding and data lifecycle | Platform workspace admin/API, session and invitation revocation, tenant export manifest, retention/deletion worker, Storage cleanup and audit tests | Approved DPA/retention/legal-hold rules, Database Owner and client communication template | Suspend first; preserve immutable evidence; cancel irreversible deletion before approval boundary; restore only from the approved recovery point |

## Technical and external approval gates

| Gate | Accountable approval | Required evidence | Current state |
| --- | --- | --- | --- |
| Commercial hosting | Product/budget owner | Approved Vercel plan, billing owner, support/logging decision | **Blocked — Hobby** |
| Database custody | Database owner and release owner | Paid-plan/backup dashboard evidence, RPO/RTO, fresh backup and isolated restore | **Blocked — not evidenced** |
| Migration change | Database owner, release owner, product owner for affected feature | Canonical ledger/hashes/object probes, migration review, restore gate | **Blocked — `038` interleaving decision open** |
| Authentication/delivery | Technical owner and service owner | Hosted Auth export, app callback, sender/delivery monitoring, fictional invite smoke | **Blocked** |
| Security | Security owner | Dependency, RBAC/tenant, CSRF, grants/policies and credential review | **Blocked** |
| Operations | Service owner, primary and secondary incident owners | External monitors, alert/recovery drill, escalation and support process | **Blocked** |
| Tenant offboarding/data lifecycle | Data owner, service owner, release owner and client sponsor | Suspension, export, retention/legal-hold, Storage cleanup, two-person deletion drill and communication evidence | **Blocked — technical workflow not accepted** |
| Privacy/legal | Accountable business owner and qualified legal/privacy reviewers | Every mandatory checkbox/decision in `LEVYTATE_LEGAL_AND_SUPPORT_APPROVAL_CHECKLIST.md` and `docs/legal/LEVYTATE_LEGAL_DECISION_MATRIX.md`, including operator/legal entity and address, privacy contact, controller/processor roles, lawful bases/LIAs, employer instructions, Early Access/commercial/liability/termination/governing-law terms, supplier contracts/regions, DPA/DPIA/privacy, retention/deletion/export, subprocessors/transfers, ICO, support and account-request identity controls | **Blocked — drafts/checklist incomplete** |
| Product boundary | Product owner | Launch roles/modules, historical-import rule, export requirement and optional capabilities approved | **Partially defined** |
| Client acceptance | Client sponsor and LevyTate release owner | Signed acceptance record for exact deployment and permitted real invitations | **Not started** |

No technical test self-certifies the legal, privacy, commercial or client gates.

## Acceptance and recovery principles

- Use fresh fictional organisations and identities; never reset shared demonstration history to force a pass.
- A successful UI state requires authoritative server persistence and must survive refresh/new session.
- Exercise both a blank employer and a populated employer, plus a second tenant for denial tests.
- Test lost responses, retries, duplicate clicks, stale versions, expired sessions and mid-session revocation.
- Record exact commit, deployment ID, environment, browser/viewport, actor, timestamps and evidence owner.
- Stop onboarding on any P0 regression. Roll only to a recorded immutable deployment; do not rebuild an old branch.
- Do not reverse database state casually. Preserve evidence and use a reviewed forward fix unless database owners approve recovery under the backup/restore runbook.
- Never run a non-dry-run push with `--include-all` while `038` is unapproved, and never use it as migration-history repair. Any future approved use must name the exact migration/hash, recovery point and approvers. Never enable Lift/My Support, change a paid plan, expose a secret, create real users or move Production aliases without explicit approval.

The detailed executable matrix and current results are in `docs/LEVYTATE_CLIENT_ACCEPTANCE.md`.
