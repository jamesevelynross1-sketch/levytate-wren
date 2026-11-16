# Local acceptance evidence — 16 November 2026

This record covers the new fictional local runtime after the prior temporary runtime was lost. Historical browser results remain in the 10 November record and are not new-run acceptance.

## Native schema startup

Pinned Supabase CLI 2.122.1 automatically applied the generated, reviewed 28-file chain during native stack startup because migrations were enabled. The expected pre-application local dry-run did **not** occur. The subsequent supported local dry-run scheduled zero migrations because the chain was already present. This is a local bootstrap-ordering defect, not a successful migration-process acceptance result. No explicit push, reset, repair, fabricated ledger or migration 038 was used. The mandatory linked hosted dry-run remains unwaived.

The independent readback in [the safe schema evidence](evidence/LEVYTATE_LOCAL_SCHEMA_START_2026-11-16.json) verifies PostgreSQL 17.11, all 28 exact recorded statement checksums, 135/135 application tables with RLS, zero browser/public table or function grants, four private buckets, no public buckets, and zero employers, People, Auth users or Storage objects. Root reviewed those findings and explicitly authorised fictional stateful local acceptance on this verified schema, preserving the process deviation. A separate fresh-runtime staging-gate correction and proof is owned by the identity worker; it must not reset this runtime.

No hosted or shared Production schema/data was changed. New-run browser acceptance has not yet run.

## First current-browser run

The signed Edge 157.0.4341.60 run used exact application commit `63eeb8fffd0638644b4d2156c861bd2aa26b2a63` and harness `4d967d17c4201169e5010c93d2b6dd64a47e59bc`. It completed 224 passing assertions, four failed assertions/groups and one external-email blocker. Six genuine contexts covered three distinct roles across two fictional tenants; four invitations used the actual employer invitation endpoint. All contexts were logged out and closed. [Full safe result](evidence/LEVYTATE_LOCAL_BROWSER_2026-11-16_FIRST_RUN.json).

The connected application, separate Manager and Lead approvals, genuine Employee declaration and employer enrolment passed. The learner remains enrolled intentionally for Operations/Intelligence; terminal withdrawal was not run in this batch and prior evidence remains separate.

The Operations helper recorded real current-date fictional progress through the UI, then expected one lifecycle event. Actual data contains both intended `progress_updated` and `learner_identified_behind_target` events for the behind-target observation; the helper must assert those exact two events before a continuation can count as acceptance. No provider review or Intelligence decision was completed in this run.

Employee recovery passed malformed draft-response retention/exact retry and actual submission commit followed by genuine logout and provider refresh denial. The visible popup reached the correct same-origin login form, but waiting for the renewed request response timed out. Its cause remains under investigation; end-to-end session recovery is not accepted.

Readiness separately passed actual Intelligence RPC failure (5 assertions) and authentication rate-store failure (8 assertions), with 200 → 503 → 200 and original privileges restored. External inbox delivery remains unproved: all mail was confined to local SMTP capture.

## Durable local recovery

After the first bounded browser run, the actual local full database was encrypted and restored into a newly named isolated database. The restore retained all 28 ledger entries and 135 RLS-protected application tables, six fictional Auth accounts, four People records and three organisations (two employers plus the synthetic catalogue). The archive and separate derived archive-only key are retained under the ignored private recovery directory with 0700/0600 permissions. No browser cookie or storage-state export was made. [Database restore evidence](evidence/LEVYTATE_LOCAL_DB_RECOVERY_AFTER_ROLES_2026-11-16.json).

Two explicitly fictional files were uploaded and read back through the actual local private Storage API, one per employer prefix. The physical-byte backup encrypted both files (214 bytes), verified the saved archive, restored them into a new isolated directory, and checked identical source catalogue and byte hashes afterward. This verifies physical byte recovery separately from the database restore; it does not claim a restored Storage service or hosted disaster-recovery acceptance. [Physical Storage evidence](evidence/LEVYTATE_LOCAL_STORAGE_RECOVERY_2026-11-16.json).

## Login hydration reproduction

A no-Auth probe against both actual login routes held five client scripts before hydration. Both frozen63 forms exposed enabled fields and buttons prematurely. After releasing scripts, both forms sent one correctly intercepted fictional request and displayed confirmation. Separately, the popup probe reproduced typed input being lost during hydration and showed a loaded-page wait prevents that timing failure. The application owner is adding a hydration guard; its corrected current-page probe and subsequent genuine recovery remain required. [Delayed-JS baseline](evidence/LEVYTATE_LOGIN_HYDRATION_BEFORE_2026-11-16.json).

## Actual local advisors

The supported pinned CLI `db advisors --local --type all --level info --fail-on none` completed successfully and returned 350 findings: 133 unindexed foreign keys (INFO), 91 unused indexes (INFO), 48 RLS tables without policies (INFO), 74 RLS expression init-plan warnings, and four mutable-function-search-path warnings. No ERROR-level finding was returned, but this is not a clean-advisor claim. [Full schema-only findings](evidence/LEVYTATE_LOCAL_ADVISORS_2026-11-16.json). The search-path functions and policy relevance are under independent review. Fresh-workload unused-index observations do not justify dropping indexes, and no automatic changes were made.

## Development trace containment

A counts-only inspection found 27 callback `token_hash=` markers in the owned current Next development trace and 42 in the owned historical verification trace. No values were printed or copied. After confirming the current app was stopped and the historical app was not running, only those generated token-bearing traces were removed. All first-run contexts had already been logged out and closed. Session and rate-limit secrets were not changed.

The local launch wrapper now sets the installed Next reporter's span threshold to its maximum safe integer, disables trace upload and telemetry, and rejects inherited trace-upload configuration. Four focused guard tests pass. An actual no-Auth probe sent public health/login requests with a non-secret sentinel query, stopped and flushed the app, then scanned 81 generated files: zero sentinel occurrences and no trace files. This is local development trace proof only; it does not assert hosting-provider log behaviour. [Counts-only cleanup and sentinel evidence](evidence/LEVYTATE_LOCAL_TRACE_SAFETY_2026-11-16.json).

## Corrected login and bounded continuation

Application `c7d57b14ddcd6c22b0bbcba672223d0f0d151e5a`, harness `b1ca1f33ac4e93a5d3c9b850326a947a9188a510`, signed Edge 157.0.4341.60: 166 passing assertions, four failed assertions/groups and the external-email blocker. Four fresh genuine contexts represented three roles in two employers. The Lead used a new disposable persistent profile; all contexts were logged out and closed, and that profile was deleted. [Full continuation result](evidence/LEVYTATE_LOCAL_BROWSER_2026-11-16_CONTINUATION.json).

Both actual login pages now pass delayed-JavaScript verification: fields and submit controls are disabled before hydration; after load, exactly one intercepted canonical request produces confirmation. This component test sends no real Auth request. [Corrected hydration proof](evidence/LEVYTATE_LOGIN_HYDRATION_AFTER_2026-11-16.json).

The **genuine Employee recovery journey completed**: the Manager normally requested more information on the existing application; the Employee's malformed draft response retained the original command; a successful submission was followed by actual logout and a failed actual provider refresh; the visible popup requested a new captured sign-in link, redeemed the actual callback, and reconnected the original page. Retry sent the exact original submitted command and returned its receipt without an additional revision, history, audit or receipt. Answers survived a subsequent refresh. No session was injected or restored from a file.

Operations successfully verified the original progress and both events, recorded a real current-date fictional completed provider review, and completed actual lost-response and malformed-response Autopilot refresh/retry with exact durable revision, audit and history assertions. The expected review signal was then absent. Actual data revealed an original scheduled review dated 16 December with no next date outranking the completed 16 November review whose next date is 23 November. This is a product review-selection defect under correction, not invented missing fixture data. [Actual review shape](evidence/LEVYTATE_REVIEW_ORDERING_ACTUAL_SHAPE_2026-11-16.json).

Native zoom remained incomplete: its helper expected the configured-dashboard heading, while the actual employer has unconfigured priorities. The helper stopped before any image or 200% setting. Its corrected wait now derives the expected setup state from live priorities and permissions; no priorities are manufactured for testing.

After all five genuine callbacks and normal cleanup, the app was stopped and flushed: no Next trace files, no credential-query markers, and no disposable profile remained. [Post-Auth trace proof](evidence/LEVYTATE_LOCAL_TRACE_AFTER_GENUINE_AUTH_2026-11-16.json). The latest fictional database state was again encrypted, retained outside temporary storage and independently restored to a new database. [Recovery evidence](evidence/LEVYTATE_LOCAL_DB_RECOVERY_AFTER_SESSION_2026-11-16.json).


## Current Lead continuation and actual native zoom

The bounded run used application `6562e009570444e7e3e0c0c69398898b1e120242` and harness `c63cd6d90ccf2a469361827b29c93e64df5f770b`: **157 PASS, 2 FAIL, 1 external-delivery BLOCKED**. It signed in one genuine Apprenticeship Lead through the public request, local SMTP capture and real callback. Earlier Employee, Manager and foreign-actor proofs were explicitly not repeated. No data, limiter or session was reset.

The actual persisted provider review now produced the expected review signal. Autopilot refresh, action creation, linked-task acknowledgement and linked-signal dismissal, Operations synchronization, and Progress Intelligence analysis/acknowledgement/action acceptance passed real commit-then-response-loss or malformed-response challenges. Exact retries preserved the original command and actor with no duplicate receipts, revisions, history, audits or actions; tenant and stale-revision denials preserved state. The actual `review_progress_inconsistency` rule fired from the approved fictional progress and review. The naturally aged application-signal branch remains NOT_RUN.

The final canonical application detail correctly exposed the exact existing learner link and no duplicate pre-enrolment control. Clicking that link then waiting for the learner heading timed out. The helper recorded this phase and a group failure; the precise navigation cause remains under investigation. This does not retract the separately observed command/receipt checks and is not classified as a harness-only failure.

Actual authenticated native Edge 157.0.4341.60 zoom passed: at fixed 1280×900 outer window, the CSS viewport changed 1272×816 → 636×408, DPR 1 → 2, and CSS zoom/pinch scale remained 1. Responsive navigation worked with Enter/Escape, focus returned, the bottom support navigation remained inside the actual scrolled viewport, no horizontal overflow occurred, and native 100% was restored. Four uncropped native viewport screenshots were captured; independent visual inspection is recorded separately. This replaces the prior native-zoom NOT_RUN for this Lead only.

The Lead logged out successfully, protected reads and refresh then denied access, the disposable profile was deleted, and the application stopped/flushed. The generated trace scan found zero trace files and zero credential-query markers after the actual callback. No browser session state was exported.


## Canonical learner navigation correction verified

The actual shell omitted the `Learners`/`learner` URL target. The correction opens the permitted scoped learner, preserves its target across refresh, and clears it on explicit Back/list navigation. This is a product correction, not a weakened heading assertion.

A final bounded run used application `f1fe44de8e405d81e8f00f8fa3479d5788096eed` and harness `4a57753b92a9492db22b8ddf1ca4753dd5415a54`: **29 PASS, 0 FAIL, 1 external-delivery BLOCKED**. One genuine Lead public sign-in and real captured callback opened the exact existing application→learner link, reloaded the same learner detail, returned to the list without reopening stale detail, and loaded the same direct URL. The original learner revision and all observed application, learner, command-receipt, lifecycle-event, operational-action and audit records were unchanged. No other mutation journey, new fixture, limiter reset or additional role was used.

Normal logout succeeded; protected reads and refresh denied further access. All contexts closed, the app stopped/flushed, and the trace scan again found zero trace files and credential-query markers. Earlier failed artifacts remain intact; this narrow proof closes their canonical navigation failure only. The development dependency patch prepared separately was not present in this browser-tested lockfile; final publication must identify that difference.
