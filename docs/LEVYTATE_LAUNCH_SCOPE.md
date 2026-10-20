# LevyTate controlled employer launch scope

## Release purpose

The launch release is the authenticated, tenant-scoped LevyTate employer product for a controlled first employer. It connects employee applications, manager approval, employer apprenticeship operations, provider/programme management, finance evidence and role-safe workforce assessments. Capabilities are included only where the current server permissions, workflow rules and acceptance evidence support them.

This document is authoritative for launch scope. Broader ideas in the product specification and backlog remain roadmap material unless listed here as implemented or optional.

## Runtime roles and boundaries

| Role | Launch responsibility | Data boundary | Decision authority |
| --- | --- | --- | --- |
| Employee | Own application, apprenticeship, learning time when enabled, personal/assigned assessments and grounded Copilot guidance | Own records only | Create/save/submit own application; explicitly share own assessment |
| Line Manager | Direct-report applications, team support and disclosed assessments | Current direct reports only | Approve, decline or request information at the manager stage; record contextual assessment review |
| Apprenticeship Lead | Organisation applications, learners, operations, providers, programmes, finance and campaigns | One employer organisation | Final employer approval and organisation operations; Settings is read-only except specifically authorised workflow management |
| Employer Admin | Organisation administration and the same employer-operational modules where enabled | One employer organisation | Employer-scoped administration; never platform administration |
| Platform Admin | Workspace provisioning, provider catalogue, access/tenant support, guidance administration and safe audit context | Platform administration without normal employer operational records | No employer application, learner, finance or assessment decisions |

An employer user who also has an active employee record may complete their own assessment. That personal record does not broaden their reviewer access.

## Module status

| Module | Launch status | Roles | Boundary |
| --- | --- | --- | --- |
| Home | Enabled | All roles | Role-specific, actionable summary only |
| My Application / My Apprenticeship | Enabled | Employee | One active application; own data only |
| Approvals / My Team | Enabled | Line Manager | Current direct reports only |
| Applications, Learners, Operations Centre | Enabled | Apprenticeship Lead, Employer Admin | Organisation-scoped workflow and lifecycle records |
| People | Enabled | Apprenticeship Lead, Employer Admin | Organisation workforce records |
| My Providers / My Programmes / Marketplace / Intelligence | Enabled | Apprenticeship Lead, Employer Admin | Factual catalogue and explicit employer selections; no ranking or automated procurement |
| Finance | Enabled | Apprenticeship Lead, Employer Admin | Imported or manually evidenced DAS information; no invented live balance or forecast |
| Assessments | Enabled | Employee, Line Manager, Apprenticeship Lead, Employer Admin | Private ownership, disclosed review and suppressed aggregates |
| Learning Time | Optional capability | Employer roles allowed by policy | Enabled per organisation; employee activity remains own-scope |
| Requests | Optional capability | Apprenticeship Lead, Employer Admin | Enabled per approved organisation; provider invitation and response isolation applies |
| Copilot | Secondary | Employer roles allowed by RBAC | Read/explain/guide and supported drafts; no autonomous operational decision or general write execution |
| Guidance Centre / Settings | Secondary | Policy-defined roles | Settings mutation requires explicit permission |
| Reports | Deferred navigation | Role-based reporting remains available through operational modules | A general governance-reporting suite is not launch scope |
| Platform provider catalogue, workspace/access support | Enabled | Platform Admin | No employer operational inheritance |

## Core journeys

1. An Employee reviews the organisation-published programme, saves a server-confirmed draft, submits it and tracks status.
2. The current Line Manager opens the exact direct-report application, records one authorised decision and retains entered information if persistence fails.
3. The Apprenticeship Lead completes final review and progresses an approved application into enrolment and learner operations.
4. Employer users maintain explicit provider and programme relationships; standard-linked application counts are not presented as confirmed provider-programme activity.
5. Employees and assigned employer users complete version-pinned assessments. Managers review only policy-disclosed direct-report submissions. Employer aggregates suppress small groups.
6. Finance displays the actual imported period, evidence source/date and missing or historical state.

## Application and approval rules

- Employee → Line Manager → Apprenticeship Lead → Enrolment is the default fallback workflow.
- A published configurable workflow may replace the fallback only for new submissions in an enabled organisation.
- One employee may have only one active apprenticeship application.
- Submitted answers are locked until more information is requested.
- Decisions are role-, ownership- and organisation-scoped, idempotent where the specialised workflow supports it, and successful UI states require confirmed server persistence.
- Applications already created under a historical workflow retain their pinned workflow context.

## Data and reporting rules

- Every operational query is organisation-scoped; manager views add direct-report scope and employee views add own-record scope.
- Missing evidence is shown as missing, not zero.
- Finance periods and balance evidence dates are explicit. Calculated transaction totals are distinguished from reported/manual balances and unsupported forecasts.
- Application counts linked only by apprenticeship standard are labelled standard-level. Provider/programme attribution requires explicit operational linkage.
- Assessment campaigns use immutable audience snapshots, complete paginated workforce retrieval and small-group suppression. Non-response is not capability evidence.

## Assessment templates

- `ai-workforce-v1` / `ai-workforce-rules-v1`: Quick Assessment.
- `ai-capability-v2` / `ai-capability-rules-v2`: preserved historical comprehensive version.
- `ai-capability-v3` / `ai-capability-rules-v3`: corrected comprehensive version; categorical usage context, direct confidence evidence and truthful no-barrier options.

All submissions retain questionnaire and result snapshots. Four scenarios are indicative judgement evidence only, not certification, eligibility or an employment decision.

## Provider and programme workflow

Marketplace answers what is available. My Providers and My Programmes contain only explicit employer selections. Requests, where capability-enabled, may invite structured proposals but an invitation or response does not create an operational relationship. Employer confirmation is required before handover.

No launch workflow uses match percentages, ratings, rankings, pay-to-rank placement, automated provider selection or marketplace transactions.

## Copilot boundary

Copilot may explain records and workflows, find authorised records, offer grounded guidance and prepare supported drafts. It may not approve applications, mutate learner lifecycle state, choose providers, complete general operational actions, expose another tenant, or act as a general-purpose chatbot. Deterministic live-data queries retain the same server RBAC as their source modules.

## Explicitly outside the initial commercial release

Public self-service signup, pupil access, open programme discovery, provider ranking/matching scores, autonomous sourcing, broad Copilot write actions, predictive analytics, complex governance reporting, audit exports, provider CRM/marketplace transactions and Production Microsoft-tenant enablement are deferred. Stable supporting code may remain hidden behind server-controlled capabilities; it is not deleted or implied as launched.

## Release evidence

A capability is **implemented** when code and schema exist, **validated** only after its focused and regression checks pass, **optional** when a server capability enables it for an approved organisation, and **planned** when it remains hidden/deferred. Production enablement, real employer data and commercial account issuance require the separate production, backup, legal, support and deployment gates.
