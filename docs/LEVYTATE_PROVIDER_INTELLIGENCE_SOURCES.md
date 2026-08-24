# LevyTate Provider Intelligence source register

Provider Intelligence uses official provider-owned sources only. The canonical provider id is the join key; names and provider metadata always come from the existing provider catalogue. Articles are short cached excerpts linking to the original publication, not copied full text.

## Initial discovery result

- Active: QA News, Baltic Blog, Apprentify Blog, Learning Curve Group News, The Marketing Trainer Blog, HBTC News, University of Staffordshire News, Learning Skills Partnership Blog and SRSCC News.
- Needs manual review: RHG Consult and AiCore (no sufficiently reliable editorial index or feed was verified during discovery).
- Disabled: Primary Goal (no reliable active official source was verified).

The bootstrap cache contains verified official links for nine of the twelve active catalogue providers. Missing dates are stored as null and shown as unavailable. A source failure never removes previously cached articles.

## Operations

Refresh uses an authenticated service endpoint, approved-domain allowlisting, HTTPS-only URLs, redirect revalidation, an eight-second timeout, a two-megabyte response cap and concurrency of four. The endpoint is scheduler-ready. It is intentionally not added to the existing Hobby-plan Vercel cron set because the desired four-to-six-hour schedule is not supported by that plan without changing deployment terms.

Platform operators should review sources marked `needs-review`, investigate `last_error`, and only activate a source after its provider-owned feed or news index has been verified. Migration 024 must be applied to the intended non-production Supabase project before persisted refresh is enabled.
