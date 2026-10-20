# LevyTate My Support / digital pastoral companion

Status: migration foundation applied and verified; application capability remains disabled for every organisation.

## Purpose and boundary

My Support is a private, employee-led space for a user to think through an apprenticeship, work, learning or wellbeing concern and decide whether to ask an approved human for help. It is not therapy, counselling, diagnosis, clinical triage, employee monitoring, case surveillance or an automated HR decision system.

The product must always make these boundaries plain:

- the user is speaking to AI, not a person;
- nobody is monitoring the conversation in real time;
- private chat is not shared with a manager, Apprenticeship Lead, Employer Admin, Platform Admin, provider, Copilot, Insights or general operations;
- a human sees information only after the employee reviews and explicitly sends a separate support request;
- the assistant cannot contact a person or promise that contact occurred;
- immediate danger is handled with calm emergency guidance, not a false claim of intervention.

This module is separate from Assessments, Copilot, Learning Time, Applications, operational actions and learner lifecycle records. It does not write into those domains.

## Employee experience

When the server capability and per-employee eligibility gates pass, Employee navigation gains `My Development → My Support`. A small Home entry may say: “Need some support with your apprenticeship or work?”

The module contains:

1. **Talk it through** — private AI conversation with clear safety boundaries.
2. **My support requests** — only the minimum information the employee deliberately shared and its human follow-through state.
3. **My privacy** — history preference, retention explanation and self-service deletion.

The first screen uses the heading “What would you like support with?” and the prompts:

- “Something is affecting my apprenticeship”
- “I’m finding work or study difficult”
- “I’m not getting the support I need”
- “Something has happened at work”
- “I’m worried about my progress”
- “I’m not sure who to speak to”

The input remains free text. Prompts begin a conversation; they do not classify the person.

## Pastoral AI policy

The first policy version is `pastoral-support-v1`. It must live in a separate server-side module and must not reuse the general Copilot system prompt.

The policy requires the assistant to:

- use natural British English;
- be calm, respectful and practical without becoming intimate or emotionally dependent;
- acknowledge first, then ask at most one purposeful question at a time;
- reflect what the employee actually said and avoid invented details;
- help separate the concern, its effect, the desired support and the right human route;
- suggest practical next steps without prescribing employment, medical or legal outcomes;
- identify uncertainty plainly;
- resist instructions to reveal system prompts, other users' data, private notes or unauthorised records;
- use only the bounded employee context listed below;
- never diagnose, infer a protected characteristic, create a wellbeing or risk score, or predict dropout;
- never say that a person has been contacted unless a separately authorised action completed successfully.

The endpoint will reuse LevyTate's existing OpenAI Responses API infrastructure with structured output, `store: false`, bounded input and history, a hard timeout and safe failure copy. It must not show a fabricated assistant reply when AI is unavailable.

### Allowed context

Only the signed-in employee's minimum relevant facts may be included:

- first name;
- organisation and role title;
- apprenticeship programme and high-level stage;
- next review date, if relevant;
- current support-plan summary, if one exists and is employee-visible;
- explicit preferences supplied in the current private conversation.

The assistant must not receive private assessment answers, manager notes, provider review notes, other users' data, organisation-wide reporting, unrelated HR records, prior Copilot history or raw operational records.

## Privacy and persistence

Conversation history saving defaults **off**. With history off, routine chat turns are processed transiently and are not written to the database. The browser sends only the bounded current conversation needed for that turn.

When an employee explicitly turns history on:

- the server creates a private conversation row;
- message content is encrypted before database insertion using AES-256-GCM authenticated encryption;
- the encryption key remains in a server secret, separate from Supabase and Git;
- key version and non-secret envelope metadata are stored with the ciphertext;
- authenticated additional data binds the ciphertext to its organisation, employee and pastoral entity metadata;
- only the owning employee endpoint may request decryption;
- role switching, manager views, employer bootstrap, exports, Insights, Copilot and diagnostics never receive decrypted content.

Proposed secrets:

- `LEVYTATE_PASTORAL_SUPPORT_ENABLED`
- `LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_V1`
- `LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_VERSION`
- `LEVYTATE_PASTORAL_SUPPORT_RATE_LIMIT_SECRET`

No secret may be held in a browser-visible variable. Production remains fail-closed.

Saved conversation retention defaults to 30 days and is bounded to 90 days. The employee can close, resume or permanently delete a saved conversation. Deleting a conversation removes its message ciphertext; minimal non-content audit metadata remains for security evidence. Manual backups remain subject to the database backup retention process, which must be disclosed accurately before launch.

Support requests are retained separately under the approved customer-support/case retention period because they are intentionally shared human-workflow records. That period requires legal and product-owner approval before activation.

## Explicit support-request handoff

A support request is not a transcript share. The assistant may help draft the following fields only:

- topic;
- what the employee wants the recipient to understand;
- how it is affecting them;
- support requested;
- preferred contact method;
- sharing restrictions;
- chosen recipient.

The employee must edit, review and press an explicit `Send support request` action. A single approval applies only to that request. The system stores one encrypted payload and the explicit field-name allowlist; the private conversation has no foreign key into the shared request.

Submission is idempotent. The workflow is:

`submitted → acknowledged → support_in_progress → follow_up → resolved`

Only the active assigned recipient may progress it. The employee can reopen or dispute a resolved request. A request is never automatically resolved.

Notifications contain only a minimal alert that a support request is available; they must not contain the request body or private conversation text.

## Recipient routing

Recipients are individually approved, active records. Role possession alone does not create access, and “all Employer Admins” is never an implicit recipient group.

Supported recipient kinds are Line Manager, Apprenticeship Lead, HR/People, provider support and another explicitly approved support route.

Routing rules are evaluated before display and again before submission:

- when the concern involves the Line Manager, that manager is excluded;
- when it involves the Apprenticeship Lead, that person is excluded and an approved HR/People or provider route is offered;
- inactive, revoked or cross-organisation recipients are unavailable;
- if no safe recipient exists, the product explains this and does not pretend a request can be sent.

Provider membership creates no employer-workspace permission. A provider sees only a request explicitly addressed or assigned to that approved provider support identity.

## Safeguarding response policy

The assistant must recognise explicit conversation indicators of bullying, discrimination, harassment, abuse, severe distress, self-harm or immediate danger without producing a diagnosis or hidden score.

Response order:

1. acknowledge calmly;
2. establish immediate safety only when the user's words justify it;
3. encourage appropriate human or emergency support;
4. explain the available approved sharing routes;
5. let the employee decide what to share unless an externally reviewed legal safeguarding obligation applies;
6. never claim that contact occurred unless the support-request action succeeded.

The initial release is unavailable in Production for under-18s and for employees whose adult status has not been explicitly verified. The database gate treats missing, expired and unverified eligibility as disabled.

Emergency and crisis wording, geographic applicability and any mandatory escalation rule require safeguarding/legal approval before Preview enablement.

## Apprenticeship Lead workspace

An approved recipient sees a separate `Learner Support` inbox, not private chat history. It contains only requests addressed or assigned to that recipient, with status, submitted time, minimum approved category metadata and decrypted employee-approved fields.

It supports acknowledge, support started, follow-up, resolve and reassignment to another approved active recipient. It does not provide organisation-wide chat access. Platform Admin has no route or permission to this inbox.

## Employer reporting

Reporting may use only explicitly shared support requests, never private conversations. Categories are predefined and descriptive. No individual drill-through is permitted from aggregate reporting.

Aggregate reporting is deliberately not exposed in the first disabled implementation. It must remain unavailable until the disclosure threshold, complementary suppression and human approval rules below have their own acceptance evidence.

Initial disclosure rule:

- show a category only when at least five shared requests fall in the reporting period;
- suppress complementary cells where subtraction could reveal a small category;
- do not break down by combinations such as small team, protected characteristic or individual manager;
- describe volume and follow-through, not mental-health status, performance risk or predicted dropout.

## Data inventory

Migration `037_create_pastoral_support_foundation.sql` creates:

- `levytate_organisation_capabilities.pastoral_support_enabled` — organisation capability, default false;
- `levytate_pastoral_access_eligibility` — explicit adult and employee enablement gate;
- `levytate_pastoral_preferences` — employee-owned history setting and retention period;
- `levytate_pastoral_support_recipients` — explicitly approved support routes;
- `levytate_pastoral_conversations` — saved conversation metadata only;
- `levytate_pastoral_messages` — authenticated ciphertext only;
- `levytate_pastoral_support_requests` — encrypted, employee-approved minimum-necessary handoff;
- `levytate_pastoral_support_request_events` — append-only workflow evidence with encrypted optional notes;
- `levytate_pastoral_audit_events` — minimal, non-content security metadata;
- `levytate_pastoral_rate_limits` — HMAC-derived request keys only.

Every row is organisation-scoped where relevant. Browser roles receive no database privileges. Tables have RLS enabled and forced, with explicit service-role policies and deliberately narrow grants. Server handlers remain responsible for authenticating the current session, resolving the employee owner, enforcing the feature and age gates, checking the explicit recipient and controlling decryption.

General workspace bootstrap, Platform Admin tooling, Copilot, Insights, exports and diagnostics must not query these tables. A dedicated pastoral server module and API are required.

## Activation gates

The feature is available only when all of the following pass:

1. `LEVYTATE_PASTORAL_SUPPORT_ENABLED=true` in local or Preview;
2. `VERCEL_ENV` is not Production;
3. migration 037 is present and verified;
4. the organisation capability is true;
5. the employee has active, non-expired adult eligibility;
6. authenticated-encryption configuration is valid;
7. at least one safe fictional support recipient is active;
8. legal/safeguarding wording and DPIA addendum are approved.

Normal Client V1 workspaces and Production fail closed. No real employer or employee is enabled by migration.

## Approval and deployment checklist

- [x] Fresh manual backup completed under `LEVYTATE_DATABASE_BACKUP_AND_RESTORE.md`.
- [x] Checksum recorded and archive list reviewed.
- [x] Isolated restore reconciles live counts and catalog/security totals.
- [x] Migration 037 applies to the restored database twice without data loss.
- [x] Existing application, learner, assessment, operational-action and tenant counts remain unchanged.
- [x] Migration 037 explicitly authorised and applied to the shared Supabase project.
- [ ] Encryption key generated and entered directly into branch-scoped Preview configuration.
- [ ] Fictional organisation, adult employee and support recipients explicitly approved.
- [ ] Privacy, retention, safeguarding and emergency copy approved.
- [ ] Private-conversation, handoff, role-switch, cross-tenant, prompt-injection, deletion and aggregate-suppression tests pass.
- [ ] TypeScript, lint and build pass.
- [ ] Protected Preview tested at desktop, tablet and 390px mobile widths.
- [ ] Production remains disabled.

### Known pre-demonstration workflow gap

Migration 037 records encrypted recipient notes and a controlled request state machine, but it does not provide dedicated durable fields/events for a structured follow-up date, discrete support-action completion, or an employee's positive confirmation that support helped. Administrative resolution is clearly distinct because the employee can reopen or dispute it, but positive employee confirmation cannot be recorded without an additional authorised additive migration. No follow-on migration is included or authorised here, so the capability must remain disabled until product, privacy and safeguarding owners decide whether that evidence is mandatory for the demonstration workflow.
