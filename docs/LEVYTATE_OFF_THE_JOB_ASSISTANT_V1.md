# LevyTate Learning Time / Off-the-Job Assistant V1

## Purpose and product language

The employer-facing feature is **Learning Time**. The formal regulatory term is **off-the-job training** and the guided preparation experience is the **Off-the-Job Assistant**.

V1 helps an employer, learner and training provider organise the evidence needed to manage off-the-job training. It is not a compliance certificate, attendance tracker, generic timesheet, payroll tool, provider LMS or autonomous decision maker.

The system deliberately separates:

1. learner-recorded candidate time;
2. employer-checked candidate time; and
3. attributable provider-confirmed time.

Only the third figure is described as provider confirmed. Historic plans, activities and confirmations are never inferred.

## Official policy sources and interpretation

The deterministic rules and source registry are based on:

- [Apprenticeship off-the-job training guidance](https://www.gov.uk/government/publications/apprenticeships-off-the-job-training/apprenticeship-off-the-job-training-guidance--2)
- [Steps to determine whether an activity counts](https://www.gov.uk/government/publications/apprenticeships-off-the-job-training/infographic-accessible-steps-to-help-you-determine-whether-an-activity-counts-as-off-the-job-training)
- [ST1512 Artificial intelligence (AI) and automation practitioner](https://skillsengland.education.gov.uk/apprenticeships/st1512-v2-1) — version 2.1, 420 hours minimum at the time of implementation
- [ST0118 Data analyst](https://skillsengland.education.gov.uk/apprenticeship-standards/st0118-v1-1) — version 1.1, 370 hours minimum at the time of implementation

Policy regime is selected from the apprentice's **original apprenticeship start date**:

- before 1 August 2025: legacy 20% basis, with the plan's attributable indicative minimum retained as a versioned source fact;
- on or after 1 August 2025: the exact published standard/version minimum, adjusted for recognised prior learning and never below the current 187-hour policy floor.

An apprentice returning from a break retains the policy regime determined by the original start date. A break suppresses normal inactivity prompts and blocks ordinary candidate activity during the break.

The four deterministic pre-checks are:

1. the activity teaches new knowledge, skills or behaviours;
2. it is directly relevant to the apprenticeship standard or an agreed learning priority;
3. it is undertaken within normal paid working hours or an attributable permitted compensated exception; and
4. it is separate from routine productive work.

The rule engine runs before optional AI. AI cannot override a hard deterministic failure.

## Roles and scope

| Role | V1 access |
| --- | --- |
| Employee | Own published plan, priorities, private drafts, submission/return/resubmission, own totals and assistant |
| Line Manager | Direct-report summaries and submitted evidence only; no private drafts and no provider confirmation |
| Apprenticeship Lead | Organisation portfolio, versioned plan setup, employer checks, attributable provider-confirmation recording and attention queues |
| Employer Admin | Same governed employer-management capabilities as Apprenticeship Lead |
| Provider user | No V1 write surface; direct provider access is deferred |
| Platform Admin | No employer learning-evidence access |

Every server read starts with the established organisation membership and role context. Employee and manager scopes are resolved on the server from employee identity and `manager_id`, respectively. Cross-organisation identifiers are not trusted.

## Data and evidence model

Migration `033_create_off_the_job_learning_assistant.sql` adds:

- a capability-off-by-default organisation flag;
- a versioned official standard requirement registry;
- one learner plan identity with immutable published plan versions;
- learning priorities linked to a plan version;
- learner-owned candidate activity records with server-derived duration;
- append-only attributable provider-confirmation records; and
- append-only state-transition events.

Published plan versions are immutable. Corrections use a new version. Confirmation records are append-only; a later record supersedes rather than overwrites earlier evidence. Activity evidence locks after submission, except while an authorised information-return state permits the learner to clarify and resubmit it.

Evidence attachments are deferred to V1.1 because the existing asset registry does not yet provide the complete private-upload, malware-scanning, retention and signed-download controls required for sensitive learning evidence. V1 stores bounded references only and instructs users not to include sensitive content.

## Activity lifecycle

`draft → submitted → needs_information → submitted → employer_checked → provider confirmation`

Alternative terminal states are `not_counted` and `withdrawn`. An ineligible activity can be retained only as an explicitly non-counted learning note. Submitted evidence cannot be silently rewritten.

All writes use bounded request bodies, same-origin checks, role and organisation revalidation, optimistic locks and idempotency keys for transitions and confirmations.

## AI safety

The Off-the-Job Assistant supports eligibility clarification, future learning planning and candidate-record preparation. Manual workflows work without `OPENAI_API_KEY`.

AI receives only bounded learner context: programme, standard identifier, lifecycle state, practical-period dates, priorities and current aggregate position. It must not receive or infer protected characteristics, health data, disciplinary data, unrelated HR records, raw credentials or another learner's records.

The output schema is strict and bounded. The assistant may draft wording or ask questions. It may not certify compliance, invent KSB references, evidence, activity, time, dates, working-hours arrangements, provider confirmation or learning outcomes. A deterministic hard failure cannot be upgraded by AI.

## Feature gate and rollout

The feature requires both:

- `LEVYTATE_OFF_THE_JOB_ASSISTANT_ENABLED=true` in a non-Production runtime; and
- `levytate_organisation_capabilities.off_the_job_assistant_enabled=true` for the authorised test organisation.

Production is always fail-closed in V1. Both defaults are off. No organisation is enabled by migration 033.

Suggested rollout sequence:

1. review and approve migration 033;
2. apply it to the already approved database target;
3. verify schema, constraints, RLS, grants and migration ledger;
4. run `node scripts/prepare-learning-time-fixture.mjs` in dry-run mode;
5. enable only an isolated fictional workspace with the explicit guarded command;
6. run role, workflow, AI-off, Copilot, Autopilot and security acceptance;
7. configure the feature only for the approved protected Preview branch;
8. push and verify the protected Preview only after all checks pass.

## Official-source synchronisation

`node scripts/sync-skills-england-otj-requirements.mjs` is dry-run by default. It reads only official Skills England standard pages and returns `verified`, `needs_review` or `unavailable`. Missing values remain unknown and are never converted to zero. `--apply` requires explicit approved Supabase credentials and should be run only after review.

## Deferred V1.1 work

- provider self-service review and confirmation;
- secure evidence uploads, malware scanning, retention policies and signed download;
- calendar, LMS or provider integration;
- payroll or working-hours system integration;
- scheduled source synchronisation with human exception handling;
- export packs after legal and data-retention review;
- any automatic operational-action creation (human approval remains required).

## Validation and audit expectations

Run `npm run validate:learning-time`, `npx tsc --noEmit`, the full repository regression suites, `npm run lint` and `npm run build`. Migration 033 must pass static safety review and a non-destructive local dry run before approval. The implementation must not be pushed or deployed while the shared schema lacks migration 033.
