# Visual precision corrective pass — 25 November 2026

Owner feedback and actual hosted screenshots identified three unacceptable defects: broken Employee/date/stage text in the application table, repeated Copilot buttons and nested cards in employee detail, and vertically misaligned Insights metrics. The previous browser matrix proved reflow (not composition): 224 pass, 2 fail, 1 blocked; the Finance preview interaction timed out and provider steps did not run. No quality sign-off.

Corrective scope:
- Bundle unmodified Inter v4.1 variable font under SIL OFL 1.1, upstream rsms/inter commit e3a3d4c57d5ecc01453a575621882a384c1995a3, Git blob 5a8d3e72ad7ffb62af3b146e1b1f54ab5813a212. Local browser asset, no external font dependency or new package. Consistent application-only typeface, restrained shadows, and shared modal spacing.
- Explicit five-column application layout with owner and stage retained within status, a readable date (draft creation labelled), top alignment, intentional wrapping and compact adaptive layout. Original approval, edit and handoff commands retained.
- Employee record uses one action bar, aligned profile facts, flat application timeline and conversation history. Only one Copilot action. Existing edit/archive/restore/discovery actions preserved.
- Insights uses equal-width rail and shared row tracks so labels, values, descriptions and evidence timestamps align despite wrapped labels; adaptive columns by actual content width. No synthetic metrics or removed source evidence.
- Browser tests must check actual loaded font, word splitting and geometric alignment at multiple widths and screenshot affected screens. Re-test Finance preview with explicit synthetic band/duration inputs and reactive standards provider. No funding eligibility or forecast calculation rule change.
- This is a corrective candidate, not visual sign-off. User-approved aesthetic and actual rendered screenshot review required. Staging only.
