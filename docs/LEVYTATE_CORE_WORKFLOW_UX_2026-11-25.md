# Core workflow UX pass — 25 November 2026

Scope: presentation, accessible interaction and workflow clarity only. Preserve tenant guards, approval commands, application handoff, learner lifecycle actions and existing feature set.

- Home retains onboarding and priority-specific recommendation gates; factual record counts remain visible on partially configured workspaces.
- Employees use a responsive compact directory for organisation-wide records, with original manager-specific cards and actions. Filter status is explicit, counts and clear filters distinguish empty results from no employees.
- Applications use one semantic adaptive table that stacks into readable record rows at narrow content widths, with original View/Edit/Handoff actions; rejected saves retain the draft and recover the busy state.
- Learners retain the existing responsive table/card design, with accessible filter controls, result counts, accurate empty states and loading skeleton.
- Shared operational metrics, progress and stage components adopt design tokens and current-step semantics.
- Fix previous provider-search regression: a one-character term in a multi-term query matches a whole word rather than an unrelated substring. Single-character queries remain broad.
- Test and build evidence must be verified separately; this is not completed browser acceptance. No production or database changes.
