# LevyTate staging: levy-only planning correction — 27 November 2026

## Decision
The Insights & Finance → DAS Funding Outlook is exclusively an **apprenticeship levy funding planner**. It must not let an employer choose a private/commercial training funding route. Government co-investment (when a levy payer has insufficient digital funds) and negotiated amounts above the funding band remain legitimate employer contributions *within* a levy-funded apprenticeship, not private programmes.

## Root cause
The legacy planner included a `levy/private` route and treated unchecked funding eligibility as privately paid training. The user's 23-start synthetic test standard had £0 published funding band and could not legitimately be deducted from DAS. Instead the page showed an inflated employer cash projection and coincident levy lines.

## Implemented in staging
- The cohort editor displays **Funding model: Apprenticeship levy** as fixed context. No paid-commercial funding selector remains.
- Approved-looking, not withdrawn, not synthetic apprenticeship records with a valid funding band may be modelled **indicatively** as levy drawdown before a user finalises eligibility verification. The UI always labels those assumptions as provisional; checking is not official approval.
- Synthetic/test-only, withdrawn, restricted and missing-band programmes are **excluded from both levy and cash projections**. They remain visible as pending cohort plans with clear reasons; no default charge of the full contract value to private cash.
- The model retains zero/25% co-investment on *eligible levy shortfalls* as appropriate to age/start rule and separately models negotiated prices above the maximum funding band. This is legally different from adding commercial training.
- Legacy exported JSON containing `route:"private"` is explicitly converted to an unconfirmed levy scenario when imported, preserving programme details and clearing old funding attestations. The UI warns about that conversion.
- Editing a cohort to choose a genuine standard preserves the already-entered negotiated price rather than silently overwriting it with the standard's band; the band is refreshed from the official catalogue and must be reviewed.
- Browser and model regression tests cover levy-only controls, synthetic exclusion, indicative genuine levy drawdown, co-investment with insufficient funds, amounts above band, withdrawal restrictions, 12/24/36/48 month horizons, mobile chart layout and saved-plan file migration.

## Staging reference data
The isolated staging standards catalogue initially had only `ST1490 Synthetic acceptance standard record` with a null funding band. Three verified live Skills England records are prepared for staging-only insertion so testers have genuine programmes with real funding maxima:
- ST1512 AI and automation practitioner, Level 4, v2.1, 18 months, maximum £18,000, https://skillsengland.education.gov.uk/apprenticeships/st1512-v2-1
- ST0118 Data analyst, Level 4, v1.1, 24 months, maximum £15,000, https://skillsengland.education.gov.uk/apprenticeships/st0118-v1-1
- ST0070 Business administrator, Level 3, v1.0, 18 months, maximum £5,000, https://skillsengland.education.gov.uk/apprenticeships/st0070

The standards are **not** fabricated provider delivery relationships or authorisation to book public funds. Real provider contract pricing, standard versions, learner eligibility and funding rules must still be confirmed.

## Remaining limits
- Only dated, manually imported DAS evidence is available. Forecast balances after the last import remain estimates.
- Remaining balance age/expiry and actual provider contracts are not fully reconciled.
- Scenarios remain in session and JSON export; organisation-level versioned permanent scenarios are not delivered in this change.
- Funding rules after July 2027 remain provisional.
- No production migration, production deployment or customer account changes are authorised.
