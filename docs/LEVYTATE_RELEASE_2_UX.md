# LevyTate Launch Release 2 UX

## Purpose

Launch Release 2 gives the authenticated employer product one calm, consistent interaction and navigation language without changing its domain model, role permissions or stored records. The design principle is **extraordinary capability, effortless usability**.

`docs/LEVYTATE_LAUNCH_SCOPE.md` remains authoritative for capability and release boundaries. This document defines presentation, navigation and accessibility behaviour only.

## Design system

- Navy (`#102c3d`) is the principal identity, text and primary-action colour.
- Mint (`#159b8f`) communicates selected, connected and positive states.
- Coral (`#c95568`) is reserved for selective brand emphasis and appropriate attention.
- The application canvas uses a warm neutral (`#f7f6f2`); white surfaces have restrained borders and elevation.
- Primary text remains strongly legible. Secondary text is not used for essential instructions or decisions.
- Panels use a consistent 16px radius. Form controls and compact navigation use 12px radii.
- Interactive controls have a minimum 40–44px target, visible keyboard focus and semantic selected/expanded states.
- Motion is restrained and obeys `prefers-reduced-motion`.
- The approved LevyTate wordmark is used unchanged.

## Navigation contract

The Release 2 areas are a presentation layer over existing modules. They do not grant permissions, alter routes or replace the Core Early Access policy.

### Apprenticeship Lead and Employer Admin

| Main area | Existing modules shown as contextual views |
| --- | --- |
| Home | Home, Operations Centre |
| People | People, Learners, Learning Time when enabled |
| Applications | Applications |
| Assessments | Assessments |
| Programmes | My Programmes, My Providers, Marketplace, Intelligence, Requests when enabled |
| Insights | Finance and only an explicitly enabled existing Reports module |

Copilot, Guidance and Settings remain available as quieter supporting tools.

### Employee

- Home
- My Development: Assessments, My Apprenticeship and Learning Time when enabled
- My Application

Copilot and Guidance remain supporting tools. Employer administration is never included.

### Line Manager

- Home
- My Team
- Approvals

The manager's personal Assessments and Learning Time, where authorised, remain available separately under My Development. Copilot and Guidance remain supporting tools.

### Platform Admin

- Workspaces
- Provider Catalogue
- Access & Tenants

Guidance Administration and Support Context remain secondary. Employer applications, learners, Finance, assessments and operational decisions remain excluded.

## URL and history behaviour

Every existing `?module=` value remains authoritative. The shell resolves it into the correct visual area and contextual subview.

- Direct links and refreshed pages reopen the requested authorised module.
- Unauthorised modules resolve through the existing server-informed Core Early Access policy.
- Primary navigation creates browser history entries.
- Browser Back and Forward resynchronise the visible module without broadening access.
- Record identifiers such as `application`, `employee`, `learner`, provider and programme parameters remain intact.

## Responsive shell

Desktop uses a compact persistent area navigation. Workspace identity, role, connection status, help and sign-out are held in the top bar and compact account menu; there is no permanent sidebar account card.

Tablet and mobile use a labelled menu button and modal navigation drawer rather than a technical module selector. The drawer:

- reports expanded and selected state;
- contains keyboard focus;
- closes on Escape;
- restores focus to its trigger;
- exposes contextual subviews without horizontal overflow.

## Shared interaction language

`MvpUi.tsx` provides the shared panel, toolbar, empty state, form, table, badge, notice, loading, button and modal patterns.

- Dialogs have associated titles, initial focus, Tab containment, Escape handling and focus restoration.
- Search controls have explicit accessible labels.
- Success is presented only after a server-confirmed mutation result.
- Errors retain the user's entered data and use an alert state.
- Destructive actions use a distinct secondary visual treatment and require existing confirmation flows.
- Loading states identify themselves to assistive technology without presenting invented records.

## Home hierarchy

Employer Home retains three layers: attention, current activity and clear next destinations. Employee Home presents the next meaningful task before journey status. Manager Home keeps direct-report approvals and operational work immediately actionable. Blank employers retain the existing optional setup journey and never receive fictional records.

## Release boundaries

Release 2 introduces no schema, assessment framework, scoring, workflow status, Finance model, provider ranking, autonomous Copilot action or marketing-site change. Requests and Learning Time remain server-capability and role controlled. Supabase Pro and managed daily backups remain a separate gate before real employer or employee data is loaded.
