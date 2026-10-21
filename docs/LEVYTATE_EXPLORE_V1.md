# LevyTate Explore — public app: implementation and release gates

## Product decision

Explore is public, employee-led career development **for people already employed**.
It is not an apprenticeship vacancy finder, a recruitment agency, or a new
provider marketplace. Users can browse freely without registration.

The simple first-release journey is deliberate:
1. **Explore official occupational routes.** The landing page shows exactly
   the 15 Skills England routes as navigable tiles, with their unchanged
   official route names and a dynamic count of the approved apprenticeships
   currently mapped to each route.
2. **Find the standard.** Selecting a route opens only its apprenticeship
   standards, in an alphabetical list with name search and optional level
   filter. The URL is shareable and survives a refresh.
3. **Unpacked.** Selecting a standard opens its own page and automatically
   requests source-grounded AI **Unpacked** content from Skills England duties
   and knowledge/skills/behaviours. Do not show an additional Generate button.
   Repeat views can use the versioned cached explanation. The original
   official record stays accessible, and unverifiable content fails closed.
4. **Start a conversation.** The employee may draft an email to their manager,
   or independently consent to MPR guidance. There is no invisible outreach
   or employer application.

Tiles are the government's **15 occupational routes**, not invented interest
categories. Occupations can also be grouped into pathways and clusters on
the official occupational maps, but the existing LevyTate catalogue only
contains authoritative **route** metadata. Do not invent the deeper
pathway/cluster mapping until it is reliably imported and verified.

"De-fluff" is retained as an internal technical route/cache identifier where
needed for backwards compatibility. **"Unpacked"** is the public-facing
feature label with the meaning "The apprenticeship, made human."

No quiz, provider marketplace, AI chatbot or extra Generate click is included
in this first-release experience.

**True generation vs. caching:** first uncached, verified versions generate
with AI on demand. Repeat views may show the previously generated explanation,
with transparent labelling and no additional token charge. Cache freshness is
checked at least weekly against the official source.

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
- Official route tiles: /explore/routes/digital (and 14 other route pages)
- Unclassified fallback: /explore/routes/uncategorised (only if any standards lack an official route)
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
- The initial eight hand-written editorial examples remain in the repository as
  prior examples but are **no longer presented as the generated experience**.
  Real user-facing De-fluff output is requested on click, using the government
  evidence and strict validation before publication.
- If official KSB grounding, model access or budget is unavailable, show the
  official source with a clear explanation, never a fabricated transformation.
- The official standard and its verification date are always accessible.

## AI transformation — feature-gated until approved

- `POST /api/levytate-explore/de-fluff` accepts an ST reference only, never
  an employee name, personalised prompt or employer-private material.
- The source adapter requests Skills England occupational summary, duties and
  KSBs, and rejects records without a matching ST-linked productCode.
- The structured OpenAI Responses output is schema-checked before display;
  it must not promise qualifications, promotions or funding.
- `LEVYTATE_EXPLORE_AI_ENABLED=true`, a server-side `OPENAI_API_KEY`, a
  `SKILLS_ENGLAND_API_KEY`, a correctly configured Supabase Preview store and
  distributed abuse limits are all required. The flag is **off by default**.
- Versioned cache and atomic claim RPCs are prepared as a SQL proposal at
  `docs/database/LEVYTATE_EXPLORE_AI_NARRATIVE_CACHE_PROPOSAL.sql`.
  It is **not applied** or Production-ready; convert it into a reviewed formal
  migration and test first.
- Generation is capped at 5 new programmes per network per day and 20 globally
  per environment per day; repeat cached views don't incur model charges.
  Public request limits also protect the official API.
- A free-to-install PWA does **not** make live model usage free. We must set up
  billing, a suitable small-model configuration and cost monitoring only with
  explicit owner approval. No paid model calls have been made by this change.
- In the current Preview, clicking a standard will show the automatic loading
  experience followed by a clear disabled/unavailable state until activated.
  We will never falsely label static copy as real-time AI output.

## Government route classification

Source: https://occupational-maps.skillsengland.education.gov.uk/
Skills England publishes 15 occupational routes. The Explore catalogue uses
each standard's actual `occupationalRoute` field to select its tile, not AI
inference. Category names are exact official labels, URL slugs are stable,
and the count on a tile is recomputed from the currently approved items.
Unknown categories must never be silently placed in a made-up government route:
a separate, explicitly marked uncategorised fallback exists if needed.

The July 2026 fallback snapshot contains representatives in every route,
but it still needs a proper source refresh before a public commercial launch.

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

**Public submission release switch:** `LEVYTATE_EXPLORE_SUBMISSIONS_ENABLED=true`
is required in the specific approved environment before the contact form is
visible and POST requests are accepted. It MUST stay absent/false on the
current Preview and Production until the isolated lead store is migrated,
verified and the separate public privacy notice is legally approved.
The manager email draft and programme discovery remain available.

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
