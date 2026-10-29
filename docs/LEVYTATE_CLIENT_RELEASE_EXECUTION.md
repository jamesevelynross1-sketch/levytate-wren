# Client release execution — issue #7

Updated 29 October 2026. Mandate: https://github.com/jamesevelynross1-sketch/levytate-wren/issues/7.

Integration worktree `/private/tmp/levytate-lg-01`, branch `codex/lg-01-secure-entry`, descended from `46b7b2811bf2918d203c6216d518a3f9a7d5cdd6`. Original checkout, local documentation commit and unrelated `.gitignore` edit are preserved. PR #5 remains open/unmerged; PR #6 remains draft and stacked on it. No merge or Production promotion is authorised.

## One execution checklist

| Work | Owner | Status | Commit | Actual tests | Environment | Blocker | Next executable step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Individual identity | Lead + identity worker | Integrated; real GoTrue numeric-status/expired-link classification fixed | `309692b`, `7a1d6b5` | Native callback12PASS; genuine six-role/two-tenant run146PASS/0FAIL/1external-emailBLOCKED, including invitation/replay/refresh/revocation/logout | Local PG17.11/Auth/REST + signed loopback SMTP hook | Hosted CLI account cannot see isolated target | Preserve local evidence; hosted acceptance after exact authorised bootstrap prerequisites |
| Applications and learner lifecycle | Workflow worker | Atomic application/learner commands, declaration, enrolment, reviews/progress, breaks, assessment and terminal outcomes integrated | `64a3934`, `1bf45b1`, `571354d` | Independent actual PG17 applications 45 PASS; final learner SQL 58 PASS including rollback, races, receipts, eligibility, assessment freshness, break/return and withdrawal | Dedicated fictional local DBs | New migrations need separate hosted approval | Verify integrated browser/API learner journey; retain shared request guards |
| Independent verification | Verification worker | Core genuine journey green; focused recovery exposes a separate partial-save defect | Harness `76123e7`; fix `87c3790` | Core146PASS includes actual declaration→eligibility→enrolment→withdrawal and linked DB/retries. Recovery21PASS/1FAIL: employee persisted before audit failed. Earlier reconnect failure was harness busy-label timing, now corrected | Native backend + genuine Auth contexts/Playwright | Partial-save engineering fix, not external | Verify atomic workspace writes; nativePG17 catalogue/Lift and actual export acceptance |
| People and catalogue | Identity worker | Catalogue integrated; fixing remaining mutation/audit atomicity before acceptance | `1ff9857`, `3740e1e`, `87c3790` | People DB26PASS; catalogue worker22PG18PASS; combined freshPG17 eight-migration chainPASS. Audit upsert requested forbidden UPDATE; removed without widening grants, but atomic replacement still required | Fictional local only | No external blocker | Closed transaction RPC for remaining People/profile/catalogue/matching writes plus mandatory append-only audit |
| Finance, Insights, request boundaries | Lead + workflow worker | Atomic Finance, truthful Insights and narrow aggregate download integrated | `8a2ad75`, `309692b`, `7dfdacf` | Finance DB30PASS; export16unitPASS (scope, privacy, disclosure, digest, audit failure, late revocation/role); Node22 health/auth/core21/37/33PASS; launch1–4PASS | Local only | None for engineering | Independent actual export/audit/browser challenge; keep hosted acceptance separate |
| Lift, Learning Time/Requests, My Support, Copilot | Workflow worker | Lift atomic candidate integrated; later module work continuing; capabilities gated | `86b4336`, manifest `87c3790` | Lift15unitPASS + workerPG18 transaction/first-proof checks; independentPG17 pending. Disabled capabilities404 for real roles; positive full module journeys NOT accepted | Synthetic local only | Human activation/privacy approval separate | Independent Lift challenge; Learning Time/Requests atomicity and synthetic support tests |
| Tenant lifecycle | Lead then identity worker | Suspension integrated; policy/encryption foundation WIP paused for priority audit fix | `9f03aba`, `8065631`; offboarding separate worker checkpoint | NativePG17 suspension18PASS; offboarding7unitPASS are not OFF03–06 acceptance | Dedicated fictional local DB | Policy approvals unsigned; unfinished engineering is not external | Resume encrypted versioned export, holds, two-person approvals and guarded deletion drill after workspace atomicity fix |
| Release and readiness | Lead | NOT released; new Preview pending | Local branch latest; old hosted Preview only `46b7b28` | Integrated403unitPASS; Node22 type/lint before latest Lift PASS; detached exact `7dfdacf` build108pagesPASS; production audit0vulnerabilities; approved bootstrap hash unchanged | Local; detached build preserves verifier | Isolated CLI/email and later human release gates | Finish current fixes; rerun exact-candidate gates, push branch and verify protected immutable Preview |

Maximum three concurrent workers. Shared services/contracts/migrations have exclusive owners. Only verifier changes shared synthetic fixtures. Historical package boundaries do not stop safe implementation.

## Approval and environment register

| Exact action / target | State | Required next step |
| --- | --- | --- |
| Convergence20261027190000 on isolated `afsccuikhocasgwyjrdw` only | Conditional approval; NOT applied | Exact anchor/hash, managedPG, zero-real-data check, restricted recovery evidence and linked dry-run scheduling only convergence |
| Supabase CLI authorised account/profile | Genuine external blocker; precise human request sent once | Interactive `supabase login`, then target appears in `supabase projects list`; never send tokens through chat. CLI2.111.0 read-only recheck still cannot see target |
| LG-01 branch Preview variables | Conditional on hosted DB verification; NOT configured | Independent Preview session secret + isolated URL/service credential; no other branch/environment writes |
| New integrity migrations | LOCAL review/test only; no hosted approval | Exact hashes, history-specific generated tree, recovery and later linked dry-run |
| Real data/accounts/email, paid infrastructure, Production promotion/configuration | Not authorised | Explicit accountable human approval |
| Hosted038, live pastoral/assessment activation | Not authorised | Remain excluded/gated; synthetic technical testing only |

Approved convergence SQL SHA-256 stays `3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204`; anchor statement checksum `876321865fd5efd9473c8863078c1d3cd2173927b737555c36266039fea16f35`. No reset/include-all/fabricated history/repair. New SQL is staged separately under `supabase/release-migrations`.

Read-only Vercel inspection: project `prj_NO1rAvQ8mrAeeeabgZGPVVUJTsB5`, Preview protection `all_except_custom_domains`. Live Production deployment `dpl_9EZh69HyoRNCdwDHzZjTVezkyKgJ` remains release branch `release/icon-pages-2026-10-20`, SHA `59547ede9b1cd62496516065ad7c306320e8acff`. Existing Git integration still automatically tracks `demo/wren` for Production; this discrepancy is recorded, NOT changed. Critical LG-01 branch backend variables are absent. Existing protected Preview https://levytate-wren-oke3h52ja-jamesevelynross1-sketchs-projects.vercel.app represents `46b7b28`, not current engineering.

## Evidence levels and precise resume point

1. **Locally verified engineering:** exact committed code and real DB/Auth/browser evidence distinguished from mocks. Build/test output does not establish hosted acceptance.
2. **Hosted acceptance:** exact immutable protected candidate + isolated DB/Auth/Storage + safe real Auth delivery. Incomplete.
3. **Real-client release approval:** commercial hosting, independent human review, legal/privacy, support/incident, backups/restore, retention and scope remain explicit human gates.

Runtime `/private/tmp/levytate-release-runtime.Yw6g7a` is loopback-only. Credentials/captured email/auth material stay restricted outside Git. Use committed `release-local-command.mjs` without printing private state. Do not build over the verifier's live `.next`. Preserve failed evidence and fictional fixtures.

Next: identity worker fixes reproduced non-atomic workspace mutation/audit writes; workflow worker continues Learning Time/Requests after Lift; verifier challenges latest catalogue/Lift on fresh nativePG17 and real export/recovery journeys. Offboarding resumes after the priority persistence fix. These are not external blockers. All new integrated gates use actual Node22.23.4 (`/Users/jamesross/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`), not desktop Node24. Detached build `/private/tmp/levytate-release-build.twAHrH` at `7dfdacf` is green; do not confuse that with later source revisions. No hosted/Production/shared Supabase data, credentials, paid infrastructure or real external email was changed.
