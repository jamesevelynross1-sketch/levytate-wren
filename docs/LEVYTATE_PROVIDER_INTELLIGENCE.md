# LevyTate Provider Intelligence

## Purpose

Provider Intelligence gives Apprenticeship Leads and Employer Admins a calm, editorial view of apprenticeship provider developments. It is a decision-support reading experience, not a provider marketplace, recommendation engine, provider scorecard or live-news product.

Sprint 1 uses a self-contained set of fictional provider and editorial fixtures. It does not read or write employer, learner, application, provider-relationship or operational-action data.

## Access boundary

- Apprenticeship Lead: primary navigation, after Operations Centre and before Applications.
- Employer Admin: primary navigation, after Operations Centre and before Applications.
- Employee: hidden and route-denied.
- Line Manager: hidden and route-denied.
- Platform Admin: explicitly hidden and route-denied.

The module reuses the existing `providers:read` permission and the central Core Early Access module policy. It does not introduce a new database permission, API or migration.

## Editorial data contract

Every update contains:

- `rawTitle`
- `displayHeadline`
- `displaySummary`
- `contentType`
- `topics`
- `programmes`
- `regions`
- `providerId`
- `publishedAt`
- `sourceType`
- `editorialStatus`

The product surface renders the editorial display headline and summary. The raw title is retained only to demonstrate the future editorial transformation boundary. No OpenAI call is made in Sprint 1.

## Fair distribution contract

The main stream first filters for editorial eligibility and selected topic. It then groups updates by provider and takes one update per eligible provider in a deterministic rotation before giving any provider another turn.

This means:

- a provider with many updates cannot occupy the opening window;
- a provider with one relevant update receives an opportunity for exposure;
- consecutive items from the same provider are avoided whenever another provider has an eligible update;
- engagement, ratings, scores, rankings, sponsorship and commercial payment do not influence ordering;
- the same fixture and filter always produce the same order.

Following is an explicit personal view stored only in client state. Following a provider or topic can narrow that view but cannot alter the fair main stream.

## Demonstration boundary

All eight providers, updates, counts and dates are fictional and illustrative. Provider marks are generated typographic initials rather than real provider logos. The experience must not be interpreted as provider quality judgement or a LevyTate recommendation.

## Deferred work

Live provider publishing, provider portal access, subscriptions, billing, analytics, sponsored content, scraping, live news ingestion, persistent follows and saves, and AI editorial processing are outside Sprint 1.
