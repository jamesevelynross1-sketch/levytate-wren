# LevyTate design system — foundation release
Date: 25 November 2026. Target: isolated hosted staging. No database, authentication, permissions, funding calculations, package or production changes.

## Design direction
Quiet, precise workforce investment software. One semantic ink, accent, muted text, risk, canvas, surface and border system. Retain brand, use a local/system sans-serif stack with Inter if present (no remote font dependency). Reserve risk colour for exceptions. Prefer one decisive action, flat surfaces, fewer decorative cards, consistent type sizes and accessible labels.

## Implemented
- Product-scoped tokens and CSS primitives, with Tailwind semantic colour aliases.
- Shared panels, forms, buttons, notices, tables, modal and empty states.
- Cleaner employer shell, tabs and navigation, role and connected status retained. Compact setup progress and a single checklist.
- Finance and Marketplace styling aligned to the same system, previous reporting and planning behaviours retained.
- Matching visual treatment for employee, manager, learner and provider workflows, and split-panel desktop sign-in with single-column mobile fallback.
- Searchable application programme selection preserves native validation, current selection and all verified provider-backed options. Cancel remains usable until a mutation starts.
- Clearer distinction between full Copilot workspace and contextual assistant launcher.

## Guardrails
Do not equate token adoption with complete accessibility compliance. Check keyboard, focus, contrasts on actual surfaces, 200% zoom, 390/768/1280/1440 desktop and mobile widths, all stakeholder journeys, saving and recovery. Do not remove optional or hidden product functionality; do not modify business logic or release contracts. Remaining add-on custom layouts require further migration; typography fallback is system-dependent. Do not mark visual acceptance complete without browser screenshots and real interaction checks.
