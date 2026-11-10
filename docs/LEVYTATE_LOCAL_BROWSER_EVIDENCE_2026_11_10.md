# Local browser verification — 10 November 2026

This is execution evidence for issue #7, not hosted acceptance or client release approval. The single delivery checklist remains `LEVYTATE_CLIENT_RELEASE_EXECUTION.md`.

Application: `e0d8496e456d728ce6cbb0c79c0c3ac9f88cc1bb`. Harness: `6c8e73539e5cf8fe504fa8f6e5765aa52de6df93`. Native local PostgreSQL 17.11, Auth and Storage used fictional data exclusively. Existing official local ledger entries 1–26 were unchanged during these browser runs. No hosted system was modified.

## Current Edge run

Verified isolated Edge 157.0.4341.42: **199 PASS, 4 FAIL, 1 BLOCKED**. Evidence: `browser-evidence-1794301966166.json` under the restricted local runtime directory `/private/tmp/levytate-release-runtime.K6eWSi`.

Five genuine contexts covered three distinct application roles: Employee, Line Manager and Apprenticeship Lead. Four were existing employer A/B accounts; the fifth was the distinct senior reviewer. All contexts closed with ordinary logout after the bounded run. The historical evidence field `authenticatedRolesVerified` counted four base contexts, not four distinct roles; subsequent evidence uses explicit context count and distinct role labels.

- Lift: actual UI held commit/lost reply and malformed successful response, original command retry, durable receipt/audit counts, private employee clarification readback, refresh, other-role privacy and other-tenant invariants passed. The earlier implicit-label selector failure was independently reproduced on the actual components and corrected with stable textbox role locators; this genuine run confirms the correction.
- Manager: naturally continued application `application-3c78a658-933b-4934-8469-6e8d40657027`; self/bypass/other-tenant denials, distinct manager approval, Lead approval, pre-enrolment, own declaration, employer verification and enrolment passed. The completed application now has enrolled learner `learner-8e5ad153-21cf-4377-8722-a2b3de16272d`. No replacement application or history reset occurred.
- Manager Learning Time: actual own permission, denied plan authorship and Lead draft/publish passed. The malformed-read browser stage failed before activity capture. Preserve published plan `543b09a2-4fc9-4745-8a06-36e3337387ef`, current version `7f2cc5b2-282e-4cc5-9cfe-6bbab710f364`; zero activities exist. The original catch did not preserve the inner exception. A subsequent isolated actual-component StrictMode probe reproduced that a healthy second GET wins over the first-only malformed response (six checks passed); the corrected harness holds the read fault until explicitly removed. This diagnoses a harness race but still requires the corrected genuine run.
- Learner progress: own-Manager write denial passed; the test expected 403 for a foreign Employee and failed before any progress write. A separate actual Data API read-only command probe returned **404/PT404**, which the application maps explicitly to 404. Revision 3, one progress row, eight lifecycle events, three receipts and four audits remained unchanged. This diagnoses the assertion contract; the corrected exact-404 browser check still requires a genuine rerun.
- Employee recovery: real draft commit followed by malformed200, retained form, exact original retry and no duplicate writes passed. Real submit committed, actual logout revoked the session, refresh returned401 and the pending answers/recovery controls remained visible. The test then timed out within the broad sign-in/reconnect stage before any new Auth request. The application is now awaiting manager review; a future test must use a legitimate information-return cycle. The old in-memory command was not retained or reconstructed.
- Copilot scope and PDF content checks passed. The new 640px effective-zoom viewport captures include actual top and scrolled-bottom views; this is not a claim of native browser zoom. Visual review is separate from text/signature checks.

Safe presentation artifacts in that runtime directory:

- `synthetic-employee-effective-200-top-1794301924257.png`
- `synthetic-employee-effective-200-bottom-1794301924750.png`
- `synthetic-employee-desktop-1794301925245.png`
- `synthetic-employee-print-1794301925418.pdf`
- `synthetic-employer-insights-1794301927789.png`
- `synthetic-employer-executive-1794301928810.pdf`

The lead engineer subsequently inspected both actual 640px viewport captures and all PDF pages: readable, no clipping or MPR chrome; the one-page Employee print and two-page employer report contain their expected content. The employer report shows the actual £715 financial balance and unavailable assessment evidence truthfully. These are local synthetic presentation observations, not native browser zoom or hosted acceptance.

## Current Chrome lifecycle continuation

Verified isolated Chrome 157.0.8103.39: **76 PASS, 0 FAIL, 1 BLOCKED**. Evidence: `browser-evidence-1794302277704.json`, same application and harness commits. Two independently authenticated Platform Admins and one normally reinvited employer Lead completed the continuation. No old session was fabricated.

The exact existing target `f3a65fb6-e0fe-4ae2-b225-de23a0211cb7` began Active after approved reactivation `344f82c1-655f-48b0-8569-e0645a5faeb3`. The UI issued a current-generation invitation to its original fictional identity; the real captured callback bound that identity. A second ordinary suspension and independently approved reactivation left the retained member API, page and refresh access denied. The admins then resuspended the target, recorded all eleven disposal decisions and independent owners, approved/exported/decrypted its fictional evidence, recorded recipient delivery, tested a legal hold, released the hold and executed disposal. Signed completion, tenant absence, exclusive Auth deletion, other-tenant preservation and denial of deleted-tenant reactivation passed.

The previously created blank employer `045e3932-f8d0-4977-ab16-892c0b8a285b` was inspected without recreation. Its initial Lead remained pending/unbound, eleven client tables empty, with no Auth identity or email in the complete current directory/capture. Those absence observations are present-state evidence, not an invented pre-creation snapshot.

Independent read-only native verification added **6 PASS**: deleted organisation absent; exclusive Auth user and sessions absent; target Storage catalogue empty; native physical target bytes absent; both original fictional employers active; independent other-tenant physical control bytes unchanged. Reproduce with `scripts/release-lifecycle-durable-check.mjs` and the exact successful browser evidence path.

Both runs' external-delivery BLOCKED result is intentional: signed Auth hook and actual local SMTP capture prove the isolated route, not delivery to a real external inbox. Hosted acceptance and real-client approval remain separate and incomplete.

## Bounded popup diagnosis before the next sign-in batch

`verify-recovery-popup-browser.mjs` rendered the actual shared recovery components and native pending dialog, then opened the real public local login page without making an Auth request: **6 PASS**, Edge 157.0.4341.42, one actual `window.open`, one new page, no browser exceptions, retained background answer intact. Initial bare-esbuild probe failures were missing Next browser `process`/`__dirname` polyfills; inspection confirmed the actual application bundle already provides them. The faithful probe uses Next's provided process implementation. This proves the component/public-page path works in isolation; it does not resolve or retrospectively pass the failed genuine expired-session journey.

## Focused continuation — successful groups, interrupted final capture

The next bounded Edge run used unchanged application `e0d8496` and harness `ef2c736`, four genuine contexts and the existing enrolled Manager/plan. It did not repeat completed Lift, People, lifecycle or enrolment journeys.

- Manager Learning Time passed the corrected malformed-read case, actual UI draft commit/lost response/exact original retry, private draft visibility, reload, submission, denied own review, withdrawal with exact retry and report-only controls. The optional local capability was restored disabled. Activity `7a90c23f-1417-46b0-b51f-dc911f37e083` remains withdrawn at version 2.
- Learner progress passed exact browser403 for the own Manager and404 for the foreign Employee with unchanged snapshots. Lead UI progress writes passed both real commit/lost response and real commit/malformed200, original input retention, exact command retries and unchanged receipt/event/audit counts after retry. Refresh retained both entries. Learner revision is now5, with three progress rows including its original enrolment baseline, ten lifecycle events and five command receipts.
- Employee recovery used a real manager information request, then passed draft malformed200 recovery and original receipt retry. Resubmission persisted as Awaiting Manager Review, revision6/history6. Its new review action was not created, so the interceptor did not confirm a successful response and did not perform the planned logout.

That failure exposed a harness cleanup bug: an expected refresh-response promise had no rejection handler because an earlier short-circuited assertion failed. Closing the context rejected the promise and terminated Node before final automatic evidence was written. Three context logouts were confirmed; the foreign Employee logout was unconfirmed. Process inspection confirmed no owned browser remained. No new sign-in was used to conceal that gap. **Do not claim a final automated assertion total for this interrupted run.** The explicit partial observations and durable readback are recorded in `partial-browser-observations-1794303421771.json` in the restricted runtime directory.

All response/page event promises in the workspace recovery helper now receive immediate rejection handlers. A real-browser regression closes a page before its expected response; the event settles safely and cleanup completes (**7 PASS**, including the prior popup checks, zero Auth requests).

The application failure was independently reproduced using the unchanged service's exact generated second-occurrence review command, intercepted and executed in a local PostgreSQL transaction that rolled back. The actual function returned **PT422 / Invalid Operations field**; the application mapped it to `LevyTateOperationalActionError`. Actions remained byte-for-byte unchanged. A separate no-write `array['detected'] || 'regenerated'` probe returned **22P02**, identifying ambiguous scalar-to-array concatenation in applied Operations SQL. `release-review-derivation-diagnostic.ts` reproduces this without printing payloads or making any other service mutation. This is service/native SQL proof, not authentication or retroactive proof of the discarded original HTTP status. The repair must use a new migration; applied entries remain immutable.
