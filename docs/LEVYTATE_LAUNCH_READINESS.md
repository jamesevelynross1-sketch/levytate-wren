# LevyTate launch readiness — Release 4

> **Superseded for current launch operations (27 October 2026).** Retained as Release 4 evidence for an older commit and Preview. Use `LEVYTATE_CLIENT_LAUNCH_PLAN.md` and `LEVYTATE_CLIENT_ACCEPTANCE.md` for the current first-employer decision.

## 1. Release candidate and deployment

- Assurance implementation commit: `9e99a7764cfab33271aed37a1ff635fe3d7c8e14`.
- Source branch: `feature/operational-rbac`.
- Protected Preview deployment: `dpl_6o4hkQ4dNvtuYYLab8GwWLRvBbCJ`.
- Exact Preview URL: `https://levytate-wren-539qm9kax-jamesevelynross1-sketchs-projects.vercel.app`.
- Stable branch alias: `https://levytate-wren-git-feat-54b957-jamesevelynross1-sketchs-projects.vercel.app`.
- Target: Preview only. No Production deployment or alias change was authorised or made.
- Database impact: none. Release 4 adds no migration and changes no employer, employee, learner, application, assessment or finance record.

This document records the tested implementation commit. The documentation-only commit containing this report is intentionally a descendant of that commit; a Git commit cannot contain its own cryptographic hash.

## 2. Acceptance matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Release 1 reliability | `validate:launch-release-1` | Pass |
| Release 2 premium UX | `validate:launch-release-2` — 27 assertions | Pass |
| Release 3 intelligence | `validate:launch-release-3` — 25 assertions | Pass |
| Release 4 disclosure/export | `validate:launch-release-4` — 20 assertions | Pass |
| Assessments V1/V2/V3 | `validate:assessments`, including >1,000 employee pagination and historical compatibility | Pass |
| Configurable application workflows | 73 assertions | Pass |
| Learning Time | 71 checks | Pass |
| Requests V1.1 | 206 checks; capability remains organisation- and environment-gated | Pass |
| Provider Intelligence | 47 checks | Pass |
| Finance | 52 checks | Pass |
| Operational governance | 27 connected checks against fictional Ground Control data | Pass |
| Operations Centre | 34 connected checks, including tenant denial and read-only endpoint | Pass |
| Platform Admin boundary | 24 connected checks | Pass |
| Core Early Access boundary | 32 checks | Pass |
| Client V1 layout | 20 checks | Pass |
| Secure employer authentication | 25 checks | Pass |
| Service-health contracts | 14 checks | Pass |
| PWA | 37 checks | Pass |
| TypeScript | `npx tsc --noEmit` | Pass |
| Lint | repository lint plus changed-file ESLint | Pass |
| Production build | Next.js 15.5.18, Node 22; 104 static pages and dynamic routes built | Pass |
| Secret scan | staged diff scanned for service keys, credentials, bearer tokens, connection strings and private keys | Pass — none found |
| Protected Preview | exact commit, branch, protection and key routes checked after deployment | Pass |
| Authenticated protected-Preview role click-through | Preview branch secrets are deliberately non-exportable; no secret was revealed or replaced for automation | Release-owner click-through required before Production promotion |

Two older fixture-driven scripts exposed validation-data drift rather than a product regression: the canonical employee fixture now has a separate active application, and a learner-detail fixture no longer has its historic awaiting-review state. Release 4 did not overwrite or reseed those shared fictional records. The core boundaries covered by those scripts passed through the current operational, Platform Admin, application-workflow and role suites. Before any future destructive workflow drill, the release owner should approve a fresh isolated fixture rather than resetting shared demonstration history.

## 3. Resolved defects

### Aggregate reconstruction

The previous output could publish an organisation category total and visible department category totals while hiding one small department. A recipient could subtract the visible departments from the organisation total.

Release 4 applies one server-side disclosure contract before Assessments, Employer Insights, campaign print, executive print and CSV presentation:

- the minimum finding threshold remains five submitted responses;
- a campaign below five submissions publishes participation only;
- if any department has one to four responses, organisation qualitative totals and all department qualitative findings are withheld;
- a zero-response department remains suppressed but does not trigger complementary suppression because it contributes no private category values;
- safe factual invited, submitted, non-response and participation counts remain available;
- campaigns and questionnaire versions remain independent evidence populations.

The suite attempts reconstruction for 6+1, 5+4, one small group among several, multiple small groups, different barrier distributions, missing/no-current-barrier data, and overlapping campaign versions. It inspects the actual CSV and rendered print output, not only an internal suppression flag.

Residual risk remains: threshold and complementary suppression do not guarantee anonymity against external datasets, repeated releases or colluding recipients. That limitation is displayed in the shared output contract.

### Executive-report personal information

The executive print now consumes a purpose-built aggregate contract. It excludes:

- employee and learner names;
- named action owners;
- raw operational reason, note and next-action text;
- campaign title, purpose and named campaign owner;
- private assessment records;
- individual finance information.

Priorities use controlled wording and a canonical owner role. Named-person and sensitive-free-text fixtures are rendered through the actual React print component and asserted absent. Authorised individual operational screens retain their required detail.

### Reporting accuracy

- Applications awaiting decision exclude completed, cancelled, withdrawn and declined records and are de-duplicated by application ID.
- Active learners and upcoming enrolments are de-duplicated by their authoritative record IDs.
- Operational attention excludes completed/cancelled persistent actions and de-duplicates source conditions.
- Application priorities apply the same current/non-closed definition as the headline.
- Every headline exposes an evidence timestamp or explicitly says the timestamp is unavailable.
- Finance labels state that totals cover persisted imported transaction history, show its from/to dates, latest import time and balance-evidence date, and do not describe all-history totals as a latest-month measure.
- Synthetic levy utilisation remains excluded.
- Assessment `useCases` are labelled workplace-use patterns, not employee-requested apprenticeship use cases.

## 4. Unresolved defects and risks

| Risk | Level | Position |
| --- | --- | --- |
| Supabase Pro and confirmed managed daily backups are not active | Critical go-live gate | No real employer or employee data and no first employer account until complete |
| Legal/operator, DPA, controller/processor, transfer, retention and professional legal review remain unsigned | Critical go-live gate | Release-owner and qualified legal/privacy approval required |
| Full DPIA has not been completed | High | DPIA screening below concludes a full DPIA is required before live workforce-assessment use |
| External Production monitoring and named primary/secondary operational owners are not approved | High | Required before Production cutover |
| Production-domain authentication/RBAC/health smoke has not been authorised | High | Must run with fictional identities during an approved change window |
| Final authenticated role click-through on the exact protected Preview needs the branch's private beta code | Medium release-evidence gap | Release owner must complete the Employee, Line Manager, Apprenticeship Lead and Platform Admin checklist without disclosing or replacing the code |
| Shared demonstration fixture history has drifted from two legacy validation scripts | Low for product; medium for repeatability | Create a fresh isolated, disposable journey fixture before the next mutation-heavy acceptance drill |
| No universal anonymity guarantee for small-group reporting | Residual privacy risk | Complementary suppression, audience controls, release discipline and DPIA mitigations required |

No known critical privacy, security or workflow defect remains in the tested Release 4 implementation. The unresolved critical items are operational/legal infrastructure gates, not defects that this commit can safely resolve.

## 5. Privacy and security evidence

- Sessions, organisation and role are resolved server-side; browser-supplied organisation or role is not trusted.
- Tenant isolation, cross-organisation denial, inactive/revoked membership revalidation and Platform Admin separation are covered by connected and static suites.
- Assessment drafts remain private until the explicit sharing policy permits access. Manager and individual assessment views remain separate.
- Aggregate findings use the shared disclosure contract described above. Private assessment answer maps and individual result snapshots are not returned in employer aggregate reports.
- Protected responses are private/no-store. Logout is server-owned and clears LevyTate and Supabase session state.
- Release 4 introduces no new write surface, database grant, browser storage or external processor.
- Staged changes contain no secret or real-customer data.

### DPIA screening

A full DPIA is required before real employer workforce-assessment deployment. The processing is systematic workplace capability profiling in an employment context, involves a power imbalance, may influence development or apprenticeship decisions, and can expose sensitive inferences even when the questionnaire does not intentionally request special-category data.

Customer-controller responsibilities requiring explicit agreement include:

- defining purpose, necessity, lawful basis and the campaign audience;
- providing transparent employee information and a meaningful route for questions/rights;
- ensuring findings are not used as automated employment, competence, funding or eligibility decisions;
- deciding who may see individual versus aggregate evidence;
- approving retention/deletion periods and handling subject-access/correction requests;
- managing workplace consultation and any equality/employment impact review.

LevyTate's processor/controller position for hosting, authentication, service security, product telemetry and optional AI must be settled in the contract and DPA. Outstanding mitigations include a documented misuse scenario review, repeated-release controls, campaign cadence rules, role training, report-recipient controls, retention automation evidence, an agreed SAR/export process and human legal/privacy approval.

Automated tests are technical evidence only and do not establish legal compliance.

## 6. Backup, recovery and infrastructure evidence

- The credential-free backup/restore runbook is `docs/LEVYTATE_DATABASE_BACKUP_AND_RESTORE.md`.
- The established procedure requires an encrypted manual dump, checksum verification, archive inspection, isolated restore, count reconciliation and restricted evidence retention.
- A fresh manual backup and isolated restore is mandatory before any further schema migration until the canonical migration baseline is fully governed.
- Release 4 needs no migration and made no database change.
- Before real data or the first employer account: activate Supabase Pro, confirm managed daily backup availability, retain the spend cap, and keep PITR disabled unless separately approved.
- Do not activate or resize a second project without explicit approval.
- External availability monitoring, alert/recovery delivery and named operational owners remain outstanding.

## 7. Authentication and onboarding

The technical foundation supports individual magic-link authentication, enumeration-resistant requests, durable subject binding, HTTP-only sessions, refresh, logout, immediate revalidation of membership/role/access and restricted fictional internal beta access. Public self-service signup is not supported and must not be claimed.

The protected Preview uses fictional `.test` identities. Platform Admin does not inherit employer operations. Production beta access, environment ownership, sender configuration, redirect allowlists and final Production smoke must be re-confirmed during an approved cutover without loading real employer data.

Employer onboarding remains blocked until the agreement/DPA, privacy notices, retention, support ownership, backup gate and DPIA are approved. The first live workspace must start blank and use controlled invitations, not demonstration records.

## 8. User-journey observations

The real browser exercise used fictional Ground Control roles and the exact Release 4 code locally. The deployed commit was then verified `Ready`, protected by Vercel Authentication, operational at its readiness endpoint, and fail-closed from `/levytate/app` to `/levytate/login` without a LevyTate session. Because the branch beta code is a Vercel Secret and cannot be exported, Codex did not reveal, replace or weaken it to automate the final authenticated protected-Preview click-through; that deliberate release-owner step remains listed as a gate.

| Task | Observation | Result |
| --- | --- | --- |
| Find overdue learner review | Insights exposes a prioritised provider-review action with learner, timing, owner role and direct authorised route | Completed directly |
| Find current decision owner | Employee Home shows the application state and next owner in the first action card | Completed directly |
| Resume application | Employee Home presents one dominant `Continue application` action and timeline | Completed directly |
| Identify workforce opportunity | Insights gives a clear unavailable state when no eligible campaign exists instead of inventing a finding | Completed; no false conclusion |
| Produce executive report | Print action is visible in the operating brief; generated component is covered by personal-data-output tests | Completed technically; final paper/PDF approval remains a release-owner visual check |
| Complete assigned assessment | Connected isolated assessment suite covers start, draft resume, submit, sharing and manager review; current Ground Control employee has no active eligible campaign | Completed in isolated workflow evidence; not fabricated in Ground Control |

Primary points of confusion were stale validation assumptions, not navigation: a historic employee expected to be awaiting manager review now has another active application, and Ground Control currently has no eligible employer assessment campaign. No shared history was overwritten to make a test pass. First-time navigation remained task-oriented: Home surfaces the next action, Insights separates operating position/workforce/finance, and error or unavailable states give a recovery direction.

## 9. Responsive and accessibility findings

- Browser review covered 1920×1080, 1440×900, 768×1024 and 390×844. Document `scrollWidth` equalled viewport width at every size; no page-level horizontal overflow was present.
- Mobile uses an accessible navigation drawer; desktop uses the labelled workspace navigation.
- Employer Insights cards and priority actions stack without clipping at 390 px. The executive-print action remains reachable.
- Keyboard-labelled buttons, headings, regions, form labels and visible focus styles are covered by the Release 2, Client V1 layout, assessment and Learning Time suites.
- A 768 px CSS viewport was used as the practical reflow proxy for a 1440 px browser at 200% zoom; no horizontal overflow was observed. Release-owner assistive-technology acceptance at OS/browser 200% zoom remains recommended.
- Browser console contained no errors during the reviewed Employee Home and Employer Insights states.
- Evidence screenshots are retained outside Git in the restricted Codex visualisation directory: laptop Insights, 390 px mobile Insights and Employee Home.

## 10. Executive-report validation

The screen, executive print and campaign CSV agree on their shared aggregate disclosure state. The executive report uses controlled aggregate signals and does not render the richer authorised on-screen priority content. The numerical contract records evidence timestamps and explicit finance periods. Tests render the actual report markup and confirm fictional personal names and sensitive free text are absent.

Print CSS and multipage structure build successfully. Final release-owner checks should include Save as PDF on the intended corporate browser/printer profile and visual inspection of page breaks, branding and accessibility of any distributed PDF.

## 11. Rollback procedure

1. Stop onboarding and preserve the affected deployment, timestamps and minimal diagnostic evidence.
2. Confirm the current Production alias and commit before any action.
3. Roll the Vercel Production alias back only to the last approved Ready deployment; do not rebuild or promote an unverified branch.
4. Revoke affected sessions or memberships if the issue is access-related.
5. Do not reverse database state unless the Release Owner and Database Owner approve the target and recovery point under the backup/restore runbook.
6. Validate liveness, readiness, login, tenant isolation, RBAC, logout and affected core workflow using fictional identities.
7. Record the incident, customer-impact decision, recovery evidence and go/no-go. Release 4 itself requires no database rollback.

## 12. Recommendation

**CONDITIONAL GO** for release-owner evaluation and continued protected Preview use with fictional data.

**NO-GO for real employer onboarding or Production promotion** until all of the following are complete:

1. Supabase Pro activated and managed daily backups confirmed.
2. Fresh manual backup/isolated-restore evidence recorded before any later migration.
3. Full DPIA and controller/processor responsibilities approved.
4. Agreement, DPA, privacy, retention/deletion, transfer/subprocessor and support/incident decisions approved by accountable humans.
5. Named release, technical, service, support and privacy/incident owners plus external monitoring are in place.
6. Approved Production-domain fictional-data smoke verifies authentication, tenant isolation, RBAC, Terms, health, logout and rollback readiness.
7. Independent release-owner review of the executive PDF and a fresh isolated end-to-end mutation journey is recorded.

These gates cannot be inferred from automated checks and must not be bypassed by enabling real accounts or loading real employee data.
