# LevyTate guided employer setup — staging implementation (27 November 2026)

## Why
The previous five-item checklist could not be completed without optional DAS and learner imports, and it returned users to Home after the first employee. Setup was fragmented across modules.

## Delivered
- One embedded six-step, responsive setup hub: organisation, business priorities, line managers, employees assigned to a manager, chosen providers, published provider-backed programmes.
- Organisation profile persists through the existing revision-guarded saveProfile server command. Apprenticeship Leads remain read-only where settings:write is not granted; Employer Admin retains ownership.
- Existing EmployeesModule embedded for line managers and employees, with correct default role for a new manager. Adding one employee no longer navigates away; additional employees and the existing importer remain available.
- Existing provider catalogue directory embedded for provider/programme selections, preserving verification details, catalogue restrictions and atomic server mutations.
- Optional imported learners and DAS finance data do not block completion. Finance evidence remains server-read and can be retried.
- A persistent return-to-setup action in other modules when essential setup is incomplete. All existing modules, Microsoft Copilot integration, Finance and add-ons are preserved.
- Progress is computed from persisted employer records and updates if records are archived/removed. Completion is never a manually set flag.

## Release boundaries
- Isolated Preview branch only. No Supabase DDL/migrations, seeds, real identities, production aliases, money calculations, permissions or feature flags changed.
- Do not represent synthetic journey verification as hosted customer acceptance. Check multi-role hosted Auth and permissions before commercial pilots.
- Validate desktop/mobile keyboard focus, pending save/recovery, multi-person creation, and programme-backed application choices.
- Guided setup is rendered for authorised employer roles independently of whether finance identity metadata is available; optional finance checks still require a scoped authenticated client read.
- Browser acceptance captures organisation, manager, employee, provider and programme stages at 390 and 1440 CSS px, checking for horizontal overflow and six-step progress.
