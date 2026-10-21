# LevyTate Explore — public PWA visual direction (October 2026)

**Status:** Protected development Preview, editorial/UI change only.

## Design principle

Create a digital experience that feels contemporary to Gen Z and younger
millennial employees **without** using generational stereotypes, slang,
unnecessary animations or juvenile gamification. Optimise for speed,
legibility, choice, authenticity and source credibility.

## Research references

- Nielsen Norman Group, *Designing for Young Adults (18–25)*:
  https://www.nngroup.com/reports/designing-for-young-adults/
  Research covers young adults already in employment as well as students,
  and cautions against assumptions that younger users simply want novelty.
- NN/g, *Teenager's UX*, 17 March 2019:
  https://www.nngroup.com/articles/usability-of-websites-for-teenagers/
  Supports compact content, clear interactions, mobile touch-friendliness and
  restraint with flashy or blinking graphics.
- Figma, *Top Web Design Trends for 2026*:
  https://www.figma.com/resource-library/web-design-trends/
  Design inspiration only; expressive typography and meaningful colour, not
  automatically applying every trend.
- W3C, *WCAG 2.2 Target Size (Minimum)*:
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
  At least 24 by 24 CSS pixels (or allowed spacing equivalent) for targets;
  aim materially above that for important mobile controls.

## Implementation

- **Preserve supplied LevyTate logo:** use the existing
  `/brand/levytate-logo-supplied.png`; never recreate it or typeface.
- Scoped `app/levytate/explore/explore-theme.css` imports only within
  Explore's Next.js layout. No modifications to MPR or employer workspace.
- Refresh hero as a single compact editorial introduction: deep navy,
  mint/lime contrast, original abstract CSS artwork and clear plain language.
- Make official route tiles more distinctive via larger type, numbering, bold
  colour and consistent icon/arrow treatment while preserving every route
  href, label, dynamic count and click target.
- Keep official pathway tile membership, order and URLs unchanged; only
  restyle their typography, colour, spacing and hover/focus states.
- Restyle the standard list, search and level select with clear result
  density and spacious touch targets. Keep filtering, pagination,
  detail links, and preserved return context unchanged.
- Restyle Unpacked loading, error and successful states without changing the
  AI endpoint, verification, caching, budgets or source disclosures.
- Restyle the manager/MPR CTA panel, not its permissions or consent flow.
  Keep public enquiry submission disabled until approval.
- Preserve installed PWA and exact Skills England attribution/source links.
- Respect `prefers-reduced-motion`; decorative motion is optional,
  never the way to reach a necessary feature.
- No external fonts, image services or tracking dependencies were added.
  Avoid unsolicited images of employees or demographic stereotypes.

## Invariants (checked in automated source regression tests)

1. 15 authoritative Skills England occupational route tiles remain the
   first clickable selection with source-derived counts.
2. Official route → pathway → listed apprenticeship standard navigation
   remains unchanged and no unclassified standard is silently discarded.
3. Route lists retain query, level filters, pagination and links.
4. Standard selection still mounts the Unpacked AI panel automatically,
   with the existing server feature flag/production safety posture.
5. Manager email drafts, voluntary MPR contact and protections stay intact.
6. Same original LevyTate brand mark, install dialog and official source links.
7. Scoped styles, visible focus and reduced motion compliance.

## Acceptance beyond automated build

- Perform actual mobile and desktop browser screenshots at 360, 390, 768,
  1024 and 1440 CSS-pixel widths.
- Test Safari/iOS and Chrome/Android, including added-to-home-screen mode.
- Run keyboard-only focus order, TalkBack/VoiceOver, 200% text zoom,
  contrast and reduced-motion checks.
- Recheck official-source API and lead-submission release gates before
  any public deployment.
- Review aesthetics with 18–28-year-old employed testers; do not claim
  evidence of user preference until real research has been conducted.

## Product journey deliberately unchanged

Explore (government route tiles) → official pathway tiles →
standards list → Unpacked → employee-led manager/MPR conversation.

**Do not add a quiz, survey, account gate, social feed, animation-led
navigation, provider marketplace or change how a tile behaves.**
