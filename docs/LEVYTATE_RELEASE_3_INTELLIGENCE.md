# LevyTate Launch Release 3 — Employer Intelligence

## Purpose

Release 3 turns existing authorised application, learner, operational, assessment and DAS finance records into a concise employer intelligence experience. It does not create a general reporting builder or a new source of business data.

The Insights area is available only to the organisation's `Apprenticeship Lead` and `Employer Admin`. It contains:

1. **Overview** — current operating position and prioritised authorised actions.
2. **Workforce Development** — campaign-pinned aggregate evidence from the comprehensive AI Capability Assessment.
3. **Finance** — the existing persisted DAS finance experience.

The legacy `ReportsModule` remains deferred. Provider Intelligence remains in Programmes. Platform Admin does not inherit employer operational reporting.

## Analytical hierarchy

Material insights use the same hierarchy:

> Conclusion → Evidence → Implication → Next action

Operational links open the existing authorised application, learner, assessment or finance workflow. Recommendations do not create applications, approve training, contact providers or mutate operational data.

## Secured data flow

`GET /api/levytate-employer-insights` requires a valid LevyTate session and revalidates the current live organisation membership and canonical role. The service denies Employee, Line Manager and Platform Admin roles before reading employer-wide data.

The server aggregates four existing secured sources:

- role-scoped workspace records;
- Operations Centre queues and persistent actions;
- workforce assessment campaign aggregates;
- persisted DAS finance transactions, import audit records and balance evidence.

The response contains aggregate measures, privacy-safe campaign findings and a short list of authorised operational priority links. It does not send private assessment drafts, assessment answer maps, individual result snapshots, finance learner names or unrelated tenant records to the browser.

Responses are private and `no-store`. If a source fails, its values are marked unavailable. Previously loaded results are cleared before a retry, so historical values are not presented as fresh following a failed request.

## Source-of-truth metric catalogue

The executable catalogue lives in `lib/levytate/intelligence/metric-catalogue.ts` and is returned with the secured report. The UI definitions table and executive report use the same definitions.

| ID | Display label | Source | Population | Calculation | Period and timestamp | Authorisation | Missing-data behaviour | Privacy / suppression |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `applications-awaiting-decision` | Applications awaiting a decision | Authorised LevyTate application records | Active applications currently owned by a Line Manager, Apprenticeship Lead or Employer Admin | Count of distinct in-scope applications with a decision owner | Current position; application update time and report generation time | Apprenticeship Lead, Employer Admin | Unavailable only when the authorised workspace cannot be read; never inferred | Organisation-scoped; named records appear only in authorised operational links |
| `active-learners` | Active learners | `levytate_learner_records` | Active records in enrolled, assessment preparation, in assessment or Break in Learning | Count of distinct active learner records in an active learning state | Current position; latest record update and report generation time | Apprenticeship Lead, Employer Admin | Zero only after a successful source read | Organisation aggregate in executive output |
| `operational-attention` | Items requiring attention | Server-derived Operations Centre queues and persistent actions | Current organisation learner records and active operational conditions | Count of current, deduplicated operational queue items | Current position; Operations service generation time | Apprenticeship Lead, Employer Admin | Unavailable if the Operations service fails | Named subjects may appear in authorised screen actions but are excluded from aggregate print output |
| `upcoming-enrolments` | Upcoming enrolments | Authorised LevyTate enrolment records | Ready for provider, submitted to provider or enrolment in progress | Count of distinct records not live, completed or cancelled | Current pipeline; enrolment update and report generation time | Apprenticeship Lead, Employer Admin | Zero only after a successful workspace read | Organisation aggregate |
| `assessment-participation` | Assessment participation | Immutable campaign audience and submitted assessment revisions | Recorded invitees for one campaign and questionnaire version | Distinct submitted responses divided by distinct recorded invitees | Selected campaign; campaign dates and report generation time | Apprenticeship Lead, Employer Admin | Unavailable without an eligible campaign; zero-response campaign reported explicitly | Five-submission finding threshold; no private drafts; no overlapping or complement filters |
| `workforce-dimensions` | Six-dimension capability evidence | Submitted comprehensive assessment result snapshots | Distinct submitted responses for one immutable campaign/framework version | Mean of available scored evidence by dimension, rounded to whole-number 0–100 indicators | Selected campaign; submitted revision and report generation time | Apprenticeship Lead, Employer Admin | Suppressed below five submissions; unavailable dimensions omitted | Aggregate evidence only; self-report is not competence; non-response is not low capability |
| `levy-financial-position` | Levy financial position | Persisted DAS transactions, import audit records and confirmed balance evidence | Classified transactions in the latest imported date range | Absolute classified contributions, apprenticeship spend and expiry amounts | Latest imported period; import timestamp and balance evidence date | Apprenticeship Lead and Employer Admin with `finance:read` | Missing values labelled; unclassified rows remain visible | Organisation-scoped provider/programme aggregates; no learner names |

## Operating Brief definitions

### Applications awaiting a decision

The value includes applications whose current owner is `Line Manager`, `Apprenticeship Lead` or `Employer Admin`. It does not include drafts owned by employees or completed, withdrawn, declined or cancelled records.

### Active learners

The value uses learner records, rather than a proxy count of applications or enrolments. Active states are:

- enrolled;
- assessment preparation;
- in assessment;
- Break in Learning.

Pre-enrolment and achieved records remain separate lifecycle positions.

### Items requiring attention

The value uses the Operations Centre's existing derived operational conditions and current persistent actions. The priority list preserves the exact authorised action URL, subject, owner, reason and next step on screen. The executive print output deliberately removes subject names.

### Upcoming enrolments

The value includes enrolment records that are ready for provider, submitted to provider or in progress. It does not infer an enrolment from an approved application.

### Context and trends

Release 3 reports factual current context and recent activity coverage. Directional trends are omitted because the current sources do not yet provide a consistent, comparable historical series for every headline measure. A trend must not be added until its baseline, dates and population are stable and documented.

## Workforce Development safeguards

### Campaign and version integrity

Each report is tied to exactly one assessment campaign and its stored questionnaire version. Historic v2 and current v3 campaigns are shown as separate selectable evidence populations and are never combined.

### Participation

The recorded campaign audience is immutable. The report shows:

- invited;
- submitted;
- non-response;
- participation percentage.

Non-response is a coverage fact only. It is not capability evidence.

### Suppression

The threshold is five distinct submitted responses.

- Organisation capability findings are hidden below five submissions.
- Each department must independently meet five submissions before its findings appear.
- A suppressed department is not merged into a visible `Other` or complement group.
- The UI exposes no overlapping filters that would allow subtraction of one group from another.
- Participation counts remain visible because they describe response coverage, not private response content.

### Interpretation

The six dimensions are aggregate self-report and scenario evidence:

1. AI understanding.
2. Personal and workplace usage.
3. Responsible use.
4. Practical application.
5. Verification and judgement.
6. Wider contribution.

They are not competence scores. Assessment findings do not determine apprenticeship eligibility, programme suitability, funding, prior learning, approval or provider selection.

### Development priorities

Up to three deterministic priorities may be shown when the threshold is met:

- the lowest available evidence dimension;
- the most frequent reported workplace barrier;
- the leading reported workplace use pattern.

Each priority states the evidence, population, proposed intervention, rationale, owner/review timing and a link back to the existing Assessments workflow. These are proposals for employer discussion, not automated decisions or mutations.

## Levy finance rules

The Finance view continues to use persisted DAS data and existing finance calculations. The Overview summarises:

- latest recorded or manually confirmed balance and evidence date;
- imported date range and latest import time;
- classified levy contributions;
- classified apprenticeship spend;
- classified expiry transactions;
- provider and programme spend aggregates;
- unclassified transaction count and value;
- missing provider, programme, balance or import evidence.

The legacy `reportingInsights()` metric labelled **Levy utilisation** is not used. It is a proxy based on learner and application counts, not a defensible financial numerator and denominator. Release 3 therefore displays no utilisation percentage, forecast, saving, return-on-investment or claim of live DAS connectivity.

## Executive report

The Overview can be printed or saved as PDF using a professional multipage layout. It includes:

- employer and report title;
- reporting date;
- current operating position;
- key exceptions and decisions;
- eligible workforce-development findings;
- recorded financial position;
- priority actions;
- definitions and material limitations.

The aggregate executive output excludes employee and learner names, private assessment records and individual finance data. It is never emailed or automatically distributed.

## Empty and unavailable states

- A successfully read empty workspace shows factual zero values.
- A failed source shows `Unavailable`, never zero.
- No assessment campaign produces an evidence-coverage prompt, not a conclusion.
- A zero-response or under-five campaign shows participation and suppression information only.
- Missing finance imports and balances are labelled explicitly.
- Unclassified finance rows remain visible as a data-quality issue.

## Validation coverage

`npm run validate:launch-release-3` verifies:

- source-to-dashboard numerical reconciliation;
- exact authorised operational deep links;
- empty workspace behaviour;
- source failure behaviour without stale values;
- zero/under-five assessment suppression;
- department suppression without complement disclosure;
- mixed framework versions remaining separate;
- three evidence-led priorities only above threshold;
- finance contribution, spend, expiry and unclassified reconciliation;
- absence of the synthetic levy-utilisation KPI;
- complete metric catalogue metadata;
- executive print output and name exclusion;
- access for Apprenticeship Lead and Employer Admin;
- denial for Employee, Line Manager and Platform Admin.

Established RBAC, assessment, finance, operational, Release 1, Release 2, TypeScript, lint and production build checks remain required.

## Known limitations

- DAS finance is imported evidence, not live DAS connectivity.
- No financial utilisation percentage is presented until a defensible period-specific numerator and denominator exist.
- No cross-period trend is presented without comparable historical populations.
- Workforce findings are bounded by campaign participation and self-report limitations.
- Department evidence remains unavailable where the five-submission threshold is not met.
- Recommendations do not establish apprenticeship eligibility, occupational fit, prior learning, funding or approval.
- No custom dashboards, automated emails or report scheduling are included.

## Schema impact

Release 3 requires no database migration and changes no stored employer, learner, application, assessment or finance data.
