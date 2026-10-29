# Client release execution — issue #7

Updated 29 October 2026. Mandate: https://github.com/jamesevelynross1-sketch/levytate-wren/issues/7.

Integration branch: `codex/lg-01-secure-entry`. Starting commit: `46b7b2811bf2918d203c6216d518a3f9a7d5cdd6`. PR #6 remains stacked on PR #5 and draft. Original local documentation commit and `.gitignore` edit are preserved in the original checkout.

## Execution checklist

| Work | Owner / exclusive files | Status | Commit | Actual tests | Environment | Blocker | Next executable step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation and identity | Identity worker: auth, membership/admin, RBAC, invitation UI and focused tests | Integrated; genuine invitation retest in progress | `fd6b608`, `1fc43d5`, `fa3adec` | Strict identity/invitation service tests pass; genuine Lead Auth/SMTP/callback/cookies/terms/refresh tested; unconfirmed invitation defect fixed, retest pending | Native local Supabase Auth/PG17 + loopback SMTP only | Hosted CLI account lacks isolated-project access | Complete real Employee/Manager invitations and independent sessions |
| Application and learner integrity | Workflow worker: application/learner services/UI, all new migrations | Application + approved handoff integrated; remaining learner lifecycle in progress | `64a3934` | Independent actual PG17: 45 PASS / 0 FAIL (concurrency, hierarchy, role/tenant denial, idempotency, audit rollback) | Dedicated synthetic local database | Hosted approval required for new migrations | Atomically enrol with initial review/progress and finish lifecycle transactions |
| Independent verification | Verification worker: `release-*` tests/harness and synthetic tenants | Active | `55e4f76`, `2c2395e`, `cee53dd` | Baseline role 7 FAIL and DB 5 FAIL reproduced; post-fix DB 45 + People 26 + Finance 30 PASS; genuine Auth testing ongoing | Native Supabase PG17.11/Auth/REST + Playwright + signed local email hook | Hosted account and isolated safe email delivery are separate gates | Six separate real role contexts, connected journeys, reload/retry and tenant challenges |
| People/import and catalogue persistence | Identity worker: People UI/import, workspace People service/store/contracts and shared pagination; lead owns catalogue next | People transaction integrated; service/UI in progress; catalogue next | `4e6c5b7`, `1f56436` | Independent actual PG17 People: 26 PASS / 0 FAIL | Synthetic local only | None for implementation | Integrate atomic import UI and stable retry receipts; verify catalogue end-to-end |
| Request boundaries, Finance, Insights, operational actions | Lead: shared boundaries/API; workflow worker: Finance/Insights | Finance/Insights integrated; remaining API adapters in progress | `6d836fa`, `7f2afef`, `0fa3d06`, `8a2ad75` | Independent actual PG17 Finance: 30 PASS / 0 FAIL; full integrated 191 tests, TypeScript/lint and CI validators passed before latest Finance/invite integration | Local unit/service tests + actual PG17; no hosted writes | None for implementation | Finish strict schemas/abuse controls, rerun integrated suite and exports |
| Lift, Learning Time/Requests, My Support and Copilot | Rotating product worker | Not started | — | NOT RUN | synthetic local only for gated modules | Live privacy/safeguarding/assessment approvals remain separate | Exercise existing complete journeys and fix reproduced defects |
| Integrated usability and release regressions | Independent verifier + lead | In progress | integrated working candidate | Next15.5.28 production build PASS (107 routes); audit0 vulnerabilities; real 320/768-width Lead checks; browser found proxy-host bug fixed and retested127 positive/local-host mismatch403 | Local; exact immutable hosted candidate still pending | Isolated hosted backend verification and later migration approvals | Continue roles/workflows/UI testing and final protected Preview |
| Tenant offboarding/export/retention | Lead, assignment pending | Not started | — | NOT RUN | synthetic local only | Human retention/deletion policy and irreversible-action approvals | Implement enforceable technical controls and approval records |

Maximum three concurrent workers. Shared auth, workspace contracts and migrations each have one owner; no concurrent hosted fixture mutations. Integrate small commits into the existing branch, then verify independently.

## Approval register

| Exact action / target | State | Reason / cost or risk | Work continuing meanwhile |
| --- | --- | --- | --- |
| Apply convergence `20261027190000` to `afsccuikhocasgwyjrdw` with SHA-256 `3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204` | Previously authorised, conditional | Exact anchor/checksums, empty-data evidence, restricted recovery evidence and linked dry-run scheduling only convergence are mandatory; no repair/reset/include-all | All local implementation and synthetic tests |
| Interactive Supabase CLI login for isolated target | Externally blocked; precise request sent once on 29 October | CLI 2.111.0 uses native credential storage, has no environment override, and lists other projects but not `afsccuikhocasgwyjrdw`; exact link returns `LegacyLinkProjectStatusError`. Run interactive `supabase login` with the authorised account/profile, then confirm isolated target in `supabase projects list`. Never send tokens through chat | Identity fixes, workflows and independent local verification |
| Three Preview variables on `codex/lg-01-secure-entry`, isolated credentials, protected redeploy | Previously authorised, conditional on hosted DB verification | Never overwrite other branches/Production; no added cost | Credential-free builds and local acceptance |
| New integrity migrations on any hosted database | Not authorised | Review exact SQL, fresh/shared history, local tests and recovery evidence first | Prepare and test locally |
| Real email delivery, real client accounts/data, Production promotion/configuration, new charges | Not authorised | Named accountable approval required | Fictional non-delivery/local capture testing; protected Preview |
| Hosted 038 and live sensitive assessment/pastoral activation | Not authorised | Privacy/safeguarding/operational gates | Synthetic local technical tests only |

## Evidence levels

- Locally verified engineering: report exact commit, command, result and whether tests use a real database/Auth service or mocks. No current pass is inferred from historical evidence.
- Hosted acceptance: one integrated immutable commit/deployment, isolated database/Auth/Storage/email, independent role sessions and two tenants. Preview READY alone is not acceptance.
- Real-client release approval: explicit human commercial, database, privacy, support and release approvals. Technical agent review is not human GitHub approval.

## Checkpoint

Initial workers started from the same verified commit in `/private/tmp/levytate-client-identity`, `/private/tmp/levytate-client-workflow` and `/private/tmp/levytate-client-verification`. Integration remains `/private/tmp/levytate-lg-01`. Do not copy Production environment files into these worktrees.

Baseline independent execution reproduced unknown-role privilege fallback and non-atomic applications. Fixes are integrated and these regressions now pass. Do not count mocked service tests as real Auth: the independent browser harness uses GoTrue-generated, signature-verified email hooks and loopback SMTP, never injected session cookies. External/hosted email delivery remains unproven.

Local runtime: `/private/tmp/levytate-release-runtime.Yw6g7a`; credentials remain restricted runtime files only. Native local PG17.11; API/Auth/REST and SMTP listen on loopback. Verifier alone owns synthetic runtime state. Core migration candidates live under `supabase/release-migrations`, not the approved generated bootstrap directory. The approved convergence checksum is unchanged. No hosted migration, Production data/configuration, paid infrastructure or real email mutation has been performed.

Next integration tasks: complete genuine closed-signup invitations; integrate identity worker People/import/session-recovery changes; finish remaining learner transactions; rotate to catalogue/Lift/LearningTime/Requests/MySupport synthetic technical acceptance; finish tenant offboarding technical controls. All unimplemented rows above remain engineering work, not external blockers.

PR state rechecked: #5 open/unmerged; #6 open/draft, based on `codex/client-launch-readiness`. Remote engineering head still equals the starting commit. Protected Preview and Production mappings are not changed during local implementation.
