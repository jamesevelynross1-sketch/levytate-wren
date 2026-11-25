# LevyTate Core: funding and investment planner, phase 1 (25 Nov 2026)

Scope: protected staging preview only. Preserve historical DAS reporting; add a deterministic, interactive England levy-payer planning view. No production or database change.

Policy evidence: GOV.UK apprenticeship funding (29 July 2026), 2026/27 technical funding guide, 2026/27 funding rules v3 and GSL reforms factsheet (2 Sept 2026). Links are embedded in the UI and calculation module. 16 withdrawn standards identified by Skills England reference; eligibility confirmation required, including exceptions and effective date. New starts from August 2026, 25% over-25 shortage rate and zero eligible shortage rate for 16–24; legacy commitments use an explicit user-selected aggregate rate. Future policy is not assumed as confirmed. Level 7 and foundation age restrictions handled separately; no eligibility decision or official funding authorisation is implied.

Core implementation:
- actual DAS evidence as initial balance / historical estimates; no historic government top-up applied to future receipts;
- explicitly aged opening funds, 24/12-month expiry and FIFO, spend before expiry within month;
- 12/24/36/48 month baseline vs proposed cohort forecast, monthly reconciled balances, expiry, transfer shortfalls and cash exposure;
- multiple planned cohorts, official standard selection, editable agreed price / band / duration / start / age / department; 80/20 estimated funding schedule with payment lag;
- manual aggregate existing commitments and transfer schedule, clearly separate from proposed cohorts; counts of live learners and approved applications shown;
- in-session scenario comparison and user-initiated CSV/JSON downloads (no browser storage or server write).
- old DAS import/report untouched. Planner is not an application/enrolment write.

Limitations: unknown opening age is explicitly optimistic, exact expiry cannot be calculated from aggregate balance alone. Baseline historical spend is not remaining learner commitments. Transfer allowance and incoming transfers not modelled, no live provider/learner contract reconciliation, actual ILR payment dates, units, funding incentive or detailed eligibility checks. Mixed age/rates require separate cohorts. Assumptions and scenarios not persisted across module unmount; no automatic approvals. Next: tenant-scoped persistent scenario versions and audited approval, exact monthly commitments and fund-age import, transfer allowance, departmental budgets, units and Copilot. Do not mark complete launch acceptance on build success.

Unit coverage: dual expiry, withdrawn standards, age boundaries, funding cap, 80/20 rounding, FIFO, transfer priority, unknown age, monthly reconciliation and horizon tail. Hosted browser acceptance and full CI outstanding until verified.
