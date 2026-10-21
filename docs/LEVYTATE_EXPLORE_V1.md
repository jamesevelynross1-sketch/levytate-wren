# LevyTate Explore — public app: implementation and release gates

## Product decision

Explore is public, employee-led career development **for people already employed**.
It is not an apprenticeship vacancy finder, a recruitment agency, or a new
provider marketplace. Users can browse freely without registration.

A user may independently:
1. Discover approved apprenticeship standards through their interests.
2. Read a humanised, editorially reviewed "De-fluff" guide beside official facts.
3. Choose to draft an email to their own manager (nothing automatically sent).
4. Separately opt in to contact from MPR/LevyTate for advice.

The public request is **not** an employer's formal application or an approval.
The authenticated platform's existing Employee → Line Manager →
Apprenticeship Lead → Enrolment workflow stays authoritative.

## Two revenue routes

- MPR earns separately negotiated provider-paid commercial introduction /
  successful enrolment fees where an enrolment is achieved. Using Explore costs
  neither employee nor employer. Commercial provider relationships must be
  disclosed and never affect standards listing or content.
- Qualified employers can separately choose a paid LevyTate employer licence.
  Qualification and employer outreach must be permission-based.

## Entry points

- Public home: /explore
- Approved programme profile: /explore/st1512 (and other approved standards)
- Installer manifest: /explore/manifest.webmanifest
- Manager share perspective: /explore/st1512?audience=manager
- Public privacy preview: /explore/privacy
- Opt-in employee/manager contact: POST /api/levytate-explore/interest
- Private beta-admin pipeline: /explore/internal
- Private pipeline API: /api/levytate-explore/admin/enquiries
- Official evidence inspector (admin only): /api/levytate-explore/admin/evidence/ST1512
- Secured retry worker: /api/cron/levytate-explore-notifications

Public paths are rewritten to the existing standalone LevyTate application
shell on levytate.co.uk and isolated Preview hosts; do not inherit MPR SiteChrome.
The existing /app route remains employer-authenticated.

## Data quality

- Reuse read-only approved standards data from LevyTate's database, with fallback
  to the generated Skills England catalogue.
- The fallback was last verified on 2026-07-02 and may now be stale.
- Explicitly exclude withdrawn, paused, retired, in-development, and
  apprenticeship units from searchable approved apprenticeship standards.
- ST1512 (AI and automation practitioner, v2.1, L4, 18 months) is an
  editorially sourced addition confirmed via its official Skills England page
  on 2026-10-21. It does not mutate employer catalogue data.
- Curated guides are reviewed editorial copy. They are not dynamic AI output
  and must not promise eligibility, employer approval, funding, promotion,
  or particular tools/outcomes.
- Where editorial KSB grounding is incomplete, show official metadata and
  say the humanised guide is being prepared. Do not fabricate learning outcomes.
- The official standard and its verification date are always accessible.

## Skills England licence

The public occupational API requires an API key, the Skills England logo,
attribution, and OGL licence compliance. For a production automated ingestion
pipeline request approved X-API-KEY access and sync occupation summary/duties/KSB
with mapping to apprenticeship standard/reference/version. Refresh regularly;
use source version, editorial approval state and a dated correction trail.
Source: https://occupational-maps.skillsengland.education.gov.uk/public-api/

## Consent, security, anti-abuse

- Browsing, search and opening programme pages require no identity.
- Manager email is prepared as a mailto: draft client-side; manager address and
  text are not transmitted to LevyTate.
- Independently consented employee or manager enquiries post only the named requester's details to MPR. A manager share link does not itself identify the employee.
- Do not contact managers or employers just because an employee enquires.
- No public browser access to Supabase service role. Server validates input,
  origin, length, active standard and persisted rate-limit quotas and fails
  closed when the backing security controls are unavailable.
- There is no automatic conversion to a tenant employee application or
  bypass of manager/Apprenticeship Lead permissions.

## Durable pipeline implemented on the branch — not activated

- Staged migration 040 creates an isolated private enquiry register, audit trail, and retryable notification outbox with atomic leasing.
- Public submissions are persisted before acknowledgement, deduplicated per requester/standard/day and environment, and protected by existing distributed rate-limit controls.
- The server notifies MPR through Resend and retries failures from a protected daily worker; there is no email-only fallback if durable storage is absent.
- Internal beta-admin only dashboard captures status, notes, and the provider-referral versus LevyTate-licence revenue route. No public lead is added to employer tenant records.
- Employee-to-manager sharing is an email draft controlled by the employee. The recipient sees a manager-specific programme view and can independently consent to MPR contact.
- Separate consent copy and version history exists for employee and manager enquiries.
- A public Explore privacy page is a Preview draft only and requires formal legal approval.
- The catalogue uses Skills England source metadata. Eight editorial De-fluff guides are available; other standards show honest official-only content until verified.
- Package builds run the automatic Explore catalogue validation and OCC-to-ST source-link tests first.
- Server-only source evidence retrieval supports Skills England's SearchOccupations endpoint when SKILLS_ENGLAND_API_KEY is configured. It verifies an exact productCode association between ST apprenticeship and OCC occupation before returning summaries, duties or knowledge/skills/behaviours. It never automatically publishes AI copy.

**Migration 040 remains unapplied.** The connected Supabase workspace exposed to this session is not confirmed to be the correct live LevyTate database. Consequently, Preview submission must fail closed rather than storing personal data in an unverified project.

## Public-release acceptance gates

1. Verify the exact isolated Preview Supabase project, complete backup/restore exercise, review then apply migration 040 there only. Confirm service-role RPCs, denied anon/authenticated access, no tenant leakage, deduplication, outbox concurrency and environment scoping.
2. Test public enquiry POSTs (employee and manager), forged origin, spam, duplicates, no DB, no email, user cancellation and accessibility with synthetic identities.
3. Confirm verified Resend sender and notification destination plus CRON_SECRET in the correct environment; prove retry without duplicate email.
4. Verify beta-admin-only list/update and deny employer-role access. Exercise simultaneous operator updates, audit events and privacy requests.
5. Request Skills England API key, set SKILLS_ENGLAND_API_KEY only in protected server environments, validate the SearchOccupations productCode mapping, refresh the July 2026 fallback and expand human-reviewed De-fluff coverage. No automatic public AI writing is approved.
6. Approve separate Explore controller privacy notice, lawful basis, company details, retention schedule, deleted-lead procedures, provider disclosure, employer outreach policy and any international processing safeguards.
7. Test actual iOS/Android installation, keyboard/screen-reader accessibility, forms, focus, contrast and mobile performance.
8. Rebuild, review and security-test the exact release commit. Obtain approval before merging or promoting Production.

## Future iteration

Expand editorial coverage via a source-grounded content pipeline; add a secure
saved-pathway account; optional employee-approved manager conversations; handle
relationship management from first enquiry to provider-paid enrolment or
LevyTate employer subscription. Validate pipeline economics using qualified
manager conversations and conversion, not installs.
