# LevyTate Consistency Audit Report

Audit date: 11 June 2026  
Scope: Portakabin LevyTate demo on `demo/portakabin`, checked against `AGENTS.md`, `docs/LEVYTATE_PRODUCT_SPEC.md` and `docs/LEVYTATE_PRODUCT_BACKLOG.md`.

## Executive Summary

The Portakabin demo now has the right strategic shape for LevyTate: role-based dashboards, one active employee application, a simple approval flow, site visibility, reporting, Ask LevyTate AI and provider matching. The product direction is commercially strong, especially where the Apprenticeship Lead AI creates provider matching requests for the LevyTate team.

The main consistency risk is that several surfaces still behave like demo components rather than a coherent operating system. Some metrics are hard-coded while the underlying data is dynamic, manager queues are not always limited to direct reports, navigation has legacy aliases, and there are two overlapping status models for applications and learners. These do not break the demo, but they weaken the credibility of the workflow story.

## Priority Ranking

| Priority | Area | Impact | Recommended Response |
| --- | --- | --- | --- |
| P0 | Line Manager permissions | Business rule and trust risk | Restrict manager views, reports and AI queues to direct reports only. |
| P0 | Metric source of truth | Demo credibility risk | Derive dashboard snapshot and summary cards from the same filtered data. |
| P1 | Status model consistency | Workflow clarity risk | Standardise learner, application and enrolment terminology. |
| P1 | Navigation aliases | UX and maintenance risk | Remove legacy section names that are not in the product spec. |
| P1 | Department Head reporting | Persona clarity risk | Remove pending application language that implies workflow ownership. |
| P2 | Duplicate pathway discovery surfaces | UX simplicity risk | Merge or clarify Recommended Pathways, Career Pathfinder and Skills Analysis. |
| P2 | Site selector scope | Data privacy and interpretation risk | Make site filtering permissions explicit by role. |
| P2 | Provider matching visibility | Commercial opportunity | Surface provider matching requests in Apprenticeship Lead reporting and admin follow-up. |

## Critical Issues

### 1. Line Manager Views Are Not Reliably Limited To Direct Reports

Product rule:
Line Managers should see applications from direct reports only.

Observed risk:
The Line Manager application review section filters by status, not by the selected or implied manager. This means all applications awaiting manager review can appear in a manager queue, including requests owned by other managers.

Why it matters:
This is the most important permissions inconsistency in the demo. It undermines the role model and could make stakeholders question whether LevyTate understands internal approval boundaries.

Recommended fix:
Introduce a current manager context, for example `Ryan Booth`, and filter manager queues, reports and AI recommendations by `request.manager === currentManagerName`. Use the same filtered dataset for:

- Applications to Review
- My Team
- Line Manager dashboard metrics
- Line Manager reports
- Line Manager AI

### 2. Dashboard Metrics Are Partly Hard-Coded While Detail Views Are Data-Driven

Product rule:
Metrics should logically relate to one another and tell a realistic organisational story.

Observed risk:
Several operating snapshot and dashboard summary values are fixed values, such as Line Manager `Applications awaiting review: 4`, Department Head `Active learners: 27`, Apprenticeship Lead `Applications awaiting final approval: 7` and `Active learners: 48`. Detail views and tables are driven from request and learner arrays, so counts can diverge after approving, declining, seeding or changing demand scenarios.

Why it matters:
The demo has interactive workflows. If a stakeholder approves an application but the headline metrics do not change consistently, the platform feels less real.

Recommended fix:
Create one shared metrics selector per role:

- `getEmployeeMetrics(persona, requests)`
- `getLineManagerMetrics(managerName, requests, learners)`
- `getDepartmentHeadMetrics(selectedSite, requests, learners)`
- `getApprenticeshipLeadMetrics(selectedSite, requests, learners, mappings)`
- `getAdminMetrics()`

Use those selectors for both the operating snapshot and dashboard summary cards.

### 3. Department Head Still Sees "Pending Applications" Language

Product rule:
Department Heads should only see workforce analytics and reporting. They should not approve, decline or appear responsible for workflow actions.

Observed risk:
Department analytics includes "Pending applications" and some reporting copy uses "Applications in approval". This is informational, but it can still imply Department Head involvement in the approval process.

Why it matters:
The Department Head persona needs a clean management-data story: participation, workforce readiness, site adoption, future demand and skills gaps.

Recommended fix:
Rename Department Head workflow-adjacent metrics:

- "Pending applications" to "Demand in approval workflow"
- "Applications in approval" to "Requests progressing through manager or lead approval"
- "Approved applications" to "Approved enrolment demand"

Keep the data visible, but frame it as reporting only.

### 4. Application Statuses And Learner Statuses Use Different Language

Product rule:
The employee application workflow is Employee -> Line Manager -> Apprenticeship Lead -> Enrolment.

Observed risk:
Application statuses use formal workflow states such as `Awaiting Manager Review`, `Submitted to Apprenticeship Lead` and `Approved for Enrolment`. Learner records use a second status model such as `Manager review`, `Lead review`, `Provider introduction`, `Enrolment` and `Live learner`.

Why it matters:
This creates two similar but not identical workflow languages. It is useful for learner operations, but the distinction is not explicit in the UI.

Recommended fix:
Separate and label the models:

- Application workflow status for pre-enrolment requests.
- Learner journey status for people already in onboarding or learning.

Where learners are still pre-enrolment, consider generating learner visibility from application data or showing them as "application activity" rather than "learners".

### 5. Daniel Carter Has Six Mapped Recommendations But Product Spec Says Five

Product rule:
Daniel Carter should show `Recommended Pathways: 5`.

Observed risk:
The persona data currently sets Daniel's `recommendedPathways` to `6`, and the role-to-pathway map contains six routes, including an `AI & Automation Workforce Programme`.

Why it matters:
This conflicts directly with the product specification and may reintroduce mistrust after the recent "one active application" fix.

Recommended fix:
Decide whether the commercial AI route is an apprenticeship pathway or a wider workforce programme. If it is not an apprenticeship pathway, show it separately as a LevyTate advisory opportunity rather than counting it in recommended apprenticeship pathways.

## Recommended Fixes

### P0 Fixes

1. Create role-scoped data selectors.
Use a small set of selectors to calculate visible requests, learners, metrics and report data. This will reduce duplicated filtering logic and prevent dashboard/detail mismatches.

2. Enforce Line Manager direct-report filtering everywhere.
Use manager name consistently for application cards, reports, AI responses and team lists.

3. Align Daniel Carter's recommendation count with the product specification.
Either remove one apprenticeship route from the count or split `AI & Automation Workforce Programme` into a commercial advisory recommendation.

### P1 Fixes

1. Consolidate status terminology.
Add a mapping layer that turns internal statuses into user-facing labels by context.

2. Clean Department Head language.
Reframe all application-related metrics as demand signals, not workflow ownership.

3. Rationalise navigation.
Remove legacy aliases from the visible nav and keep only the product-spec sections:

- Employee: Ask LevyTate AI, Dashboard, Recommended Pathways, Career Pathfinder, Skills Analysis, My Applications, Development Passport
- Line Manager: Ask LevyTate AI, Dashboard, My Team, Applications, Team Development, Reports
- Department Head: Ask LevyTate AI, Dashboard, Department Analytics, Site Breakdown, Future Demand, Reports
- Apprenticeship Lead: Ask LevyTate AI, Dashboard, Approvals, Approved for Enrolment, Providers, Programmes, Reports

### P2 Fixes

1. Make site selector scope role-aware.
Employees should see their own site context only. Managers should see their team/site scope. Department Heads and Apprenticeship Leads can use wider site filtering.

2. Make provider matching requests more visible after submission.
Provider matching is a core commercial workflow. Submitted requests should appear in Apprenticeship Lead reports or a dedicated "Provider Matching Requests" section.

3. Reduce overlap between pathway discovery tools.
Recommended Pathways should answer "what is approved for me". Career Pathfinder should answer "where could I go next". Skills Analysis should answer "what capability gaps support that route".

## Quick Wins

- Rename Department Head "Pending applications" to "Demand in workflow".
- Change Daniel Carter's dashboard count from 6 to 5, or relabel the sixth route as an advisory programme.
- Add a small "Direct reports only" label to Line Manager review queues.
- Add empty states for manager and lead queues after approvals or declines.
- Add a "Submitted to LevyTate team" status chip to provider matching submissions.
- Remove unused or legacy nav section names from the visible sidebar.
- Standardise title case across card labels such as "Recommended pathways" and "Current Application".
- Replace any remaining generic "Applications" labels with role-specific labels.

## Commercial Opportunities

### Provider Matching Lead Generation

The Apprenticeship Lead AI is already aligned to the commercial model because it creates provider matching requests for the LevyTate team. This should become a first-class commercial workflow with:

- request status
- assigned LevyTate owner
- estimated learner volume
- priority level
- next commercial action

### Strategic Advisory Signals

AI prompts around future skills, low site participation, levy underuse and role mapping can generate advisory opportunities. These should be captured as:

- workforce planning discussion
- levy optimisation review
- provider matching request
- department capability review

### Provider Subscription Value

Provider mappings and performance reporting can support the provider subscription model if future versions include:

- provider performance score
- provider shortlist visibility
- delivery fit by region
- cohort readiness
- employer feedback

### Executive Reporting

The reporting pages are well aligned with boardroom use cases. The strongest commercial reports to prioritise are:

- Levy utilisation
- Active learners by site
- Provider performance
- Starts vs completions
- Workforce Readiness Index

## Duplicate Functionality

### Pathway Discovery

There are several related discovery surfaces:

- Recommended Pathways
- Career Pathfinder
- Skills Analysis
- Ask LevyTate AI
- Programme Catalogue

These are useful, but the boundaries should be explicit. Without clear separation, users may not know where to begin.

Recommended simplification:

- Ask LevyTate AI: guided entry point.
- Recommended Pathways: approved matches for the employee role.
- Career Pathfinder: progression route.
- Skills Analysis: capability evidence behind the recommendation.
- Programme Catalogue: Apprenticeship Lead/admin catalogue management.

### Reports And Analytics

Department Analytics, Apprenticeship Participation, Site Breakdown, Future Demand and Reporting overlap in the Department Head experience.

Recommended simplification:
Keep Department Head dashboard as the launchpad, then make Reporting the executive pack and each nav item a specific analytic lens.

## Navigation Issues

### Legacy Section Aliases

The `SectionKey` type includes many historical labels, including `Requests`, `Approvals`, `Enrolments`, `Department Demand`, `Future Skills`, `Approved Providers`, `Performance`, `Levy Position`, `Forecast`, `AI Assistant` and `Admin`. Some are not visible in the current role nav but remain renderable.

Risk:
This increases maintenance complexity and makes it easier for future changes to reintroduce inconsistent labels.

Recommendation:
Keep aliases internally only if required for old demos. Otherwise remove them from the Portakabin standard and map old labels to current product-spec labels.

### Apprenticeship Lead Navigation

The product spec calls the final approval area "Approvals". The current visible nav uses "Applications for Final Approval". This is more explicit but not aligned with the documented nav.

Recommendation:
Use one label consistently. Preferred: "Approvals" in sidebar, with page title "Applications for Final Approval".

## AI Assistant Audit

### What Aligns

- Employee AI uses progressive reveal.
- Employee AI blocks second applications when an active application exists.
- Line Manager AI supports review and team development.
- Department Head AI avoids approval actions.
- Apprenticeship Lead AI supports role-to-standard mapping and provider matching.
- Provider matching is submitted to the LevyTate team, not directly to providers.

### Risks

- Line Manager AI appears to use all pending manager-review requests rather than direct reports only.
- Apprenticeship Lead AI provider matching requests are local to the AI component and do not flow into wider reports or provider management.
- Employee AI lets users explore a workforce programme in the same pattern as apprenticeships, which may blur levy-funded apprenticeship pathways and broader LevyTate advisory products.

### Recommended Fixes

- Scope manager AI to direct reports.
- Persist provider matching requests in shared demo state.
- Label non-apprenticeship AI recommendations as "Advisory opportunity" or "Workforce programme" rather than an apprenticeship pathway.

## Application Workflow Audit

### What Aligns

- The documented workflow is present: Employee -> Line Manager -> Apprenticeship Lead -> Approved for Enrolment.
- Department Head is not given approval buttons.
- Employees are blocked from creating a second active application.
- Amelia Hart and Daniel Carter each have one active application awaiting manager review.

### Risks

- `moveRequest` can step through every status in `requestStages`, including decline and closed statuses, which is useful for demo controls but does not reflect real workflow transitions.
- Applications approved by Line Manager are treated as visible in Apprenticeship Lead queues, but "Approved by Line Manager" and "Submitted to Apprenticeship Lead" are both active states. This is acceptable, but the UI should explain whether they are equivalent or sequential.
- Seeded demo requests can add generic applications that may dilute the realistic Portakabin data story.

### Recommended Fixes

- Replace generic status stepping with allowed transition maps by role.
- Treat "Approved by Line Manager" as an internal event and show user-facing status as "Awaiting Final Approval".
- Make seeded requests use realistic names, managers and sites from existing data.

## Reports Audit

### What Aligns

- Reports exist for Line Manager, Department Head and Apprenticeship Lead.
- Employees do not have a visible Reports nav item.
- Executive visualisations are present, including line, donut, radar, gauge and heatmap styles.

### Risks

- Several report metrics are fixed values rather than calculated from the selected site, manager or department.
- Export buttons are visible but mock-only. This is acceptable for a demo, but could be framed as "Preview export" or "Export coming soon" if challenged.
- Department Head reports include pending application counts but should make clear this is reporting, not workflow ownership.

### Recommended Fixes

- Connect report metrics to shared selectors.
- Add small captions that explain mock exports in demo mode.
- Align Department Head language to participation, readiness and demand.

## Provider Matching Audit

### What Aligns

- Provider matching is positioned as a LevyTate commercial workflow.
- Apprenticeship Lead can submit a provider matching request.
- Provider mappings use real provider names and approved delivery partner language.

### Risks

- Provider matching requests do not appear in the Provider Mappings section after submission.
- Provider matching status is currently held within the AI component rather than shared with the broader application state.
- Provider management and provider matching are adjacent but not clearly separated.

### Recommended Fixes

- Add a dedicated "Provider Matching Requests" subsection under Providers or Reports.
- Store provider matching requests in the main page state.
- Keep "Provider mappings" for approved delivery arrangements and "Provider matching requests" for LevyTate commercial support.

## Site Selector Audit

### What Aligns

- The site selector includes Portakabin UK sites.
- Learner and request data can be filtered by selected site.
- Learners by Site gives useful operational visibility.

### Risks

- Employees can use the global site selector even though the spec says employees should not see other employees.
- Selected site filtering may hide an employee's own application if a different site is chosen.
- Site counts can diverge from hard-coded dashboard metrics.

### Recommended Fixes

- Disable or limit the site selector for Employee view.
- In Employee view, show only the selected persona's site.
- In Manager view, limit sites to the manager's direct-report footprint.
- In Department Head and Apprenticeship Lead views, keep All sites and full selector access.

## Features That No Longer Align Cleanly

- Generic demo controls that seed "Seeded colleague" requests reduce the realism of the Portakabin environment.
- Legacy nav aliases make the product feel broader but less coherent.
- Non-apprenticeship workforce programmes counted alongside apprenticeship pathways may conflict with levy-specific language.
- Admin Console is useful for platform demos, but it is outside the employer journey and should remain clearly separated from Portakabin stakeholder roles.

## Recommended Next Implementation Sequence

1. Build shared role-scoped selectors for requests, learners and metrics.
2. Fix Line Manager direct-report filtering across dashboard, applications, reports and AI.
3. Align Daniel Carter recommendation count and separate workforce advisory programmes from apprenticeship pathways.
4. Reword Department Head workflow-adjacent metrics as reporting-only demand signals.
5. Standardise navigation labels to the product spec.
6. Move provider matching requests into shared state and show them in provider/reporting surfaces.
7. Limit site selector visibility by role.
8. Replace generic seed request data with realistic demo records.

## Final Assessment

LevyTate is directionally coherent and commercially promising. The strongest story is the connected journey from employee pathway discovery to manager approval, final apprenticeship lead decision, provider mapping and workforce reporting.

The next refinement should focus less on adding features and more on tightening the operating model: one source of truth for role metrics, strict permission scoping, cleaner navigation and clearer separation between apprenticeship pathways, provider mappings and LevyTate commercial advisory opportunities.
