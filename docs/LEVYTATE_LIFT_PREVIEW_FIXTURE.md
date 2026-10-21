# LevyTate Lift protected Preview fixture

## Scope and safety boundary

This manifest describes the idempotent fictional-data fixture authorised for the existing Ground Control validation workspace only.

- Organisation: Ground Control
- Organisation ID: `12000000-0000-4000-8000-000000000001`
- Supabase project: `lzwcahdgchrkeulmlfqv`
- Runtime: protected Vercel Preview for `feature/operational-rbac`
- Instrument: `lift-workforce-questionnaire-v1.1`
- Interpretation: `lift-workforce-rules-v1.1`
- Grouping: `lift-opportunity-grouping-v1`

The script refuses any other project or organisation. All new people use `@levytate.test` addresses and are clearly named as fictional Lift contributors. It does not create authentication identities or alter applications, learners, pastoral records, finance records or historical assessments.

## Journeys

### Interactive paired submission

Idempotency key: `gc-lift-interactive-v1`

- Uses the existing fictional Employee and Line Manager demo identities.
- Creates one draft employee assessment and one independent draft manager observation.
- Leaves both drafts untouched so the employee can save/resume/submit and the manager can submit independently during manual acceptance.

### Populated Opportunity, Decision and Proof

Idempotency key: `gc-lift-route-v1`

- Adds exactly five fictional contributor employee records, all direct reports of the existing fictional Line Manager.
- Submits employee and manager evidence in alternating orders through the production Lift service functions.
- Uses the controlled `reporting_and_insight` workflow group.
- Generates interpretation findings and opportunity candidates from the actual questionnaire answers and manager observations.
- Produces one privacy-safe aggregate route only after five distinct contributors exist.
- Records a fictional bounded decision, explicit assumptions, a baseline and an illustrative outcome through the production decision/proof services.
- No monetary return is asserted.

### Small-group suppression

Idempotency key: `gc-lift-suppression-v1`

- Adds exactly two separate fictional contributors.
- Generates their evidence through the same production services using the controlled `service_and_customer` group.
- Retains the two private candidates while exposing no employer aggregate route.

## Idempotency and verification

Run only after the migration and workspace approval gates:

```sh
LEVYTATE_LIFT_FIXTURE_ORGANISATION_ID=12000000-0000-4000-8000-000000000001 \
LEVYTATE_LIFT_FIXTURE_CONFIRMATION=GROUND_CONTROL_LIFT_039 \
npm run seed:lift-preview
```

Existing fixture IDs are checked before reuse, inserts ignore matching duplicates, and already submitted evidence is reconciled rather than overwritten. Existing decisions and proof revisions are detected before new writes.

Expected final evidence:

- one draft interactive assessment;
- one draft independent manager observation;
- five populated-route candidates and one disclosed route;
- one decision with explicitly fictional assumptions;
- one proof record retaining baseline and outcome evidence;
- two suppressed candidates and zero disclosed small-group routes;
- no other organisation enabled.
