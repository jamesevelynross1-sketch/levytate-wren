# Client release execution — issue #7

Updated 29 October 2026. Mandate: https://github.com/jamesevelynross1-sketch/levytate-wren/issues/7.

Integration branch: `codex/lg-01-secure-entry`. Starting commit: `46b7b2811bf2918d203c6216d518a3f9a7d5cdd6`. PR #6 remains stacked on PR #5 and draft. Original local documentation commit and `.gitignore` edit are preserved in the original checkout.

## Execution checklist

| Work | Owner / exclusive files | Status | Commit | Actual tests | Environment | Blocker | Next executable step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation and identity | Identity worker: auth, membership/admin, RBAC, invitation UI and focused tests | In progress | baseline | NOT RUN for new changes | isolated local worktree; hosted reads/link only | Prior CLI project privilege failure; rechecking metadata/profile | Diagnose supported CLI access; implement strict role/membership/invitation contracts |
| Application and learner integrity | Workflow worker: workspace/application/learner services, their UI, all new migration files | In progress | baseline | NOT RUN for new changes | separate local synthetic database | Hosted approval required for new migrations | Reproduce bypasses; implement authorised transitions, atomic uniqueness and approved handoff |
| Independent verification | Verification worker: new `release-*` tests/harness; independent synthetic tenants | In progress | baseline | NOT RUN for new coverage | local, isolated from worker mutations | Real Auth/browser stack availability being checked | Reproduce baseline failures; test separate roles/two tenants and challenge fixes |
| People/import and catalogue persistence | Lead, assignment pending initial integration | Not started | — | NOT RUN | local | Shared workspace file currently owned by workflow worker | Rotate ownership after workflow integration |
| Request boundaries, Finance, Insights, operational actions | Lead, assignment pending initial integration | Not started | — | NOT RUN | local | None identified | Cover every write surface and durable result |
| Lift, Learning Time/Requests, My Support and Copilot | Rotating product worker | Not started | — | NOT RUN | synthetic local only for gated modules | Live privacy/safeguarding/assessment approvals remain separate | Exercise existing complete journeys and fix reproduced defects |
| Integrated usability and release regressions | Independent verifier + lead | Not started | — | NOT RUN | exact integrated candidate | Depends on implementation and authentic test stack | Browser/API/database acceptance, lint/typecheck/build/audit and protected Preview |
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

Baseline independent execution: `release-role-boundaries.test.ts` reports **FAIL 7 / PASS 1**: Department Head, lowercase `employee`, blank, Administrator, Unknown, null and undefined receive Employee permissions. This is a reproduced product defect, not an infrastructure blocker. Fix and post-change rerun are in progress.

PR state rechecked: #5 open/unmerged; #6 open/draft, based on `codex/client-launch-readiness`. Remote engineering head still equals the starting commit. Protected Preview and Production mappings are not changed during local implementation.
