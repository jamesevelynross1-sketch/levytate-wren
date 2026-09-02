# LevyTate Client V1 acceptance

Status: release-candidate acceptance complete on 2 September 2026.

This document defines and records the Client V1 boundary for the authenticated LevyTate product. It is not approval to promote a deployment to Production.

## Release boundary

Client V1 provides:

- controlled employer workspace and individual user provisioning;
- a blank, private operational workspace for every new employer;
- a shared read-only provider and programme Marketplace;
- employer-owned `My Providers` and `My Programmes` selections;
- People, application, approval, learner-lifecycle and Operations Centre workflows;
- persistent Progress Review Intelligence and operational actions;
- persistent organisation-scoped DAS Finance imports and balances;
- role- and tenant-scoped deterministic Copilot answers;
- workspace access visibility without employer-side access mutation.

The Platform Admin remains separate from employer operational decisions. Employer users cannot edit canonical Marketplace records. Employees can apply only to active programmes selected in their employer's `My Programmes` portfolio.

## Baseline and migration safety

- Starting Git commit: `7458ba44e16064e88bc87327e0f4c75140d10094`.
- Supabase project reference: `lzwcahdgchrkeulmlfqv` (shared / Production-capable).
- Initial linked migration ledger: `006`–`018`, `020`–`024`; `019` intentionally absent.
- Pre-migration custom-format database backup: stored outside the repository under the approved LevyTate backup location, with a SHA-256 checksum and a successful isolated restore inspection.
- Applied migrations: `025_create_intelligence_signals.sql`, `026_create_levy_finance_persistence.sql`, and `027_create_organisation_catalogue_selections.sql`.
- Final linked migration ledger: local and remote aligned through `027`, with `019` still intentionally absent.

The migrations are additive. They preserve all existing employer, user, employee, application, learner, review, progress and operational-action rows. New tables use organisation keys, constrained states, supporting indexes, forced row-level security, revoked browser roles and service-role-only policies. No canonical Marketplace record is copied into an employer workspace.

## Data architecture

### Marketplace

Canonical providers and programmes remain global LevyTate reference records in the internal catalogue workspace. Client workspaces receive sanitised read views of those records. Employer mutations cannot edit them.

### My Providers

Employer selections persist in `levytate_organisation_providers`, keyed by `organisation_id` and `provider_id`. A new workspace starts with zero rows. Active/inactive relationship state is private to that organisation.

### My Programmes

Employer selections persist in `levytate_organisation_programmes`, keyed by `organisation_id` and `programme_id`. A new workspace starts with zero rows. Selecting a programme also ensures its provider is selected; deactivating a provider deactivates that employer's active programme selections without changing the global catalogue.

### Employer operational data

People, roles, applications, learner records, reviews, progress updates, lifecycle events, operational actions, intelligence signals and Finance records persist server-side in Supabase. Client V1 does not use browser storage or in-memory fallbacks for employer business records. The workspace provider defaults to server persistence and fails closed with no permissions if persistence is unavailable.

Explicit demonstration routes and test fixtures remain isolated. Demonstration-only Finance can use local illustrative data, but authenticated Client V1 Finance always uses the organisation-scoped API.

## Client-mode and demo audit

The authenticated application, server routes, shared modules, scripts and migrations were searched for `.test`, `demo`, `fixture`, `mock`, `illustrative`, `localStorage`, `sessionStorage`, `coming soon`, `TODO`, `not implemented`, `placeholder`, `fallback`, `prototype` and `disabled`.

| Classification | Result |
| --- | --- |
| A — automated tests | Fictional `.test` identities, deterministic fixtures and validation scripts remain under explicit test paths. |
| B — explicit Demo Mode | Ground Control and Portakabin demo routes, demo data modules and illustrative Finance fixtures remain isolated from `/levytate/app`. |
| C — client-facing launch blockers | Zero after remediation. Client workspace bootstrap, Finance, Review Intelligence, Provider Intelligence and access views no longer fall back to fabricated employer data. |
| D — harmless implementation detail | Input placeholders, JavaScript regular-expression `.test()` calls, safe error fallbacks, deterministic Copilot fallback wording and platform reference-content fallbacks do not create employer business records. |

The internal beta-login `.test` restriction is an authentication safety boundary, not a data dependency. Real Supabase-authenticated members resolve from active membership, organisation and canonical role records without a `.test` gate.

## Navigation

Apprenticeship Lead and Employer Admin navigation is grouped as:

- Operate: Home, Applications, Learners, Operations Centre.
- Manage: People, My Providers, My Programmes, Finance.
- Discover: Marketplace, Intelligence.
- Support: Copilot, Guidance Centre, Settings.

Employee and Line Manager navigation remains responsibility-scoped. Platform Admin navigation remains platform-scoped and does not expose normal employer operations.

## Exact Client V1 acceptance journey

The automated live acceptance created two isolated temporary Client V1 organisations, exercised the journey, verified persistence and tenant boundaries, and removed its temporary records.

### Starting blank state

Both employers started with these exact private operational counts:

| Collection | Employer A | Employer B |
| --- | ---: | ---: |
| Employees | 0 | 0 |
| Applications | 0 | 0 |
| Learners | 0 | 0 |
| My Providers | 0 | 0 |
| My Programmes | 0 | 0 |
| Reviews | 0 | 0 |
| Progress updates | 0 | 0 |
| Operational actions | 0 | 0 |
| Intelligence signals | 0 | 0 |
| Finance transactions | 0 | 0 |
| Finance imports | 0 | 0 |

At the same time both employers could read the same global Marketplace and Provider Intelligence feed.

### Global reference-data counts

- Marketplace providers returned to the acceptance workspace: 14.
- Marketplace programmes returned to the acceptance workspace: 151.
- Published Provider Intelligence articles: 76.

### Completed workflow

Employer A added QA to `My Providers` and one QA programme to `My Programmes`. Employer B independently selected the same canonical QA provider, proving that both relationships were organisation-owned; the temporary Employer B selection was then removed as test cleanup without affecting Employer A, so Employer B remained blank for the second-employer test. The global records were unchanged. Employer A then added an Apprenticeship Lead, Line Manager and Employee, submitted and approved an employee application, onboarded the employee as a learner, recorded three progress updates and one provider review, generated and accepted one intelligence signal, completed its linked action, and imported two unique Finance transactions twice to prove duplicate protection.

Final Employer A acceptance state:

| Collection | Count |
| --- | ---: |
| Employees | 3 |
| Applications | 1 |
| Learners | 1 |
| My Providers | 1 |
| My Programmes | 1 |
| Reviews | 1 |
| Progress updates | 3 |
| Operational actions | 9 |
| Intelligence signals | 1 |
| Finance transactions | 2 |
| Finance imports | 2 |
| Legacy provider relationships | 0 |

Employer B remained at zero for every private operational collection. Cross-organisation people, applications, learners, selections, actions, signals, Finance and settings requests failed safely. Global Marketplace and Provider Intelligence remained available to both.

## Copilot evidence

Deterministic Copilot validation used external model access disabled. It proved these distinctions:

- `What programmes does QA offer?` uses the global Marketplace.
- `Which providers do we use?` uses active `My Providers` only.
- `Which programmes are available to our employees?` uses active `My Programmes` only.
- `Find a Level 4 data programme we could add.` uses Marketplace discovery.
- `How many QA learners do we currently have?` uses organisation learner evidence, not catalogue presence.
- Employee programme search is constrained to the employee's organisation `My Programmes` selections.

No Copilot validation transmitted employer data to an external model.

## Persistence and state handling

- Workspace mutations re-read authoritative Supabase state.
- Provider and programme selections survive a new session.
- Learner reviews, progress and lifecycle collections load from Supabase on workspace bootstrap.
- Intelligence signal acknowledgement, dismissal and acceptance persist in Supabase.
- Accepted intelligence signals create idempotent persistent operational actions.
- DAS imports and balances persist in Supabase; transaction fingerprints prevent duplicates.
- Logout/new-login validation retained the imported DAS state.
- Loading, blank, safe error and retry states are present on the new Client V1 modules.
- Raw database, provider or environment errors are not rendered to users.

## Validation record

The release candidate passed:

- Client V1 live acceptance: 42/42 checks;
- programme directory runtime: 64/64 checks;
- reviews and progress workflow: 65/65 checks;
- Core Early Access runtime: 20/20 checks;
- service health runtime: 21/21 checks;
- Finance: 52/52 checks;
- Provider Intelligence: 34/34 checks;
- Progress Review Intelligence: 31/31 checks;
- distributed authentication rate limits: 20/20 checks;
- secure employer authentication foundation: 25/25 checks;
- all application-review, learner, assessment, break, Line Manager, RBAC, governance, Operations Centre, Platform Admin, pre-enrolment, Copilot and operational-action suites;
- staging entry enabled and disabled modes;
- TypeScript, repository lint, changed LevyTate-file lint and the optimised Next.js build.

Responsive acceptance covers desktop, tablet and mobile widths, with no horizontal overflow, broken primary navigation or browser-console errors.

## Visible controls

Navigation, search/filter controls, details, drawers, modal forms, create/save/approve flows, signal actions, add-to-workspace actions, deactivate actions, CSV parsing/import, Finance balance/import, Copilot result links, logout and safe denied states were covered through live workflow tests and rendered-browser checks. No visible Client V1 control is knowingly dead or linked to a missing route.

## Provider Intelligence refresh scheduling

Provider Intelligence is live and can be refreshed through the authenticated server endpoint. A recurring external schedule is deliberately not included in this release candidate because the protected Preview requires a controlled authentication/bypass design and scheduling is not a Client V1 functional dependency.

Post-V1 manual step: select the approved production scheduler, store the existing refresh bearer secret in that scheduler's encrypted secret store, and invoke the production refresh endpoint on the approved cadence. Never commit the secret or place it in a URL.

## Remaining post-V1 enhancements

These are non-blocking enhancements:

- automate the approved Provider Intelligence refresh cadence;
- add client-workspace archive/decommission administration;
- add paginated Supabase Auth directory lookup when the Auth directory approaches 1,000 users;
- extend Finance forecasting after sufficient fund-age and commitment data exists;
- add richer bulk-import mapping and correction workflows.

## Production promotion procedure

Production promotion requires a separate explicit approval. The controlled procedure is:

1. Confirm commercial, legal, support and incident ownership approval for the first employer.
2. Upgrade the shared Supabase project to Pro before loading any real employer or employee data; confirm daily backups, keep PITR disabled and keep the spend cap enabled.
3. Take a fresh secure custom-format database dump outside Git and prove its checksum and isolated restore.
4. Reconfirm the linked Supabase reference and migration parity through `027`; do not repair or invent migration `019`.
5. Audit the existing Vercel Production environment by variable name and scope, without printing values. Configure only approved Production values; keep beta login disabled.
6. Promote the exact accepted immutable Vercel Preview deployment in the existing `levytate-wren` project. Do not create another Vercel project.
7. Confirm the Production aliases deliberately, including `levytate.co.uk` and `www.levytate.co.uk`, only after the promotion approval window opens.
8. Provision one controlled blank employer and named users, then run authentication, tenant isolation, application, manager approval, learner, Operations, Finance and logout smoke tests.
9. Monitor `/api/levytate-health/live`, `/api/levytate-health/ready`, authentication delivery and server logs during the launch window.
10. If an application defect appears, roll aliases back to the previous immutable deployment. The additive database migrations remain in place unless a separately reviewed forward migration is required.

## Acceptance decision

There are zero known unresolved Client V1 launch blockers in this acceptance boundary. Production remains gated by the separate operational promotion procedure above.
