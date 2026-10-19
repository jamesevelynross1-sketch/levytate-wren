# LevyTate Workforce Assessments V1

## Purpose

Assessments connects employee reflection, team context and organisation workforce planning without turning self-reported evidence into a competence, eligibility or approval decision. The first framework covers AI, automation and data because it supports practical workforce planning while retaining a clear distinction between personal capability and workplace conditions.

The original LevyTate question set is informed by the UK Government's [AI Skills for Business Toolkit](https://www.gov.uk/government/publications/ai-skills-for-businesses-toolkit) and [AI Foundation Skills for Work benchmark](https://www.gov.uk/government/publications/ai-foundation-skills-for-work). It is not a reproduction, endorsement or accreditation of any third-party assessment. The public AI apprenticeship Capability Check was reviewed as a product-pattern reference only; its unseen question content is not reused.

## Roles and privacy

- Employees own private drafts, submit assigned campaigns, explicitly share a personal submission with their line manager, start linked reassessments and may prepare an application draft.
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

## Reporting definitions

- **Invited**: distinct employees in the recorded campaign audience, excluding explicit removal records.
- **Submitted**: distinct employees with an active submitted revision for the campaign.
- **Participation**: submitted divided by invited.
- Non-response is never interpreted as low capability.
- Department needs and blocker detail is suppressed below five submitted responses.
- Employee names are not included in aggregate reporting exports.

## Application handoff

An employee may choose a mapped apprenticeship standard and prepare a draft application from a submitted assessment. The handoff uses the existing application mutation service, so the one-active-application rule, role mapping, configurable workflow and normal approvals remain authoritative. Assessment results do not establish suitability, prior learning, funding, eligibility or approval.

## Security and storage

All operational tables are organisation-scoped, RLS-enabled and unavailable to browser roles. The server-only service role is used behind session, role and tenant checks. Event writes are retry-safe, submitted results and events are immutable, and no service key reaches the client.

## First-release limits

- One built-in workforce framework is available.
- Campaign audiences are fixed after creation in V1.
- Reports are printable through the browser; scheduled exports are not included.
- Proposed actions are recorded, but general operational-action completion remains a separate workflow.
- Provider initial assessments and apprenticeship eligibility evidence are outside this module.
