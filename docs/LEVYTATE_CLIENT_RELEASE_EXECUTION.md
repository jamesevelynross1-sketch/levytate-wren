# Client release execution — issue #7

Updated 29 October 2026. Mandate: https://github.com/jamesevelynross1-sketch/levytate-wren/issues/7.

Integration worktree `/private/tmp/levytate-lg-01`, branch `codex/lg-01-secure-entry`, descended from `46b7b2811bf2918d203c6216d518a3f9a7d5cdd6`. Original checkout, local documentation commit and unrelated `.gitignore` edit are preserved. PR #5 remains open/unmerged; PR #6 remains draft and stacked on it. No merge or Production promotion is authorised.

## One execution checklist

| Work | Owner | Status | Commit | Actual tests | Environment | Blocker | Next executable step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Individual identity | Lead + identity worker | Integrated; callback regression reproduced and fixed without table grants | `5d38fed`, `309692b` | Native Data API callback 12 PASS; six genuine role callbacks, first-time invitations and direct browser Data API denial; modelled tests separate | Local PG17.11/Auth/REST + signed loopback SMTP hook | Hosted CLI account cannot see isolated target | Finish genuine UI recovery and callback/Auth readiness fault tests |
| Applications and learner lifecycle | Workflow worker | Atomic application/learner commands, declaration, enrolment, reviews/progress, breaks, assessment and terminal outcomes integrated | `64a3934`, `1bf45b1`, `571354d` | Independent actual PG17 applications 45 PASS; final learner SQL 58 PASS including rollback, races, receipts, eligibility, assessment freshness, break/return and withdrawal | Dedicated fictional local DBs | New migrations need separate hosted approval | Verify integrated browser/API learner journey; retain shared request guards |
| Independent verification | Verification worker | Active; latest extended browser NOT fully green | `51f1394`, `e504f8e` | Earlier connected browser105PASS/0FAIL/1external-emailBLOCKED. Extended100PASS/1FAIL: after genuine reauthentication form retains values but stale recovery state blocks final save. No durable-save claim | Native backend + six real Auth contexts/two tenants/Playwright | Engineering defect being fixed, not an external blocker | Correct recovery state, rerun; add real learner and suspension journeys |
| People and catalogue | Identity worker | People import integrated; catalogue candidate awaiting integration | `0c20a2b`, archive envelope `d945c5a`; catalogue separate WIP | Independent People DB26PASS; atomic role/selection SQL, explicit archive state and awaited UI candidate under review/testing | Fictional local only | No external blocker | Finish catalogue/application lock contract, integrate and independently challenge |
| Finance, Insights, request boundaries | Lead + workflow worker | Atomic Finance, truthful Insights and remaining HTTP boundary fixes integrated | `8a2ad75`, `981321c`, `309692b` | Native Finance DB30PASS; strict body/origin/webhook and confirmed early-access persistence tests; health/auth/core validators21/37/33PASS; launch1–4PASS after repairing inconsistent upcoming-enrolment fixture | Local only | None for engineering | Full integrated CI-equivalent run; structured export/disclosure validation |
| Lift, Learning Time/Requests, My Support, Copilot | Workflow worker | In progress; Copilot grounding/budgets integrated; sensitive capabilities gated | `7f2afef`; new module work pending | Actual role requests confirm disabled capabilities404; positive module journeys NOT accepted | Synthetic local only | Human activation/privacy approval separate | Fix reproduced Lift atomicity/CAS/proof issues, then Learning Time/Requests; synthetic support tests |
| Tenant lifecycle | Lead then identity worker | Suspension API/UI and atomic SQL implemented; export/retention/deletion outstanding | Suspension local candidate pending commit; verifier `cb895c2` | NativePG17 suspension18PASS: audit rollback, concurrent retry, revocation, invitation race, scope and second-tenant isolation | Dedicated fictional local DB | Policy approvals unsigned; unfinished engineering is not external | Integrate suspension evidence, then versioned export, holds, approval records and guarded deletion drill |
| Release and readiness | Lead | NOT released; new Preview pending | Integration; old hosted Preview is only `46b7b28` | Latest integrated checkpoint321unitPASS/typecheckPASS; lint passed earlier adapters. Fresh bootstrap hash unchanged. Current final commit not yet built | Local; detached build required | Isolated CLI/email and later human release gates | Finish integration, run Node22 CI/build, push branch and verify protected immutable Preview |

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

Next: finish catalogue integration, retain new learner authenticated-write/strict schemas, integrate suspension evidence and offline release builder after final reviewed hashes. Continue support-module and offboarding implementation; these are not external blockers. Rerun all CI-equivalent checks under Node22 because the desktop bundled runtime now reports Node24. Build in a detached worktree, then push only the existing engineering branch and verify protected Preview without Production aliases. No hosted/Production/shared Supabase data, credentials, paid infrastructure or real external email was changed.
