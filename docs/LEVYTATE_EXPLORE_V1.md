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
- Opt-in advisory request: POST /api/levytate-explore/interest

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
- A separate employee action with mandatory consent posts name, work email,
  employer and selected standard to MPR.
- Do not contact managers or employers just because an employee enquires.
- No public browser access to Supabase service role. Server validates input,
  origin, length, active standard and persisted rate-limit quotas and fails
  closed when the backing security controls are unavailable.
- There is no automatic conversion to a tenant employee application or
  bypass of manager/Apprenticeship Lead permissions.

## Alpha transport and production-blocking tasks

The initial contact API uses server-side Resend to notify MPR, and its reply
is successful only if email transmission is accepted. It does not yet record
a durable lead/outbox transaction, manage re-delivery, or allow the user to
track a reference. **This is not production-ready lead handling.**

Before opening public submissions:
1. Add a durable isolated Explore lead store with private-only access,
   per-record consent provenance, duplicate handling and an outbox/retry
   process; adopt a migration in a verified Supabase environment, not against
   a shared employer production database.
2. Create admin-only MPR triage and employer qualification workflows that
   don't expose public enquiries to employer tenant users.
3. Test rate limits, origin restrictions, all validation states and failure
   recovery with synthetic identities in isolated Preview.
4. Obtain Skills England API key, sync and review official data (July
   fallback requires refresh); validate version and funding language.
5. Validate contact/email operator addresses and verified sending domain
   (LEVYTATE_EXPLORE_NOTIFY_EMAIL + RESEND_API_KEY); confirm privacy notice,
   retention and PECR review; introduce appropriate bot protection if traffic
   warrants it.
6. Test PWA installation and routes on real iOS Safari and Android Chrome,
   keyboard navigation, reduced motion, Lighthouse and mobile performance.
7. Run repository typecheck, lint, validation and build on the **exact**
   release commit. Independently verify the protected Preview URL.
8. Confirm the release owner, legal/privacy owner and code reviewer approve
   public release. No automatic Production promotion.

## Future iteration

Expand editorial coverage via a source-grounded content pipeline; add a secure
saved-pathway account; optional employee-approved manager conversations; handle
relationship management from first enquiry to provider-paid enrolment or
LevyTate employer subscription. Validate pipeline economics using qualified
manager conversations and conversion, not installs.
