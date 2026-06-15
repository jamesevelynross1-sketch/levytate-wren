# Portakabin Demo Status

Status date: 15 June 2026  
Primary route: `/portakabin-apprenticeship-hub`  
Scope: Existing Portakabin Apprenticeship Hub only. Future Talent Portal was not altered.

## Current Working Features

- The Portakabin demo is available at `/portakabin-apprenticeship-hub`.
- The route is configured as a standalone LevyTate application environment and bypasses the public MPR Consulting header, footer and website navigation.
- The top header contains functional controls for search, site selector, demo employee selector in Employee view, role switcher and Admin console.
- The left navigation changes by stakeholder role:
  - Employee
  - Line Manager
  - Department Head
  - Apprenticeship Lead
  - Admin Console
- Dashboard content is role-specific and uses a LevyTate SaaS layout.
- Employee view supports:
  - Amelia Hart and Daniel Carter demo persona switching.
  - Recommended pathways.
  - Career Pathfinder.
  - Skills Analysis.
  - My Applications.
  - Development Passport.
  - One active application blocking.
- The one-active-application rule is implemented in application creation logic and blocks second applications for employees with active statuses.
- Amelia Hart has an active `Level 3 Team Leader` application with status `Awaiting Manager Review` and reviewer `Ryan Booth`.
- Daniel Carter has an active `Level 4 Data Analyst` application with status `Awaiting Manager Review` and reviewer `Sarah Mitchell`.
- Line Manager view includes manager-focused dashboard cards, team view, application review cards, team skills, team development and reports.
- Department Head view is mostly analytics-focused and does not show individual approve or decline buttons.
- Apprenticeship Lead view includes final approval queues, approved enrolment view, providers, programmes, compliance, site adoption and reporting.
- Ask LevyTate AI is role-specific:
  - Employee AI supports guided pathway discovery and application assistance.
  - Line Manager AI supports review and team development.
  - Department Head AI supports workforce insight without approval actions.
  - Apprenticeship Lead AI supports role-to-standard advice and provider matching requests.
- Provider mappings use real demo provider names including TEC Partnership, North Lindsey College, Leeds College of Building, Babington, Remit Training, SR Apprenticeships, QA and Apprentify.
- Site selector includes real Portakabin UK sites and filters learner/request views where data is passed through filtered arrays.
- Reports include executive-style visualisations such as line, donut, radar, gauge, heatmap and progress views.

## Issues Found

### P0: Line Manager Scope Is Still Too Broad

Line Manager review queues and AI support still filter mainly by application status rather than by direct-report manager ownership. This means a manager can see applications awaiting review across multiple managers, not only their own direct reports.

Risk:
This conflicts with the product specification and weakens stakeholder trust in role permissions.

### P0: Metrics Are Not Fully Data-Driven

Several dashboard snapshot and launch-card values are still hard-coded. Examples include:

- Line Manager applications awaiting review.
- Line Manager active team learners.
- Department Head active learners and participation.
- Apprenticeship Lead final approval count.
- Apprenticeship Lead active learner count.

Risk:
Metrics can diverge from the underlying request and learner data after approving, declining, seeding or changing scenario data.

### P0: Daniel Carter Recommendation Count Conflicts With Spec

The product specification says Daniel Carter should show `Recommended Pathways: 5`. The current persona data still sets Daniel to `recommendedPathways: 6`, and his role pathway map contains six routes.

Risk:
This directly contradicts the agreed demo persona specification and may make the one-active-application fix look incomplete.

### P1: Department Head Still Uses Approval-Adjacent Language

Department Head screens and reports still include labels such as "Pending applications" and "Applications in approval". Department Head does not have approval actions, but the wording can imply workflow ownership.

Risk:
This blurs the Department Head persona, which should remain focused on workforce analytics, participation, future demand and readiness.

### P1: Application Status And Learner Status Models Are Mixed

Application records use formal workflow statuses such as:

- `Awaiting Manager Review`
- `Submitted to Apprenticeship Lead`
- `Approved for Enrolment`

Learner records use operational statuses such as:

- `Manager review`
- `Lead review`
- `Provider introduction`
- `Enrolment`
- `Live learner`

Risk:
The demo can look like it has two different workflow languages unless these are clearly separated as application workflow status and learner journey status.

### P1: Provider Matching Requests Are Local To AI

Apprenticeship Lead AI can submit provider matching requests, but those requests live inside the AI component state and do not appear in provider management, reporting or a wider provider matching queue.

Risk:
Provider matching is a commercial LevyTate workflow, but it is not yet visible enough after submission.

### P1: Site Selector Scope Is Too Open For Employee View

The site selector is globally available. In Employee view, changing site context can create confusion because employees should not see other employees or organisation-wide learner data.

Risk:
This conflicts with the employee permission model and can make personal application visibility feel dependent on a global site filter.

### P2: Navigation Still Contains Legacy Aliases Internally

The current `SectionKey` type still supports older labels such as Requests, Approvals, Enrolments, Department Demand, Future Skills, Approved Providers, Performance, Levy Position, Forecast, AI Assistant and Admin.

Risk:
These do not all appear in the visible sidebar, but they increase maintenance risk and make future feature work easier to mislabel.

### P2: Demo Controls Can Create Generic Records

The seed request flow creates a generic `Seeded colleague` request.

Risk:
Generic demo records reduce the authentic Portakabin employer environment feel.

## Recommended Next Fixes

### Priority 1

1. Enforce Line Manager direct-report filtering across:
   - Dashboard metrics
   - Applications to Review
   - My Team
   - Line Manager reports
   - Line Manager AI

2. Create shared metric selectors so dashboard snapshot cards, launch cards and reports use the same source of truth.

3. Align Daniel Carter to the product specification:
   - Set Recommended Pathways to 5.
   - Treat the AI and Automation Workforce Programme as an advisory opportunity if it should remain outside the apprenticeship pathway count.

### Priority 2

4. Reword Department Head application metrics as demand and participation signals, not workflow ownership.

5. Clarify application workflow status versus learner journey status in labels and data presentation.

6. Move provider matching request state into the main Portakabin demo state and surface submitted requests in provider/reporting areas.

### Priority 3

7. Make site selector behaviour role-aware:
   - Employee: fixed to own site or hidden.
   - Line Manager: limited to direct-report footprint.
   - Department Head and Apprenticeship Lead: wider site selector access.

8. Replace generic seeded request data with realistic Portakabin names, managers, sites and roles.

9. Reduce or map legacy section aliases to the current product specification labels.

## Risks Before Demo

- A stakeholder may notice that manager approval queues include more than one manager's direct reports.
- Daniel Carter may still show six recommended pathways, contradicting the documented persona expectation of five.
- Hard-coded metrics may not update convincingly during a live workflow walkthrough.
- Department Head wording may make it sound as though they participate in approvals.
- Provider matching is commercially valuable but currently feels disconnected after submission.
- Employee site selector access may raise data visibility questions.

## Current Route Confirmation

The current Portakabin demo route remains:

`/portakabin-apprenticeship-hub`

Future Talent Portal was not changed during this status pass.
