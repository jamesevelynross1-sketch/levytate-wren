# LevyTate Workforce Assessments

## Purpose

Assessments connects employee reflection, team context and organisation workforce planning without turning self-reported evidence into a competence, eligibility or approval decision. The first framework covers AI, automation and data because it supports practical workforce planning while retaining a clear distinction between personal capability and workplace conditions.

The original LevyTate question set is informed by the UK Government's [AI Skills for Business Toolkit](https://www.gov.uk/government/publications/ai-skills-for-businesses-toolkit) and [AI Foundation Skills for Work benchmark](https://www.gov.uk/government/publications/ai-foundation-skills-for-work). It is not a reproduction, endorsement or accreditation of any third-party assessment. The public AI apprenticeship Capability Check was reviewed as a product-pattern reference only; its unseen question content is not reused.

## Roles and privacy

- Any authorised employer user with an active employee record owns their private drafts, can submit their assigned campaigns, explicitly share a personal submission with their line manager, start linked reassessments and may prepare an application draft. Their personal activity remains separate from any manager or employer-review access granted by their runtime role.
- Line Managers see only active direct-report submissions that were explicitly shared with that manager or disclosed by campaign policy. They can record context, support, constraints and proposed action.
- Apprenticeship Leads and Employer Admins create and operate campaigns, see campaign submissions and access organisation reporting. They do not see private personal assessments.
- Platform Admin has no access to employer assessment data.

Campaign creation records an immutable audience snapshot. A campaign explains its purpose and visibility before an employee submits. Closing or expiry prevents new submissions; reopening is explicit and audited.

## Versions, evidence and interpretation

Questionnaire version `ai-workforce-v1` and interpretation version `ai-workforce-rules-v1` are stored with each assessment. Submitted revisions and result snapshots are retained. Editing after submission creates a new private revision; the previous submitted revision remains the reporting source until the employee submits again.

`unanswered`, `not_sure` and `not_applicable` remain distinct. The deterministic interpretation produces:

- strengths;
- development needs;
- practical workplace opportunity;
- workplace constraints;
- possible routes to discuss; and
- discussion prompts.

Limited tool access, practice opportunity, time or manager support is treated as a workplace condition, not a personal capability deficit. Possible routes are explained guidance and never automatic decisions.

### Comprehensive AI Capability Assessment

Questionnaire version `ai-capability-v2` and interpretation version `ai-capability-rules-v2` adapt the approved Ground Control Current AI Capability Assessment into LevyTate's connected, tenant-scoped architecture. The active framework contains 40 questions across experience, understanding, responsible use, practical application, verification, contribution, four workplace scenarios, barriers and opportunities. The earlier reference landing-page description of 28 questions is not used because it did not match the active question bank.

Launch Release 1 publishes questionnaire version `ai-capability-v3` and interpretation version `ai-capability-rules-v3`. V2 remains immutable for historical drafts, submissions, results and campaign snapshots. V3 treats `ex3` as categorical usage-context evidence rather than silently attempting to score its text values, compares the explicit `ex6` confidence response with the four indicative scenarios, and offers truthful `No current barrier` and `Not applicable` responses. Those responses are excluded from barrier reporting rather than scored as capability gaps.

The six internal evidence dimensions are AI understanding (15%), personal and workplace usage (20%), responsible use (20%), practical application (20%), verification and judgement (20%), and wider contribution (5%). Scored self-report responses use a 1–5 scale normalised to 0–100; categorical context questions are not converted into numbers. Only available, relevant evidence contributes to a dimension or weighted indicator: unanswered, unknown and not-applicable responses are excluded rather than scored as poor capability. Four practical scenarios are scored separately on the server, with a practical indicator produced only when all four are answered. They provide indicative judgement evidence only and are not certification or a validated competence test.

Internal development bands (Foundation, Developing, Applied and Advanced), profiles (User, Enabler, Technical and Leader), confidence alignment, transferable experience and recommended cohorts support an authorised development conversation. They are working interpretation rules, not externally validated thresholds or certified competence measures. The Advanced band is conservatively capped when responsible-use, verification or practical evidence is weak. Employees receive constructive narrative findings and possible next steps, not numerical scores, grades or pass/fail outcomes.

The scenario answer key is held only in a server module. It is not included in the questionnaire registry, employee JavaScript, workspace API or browser bundle. The framework captures categories of personal use only and explicitly tells employees not to disclose personal prompts, private topics, account details or confidential workplace information.

## Reporting definitions

- **Invited**: distinct employees in the recorded campaign audience, excluding explicit removal records.
- **Submitted**: distinct employees with an active submitted revision for the campaign.
- **Participation**: submitted divided by invited.
- **Department basis**: the department recorded in the immutable campaign audience snapshot, so later employee-profile changes do not rewrite campaign participation history.
- Non-response is never interpreted as low capability.
- Every recorded audience department remains in the report, including departments with zero submissions; invited, submitted and participation are shown separately from findings.
- Department needs and blocker detail is suppressed below five submitted responses.
- Comprehensive organisation intelligence (profiles, dimensions, barriers and cohorts) is also withheld below five submissions. The current UI does not expose complement groups or intersecting aggregate filters, preventing subtraction attacks through overlapping views.
- Employee names are not included in aggregate reporting exports.

## Application handoff

An employee may choose a mapped apprenticeship standard and prepare a draft application from a submitted assessment. The handoff uses the existing application mutation service, so the one-active-application rule, role mapping, configurable workflow and normal approvals remain authoritative. Assessment results do not establish suitability, prior learning, funding, eligibility or approval.

## Security and storage

All operational tables are organisation-scoped, RLS-enabled and unavailable to browser roles. The server-only service role is used behind session, role and tenant checks. Event writes are retry-safe, submitted results and events are immutable, and no service key reaches the client.

## Current limits

- The 12-question Quick Assessment and versioned 40-question Comprehensive AI Capability Assessment are published. Campaigns and submissions remain pinned to their selected published version; V2 is historical and V3 is the corrected current comprehensive version.
- Campaign audiences are fixed after creation in V1.
- Reports are printable through the browser and aggregate CSV is authorised server-side. Scheduled exports are not included.
- Proposed actions are recorded, but general operational-action completion remains a separate workflow.
- Provider initial assessments and apprenticeship eligibility evidence are outside this module.
- Four scenarios provide limited practical evidence and must be interpreted with role context, manager discussion and workplace evidence.
