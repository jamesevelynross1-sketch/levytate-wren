# LevyTate My Support — DPIA addendum preparation

Status: draft for legal, safeguarding and data-protection review. This is not approved launch copy.

## Proposed processing

My Support would let an eligible adult employee use an AI assistant to think through an apprenticeship, learning, workplace or wellbeing concern. Conversation history is optional and off by default. A separate support request is processed only after the employee reviews and explicitly shares a minimum set of fields with a named, approved recipient.

The feature may process information that becomes special-category personal data because of what the employee chooses to type. That possibility makes the feature high sensitivity even though LevyTate does not ask the AI to infer health, disability, ethnicity, religion, sexual orientation, trade-union status or any diagnosis.

## Roles requiring confirmation

Before activation, the employer, LevyTate and any provider support route must confirm their controller/processor roles for:

- private AI conversation processing;
- optional encrypted conversation storage;
- employee-approved support requests;
- safeguarding and emergency handling;
- support-request notifications;
- retention, erasure and backup handling;
- aggregate employer reporting.

No Production use is permitted until the lawful basis, special-category condition where applicable, transparency wording and data-processing instructions are approved.

## Data-flow summary

1. The authenticated employee enters text in My Support.
2. The LevyTate server validates the employee, fictional/approved organisation, adult eligibility, capability, rate limit and payload size.
3. The server sends bounded employee context and bounded conversation history to the approved AI provider using the Responses API with provider-side storage disabled.
4. If history saving is off, the routine turn is not written to Supabase.
5. If history saving is on, LevyTate encrypts each message using authenticated encryption before inserting ciphertext into Supabase.
6. A support request is a new, employee-reviewed object. It contains only approved fields, is encrypted before storage and is accessible only to the employee and active assigned recipient.
7. Aggregate employer reporting uses predefined categories from shared requests only, subject to disclosure thresholds and complementary suppression.

## Data minimisation

Allowed AI context is limited to the employee's first name, organisation, role title, programme, high-level stage, relevant review date, employee-visible support summary and current conversation preferences.

The following are prohibited from the AI context and private store:

- other users' data;
- private assessment answers;
- manager and provider notes;
- organisation-wide reports;
- prior Copilot conversations;
- inferred diagnoses, risk scores, performance scores or predictive dropout labels.

Audit records contain action, outcome, timestamp, entity identifier and correlation identifier only. They do not contain prompts, responses, transcript text or support-request payloads.

## Access controls

- Private conversations: owning employee only.
- Support requests: owning employee and explicitly addressed/assigned active support recipient only.
- Line Manager: no access unless individually chosen and not implicated by the concern.
- Apprenticeship Lead: no organisation-wide transcript access; only addressed/assigned requests.
- Employer Admin: no automatic access by role.
- Platform Admin: no content access.
- Provider: only a request explicitly addressed or assigned to an approved provider support membership.
- Copilot, Insights, general operations, data exports and demo role switching: no private conversation content.

All database tables are service-role only and application-encrypted content remains unintelligible without the separate server-held key. The server must revalidate membership, organisation, ownership and recipient assignment on every request.

## Retention and deletion proposal

- Unsaved routine conversation: no database persistence.
- Saved private conversation: 30-day default, 90-day maximum, employee deletion available at any time.
- Conversation security audit metadata: proposed 12 months, no content.
- Shared support request and workflow evidence: retention period to be decided with the employer and legal adviser before activation.
- Encrypted manual backups: managed under the database backup runbook; the practical effect on erasure timing must be stated in the privacy wording.

These periods are proposals and do not amend the canonical retention schedule until approved.

## Safeguarding and age boundary

The initial release must fail closed for under-18s and age-unverified users. Missing or expired eligibility is equivalent to disabled access.

The assistant may recognise explicit words indicating bullying, discrimination, harassment, abuse, severe distress, self-harm or immediate danger solely to select safer response wording and human routes. It must not create a hidden category, diagnosis or score about the person.

Emergency wording, geographic coverage, mandatory-reporting duties and the point at which user choice may be overridden require specialist safeguarding/legal approval. The system must never claim that a person has been contacted unless a separate action completed successfully.

## AI-provider controls requiring evidence

Before activation, record evidence for:

- the approved model and region;
- provider-side request storage disabled;
- applicable DPA and subprocessor terms;
- data-retention and abuse-monitoring behaviour;
- whether submitted data is used for model training;
- access logging and incident notification;
- a tested provider outage and timeout response;
- prompt-injection and data-exfiltration testing.

## Aggregate reporting controls

Only explicitly shared support requests contribute to employer aggregates. Private conversations never do.

The initial rule suppresses cells below five and uses complementary suppression where subtraction could reveal a small group. Reporting must not rank employees or managers, profile individuals, infer health or capability, or predict withdrawal/dropout.

## Residual risks for decision

| Risk | Proposed control | Approval/evidence still required |
|---|---|---|
| Employee assumes a human is watching | Persistent AI/no-live-monitoring disclosure and direct human route | Usability test and approved wording |
| Sensitive text reaches an unintended role | Separate encrypted store, owner checks, explicit recipients, no broad role inheritance | End-to-end RBAC and role-switch evidence |
| Unsafe AI response | Separate versioned pastoral policy, structured validation, deterministic safety layer, human route | Safeguarding review and red-team scenarios |
| Provider or staff revocation leaves access open | Revalidate active recipient on every read/action | Live revocation test |
| Small-number reporting re-identifies a person | Minimum threshold five and complementary suppression | Reporting test set and DPO approval |
| Deletion misunderstood because of backups | In-product explanation and runbook-aligned erasure process | Final retention language |
| Under-18 use | Explicit adult eligibility gate; missing/expired means disabled | Operational owner and evidence source |
| AI/provider outage | Honest unavailable state; no fabricated response | Timeout and failure test |

## Required approvals before any Preview enablement

- Product Owner: scope and fictional test population.
- Data Protection lead: DPIA, lawful basis, role allocation, special-category handling and retention.
- Safeguarding lead or qualified adviser: response policy, emergency copy and escalation boundaries.
- Security owner: encryption/key rotation, logging, incident response and access tests.
- Employer test owner: named recipients and safe alternative routing.

Migration 037 may be applied only after the separate database backup/restore gate and explicit migration authorisation. Applying the migration does not itself authorise feature activation.
