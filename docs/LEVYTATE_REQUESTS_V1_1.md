# LevyTate Requests V1.1

Status: build-stage persistence and workflow proposal. Migration `028` is local only and has not been applied to the linked shared Supabase project.

## Purpose

LevyTate Requests connects employer demand with provider supply through a controlled workflow:

> One brief. Comparable proposals. Employer-controlled selection. Connected delivery.

It sits between the global Marketplace and an employer's My Providers / My Programmes portfolio. Receiving a Request never makes a Marketplace provider an employer-managed provider, and proposing a programme never adds it to My Programmes. Only an explicit employer handover after agreement confirmation creates those selections.

Requests is not an open lead marketplace, auction, ranking engine, autonomous sourcing system, tender suite, provider CRM or contract-award mechanism.

## Architecture

The build is split into four security domains:

1. Employer Request records are scoped by `organisation_id` and accessed only after the server resolves an active employer membership and explicit Request permission.
2. Provider memberships are a separate tenancy keyed by canonical `provider_id`. They do not reference or create employer organisation membership.
3. Published Request and submitted response versions are immutable snapshots tied to the exact version answered.
4. Agreement and handover records capture an explicit employer decision without creating applications, learners, enrolments or contracts.

All database access remains server mediated. Migration `028` forces row-level security, revokes `public`, `anon` and `authenticated` table access, and grants only the `service_role` the minimum table operations required. The application server must still derive and verify employer/provider scope for every read and write; a service-role key is not an authorisation decision.

Every new browser mutation endpoint requires an exact same-origin request and parses JSON through a streaming byte limit before schema validation. Oversized bodies are rejected before an unbounded payload can be materialised in server memory.

## Feature capability

Requests uses a dual server-side gate:

- `LEVYTATE_REQUESTS_ENABLED=true` enables the code path in an explicitly controlled environment.
- `levytate_organisation_capabilities.requests_enabled=true` enables an individual persisted workspace after migration `028` is approved.

Both are required in deployed environments. Absence of either gate fails closed. For non-production local validation only, `LEVYTATE_REQUESTS_LOCAL_ORGANISATIONS` may identify explicit fictional test organisation IDs without a live capability row while migration `028` remains unapplied.

Normal Client V1 workspaces have no capability row and remain unchanged. The capability must stay absent/false in Production during this build stage.

## Employer journey

The employer experience is intentionally limited to three main stages:

1. **What do you need?** Start from a Marketplace provider/programme, My Providers, My Programmes or Requests. Choose a programme-led or need-led Request and enter the minimum requirement facts.
2. **Review your brief.** Review and explicitly approve the provider-visible snapshot. Employer-private context is excluded by construction.
3. **Choose providers and send.** Select up to five Marketplace providers and explicitly send the same brief/version and response deadline to each.

The only conceptually required inputs are:

- requirement/outcome;
- learner volume, including `not_confirmed`;
- workplace location, including remote/distributed or `not_confirmed`;
- delivery preference;
- preferred start, including flexible or `not_confirmed`;
- readiness; and
- response deadline before sending.

Programme-led Requests also require a canonical programme ID. A provider/programme entry point supplies context only and never auto-invites or sends.

AI may structure employer-supplied text, but it cannot select providers, invent facts or publish. Every workflow operation remains available without external AI.

## Published brief and privacy boundary

The published snapshot contains only an employer-approved allow-list:

- employer organisation name;
- title and requirement;
- programme/standard context deliberately selected by the employer;
- learner volume/range;
- shared workplace locations;
- delivery preferences;
- preferred timing;
- readiness;
- deliberately supplied department, target-role, workforce-mix, business-outcome, workplace-project, accessibility, procurement and additional notes; and
- the common topics providers should address.

The snapshot builder never copies:

- employee or learner names, IDs, emails or other personal data;
- applications, progress, review content or learner lifecycle data;
- Finance/DAS balances or references;
- Intelligence Signals;
- internal provider notes or concerns;
- employer-private decision notes;
- competing provider identities, responses, prices or decline reasons;
- salaries, credentials, tokens, cookies or raw AI prompts.

The final send preview must restate both the shared and excluded information before the employer confirms.

## Request versioning

Drafts remain editable through `updateServiceRequestDraft`. Publishing creates immutable Version 1. A material change uses `updatePublishedServiceRequest`, records a change summary and creates Version 2 or later; it never rewrites a prior snapshot.

Invitations point to the current published Request version. Submitted response versions independently retain the exact Request version they answered. Existing responses therefore remain historically comparable after a Request update, while invitees can be told that the Request has changed and create a revised response. A client-supplied revision flag alone cannot reopen a submitted response: the invitation must point to a later published Request version.

Response deadlines must be valid future dates when a brief is created, published or revised. Passing a deadline marks non-responded invitations appropriately without deleting drafts. When no submitted response exists and no invitation remains open, the Request becomes `expired` with a deterministic `request_expired` system event. A submitted response keeps the Request in its response/decision state: the deadline closes provider submissions, not the employer's comparison and decision window. After the deadline the employer may explicitly close the decision without selecting a provider, retaining all history, or extend the deadline. Extending an expired Request creates a new published version, restores each invitation from its recorded delivery/view truth and reopens the Request at the appropriate response/decision status. Cancellation remains terminal and cannot be reopened in V1.1. Once a provider is progressing to agreement, the employer must use the explicit `Did not proceed` outcome rather than cancelling or materially revising the brief.

## Controlled statuses

Request statuses:

- `draft`
- `open`
- `responses_received`
- `decision_in_progress`
- `progressed_to_agreement`
- `closed`
- `cancelled`
- `expired`

Invitation statuses:

- `pending_delivery`
- `sent`
- `viewed`
- `responded`
- `declined`
- `delivery_failed`
- `deadline_passed`
- `cancelled`

Response status is only `draft` or `submitted`; immutable submitted versions carry revision history. Decision state is `pending`, `shortlisted`, `declined`, `progressed_to_agreement`, `agreement_confirmed` or `not_proceeded`.

Invitation/view/response/decline counts are derived rather than added to the Request status model.

## Provider selection and commercial neutrality

Employers choose recipients. Catalogue suggestions may cite transparent facts such as a verified programme, delivery model or coverage. They must not use percentage match scores, rankings, subscription level, advertising spend, historic LevyTate payment, popularity or provider size.

The V1.1 anti-spam maximum is five providers per Request. Three may be suggested where enough relevant providers exist, but it is not a rule. All invitees receive the same published version, material information and employer-set deadline. Providers never see who else was invited.

## Legacy matching separation

`levytate_matching_requests` and its percentage-ranked shortlist behaviour are deliberately not imported, queried or mutated by the Requests domain. The new workflow has explicit `serviceRequests:*` permissions, separate tables and employer-selected recipients.

Reusable factual Marketplace filtering may be used by the UI, but score generation, best-match ordering, automatic provider selection and legacy matching statuses are excluded.

## Provider tenancy and authentication

Provider users authenticate using the existing Supabase passwordless architecture. A session must resolve all of:

- Auth subject;
- normalised email;
- active `levytate_provider_memberships` row;
- canonical provider ID;
- provider role; and
- the specific Request invitation.

Provider roles are separate from employer roles:

- `Provider Admin`
- `Provider User`

Both may view/respond to Opportunities belonging to their canonical provider tenancy in V1.1. An invitation contact is notification context, not an individual record-level authorisation boundary: another active member of the same provider may continue the provider's response, while a member of any other provider remains denied. Self-service provider-user administration is not included; Platform Admin provisions provider membership during V1.1 unless the separate token-redemption route receives security approval.

The Platform Admin's **Access & tenant support** surface contains the controlled V1.1 operator journey. It is discovered through a server-probed endpoint and renders no provider-access controls when the Requests environment gate is off. An authenticated Platform Admin selects an active canonical Marketplace provider, records the provider user's display name and work email, and assigns `Provider User` or `Provider Admin`. Provisioning prepares the Supabase Auth identity and creates one active, audited provider membership with a visibly pending binding; it does not send a sign-in email, expose an Auth identifier or create employer membership. The user then requests their own passwordless link from `/levytate/provider/login`, and the first successful callback binds the Auth subject.

The same surface shows active/inactive and pending/bound status plus last-sign-in context. Platform Admin may update display name or provider role, revoke access, or reactivate the existing membership after confirmation. These lifecycle changes use the service-role-only `levytate_mutate_provider_membership` transaction so the membership and its platform audit record succeed or fail together. Provider Admin self-service remains deliberately deferred; the two provider roles have equal Opportunity-response permissions in V1.1.

Reactivation deliberately invalidates any previous Auth-subject binding and returns the membership to `pending`. The provider must complete a fresh passwordless callback before protected access resumes, so an old browser session cannot silently regain access.

The proposed `levytate_provider_access_invites` table supports a future controlled first-use flow with a SHA-256 token hash, expiry, invited-email/provider/invitation binding, one active invite, single-use redemption and revocation. It never stores a plaintext token and cannot create employer membership. The build does not expose an insecure public redemption shortcut.

Provider membership grants only:

- the provider's identity;
- Requests explicitly invited to that provider;
- that provider's drafts/submitted responses;
- provider-specific and anonymised shared clarifications relevant to those invitations; and
- that provider's factual Activity counts.

It grants no employee, application, learner lifecycle, Finance, employer settings, operational actions, employer Intelligence Signals or cross-provider data.

Provider mutations require an explicit same-origin browser request. Provider session signing uses an independent deployment secret, active membership is revalidated on every protected read, logout clears all provider cookies and browser cache/storage, and a page restored from the back-forward cache reloads through the server boundary before showing protected content.

## Provider Opportunities

The minimal provider workspace is separate from employer navigation at `/levytate/provider` and contains Opportunities and Activity.

Opportunity detail displays the exact approved snapshot, Request version, published date, deadline and readiness, plus:

> This is an invitation to respond and is not a contract award or funding commitment.

A structured response contains:

1. canonical proposed programme or `Alternative / pathway to discuss`;
2. why it fits;
3. earliest available start;
4. delivery approach;
5. learner/cohort capacity;
6. workplace requirements;
7. learning commitment where known;
8. employer reporting/support;
9. provider proposed training/assessment price;
10. price basis/assumptions and separately identified additional costs;
11. relevant evidence; and
12. exceptions or points to clarify.

Funding-band maximums remain reference context and are never relabelled as provider price. No employer cost or co-investment is inferred.

Provider response AI, if added later, may structure approved provider facts but must not invent capacity, price, availability, outcomes, evidence or customers. Response creation does not depend on AI.

## Decline and delivery failure

A provider can decline using a controlled reason category and optional note. It remains private Request intelligence and never creates a public rating.

Notification acceptance is recorded separately from the invitation record, including the delivery provider's non-secret message identifier where one is returned. A delivery failure sets `notification_status=failed` and `status=delivery_failed`; it never falsely reports a sent notification. The same invitation can be retried without creating a duplicate. No automatic reminder campaign exists in V1.1.

An invitation is not exposed in the provider workspace while delivery is pending or failed. Only a truthfully accepted notification makes the Opportunity visible. A provider response notification is likewise recorded once per employer recipient; an exact submission replay retries only recipients whose delivery acknowledgement is still missing, using stable recipient-safe idempotency without duplicating the response.

## Clarifications

Both directions are supported:

- a provider may ask an employer a Request question; the employer answers and can deliberately share a material answer with every invitee;
- an employer may ask a provider a question about its submitted response; only that provider may answer.

Provider-specific questions remain limited to that invitation. Shared provider-origin clarifications are projected to other providers with the label `Employer clarification`, without provider ID, provider member ID or originating-provider language. An employer-origin question is also labelled `Employer clarification` to its target provider.

## Comparison and decisions

Comparison is a structured side-by-side projection on desktop and can render as sequential cards on small screens. It includes programme, start availability, delivery, capacity, workplace requirements, learning commitment, support/reporting, provider proposed price, evidence and exceptions.

The deterministic difference summary identifies factual differences such as start date, delivery, cohort conditions and price assumptions. It never produces a score, ranking, star rating, best fit, recommendation or winner.

Employer actions are:

- `Ask clarification`
- `Shortlist`
- `Decline`
- `Progress to agreement`

Multiple providers may be shortlisted. One provider may progress to agreement at a time in V1.1; both the workflow and a partial unique database index enforce that rule under concurrent requests. Cancelled or closed Requests reject new employer decisions. A passed response window still permits the employer to assess responses already submitted, but decisions reject any response tied to an older Request version. Employer-private notes are never included in provider projections.

Progressing means an intention to continue commercial/operational discussions. It is not a contract, funding approval, provider appointment or learner enrolment. Agreement is recorded only through an explicit later `Agreement confirmed` action; inactivity never implies agreement.

## Agreement and operational handover

Agreement confirmation creates an immutable **Request agreement snapshot** from the selected submitted response version. It retains proposed start, delivery, workplace requirements, learning commitment, reporting/support, proposed price and assumptions, additional costs, exceptions and the canonical programme ID where selected. It is explicitly operational reference, not a legally binding contract.

The employer may then explicitly choose:

- Add provider to My Providers;
- Add selected canonical programme to My Programmes.

Handover is idempotent per Request, including when the same intent arrives under a different transport idempotency key, and uses the existing organisation catalogue-selection records. A later conflicting handover intent is rejected rather than creating a second record. Existing selections are not duplicated. It never creates employees, applications, learners, enrolments or lifecycle changes.

## Metrics and events

Provider Activity exposes factual counts only:

- Opportunities received;
- Responses submitted;
- Shortlisted;
- Progressed to agreement;
- Declined.

No revenue, ROI, win rate or quality label is inferred.

The append-only event model records meaningful state changes with a per-Request idempotency key. Events cover creation, publication/update, delivery/view, response start/submission/revision, provider decline, both clarification directions, sharing, shortlist/employer decline, progress, confirmed/not-proceeded agreement, deadline extension, expiry, cancellation/closure and workspace handover.

Event metadata is bounded to operational facts. It must never contain secrets, full emails, private notes, chain-of-thought or raw AI prompts/responses.

## Persistence proposal

Migration: `supabase/migrations/028_create_service_requests.sql`

New tables:

- `levytate_organisation_capabilities`
- `levytate_provider_memberships`
- `levytate_service_requests`
- `levytate_service_request_versions`
- `levytate_service_request_invitations`
- `levytate_provider_access_invites`
- `levytate_service_request_responses`
- `levytate_service_request_response_versions`
- `levytate_service_request_clarifications`
- `levytate_service_request_decisions`
- `levytate_service_request_agreements`
- `levytate_service_request_handovers`
- `levytate_service_request_events`

The schema uses composite employer/request/provider foreign keys where the current catalogue model permits, UUID record IDs, unique invitation/response/idempotency constraints, restrictive foreign-key actions, forced RLS and service-role-only policies. Decision, agreement and handover foreign keys preserve their Request/provider correlation. A null-safe service-role guard protects both mutation functions. The Request persistence function commits every logical action as one database transaction, takes an organisation-scoped advisory lock and checks the previously read target Request plus every changed mutable row before writing. This protects related-row-only actions, such as invitation or clarification inserts, from committing against a Request cancelled or changed between the application read and database lock. Agreement confirmation, its handover audit and explicit My Providers/My Programmes selections are committed together. A transaction-scoped advisory-lock trigger separately enforces the maximum of five provider invitations under concurrent sends, and a partial unique index prevents two providers progressing on the same Request. Published brief versions and submitted response versions have no update or delete grant. No existing table is altered. Canonical provider/programme identifiers are verified through the existing Marketplace service rather than copied or mutated.

## Migration safety and activation procedure

The linked project `lzwcahdgchrkeulmlfqv` is shared/Production-capable. Migration `028` must not be applied until explicit approval.

After approval, the authorised operator must:

1. confirm the feature branch and a clean working tree;
2. take and checksum a fresh secure database backup outside Git;
3. confirm the linked Supabase reference is exactly `lzwcahdgchrkeulmlfqv`;
4. run `supabase migration list --linked` and require exact local/remote parity through `027`, with `019` intentionally absent;
5. re-review migration `028` for its thirteen new tables, foreign keys, constraints, indexes, forced RLS, grants and policies;
6. run `supabase db push --linked --dry-run` and verify that only `028_create_service_requests.sql` is proposed;
7. obtain explicit shared-database migration approval;
8. run the approved linked push once, then verify the remote ledger contains `028` and inspect every new table/policy;
9. insert/update `levytate_organisation_capabilities.requests_enabled=true` only for the named protected test organisation through an authorised server/admin path;
10. set `LEVYTATE_REQUESTS_ENABLED=true` only for the approved protected Preview environment and redeploy that Preview;
11. repeat tenant, provider-isolation, privacy, idempotency and accepted Client V1 regressions against the protected Preview; and
12. leave Production's environment gate disabled and all normal workspace capability rows absent/false.

Do not perform step 8 without the approval in step 7. Do not apply through the SQL editor ad hoc, edit ledger history, enable Production, or seed Request records.

## Automated build-stage evidence

`node scripts/validate-requests-v1-1.mjs` exercises the exact fictional main scenario and validates:

- blank employer state and feature-off safety;
- explicit employer permissions;
- draft/publish/immutable versions/material update;
- three employer-selected canonical providers and the five-provider limit;
- separate provider membership resolution and direct-ID isolation;
- truthful email failure/retry;
- response drafts/submission/version/idempotency;
- provider decline;
- provider-to-employer and employer-to-provider clarifications;
- shared-clarification anonymisation;
- structured neutral comparison with no rank/score/winner;
- shortlist/progress/agreement semantics;
- idempotent My Providers/My Programmes handover;
- second-employer and Provider A/B/C isolation;
- cancellation, deadline marking, post-deadline employer decisions and versioned extension;
- terminal/deadline write denial, future-deadline validation and safe expiry/reopen;
- response revision only after a new published Request version, and rejection of stale-version decisions;
- provider-tenancy-wide access for a second active member of the same provider;
- responded-status preservation and handover replay/conflict behaviour;
- event integrity and private-data exclusion;
- UUID/schema compatibility; and
- static additive/RLS/revocation/migration-boundary checks.

The deterministic build-stage suite is supplemented by an isolated PostgreSQL 18 migration run against the minimum existing LevyTate schema contract. That run created migration `028`, exercised atomic Request-plus-event persistence, proved a deliberately invalid final row rolls the whole action back, proved stale mutable-row timestamps are rejected, and exercised transactional provider-membership-plus-audit creation. It did not use or modify the linked Supabase project. A full Supabase-compatible clean-project run, linked migration dry-run and concurrent integration test remain mandatory after shared-database approval and before activation.

Fixtures use fictional `.test` identities and existing canonical provider/programme IDs. They create no canonical provider row and are not imported by real client mode.

## Known V1.1 limitations

- Provider self-service membership administration is deferred.
- Secure first-use token redemption remains gated until its complete server route and abuse controls are separately approved; Platform Admin provisioning is the safe V1.1 fallback.
- No automatic reminders, reopening, multi-requirement Request, contract e-signature, billing or procurement-compliance engine.
- No provider ratings, rankings, scoring, subscription preference or open opportunity board.
- No cross-employer analytics or provider view of named aggregate employer demand.
- No automatic application, learner, enrolment, lifecycle or provider-performance mutation.
- Comparison intelligence is deterministic and neutral; it does not choose a provider.
- External AI is optional and cannot publish, send, decide or populate unsupported facts.

## Unchanged systems

Migration `028` and this domain do not alter:

- accepted Client V1 blank-workspace behaviour while Requests is off;
- global Marketplace data or editing rules;
- My Providers/My Programmes selection semantics outside explicit handover;
- existing applications or learner lifecycle;
- Finance calculations or records;
- Provider Intelligence ingestion, visibility or fairness;
- Progress Review Intelligence;
- legacy matching history;
- public MPR/LevyTate sites; or
- Production aliases/environment.
