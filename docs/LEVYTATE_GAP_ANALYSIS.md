# LevyTate Gap Analysis

Audit date: 16 June 2026  
Scope: Current `demo/portakabin` implementation of `/portakabin-apprenticeship-hub`, reviewed against `AGENTS.md`, `docs/LEVYTATE_PRODUCT_SPEC.md`, `docs/LEVYTATE_PRODUCT_BACKLOG.md`, and `docs/LEVYTATE_AUDIT_REPORT.md`.

## 1. Current Navigation Structure

Current live sidebar navigation by role:

- Employee: `Ask LevyTate AI`, `Dashboard`, `Recommended Pathways`, `Career Pathfinder`, `Skills Analysis`, `My Applications`, `Development Passport`
- Line Manager: `Ask LevyTate AI`, `Dashboard`, `My Team`, `Applications to Review`, `Team Skills`, `Team Development`, `Reporting`
- Department Head: `Ask LevyTate AI`, `Dashboard`, `Department Analytics`, `Site Breakdown`, `Apprenticeship Participation`, `Skills Map`, `Future Demand`, `Reporting`
- Apprenticeship Lead: `Dashboard`, `Applications for Final Approval`, `Approved for Enrolment`, `Providers`, `Programmes`, `Ask LevyTate AI`, `Compliance`, `Site Adoption`, `Reporting`
- Admin Console remains available from the top bar and exposes admin/configuration sections not part of the main employer journey

| Item | Current State | Target State | Gap | Recommended Change | Priority |
| --- | --- | --- | --- | --- | --- |
| Navigation is simplified | The role nav is clearer than earlier versions, but several roles still have dense sidebars and some labels differ from the product spec. Department Head and Apprenticeship Lead carry the heaviest nav load. | Navigation is simplified. | Navigation is still broader than needed for a focused operating system and still exposes overlapping pages. | Reduce each role to the minimum journey-critical sections and align labels to the product spec, especially `Applications to Review` vs `Applications`, and `Applications for Final Approval` vs `Approvals`. | High |
| Ask LevyTate AI is the hero feature | `Ask LevyTate AI` is top-level for every role except it is not the first or default experience. Dashboard remains the primary landing surface. | Ask LevyTate AI is the hero feature. | AI is present, prominent, and role-specific, but not the primary front door to the product. | Reframe dashboard and nav hierarchy so AI sits as the main guided entry point, with dashboard acting as a supporting overview. | High |
| Provider Matching is a top-level feature | Provider Matching exists, but only inside the Apprenticeship Lead AI workflow. There is no dedicated top-level nav item called `Provider Matching`. | Provider Matching is a top-level feature. | Commercially important workflow is not visible enough from navigation alone. | Add a dedicated top-level `Provider Matching` entry for Apprenticeship Lead, or make `Providers` explicitly split into `Provider Mappings` and `Provider Matching Requests`. | High |
| Duplicate content removed | There is still overlap across `Recommended Pathways`, `Career Pathfinder`, `Skills Analysis`, `Reporting`, `Department Analytics`, and `Site Breakdown`. | Duplicate content removed. | The current nav structure still spreads similar concepts across multiple pages. | Consolidate discovery surfaces and analytics surfaces so each section has one clear job. | High |
| Development tools hidden behind expandable sections | Some content is already tucked behind accordions or detail panels, especially pathway cards and provider mappings. Navigation itself still exposes many operational tools directly. | Development tools hidden behind expandable sections. | Progressive disclosure exists at component level, but not at information architecture level. | Keep advanced tools in secondary panels or expandable admin sections instead of first-line nav items wherever possible. | Medium |

## 2. Current Dashboards By Role

Current dashboard summary by role:

- Employee: current application timeline, recommended pathways count, saved opportunities, development passport
- Line Manager: year-on-year team participation, manager queue, active team learners, skills risk
- Department Head: site participation bars and workforce readiness signal
- Apprenticeship Lead: levy and learner view, final approvals queue, active learners, provider mappings
- Admin Console: platform health and configuration signal

| Item | Current State | Target State | Gap | Recommended Change | Priority |
| --- | --- | --- | --- | --- | --- |
| Workforce Readiness is the primary metric | Workforce Readiness is visible for Department Head and in reporting, but it is not the universal anchor metric across all role dashboards. Employee and Line Manager dashboards lead with application and participation signals. Apprenticeship Lead leads with levy and learner operations. | Workforce Readiness is the primary metric. | Workforce Readiness is important, but not yet the single framing metric of the platform. | Promote Workforce Readiness or a clearly related readiness score into the dashboard hero and operating snapshot across leadership roles, with employee and manager views showing their contribution to it. | High |
| Dashboards fit on a single screen | The main dashboards are much calmer than earlier versions and most role overviews are compact. They still rely on a hero plus operating snapshot plus role-specific panel, which can exceed one viewport depending on screen size and role. | Dashboards fit on a single screen. | The layout is improved, but not consistently single-screen across all roles and viewport widths. | Compress hero and snapshot further, and treat additional analytics as optional expansion below the fold. | Medium |
| Each role has a unique experience | Each role now has distinct nav and dashboard content. Employee, Line Manager, Department Head, and Apprenticeship Lead are meaningfully separated. | Each role has a unique experience. | This is largely achieved, though all roles still inherit the same hero and snapshot pattern. | Preserve the role-specific core while differentiating the dashboard framing and primary metric more strongly by role. | Low |
| Employee limited to one active application | Employee dashboard and application journey respect the one-active-application rule and show a single current application. | Employee limited to one active application. | This target is already met in the current dashboard behaviour. | Keep this as a locked rule and ensure future dashboard copy continues to reinforce it. | Low |
| Ask LevyTate AI is the hero feature | Dashboard is still the default landing experience, with AI as a separate section. | Ask LevyTate AI is the hero feature. | The dashboard rather than AI currently owns the first impression. | Consider making the hero CTA AI-first and simplifying dashboard cards so AI feels like the main interaction mode. | Medium |

## 3. Current Ask LevyTate AI Functionality

Current role-specific AI behaviour:

- Employee AI: progressive reveal from prompt to recommendation to application form, with one-active-application blocking
- Line Manager AI: prompts for application review and team capability guidance, scoped to direct-report data in the current demo
- Department Head AI: participation, site comparison, future skills and workforce insight with no approval actions
- Apprenticeship Lead AI: role-to-standard mapping, funding context, alternative standards, and provider matching request creation

| Item | Current State | Target State | Gap | Recommended Change | Priority |
| --- | --- | --- | --- | --- | --- |
| Ask LevyTate AI is the hero feature | AI is one of the strongest features in the product and is present for every role, with the deepest functionality for Employee and Apprenticeship Lead. It still sits as a destination page rather than the organising principle of the platform. | Ask LevyTate AI is the hero feature. | AI is good, but it is not yet the product's main narrative or landing flow. | Make AI the main entry point from the dashboard and simplify adjacent pages so they feel like AI-supported workspaces rather than parallel routes. | High |
| Each role has a unique experience | Role-specific AI experiences are clearly differentiated and aligned to permissions. | Each role has a unique experience. | This target is largely met. | Keep role-specific AI, but tighten the visual and workflow distinctions so each experience feels purpose-built rather than templated. | Low |
| Employee limited to one active application | Employee AI correctly blocks starting or submitting a second active application and directs the user back to `My Applications`. | Employee limited to one active application. | This target is already met. | Keep the blocking logic and ensure future AI flows continue to use the same rule source. | Low |
| Duplicate content removed | AI overlaps with `Recommended Pathways`, `Career Pathfinder`, `Skills Analysis`, and some provider workflows. | Duplicate content removed. | AI is strong, but adjacent pages still duplicate parts of its value proposition. | Clarify AI as the guided layer, while other pages become evidence, detail, or admin support views. | Medium |
| Development tools hidden behind expandable sections | The AI interfaces already use progressive reveal and staged forms. | Development tools hidden behind expandable sections. | This target is partly achieved inside AI, but not consistently across the rest of the app. | Use the AI pattern as the reference for the broader platform: input first, then reveal detail only when needed. | Medium |

## 4. Current Provider Matching Functionality

Current provider-related functionality:

- Provider mappings live in a dedicated `Providers` page with fit score, status, alternative provider, enrolment email, and next action
- Apprenticeship Lead AI can create provider matching requests with status tracking such as `Submitted`, `Under Review`, and `Provider Shortlist Being Prepared`
- Approved enrolment cards can submit a learner to the mapped provider for enrolment using the configured provider email in `System Settings`
- Provider enrolment submission is separate from Provider Matching and is handled as a demo-state operational workflow

| Item | Current State | Target State | Gap | Recommended Change | Priority |
| --- | --- | --- | --- | --- | --- |
| Provider Matching is a top-level feature | Provider Matching exists and is commercially aligned, but it is embedded inside Apprenticeship Lead AI rather than promoted as its own primary feature. | Provider Matching is a top-level feature. | High-value commercial workflow is still hidden inside AI and not obvious from navigation or dashboard hierarchy. | Promote Provider Matching to first-class navigation and reporting, separate from provider mappings and separate from enrolment submission. | High |
| Reports are executive-focused | Provider data is currently more operational than executive. Mappings show fit, status and email settings, but not portfolio-level commercial or delivery insight. | Reports are executive-focused. | Provider workflows are functional, but provider performance and provider matching are not yet framed as executive decision tools. | Add provider matching and provider performance summaries into leadership reporting with readiness, risk, and commercial follow-up signals. | Medium |
| Duplicate content removed | Provider mappings, provider matching requests, and provider enrolment submission now exist as three adjacent but separate concepts. | Duplicate content removed. | The concepts are clearer than before, but still dispersed across AI, Providers, Approved for Enrolment, and Settings. | Define three explicit lanes: `Provider Matching`, `Provider Mappings`, and `Provider Enrolment`, each with a single home. | High |
| Development tools hidden behind expandable sections | Provider mapping detail uses expandable disclosure well. Operational controls such as `Mark live`, `Flag review`, and `Replace` remain visible on every row. | Development tools hidden behind expandable sections. | Admin actions are always visible, which adds operational noise. | Move lower-priority provider admin actions into an expandable `Actions` tray or row menu. | Medium |

## 5. Current Reporting Functionality

Current reporting behaviour:

- Line Manager reports: applications awaiting review, active learners, participation, year-on-year participation, skills profile, team participation donut, team progress
- Department Head reports: participation, active learners, demand signal, readiness, site participation, readiness trend, skills gap heatmap, learner distribution, executive brief
- Apprenticeship Lead reports: final approvals, active learners, provider partners, levy utilisation, workforce readiness, site distribution, provider performance, starts vs completions, programme portfolio, executive brief
- Admin/non-role reporting falls back to executive summary and learners by site

| Item | Current State | Target State | Gap | Recommended Change | Priority |
| --- | --- | --- | --- | --- | --- |
| Reports are executive-focused | Department Head and Apprenticeship Lead reports are the closest fit to the target. They include readiness, trend, distribution and executive summary components. Line Manager reporting is more operational. | Reports are executive-focused. | Executive reporting exists, but not all reporting surfaces are consistently framed at executive decision level. | Keep Line Manager reporting operational, but ensure leadership reporting is the dominant reporting story in the product and in sprint priorities. | Medium |
| Workforce Readiness is the primary metric | Workforce Readiness is already prominent in Department Head and Apprenticeship Lead reports, but not consistently the lead metric across the platform. | Workforce Readiness is the primary metric. | Reporting already supports this well, but the broader product hierarchy does not. | Use reporting as the model for the rest of the app by promoting Workforce Readiness into dashboard and navigation language. | High |
| Duplicate content removed | Reporting overlaps with Department Analytics, Site Breakdown, Apprenticeship Participation, Future Demand, and Learners by Site. | Duplicate content removed. | Too many sections can lead to the same insight from different routes. | Collapse overlapping analytics pages into a smaller number of executive lenses and let reporting own the consolidated boardroom view. | High |
| Dashboards fit on a single screen | Reporting pages are strong but dense. They do not aim to fit on a single screen and often extend vertically. | Dashboards fit on a single screen. | Reports are useful, but they are not compact launchpads. | Preserve report depth, but keep dashboard pages short and route users into reporting only when they want deeper analysis. | Medium |
| Navigation is simplified | Reporting sits alongside several analytics pages, so the user can reach similar insights from multiple places. | Navigation is simplified. | Reporting competes with several parallel analytic sections. | Reframe `Reporting` as the executive pack and rationalise other analytics items around it. | High |

## Overall Priority Summary

- High:
  - Make Workforce Readiness the organising metric, not just a report component
  - Elevate Ask LevyTate AI from a strong section to the hero experience
  - Promote Provider Matching to a top-level feature
  - Simplify navigation and remove overlapping sections
  - Consolidate duplicated discovery and analytics routes
- Medium:
  - Push more operational tools behind expandable or secondary controls
  - Tighten single-screen dashboard behaviour
  - Make provider and reporting flows more clearly executive-facing
- Low:
  - Preserve and maintain already-strong behaviours such as one active employee application and role-specific AI journeys

## Recommended Sprint Framing

The current Portakabin demo is directionally strong and already supports the core LevyTate story. The next sprint should not be about adding more surfaces. It should be about concentrating value:

- make Workforce Readiness the headline metric
- make Ask LevyTate AI the main guided entry point
- make Provider Matching visibly first-class
- simplify navigation around fewer, clearer destinations
- hide advanced tooling behind progressive disclosure
