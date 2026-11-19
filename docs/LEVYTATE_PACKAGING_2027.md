# LevyTate — Core and add-ons for Q1 2027

**Decision (19 November 2026):** simplify the employer-facing product without discarding previously built features. This is a packaging and navigation change, **not** a deletion, replacement, entitlement cut-off or new billing system.

## Core — the product an employer buys first

1. **Applications and approvals.** Employee application, line-manager decision, Apprenticeship Lead final decision, documented handoff and audit trail.
2. **Employer apprenticeship operations.** People, learners, programme records and the Operations Centre, including the compliance information already available.
3. **Programme and provider management.** Employer's programmes, provider relationships and the factual catalogue. Later provider-side logins should update agreed programme/learner information with employer visibility and a clear source and update history.
4. **Reporting and finance.** Existing employer Insights and Levy Finance. Focus on trustworthy current position, spend, funding, exceptions and exports. The older standalone Reports module remains deferred; it is not silently presented as available.
5. **Essential role journeys.** Employee apprenticeship record; manager team, approvals and personal application; platform administration remains protected and separate.

## Add-ons — preserve all current work for modular commercial offers

| Add-on family | Existing capability retained | Launch stance |
| --- | --- | --- |
| Workforce Intelligence | Workforce Assessments, Workforce Development findings | Existing beta access preserved; package separately later |
| Provider Intelligence | Provider and market Intelligence | Existing beta access preserved |
| Provider Requests | Provider briefs and proposal comparisons | Capability-flagged where already supported |
| Learning Time | Off-the-job learning assistant/evidence | Capability-flagged where already supported |
| Learner Support | Private pastoral conversations and approved support requests | Capability-flagged with existing safety controls |
| Copilot | Contextual apprenticeship assistance | Existing beta access preserved |
| Advanced Reports | Previously deferred report module | Do not claim available before readiness |

**Support** (Knowledge/Guidance and employer Settings) remains available outside commercial add-ons. Platform Admin Settings remains a Core administration area, not a customer purchase.

**Future module candidates — not built or sold by this change:** school-pupil access, employer work experience and the school-to-apprenticeship progression journey; provider contribution workflows beyond the capabilities already present. Keep these on the roadmap, especially in light of greater youth apprenticeship focus, but do not put them in the Q1 launch critical path.

## Implementation boundaries

- **Phase 1 (this branch):** authoritative feature classification; role-aware Core/Add-on/Support navigation; tests proving previously available routes and modules remain reachable. No component code, route policy, production configuration or database migration is removed.
- **Phase 2 (after a pilot verifies the commercial packages):** per-organisation module entitlements enforced on the server **and** at API access points, with migration and audit plan. The navigation must never be the only paywall. Protect existing beta commitments during any transition.
- **Phase 3:** selective provider collaboration, reporting improvements and modular paid packaging, with employer-approved data sharing, provenance, freshness indicators and access restrictions. Provider edits must not automatically become an unquestioned source of truth.

## Q1 acceptance criteria

- An employer can submit/approve an application, see learners, manage known providers and obtain defensible finance/reporting views without entering an add-on.
- Every pre-existing module remains accessible to the same roles when its existing capability flags are on.
- Employee and manager personal journeys are preserved. Provider and school access must not inherit employer roles or sensitive data.
- Core navigation is immediately understandable; add-ons are findable but do not dominate the initial experience.
- Test and pilot with a real employer before promising provider-fed live performance data or externally verified balances.
