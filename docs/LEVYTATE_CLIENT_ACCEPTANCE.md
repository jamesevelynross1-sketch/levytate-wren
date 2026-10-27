# LevyTate client acceptance

- Status: **FAILED / BLOCKED — real-employer launch is not accepted**
- Evidence date: 27 October 2026
- Audited source: `59547ede9b1cd62496516065ad7c306320e8acff`
- Audit branch: `codex/client-launch-readiness`
- Production deployment: `dpl_9EZh69HyoRNCdwDHzZjTVezkyKgJ` (`Ready` at the Vercel artifact level)

Document revision: this report is created by the audit on a descendant documentation commit; the audited source SHA above does not itself contain this file. Use Git history for the report commit.

This document records current evidence and defines the executable acceptance matrix for the first paying employer. It supersedes claims that historic Preview or Client V1 acceptance is current Production approval. A Vercel `Ready` state, successful build or old workflow script is not client acceptance.

## Decision

**NO-GO.** Do not issue real invitations, create a real employer workspace, load real workforce data or represent LevyTate as launch-ready.

The current Production artifact matches the requested baseline and the main public/app host split works. However, Production readiness is `503`, the required session-signing secret is missing, magic-link completion cannot reliably establish a LevyTate session, the hosting plan is non-commercial Hobby, severe dependency advisories remain, and the core default application/onboarding/enrolment journey has server-side integrity gaps.

## Evidence labels

| Label | Meaning |
| --- | --- |
| PASS | Reproduced against the current source or deployment with the stated test |
| PARTIAL | Useful implementation/static evidence exists, but deployed user acceptance or an important state is missing |
| FAIL | A reproducible defect violates the launch contract |
| BLOCKED | The test cannot be accepted until a prerequisite or authorised environment is available |
| NOT RUN | No current evidence; historic results do not count as a pass |

`P1-CONDITIONAL` is a case class, not an evidence result. A conditional case may be waived only by the Product Owner and Release Owner with a documented customer-safe workaround, named delivery owner, client impact, and expiry date. Every P0-linked and every unmarked case is mandatory.

## Baseline and preservation

- The audit independently fetched the remote and started an isolated worktree from exact commit `59547ede9b1cd62496516065ad7c306320e8acff` on `codex/client-launch-readiness`.
- The original checkout remains on local commit `ba036ad9e5146b30bc1056c5e2e7927623b10731`, ahead one and behind 25 relative to `origin/feature/operational-rbac`, with the user's `.gitignore` edit preserved.
- The dangling/historic documentation work associated with `f15254c` was inspected, not merged. Its sales-storage risk remains a separate review item.
- No Production alias, customer, paid plan, shared migration, feature capability, credential or real data was changed by this audit.

## Current deployed evidence

Observed 27 October 2026, approximately 14:25–14:38 UTC.

| Check | Result | Status |
| --- | --- | --- |
| Production deployment SHA | `dpl_9EZh69HyoRNCdwDHzZjTVezkyKgJ` serves `59547ede...` and reports Vercel `READY` | PASS |
| Production artifact | [Deployment](https://levytate-wren-ey70j5xu4-jamesevelynross1-sketchs-projects.vercel.app) / [inspector](https://vercel.com/jamesevelynross1-sketchs-projects/levytate-wren/9EZh69HyoRNCdwDHzZjTVezkyKgJ); `target=production`; branch `release/icon-pages-2026-10-20`; created `12:22:02.842Z`; Ready `12:25:35.547Z` | PASS |
| Production aliases | App, `www` and apex custom domains resolve to `dpl_9EZ...` | PASS |
| Deployment protection | Project protection is `all_except_custom_domains`; the direct deployment URL returns `302` to Vercel SSO while the three custom Production domains are public | PASS |
| Duplicate build evidence | Earlier `dpl_BSrGZwKc1WeMGx8erHCYUDfxYAGB` was also `READY`, `target=production` for the same SHA about eight minutes earlier; trigger and staged-promotion evidence were not established | PARTIAL |
| Apex | `https://levytate.co.uk/` → `https://www.levytate.co.uk/` | PASS |
| Marketing home | `https://www.levytate.co.uk/` returns `200` | PASS |
| App root | `https://app.levytate.co.uk/` → `/login` | PASS |
| App login | `https://app.levytate.co.uk/login` returns `200` | PASS |
| Marketing login | `https://www.levytate.co.uk/login` → app login | PASS |
| Liveness | `/api/levytate-health/live` returns `200`/`operational` on app and `www` | PASS |
| Readiness | `/api/levytate-health/ready` returns `503`/`unavailable` on app and `www` | **FAIL** |
| Status page | `www/status` returns `404`; `app/status` redirects to that broken URL; `https://www.levytate.co.uk/levytate/status` returns `200` | **FAIL** |
| Production session secret | `LEVYTATE_BETA_SESSION_SECRET` is absent from Production by variable-name inspection | **FAIL** |
| Commercial hosting | Connected Vercel project reports Hobby; the official [Hobby plan](https://vercel.com/docs/plans/hobby) restricts it to non-commercial personal use | **FAIL** |
| External monitoring | No external monitor, named alert recipients or recovery drill evidenced; Vercel drain inventory could not be verified because the drains endpoint returned `404` | **FAIL** |
| Scheduled jobs | All three committed schedules lack their required Production secrets and their route guards deterministically return `401` | **FAIL** |

The public readiness body intentionally suppresses provider detail. Source and environment-name evidence together identify the missing session secret as a direct critical cause; database critical checks must still be retested after configuration is corrected.

## Current source-quality evidence

Dependencies were installed from the committed `package-lock.json` using npm `11.6.2` after npm `10.9.8` failed internally during clean install. The installed direct versions were verified, including Next.js `15.5.18`, React `19.2.6` and Vitest `5.0.5`.

| Command/evidence | Result | Interpretation |
| --- | --- | --- |
| `npm test` | 5 files, 28/28 tests pass; default suite is narrow | PASS |
| `npm run typecheck` | Pass | PASS |
| `npm run lint` | Pass for configured files; LevyTate is largely outside the lint command | PASS |
| `npm run build` | Pass; Next.js 15.5.18; 106 static/dynamic pages generated | PASS |
| `npm audit --omit=dev` | 1 critical, 5 high production vulnerabilities | **FAIL** |
| Launch Releases 1–4 | Pass; Release 2: 27, Release 3: 25, Release 4: 20 assertions; static/regression only | PARTIAL |
| Configurable application workflows | 73 assertions pass for the configurable engine, not the default fallback | PASS |
| Finance | 52/52 static/domain assertions pass | PASS |
| Client V1 layout | 20/20 static layout assertions pass; no current real-device run | PARTIAL |
| Service health contracts | 14/14 contract assertions pass; live readiness still fails | PARTIAL |
| Provider Intelligence | 47/47 static/domain assertions pass using `node --import tsx` | PASS |
| Progress Review Intelligence | 31/31 static/domain assertions pass | PASS |
| Contextual Copilot | 16/16 static/domain assertions pass | PASS |
| Requests V1.1 | 206/206 pass; optional capability, not launch enablement | PARTIAL |
| Assessments | Static/domain suite passes; separate DPIA/legal/organisation gate remains | PARTIAL |
| Learning Time | Static/domain suite passes; optional capability | PARTIAL |
| Lift | Product logic suite passes; real-user activation remains prohibited | PARTIAL |
| Pastoral support | 58/58; migration 037 checks 24/24; unapplied 038 checks 19/19; My Support remains disabled | PARTIAL |
| Secure employer auth static validator | 21 pass, 4 fail because checks drifted from shared cookie/expiry helpers and brittle text matching | FAIL |
| Core Early Access static validator | One exact-string check fails after pastoral capability arguments were added | FAIL |
| Runtime/live validators requiring localhost or service credentials | Failed to connect or lacked authorised configuration; not product-pass evidence | BLOCKED |

### Production dependency advisory inventory

Captured by `npm audit --omit=dev --json` and `npm ls next postcss sharp nanoid source-map-js zod --all` on 27 October 2026 at 14:48 UTC. “Reachability” below is audit triage, not an exploitability determination. The direct Next.js request/image paths are potentially reachable and unaccepted; no finding may be waived from aggregate severity alone.

| Installed path | Advisory IDs and affected range | First version outside all shown ranges | Reachability/decision |
| --- | --- | --- | --- |
| Direct `next@15.5.18` | `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`, `GHSA-4c39-4ccg-62r3`, `GHSA-p9j2-gv94-2wf4`, `GHSA-q8wf-6r8g-63ch`, `GHSA-955p-x3mx-jcvp` (`<15.5.21`); `GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4` (`<15.5.24`); `GHSA-4jqv-mc3x-m676`, `GHSA-mcj8-r9mp-w47p` (`<15.5.27`); `GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r` (`<=15.5.27`) | `15.5.28` closes every listed `15.5.x` range; compatibility must still be tested | Request, rewrite, Server Action and image-optimisation findings are potentially runtime reachable and therefore P0 until patched or specifically mitigated. `GHSA-p293-qw3h-jr36` is Windows-host-only and is not reachable on observed Vercel Linux. |
| Direct/Next `postcss@8.5.15` | `GHSA-fxqj-rqcc-2cmp` (`<=8.5.22`), `GHSA-r28c-9q8g-f849` (`<=8.5.17`) | `8.5.23` | Primarily build/source-map processing; no attacker-controlled Production source-map input was proven. Patch or record a bounded build-pipeline exception. |
| `next > sharp@0.34.5` | `GHSA-f88m-g3jw-g9cj` (`<0.35.0`), `GHSA-rgj7-g3m4-5g8c` (`<0.35.4`), `GHSA-wq5f-xc86-pv6w` (`<0.35.5`) | `0.35.5` | Potentially reachable through Next image optimisation if hostile image formats/sources can be supplied; validate actual configuration and patch. |
| `postcss > nanoid@3.3.12` | `GHSA-28wg-ghj8-5hjv` (`<3.3.16`), `GHSA-2v37-7h3g-55p8` (`<3.3.18`) | `3.3.18` | No untrusted custom-size generator path was established. Patch transitively or document the absence of that call path with expiry. |
| `postcss > source-map-js@1.2.1` | `GHSA-68fv-2mgg-jv7q` (`>=1.0.0 <1.2.2`) | `1.2.2` | No Production indexed-source-map input path was established. Patch transitively or document the build-only boundary with expiry. |
| Direct/MCP `zod@4.6.5` | `GHSA-mrhx-c7xc-m3w5` (`<4.6.6`) | `4.6.6` | Oversized constrained collections can exhaust memory. Because launch APIs lack uniform byte bounds, treat as potentially reachable until patched and request limits are enforced. |

### Quality-gate limitations

- `npm test` includes only `tests/**/*.test.ts`; `.cjs` tests and numerous `scripts/validate-*` suites are outside the default gate.
- The configured lint command targets MPR/stocks paths and a few shared files rather than the LevyTate application.
- GitHub Actions runs install and `npm test`, but does not require lint, typecheck, build, launch validators, deployed health or browser acceptance.
- Repository rulesets are empty; GitHub default branch `demo/wren` and effective release branch `release/icon-pages-2026-10-20` both report “Branch not protected”; no independent review requirement was found.
- Vercel project metadata reports Node `24.x`, while `package.json` pins `22.x` and observed Production functions run `nodejs22.x`; Node 22 is the current actual runtime and the project-default drift needs reconciliation.
- Several historical live scripts depend on mutable shared fixtures and are not a substitute for a new isolated acceptance employer.

## Database and environment evidence

Read-only linked CLI evidence against project reference `lzwcahdgchrkeulmlfqv` was captured on 27 October 2026.

| Check | Result | Status |
| --- | --- | --- |
| PostgreSQL | 17.6 | PASS |
| Migration ledger | `006`–`018`, `020`–`037`, `039`; `019` absent by design; `038` local-only/unapplied | PARTIAL |
| My Support 038 objects | Absent live; this proves object absence only, not every code/capability boundary | PASS |
| Lift 039 objects | Present; this proves shared-schema state, not real-user activation approval | PASS |
| Table RLS | 111/111 LevyTate tables have RLS enabled; 64 force RLS | PARTIAL |
| Policies/grants | 32 RLS tables have no policy; 34 have anon grants; 34 authenticated grants; 74 policies use deprecated `auth.role()` | PARTIAL |
| Security settings | Leaked-password protection is disabled; two public Lift trigger functions and mutable search paths require explicit remediation/acceptance | FAIL |
| Performance/policy advisors | RLS-without-policy and deprecated-policy information requires table-by-table review | PARTIAL |
| Managed backups/plan | Not independently confirmed | BLOCKED |
| Current isolated restore | No dated exercise/evidence was available to inspect | NOT RUN |
| Storage | Core buckets private but no size/MIME limits; no `storage.objects` policies observed; retained sales apps use shared service-role path | PARTIAL |

A normal `supabase db push --linked --dry-run` is not a valid green gate while unapplied `038` sits before applied `039`; it raises the missing-remote-history condition and suggests `--include-all`. Never run a non-dry-run push with `--include-all` while `038` is unapproved, and never use it as migration-history repair. A future use requires a signed decision naming the exact migration/hash, recovery point and approvers. Before any `040+` migration, implement and test a supported active-tree strategy that prevents `038` from being scheduled.

## Current end-to-end acceptance matrix

| Journey | Current result | Blocking evidence |
| --- | --- | --- |
| Platform Admin creates blank employer | PARTIAL | Source creates a blank org/membership; not rerun through current deployed UI; Production auth unavailable |
| Employer Admin/Lead invitation and first login | FAIL | Provisioning sends no invitation; hosted callback/delivery not accepted; Production session secret absent |
| Invite Employees and Line Managers | FAIL | Same limitation; People record and membership pairing is unguided |
| Bulk import People | FAIL | UI reports success without awaiting persistence; no organisation/email uniqueness |
| Select provider and programme | PARTIAL | Server validation is sound; UI mutation results are not awaited; deployed journey not run |
| Employee discovers and applies | FAIL | One-active guard is non-atomic; fallback status creation is too permissive |
| Line Manager performs current-direct-report decision | FAIL | Read scoping is strong, but fallback transition enforcement can be bypassed by Lead/Admin |
| Apprenticeship Lead final approval | FAIL | Fallback state machine is not server-enforced |
| Approved applicant moves into learner operations | FAIL | Learner creation does not require final-approved same-employee application and can start enrolled |
| Operations Centre and follow-up | PARTIAL | Implementation and historic scripts exist; no current exact-candidate browser run |
| Finance import/evidence | PARTIAL | 52/52 domain checks pass; no current deployed refresh/retry/export acceptance |
| Employer Insights/export | PARTIAL | Role-scoped view/print exists; structured employer evidence export is absent |
| Contextual Copilot | PARTIAL | Role-grounded source evidence passes; no current deployed abuse/role matrix; limiter is in-memory/IP-only |
| Mid-session role/membership revocation | PARTIAL | Server revalidates membership per request; no current exact-candidate browser run |
| Session expiry/retry | FAIL | UI has no complete refresh/reauth recovery path and can surface a generic save warning |
| Desktop/mobile/keyboard | BLOCKED | Static responsive controls exist; no current authenticated device/viewport run |
| Cross-tenant writes | BLOCKED | Scripts/historic evidence exist; fresh two-tenant exact-candidate run not completed |

## Executable acceptance suite

Every unmarked case is mandatory. Cases explicitly marked `P1-CONDITIONAL` may be waived only under the rule above. All mandatory and unwaived conditional cases must pass on a protected immutable candidate with fictional data and an isolated non-Production backend under `CLA-ENV-09`. After explicit approval, the non-disruptive smoke subset must pass on the exact promoted deployment artifact ID and SHA; rebuilding the same SHA is not equivalent because environment and build inputs can differ.

### A. Environment, release and recovery

- **CLA-ENV-01** — Record clean Git tree, exact SHA, branch, deployment ID, target environment and previous approved rollback deployment.
- **CLA-ENV-02** — Required CI runs test, full LevyTate lint, typecheck, build, host routing, service-health contracts and selected launch suites.
- **CLA-ENV-03** — Production dependency audit has no unaccepted critical/high result.
- **CLA-ENV-04** — App, `www` and apex routing match the split-domain contract; no MPR chrome appears on login/app.
- **CLA-ENV-05A** — On the protected candidate, the healthy baseline returns `200` for liveness/readiness. During a controlled critical dependency failure, liveness remains `200`, readiness becomes `503`, and recovery returns readiness to `200`.
- **CLA-ENV-05B — P1-CONDITIONAL** — `/levytate/status` returns `200` on the protected Preview. After the host rewrite is separately approved and reaches Production, canonical `https://www.levytate.co.uk/status` returns `200`, shows “Operational” in steady state and truthfully renders a dependency disruption without exposing provider detail.
- **CLA-ENV-06** — External monitor alerts two named owners, suppresses duplicates and sends recovery notification.
- **CLA-ENV-07** — On the protected candidate or a separately approved resilience window, a rollback drill returns the chosen immutable deployment and rechecks auth, RBAC, health and logout without database reversal. Routine Production smoke verifies rollback-candidate availability but does not execute rollback.
- **CLA-ENV-08** — Vercel and Supabase commercial/backup plans, support contacts and billing owners are recorded.
- **CLA-ENV-09** — Before any stateful, failure-injection, forged-write, restore or deletion case, record that the protected candidate uses isolated non-Production Supabase database/Auth/Storage, email sender/mailboxes and scheduled-job targets with zero real data. If any Preview variable points to the shared Production backend, those cases are BLOCKED unless a separately approved resilience window confirms zero real/customer data, named incident/data owners, exact fixture scope and recovery point.

### B. Database custody, restore and migration control

- **CLA-DB-01** — Current Supabase plan, managed-backup enabled state, last successful backup and retained recovery window are captured from the authoritative dashboard without exposing credentials.
- **CLA-DB-02** — Named Database Owner, restore approver and incident backup are recorded with approved RPO, RTO, retention and restore-communication rules.
- **CLA-DB-03** — A fresh restricted custom-format archive includes `public`, `auth`, `storage` and `supabase_migrations`, retaining object owners and ACLs; timestamp, size, schema/object/owner/grantee inventories and SHA-256 are retained outside Git. Every in-scope private bucket also has an encrypted object-byte export with key/version/size/content-type/per-object checksums, or file workflows are disabled and zero client objects are proven.
- **CLA-DB-04** — The archive restores ownership/ACLs with fail-fast behaviour into an isolated, non-networked PostgreSQL environment using only recorded NOLOGIN placeholder roles and no Production write path. Storage objects restore into a non-Production target/harness and pass allowed/cross-tenant-denied retrieval.
- **CLA-DB-05** — Fresh live read-only results match the restore for required row counts, tables, functions, triggers, constraints, indexes, RLS/forced-RLS, policies, owners, ACL/grants and the `supabase_migrations.schema_migrations` ledger; Storage key/byte/count/checksum metadata also matches when file workflows are in scope.
- **CLA-DB-06** — A dated canonical manifest records `006`–`039`, explicitly marks `019` absent, `038` unapplied and `039` applied, and records hashes/object probes for `038` and `039`.
- **CLA-DB-07** — A supported active-tree strategy for unapplied `038` is implemented and tested; `supabase migration list --linked` matches the manifest without pretending `038` was applied.
- **CLA-DB-08** — The intended next migration dry-run schedules exactly the reviewed migration(s), never `038`; no non-dry-run `--include-all` or history-repair shortcut is used.

### C. Blank employer and tenant isolation

- **CLA-TEN-01** — New Client V1 organisation has zero People, memberships beyond the approved initial user, applications, learners, enrolments, actions, private selections, Finance rows, assessments and support data.
- **CLA-TEN-02** — The blank organisation can read only approved global catalogue/reference content; no demo record is present.
- **CLA-TEN-03** — A populated second employer cannot read or mutate first-employer IDs through every route family and workspace mutation in Appendix A.
- **CLA-TEN-04** — Forged/nonexistent/cross-tenant organisation, employee, manager, role, application, learner, provider, programme, Finance and assessment IDs, plus invalid platform-role values, fail closed through CSV and manual/API writes.
- **CLA-TEN-05** — Demo routes return the intended public/demo boundary and cannot share a real-client session or records.

### D. Invitations, authentication and access lifecycle

- **CLA-AUTH-01** — Lead/Admin/Manager/Employee invitation is delivered through the approved sender with generic public responses and auditable sent/delivered/bounced state.
- **CLA-AUTH-02** — A protected pre-Production test uses one exact approved staging/custom-domain callback URI or one immutable Preview callback URI. Production requests always generate exactly `https://app.levytate.co.uk/levytate/auth/callback` and never accept a user-controlled `redirectTo`; final Production smoke is app-domain-only. If provider access is approved, its separate exact provider callback is allowlisted and tested independently. Export the shared-project hosted allowlist and remove localhost/obsolete Preview entries where feasible, otherwise record owner, client impact and expiry/removal date.
- **CLA-AUTH-03** — First login binds the verified Auth subject to exactly one active membership and enforces terms. Employee and Line Manager memberships must deterministically match one active same-email People record; Employer Admin and Apprenticeship Lead may intentionally activate without a People record, including the initial blank-workspace user.
- **CLA-AUTH-04** — Duplicate invite, existing Auth user, expired link, replay, bounced address and reinvite have explicit safe outcomes.
- **CLA-AUTH-05** — Session cookie is Secure, HTTP-only, SameSite and app-host-only; marketing host receives no authenticated cookie.
- **CLA-AUTH-06** — Role or membership change takes effect on the next request; revocation mid-session blocks both page and API.
- **CLA-AUTH-07 — P1-CONDITIONAL** — Session expiry preserves unsaved input where possible and provides a clear reauthentication path; refresh cannot broaden role/tenant scope.
- **CLA-AUTH-08** — Logout invalidates the current provider session where available, always clears local state, and remains safe when the provider revoke call fails.
- **CLA-AUTH-09** — Directory lookup works beyond 1,000 users without duplicate identity creation.

### E. Role and navigation boundaries

- **CLA-RBAC-01** — Employee sees only own application/apprenticeship and permitted optional modules.
- **CLA-RBAC-02** — Line Manager sees and decides only current direct reports.
- **CLA-RBAC-03** — Apprenticeship Lead and Employer Admin see only their organisation and only their authorised decisions.
- **CLA-RBAC-04** — Platform Admin can provision/support but cannot perform employer application, learner, Finance, assessment or Copilot decisions.
- **CLA-RBAC-05** — Department Head cannot be provisioned as a launch authenticated role and cannot approve an application.
- **CLA-RBAC-06** — Unknown/stale role values fail closed rather than silently becoming an unintended Employee session.

### F. People import and onboarding

- **CLA-PEO-01** — Valid CSV imports hierarchy and roles; success count equals committed rows after refresh/new session.
- **CLA-PEO-02** — Missing headers, bad email, invalid platform role, duplicate input email, existing organisation email, duplicate employee number and nonexistent/cross-tenant manager or organisational-role reference are reported per row.
- **CLA-PEO-03** — Mixed valid/invalid rows follow the approved all-or-explicit-partial rule and retain a downloadable correction result.
- **CLA-PEO-04** — Network failure/lost response can be retried without duplicate People records; reconciliation identifies committed rows.
- **CLA-PEO-05** — Manual/API People save validates the same fields and same-tenant manager/role references as CSV, awaits persistence, keeps the form on failure and does not launch discovery early.
- **CLA-PEO-06** — The authoritative People hierarchy is created/imported first; Employee/Manager invitations remain pending until deterministic email pairing succeeds. Employer Admin/Lead activation may proceed without a People record.

### G. Provider and programme portfolio

- **CLA-CAT-01** — Employer selects only active canonical providers/programmes; forged, inactive or unverified records are rejected.
- **CLA-CAT-02** — Programme selection ensures the provider relationship and persists after refresh/new session.
- **CLA-CAT-03** — Provider deactivation applies the documented programme consequence without changing another tenant or the global catalogue.
- **CLA-CAT-04 — P1-CONDITIONAL** — Failed selection/deactivation shows no success, retains user context and supports safe retry.

### H. Application and approval integrity

- **CLA-APP-01** — Employee creates/saves/submits only own application to the organisation-published programme.
- **CLA-APP-02** — Employee exploration, saving and Copilot remain available while one active application exists, but second draft/create/submit is rejected.
- **CLA-APP-03** — Two concurrent active creates for one employee produce exactly one success and one safe conflict.
- **CLA-APP-04** — Submitted answers lock until information is requested; information-return/resubmit follows the exact current owner.
- **CLA-APP-05** — Only the current Line Manager can perform the manager step; Lead/Admin cannot impersonate or skip it.
- **CLA-APP-06** — Only the Apprenticeship Lead can perform the final step after manager approval.
- **CLA-APP-07** — Skip, reverse, replay, duplicate click, forged status/owner, stale expected state and lost-response retry are rejected or return the exact prior result.
- **CLA-APP-08** — If configurable workflows are enabled for the first employer, a published version is pinned to each application and later edits do not rewrite in-flight history; otherwise capability/configuration evidence proves the engine is disabled and the accepted server-enforced fallback is the only path.
- **CLA-APP-09** — Decision note requirements and audit events are retained for approve, decline and request-information outcomes.

### I. Enrolment and learner operation

- **CLA-LRN-01** — Final approval exposes one explicit start-pre-enrolment action.
- **CLA-LRN-02** — Server requires the final-approved application, same employee, selected programme/provider and organisation before creating pre-enrolment; the legacy workspace `saveEnrolment` path enforces the same contract or is disabled.
- **CLA-LRN-03** — Direct `enrolled` creation, blank/unapproved/wrong-employee application, duplicate learner, and legacy `saveEnrolment`/`updateEnrolmentStatus` bypass attempts are rejected.
- **CLA-LRN-04** — If historical learner import is approved for the first employer, it is a separate privileged, labelled, audited path with its own validation; otherwise the route/action is absent or disabled and ordinary learner creation cannot impersonate an import.
- **CLA-LRN-05** — Pre-enrolment readiness gates enrolment; review/progress/action writes survive refresh and are retry-safe.
- **CLA-LRN-06** — Failure after learner creation cannot silently leave partial progress/review state; UI offers resume/reconciliation.

### J. Finance, Insights and operations

- **CLA-OPS-01** — Finance accepts valid bounded CSV, rejects malformed/oversized/>10,000-row input, handles duplicate fingerprints and persists exact period/source/balance evidence.
- **CLA-OPS-02** — Finance/Insights counts reconcile to underlying persisted application, learner, action and transaction records after refresh/new session.
- **CLA-OPS-03** — Missing source evidence appears as unavailable, never zero or invented forecast.
- **CLA-OPS-04** — Source failure produces truthful partial Insights with retry; disclosure/small-group suppression is identical on screen and print, and on the conditional structured export when it is in first-client scope.
- **CLA-OPS-05 — P1-CONDITIONAL** — If the first-client contract requires structured Insights evidence, the agreed narrow export contains only authorised fields, explicit evidence periods/timestamps and no hidden personal/sensitive text. General governance/reporting exports remain deferred.
- **CLA-OPS-06** — Operational action duplicate/lost response is idempotent and completed/cancelled actions leave attention counts.

### K. Copilot and optional-module boundaries

- **CLA-AI-01** — Employee-own, manager-direct-report and Lead/Admin organisation scopes are enforced for every audited Copilot intent in Appendix A; returned entity links repeat the same authorisation check.
- **CLA-AI-02** — Forged role/entity, cross-tenant prompt, prompt injection and unsupported general-chat requests fail safely.
- **CLA-AI-03** — Answers distinguish catalogue facts, employer selections, learner evidence and unavailable information; no invented provider/funding claim.
- **CLA-AI-04** — Any supported draft remains editable and no decision/write occurs without the existing authorised workflow.
- **CLA-AI-05 — P1-CONDITIONAL** — Distributed rate limiting isolates identities/organisations and does not unfairly throttle a whole employer NAT.
- **CLA-OPT-01** — Lift GET/POST remains unavailable in Production even if flags are set; no real organisation is enabled.
- **CLA-OPT-02** — My Support remains hidden/unavailable in Production and no pastoral data appears in general workspace, Insights or Copilot.
- **CLA-OPT-03** — Requests/Learning Time appear only for an explicitly accepted enabled organisation.

### L. Resilience, browser and accessibility

- **CLA-RES-01 — P1-CONDITIONAL** — Every versioned workspace mutation and specialised write route family in Appendix A is covered by an explicit duplicate-click/lost-response/`4xx`/`5xx`/offline/retry/refresh-reconciliation case appropriate to that write. Specific P0-linked retry/concurrency cases elsewhere remain mandatory even if this broad matrix is waived.
- **CLA-RES-02** — Exact-origin/CSRF and bounded-body controls reject sibling-origin and oversized mutation requests.
- **CLA-RES-03** — Chrome/Edge current desktop plus 320 px and 375/390 px mobile complete invitation, import, application, approval, Finance and logout without horizontal page overflow.
- **CLA-RES-04** — Keyboard-only navigation, drawer, modal focus trap, forms, error summary and visible focus work; labels/status announcements are understandable.
- **CLA-RES-05** — No raw database/provider/configuration error, credential, login code or authentication state appears in UI, logs, screenshots or evidence attachments.

### M. Employer offboarding and data lifecycle

- **CLA-OFF-01** — Suspending a fictional employer immediately blocks every membership at page and API boundaries while leaving the second tenant unaffected; public responses remain generic.
- **CLA-OFF-02** — Suspension/revocation invalidates active sessions on the next request, cancels pending invitations and reinvites, stops scheduled employer communications/jobs, and records actor/reason/time.
- **CLA-OFF-03** — An authorised tenant export follows a versioned manifest across database records and in-scope Storage objects, is encrypted and time-limited, reconciles counts/checksums, excludes other tenants and records requester/approver/delivery/deletion evidence.
- **CLA-OFF-04** — Retention, legal-hold and deletion schedules are deterministic per data class; a hold prevents deletion; due/pending/completed exceptions are visible to named data/service owners without exposing content.
- **CLA-OFF-05** — A two-person-approved deletion drill on a fictional tenant removes or irreversibly anonymises scoped database/Auth/Storage content while retaining only specifically authorised audit/financial/legal evidence; cross-tenant counts and access are unchanged.
- **CLA-OFF-06** — Offboarding produces the approved client notice, support handover, recovery/irreversibility boundary and signed evidence record; reactivation before deletion requires explicit approval and does not silently broaden role or tenant scope.

## Appendix A — versioned launch surface inventory

This inventory was read from audited source `59547ede9b1cd62496516065ad7c306320e8acff`. Any route, mutation or intent change after that SHA requires the acceptance owner to update the inventory before sign-off.

### Workspace mutations

`saveProfile`, `saveEmployee`, `archiveEmployee`, `saveEmployeeDevelopmentProfile`, `saveRole`, `archiveRole`, `saveApplication`, `updateApplicationStatus`, `saveProvider`, `archiveProvider`, `saveProviderProgramme`, `archiveProviderProgramme`, `removeProviderProgramme`, `saveProviderRelationship`, `saveOrganisationProvider`, `saveOrganisationProgramme`, `saveMatchingRequest`, `updateMatchingStatus`, `saveEnrolment`, `updateEnrolmentStatus`.

### Specialised route families

| Route family | Launch acceptance boundary |
| --- | --- |
| `/api/levytate-platform/workspaces` | Workspace provisioning, membership role/activation and invitation lifecycle |
| `/api/levytate-application-workflows` | Policy/version publication, submission and authorised decision transitions |
| `/api/levytate-learners/**` | Pre-enrolment, enrolment, progress, reviews, breaks and readiness |
| `/api/levytate-finance` | Bounded import, evidence persistence, retry and disclosure-safe readback |
| `/api/levytate-assessments/**` | Versioned readiness/evidence decisions within the separately approved assessment boundary |
| `/api/levytate-operational-actions/**` | Idempotent action creation and status transition |
| `/api/levytate-workspace/access` | Current-session role, tenant and capability resolution |
| `/api/levytate-ai` | Role-scoped intent/entity retrieval and no autonomous write |

### Contextual Copilot intents

`learners_needing_attention`, `highest_risk_actions`, `applications_awaiting_review`, `applications_returned`, `applications_approved`, `application_status`, `manager_check_ins`, `employee_review_status`, `employee_support`, `team_summary`, `learners_behind_target`, `learners_without_recent_progress`, `learners_ending_before`, `overdue_reviews`, `ready_to_enrol`, `pre_enrolment_blockers`, `active_breaks`, `assessment_readiness`, `operational_actions`, `provider_operational_summary`, `programme_operational_summary`, `organisation_providers`, `organisation_programmes`, `programme_directory`, `learning_time_summary`, `learning_time_attention`, `learning_time_planning`, `access_boundary`.

## Appendix B — reproducible database evidence

Read-only evidence was captured from 14:46:36 to 14:49:10 UTC on 27 October 2026 using Supabase CLI `2.111.0`, linked project `lzwcahdgchrkeulmlfqv`, database `postgres`. Commands ran from the preserved original checkout solely because it contains the existing `supabase/.temp` link. `cmp` confirmed migrations `038` and `039` were byte-identical to audited source `59547ede9b1cd62496516065ad7c306320e8acff`; no database write was made.

```sh
supabase --version
shasum -a 256 \
  supabase/migrations/038_create_pastoral_human_follow_up.sql \
  supabase/migrations/039_create_levytate_lift_foundation.sql
supabase migration list --linked
supabase db push --linked --dry-run
supabase db advisors --linked --type security --level info --fail-on none
supabase db advisors --linked --type performance --level warn --fail-on none
```

Migration hashes are `d324ef2c2b35c0fbd0ccf79d56121915f6b6c82b6384984ac8d6ef828bab4ca3` for `038` and `f6a258053e9f3de9677bdc9329d17e97f32d3eef80996bd1a5bc165697af14f0` for `039`. The ledger command shows local/remote agreement for `006`–`018`, `020`–`037` and `039`, with local `038` blank remotely. The dry-run applied nothing and returned `LegacyDbPushMissingRemoteError`, suggesting `--include-all` for `038`; this is evidence of the unsafe interleaving, not authority to use that flag.

The following exact read-only identity/object query returned PostgreSQL `17.6`, all four `038` probes `false`, the `039` capability and framework probes `true`, and 19 Lift tables:

```sql
select current_database() as database_name, current_setting('server_version') as postgres_version;

select
  to_regclass('public.levytate_pastoral_support_actions') is not null
    as migration_038_actions_table_present,
  to_regclass('public.levytate_pastoral_support_action_events') is not null
    as migration_038_action_events_table_present,
  exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='levytate_pastoral_support_requests'
      and column_name='administratively_closed_at'
  ) as migration_038_admin_closed_column_present,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='levytate_record_pastoral_follow_up'
  ) as migration_038_follow_up_function_present,
  exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='levytate_organisation_capabilities'
      and column_name='lift_enabled'
  ) as migration_039_lift_enabled_present,
  to_regclass('public.levytate_lift_framework_versions') is not null
    as migration_039_framework_table_present,
  (
    select count(*) from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and c.relname like 'levytate_lift_%'
  ) as migration_039_lift_table_count;
```

The catalogue summary was produced with this exact query:

```sql
with levytate_tables as (
  select c.oid,c.relrowsecurity,c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname like 'levytate_%'
), levytate_policies as (
  select p.* from pg_policy p join levytate_tables t on t.oid=p.polrelid
), browser_routine_acl as (
  select p.oid,a.grantee,r.rolname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  left join pg_roles r on r.oid=a.grantee
  where n.nspname='public' and p.proname like 'levytate_%'
    and a.privilege_type='EXECUTE'
    and (a.grantee=0 or r.rolname in ('anon','authenticated'))
), security_definer_functions as (
  select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'levytate_%' and p.prosecdef
)
select
  count(*) as levytate_tables,
  count(*) filter (where relrowsecurity) as rls_enabled,
  count(*) filter (where relforcerowsecurity) as rls_forced,
  count(*) filter (where relrowsecurity and not exists
    (select 1 from levytate_policies p where p.polrelid=levytate_tables.oid))
    as rls_without_policy,
  count(*) filter (where has_table_privilege('anon',oid,'SELECT')
    or has_table_privilege('anon',oid,'INSERT')
    or has_table_privilege('anon',oid,'UPDATE')
    or has_table_privilege('anon',oid,'DELETE')) as anon_granted_tables,
  count(*) filter (where has_table_privilege('authenticated',oid,'SELECT')
    or has_table_privilege('authenticated',oid,'INSERT')
    or has_table_privilege('authenticated',oid,'UPDATE')
    or has_table_privilege('authenticated',oid,'DELETE')) as authenticated_granted_tables,
  (select count(*) from levytate_policies) as policies,
  (select count(*) from levytate_policies p
    where coalesce(pg_get_expr(p.polqual,p.polrelid),'') ilike '%auth.role%'
       or coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ilike '%auth.role%')
    as policies_using_auth_role,
  (select count(*) from browser_routine_acl) as browser_routine_execute_acl_entries,
  (select count(*) from security_definer_functions) as security_definer_functions
from levytate_tables;
```

It returned 111 LevyTate tables, RLS enabled on 111, forced RLS on 64, 32 RLS tables without a policy, 34 tables with `anon` grants, 34 with `authenticated` grants, 103 policies, 74 policies using `auth.role()`, six browser routine `EXECUTE` ACL entries and 15 `SECURITY DEFINER` functions. Storage and ledger metadata were inspected without reading stored objects:

```sql
select
  (select jsonb_agg(jsonb_build_object(
     'id',b.id,'public',b.public,'file_size_limit',b.file_size_limit,
     'allowed_mime_types',b.allowed_mime_types) order by b.id)
   from storage.buckets b
   where b.id in ('levytate-organisations','levytate-provider-documents',
                  'levytate-uploads','mpr-prospect-os','levytate-prospect-os')) as buckets,
  (select count(*) from pg_policies
   where schemaname='storage' and tablename='objects') as storage_object_policy_count;

select column_name,data_type
from information_schema.columns
where table_schema='supabase_migrations' and table_name='schema_migrations'
order by ordinal_position;
```

The result showed five private buckets, null size/MIME limits on the three core buckets, and zero `storage.objects` policies. `supabase_migrations.schema_migrations` contains `version text`, `statements ARRAY`, `name text`, and no checksum column.

Each SQL block above was passed unchanged as the query argument to `supabase db query --linked`. The security-advisor command returned 39 results: 33 `rls_enabled_no_policy` information items (32 LevyTate plus legacy `subscribers`), five `function_search_path_mutable` warnings and one `auth_leaked_password_protection` warning. The performance command returned 74 `auth_rls_initplan` warnings.

No raw CLI payload was committed as an evidence pack, so this report deliberately does not claim independently verifiable output hashes. The dated commands, exact source migration hashes, SQL and safe aggregate results are the reproducible record. They prove catalogue, ledger and object-definition state only; they do not prove billing plan, managed-backup enablement, last successful backup, retention, Storage object-byte recovery or restore eligibility. Management metadata access was denied, so those P0 gates remain BLOCKED pending dashboard/API evidence and isolated database plus Storage restore drills.

## Production smoke subset

After all prior gates pass and a Production change is explicitly approved, run these non-disruptive checks on the exact promoted deployment artifact ID and SHA with fictional identities:

1. Record exact promoted deployment ID/SHA, aliases, release approval and pre-approved rollback-candidate availability.
2. Verify apex/`www`/app routing plus steady-state liveness, readiness and canonical status; do not induce dependency failure.
3. Use pre-created controlled fictional canary identities and mailboxes to complete app-domain magic-link login, current terms check, refresh and logout; do not send employer/employee invitations.
4. Perform read-only role/navigation checks for Employee-own, Manager-direct-report, Lead/Admin-organisation and Platform-Admin-support boundaries; verify one pre-created revoked/cross-tenant identity is denied.
5. Verify Lift and My Support remain unavailable and no optional capability is newly exposed.
6. Send an external-monitor test notification to the two named owners and verify receipt/recovery-test semantics without taking the service down.
7. Confirm rollback-candidate metadata and access remain available; do not execute rollback in routine smoke.

Do not create a workspace, invitation, People record, application, learner, Finance import or deletion during routine Production smoke, and never use a real customer or employee. Run all stateful journey cases, controlled dependency failures and actual rollback/offboarding drills on the protected candidate or during a separately approved resilience window with named incident/data owners, idempotent fictional fixtures and an approved evidence cleanup/retention record.

## Required human sign-off

| Decision | Named approver required | State |
| --- | --- | --- |
| Launch scope and first-client workflow | Product owner | Pending |
| Vercel paid commercial plan | Product/budget owner | Pending |
| Supabase paid plan, backup, restore, RPO/RTO | Database owner and release owner | Pending |
| Applied migration `039` record | Database/release owner | Complete in the dated `LEVYTATE_LIFT_MIGRATION_039_VALIDATION.md`; do not reapply |
| Unapplied `038` active-tree/future-migration strategy | Database, product, privacy and safeguarding owners | Pending |
| Security residual risk and dependency acceptance | Security/technical owner | Pending |
| Auth sender, invite copy and support process | Service/product owner | Pending |
| Complete legal/privacy/support decision set | Qualified legal/privacy reviewers and business owner; every mandatory item in `LEVYTATE_LEGAL_AND_SUPPORT_APPROVAL_CHECKLIST.md` and `docs/legal/LEVYTATE_LEGAL_DECISION_MATRIX.md`, including operator identity/address, privacy contact, controller/processor roles, lawful bases/LIAs, employer instructions, Early Access/commercial/liability/termination/governing-law terms, suppliers/regions, deletion/export and support/account-request identity controls | Pending |
| Monitoring, incident, support and escalation | Named service/incident owners | Pending |
| Employer offboarding, export, retention and deletion execution | Data owner, service owner, release owner and client sponsor | Pending |
| Exact deployment acceptance and permission for real invitations | LevyTate release owner and client sponsor | Pending |

## Acceptance rule

Launch becomes eligible for a controlled **GO** only when:

- every P0 in `LEVYTATE_CLIENT_LAUNCH_PLAN.md` is closed;
- every mandatory and unwaived conditional test above is PASS, with no unexplained NOT RUN/BLOCKED result;
- every conditional waiver or other accepted P1 workaround records Product/Release Owner approval, named delivery owner, client impact, expiry date and customer-safe operating procedure;
- the exact approved commit/deployment and rollback candidate are recorded;
- accountable humans sign the commercial, database, operational, legal/privacy and client gates; and
- an explicit approval authorises real invitations.

Until then, the only accepted mode is protected testing with fictional data and Lift/My Support disabled.
