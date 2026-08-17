# LevyTate Provider Intelligence

## Purpose

Provider Intelligence gives Apprenticeship Leads and Employer Admins a calm, editorial view of apprenticeship provider developments. It is a decision-support reading experience, not a provider marketplace, recommendation engine, provider scorecard or live-news product.

For Apprenticeship Leads, it creates one place to scan relevant programme changes, employer guidance and market themes before moving into operational work. For providers, the future value is a clear editorial route to reach relevant employers without buying organic position or competing on popularity metrics.

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
- `image`
- `imageAlt`
- optional `imageFocalPoint`
- `imageType`
- optional `presentationHint`

The product surface renders the editorial display headline and summary. The raw title is retained only to demonstrate the future editorial transformation boundary. No OpenAI call is made in Sprint 1.

In a future implementation, AI may summarise source material, improve display headlines and personalise topic selection to a user's stated interests. It must never rank providers by payment, posting volume, popularity, engagement, commercial relationship or an inferred quality score.

> **AI personalises topics and summarises information. It does not determine which paying provider deserves greater organic visibility.**

## Fair distribution contract

The main stream first filters for editorial eligibility and selected topic. It then groups updates by provider and takes one update per eligible provider in a deterministic rotation before giving any provider another turn.

This means:

- a provider with many updates cannot occupy the opening window;
- a provider with one relevant update receives an opportunity for exposure;
- consecutive items from the same provider are avoided whenever another provider has an eligible update;
- engagement, ratings, scores, rankings, sponsorship and commercial payment do not influence ordering;
- the same fixture and filter always produce the same order.

Following is an explicit personal view stored only in client state. Following a provider or topic can narrow that view but cannot alter the fair main stream.

## Visual presentation contract

The feed uses a separate deterministic `assignFeedPresentation()` pass after fair provider ordering. Its controlled rhythm includes feature, standard, split, compact, event and case-study formats. Presentation assignment never changes provider order. A provider that has already received a prominent feature, split or case-study placement is downgraded to a standard or compact format while another eligible provider has not yet received comparable prominence.

Tile size is not influenced by provider spend, popularity, engagement or publishing volume. The current imagery is lightweight, local CSS editorial artwork using the LevyTate navy, mint and coral palette. Every fixture carries descriptive image metadata; no remote photography, licensing dependency or image-generation service is used.

## Experience areas

- Morning Brief: a concise editorial synthesis with a small provider-balanced set of highlights.
- Provider Stream: structured editorial updates ordered by the fair-distribution contract.
- Market Watch: illustrative counts that make the fixture's current themes scannable.
- Following: a device-local view of explicitly followed providers and topics, with device-local saves.

## Demonstration boundary

All eight providers, updates, counts and dates are fictional and illustrative. Provider marks are generated typographic initials rather than real provider logos. The experience must not be interpreted as provider quality judgement or a LevyTate recommendation.

## Deferred work

Live provider publishing, provider portal access, subscriptions, billing, analytics, sponsored content, scraping, live news ingestion, persistent follows and saves, and AI editorial processing are outside Sprint 1. A future Premium provider publishing flow must still pass editorial eligibility and the same fair rotation. Future engagement analytics must remain diagnostic rather than an organic ranking input. If sponsored content is ever introduced, it must be visibly separated from the organic stream and must not alter organic exposure.
