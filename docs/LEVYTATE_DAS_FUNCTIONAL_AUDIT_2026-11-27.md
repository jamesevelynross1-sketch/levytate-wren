# LevyTate — DAS funding-planner functional audit (27 November 2026)

## Reproduced customer journey
- Isolated staging account imported `mock_DAS_v1_transactions.csv`: 132 accepted rows; evidence 5 September 2024 to 26 August 2026; latest recorded balance £709,726, August receipts £95,717, August apprenticeship spend £94,495.
- The planner initially displayed an empty outlook after import. A separate staging fix now reconciles untouched plans to that dated evidence.
- Employer then created a hypothetical cohort: **23 starts in March 2027**, **£253,000** full contract price, **Synthetic acceptance standard record**, eligibility **unconfirmed**. On a 12-month view, projected cash was ~£105,417. The levy-balance baseline/proposal lines overlapped because the simulation could not treat an unconfirmed test standard as levy funded.

## Fixes in this change
1. Compare two distinct financial measures: *remaining levy account* or *cumulative employer cash paid*. The comparison defaults to whichever actually differs (employer cash when levy scenarios coincide).
2. Explain identical levy lines rather than invent an artificial gap. Show baseline/proposed and incremental cost for the selected month and the distinction between selected-horizon cash and whole-programme contract value.
3. Keep the 12/24/36/48-month forecasts consistent. Display balances, cash, receipts, spend, transfers and expiry in the detailed monthly table and retain CSV export.
4. Consume known-age opening funding before unknown-age funding in the FIFO estimator. Report expiry as unknown if the opening fund-age evidence is incomplete; do not equate a £0 mathematical figure with verified zero expiry.
5. Reject "Synthetic" or "test only" catalogue standards as levy eligible even when they have a plausible ST reference and a user ticks the funding verification box. These remain valid fixtures for private-cash scenario testing only.
6. Preserve original 132-row imported DAS ledger, saved evidence, organisation boundaries, staged assumptions, employee records and permissions. No schema/production migration.

## QA acceptance cases
- Unfunded 23-start synthetic cohort: same levy-balance path, divergent employer-cash path, correct provisional cash timeline, default cash view and visible reason.
- A real standard whose eligibility has been explicitly checked: divergent levy paths and default levy view.
- Known/unknown opening-age FIFO order and safe expiry warnings.
- 12/24/36/48-month aligned comparison timelines and refusal of mismatches.
- Responsive 390px and 1440px graphical comparisons, accessible control names and detailed month selection.
- Existing Finance import atomicity, idempotency, auth scopes and retention verified through the established disposable Core acceptance gates.

## Known product boundaries (not marked complete by these fixes)
- **Planning sessions are not server-persisted**: the "Session plans" UI reflects this. Export the plan JSON to retain scenarios after leaving the page. Tenant-scoped audited persistent scenarios are a separate delivery gate.
- **No live DAS API connection**: the import is a user-initiated historical CSV, not a live balance feed. The historical 26 August balance is not the current position.
- **Future expiry needs unspent funds by receipt age**; a balance and monthly receipts alone cannot prove it. The assumption is explicit.
- **Provider/standards data in staging is synthetic**, not proof of official programme suitability. Confirm genuine provider, funding band and learner eligibility before relying on a funded scenario.
- Aggregate existing spend is a starting commitment estimate, not the remaining provider contract schedule. Forecasts must not be described as guaranteed DfE payment dates.
