# LevyTate Explore — zero-store-fee installation plan

## Decision for v1 (October 2026)

**Publish Explore as an installable Progressive Web App (PWA), not a native
App Store or Google Play listing.** No Apple/Google developer registration,
mobile app binary, or paid packaging service is necessary.

The app retains a normal public HTTPS URL, so someone can discover a programme
from Google or a manager's link without downloading anything.

## Current branch implementation

- Shared public Explore header has a **Get the app** action.
- Android Chromium: use the browser's genuine `beforeinstallprompt`
  when available; otherwise show the Add to Home Screen / Install instructions.
- iPhone/iPad: explain the Safari Share → Add to Home Screen →
  Open as Web App → Add steps. **iOS cannot open a native installation prompt
  programmatically.** Users must confirm the action themselves.
- Desktop Chrome/Edge: native install prompt when provided, with browser-menu
  instructions as fallback.
- Standalone-mode and `appinstalled` detection; no false claims of success.
- Existing `/explore/manifest.webmanifest`, icon set and `/explore-sw.js`
  remain scoped to Explore, not authenticated employer modules.
- The worker never caches enquiries, tokens or programme approval data.
- Install UI has no ad tracker and does not collect personal information.
- Installation tests check manifest metadata, icons and platform instructions.

## Install QA

On a real Android Chrome device:
1. Open HTTPS Explore (not an HTTP or restricted test domain).
2. Select Get the app. If native install is offered, use it.
3. If native install is unavailable, use Chrome's menu and Install app.
4. Confirm the launcher icon and standalone window, then reload a programme.

On a real iPhone:
1. Open HTTPS Explore in Safari.
2. Select Get the app and follow the three steps.
3. Confirm Open as Web App then Add.
4. Launch from Home Screen; verify the icon, title, programme deep links,
   privacy links and offline state.

Also test keyboard navigation, reduced-motion preferences, zoom, VoiceOver,
TalkBack, small phones and an interrupted connection. Until external testing
is completed, don't claim an app-store-grade user experience.

## Distinguish £0 install/distribution from £0 commercial hosting

PWA installation requires no store registration fee. Hosting and backend
infrastructure are separate matters.

**Vercel Hobby is for personal/non-commercial projects only.** A public
app generating provider-paid introductions or employer software leads has a
commercial purpose. Do not publicly launch the commercial app on Vercel Hobby.
See Vercel Terms (Oct 2026): https://vercel.com/legal/terms

**Netlify Free explicitly permits commercial projects** with usage limits and
free deploy previews. It is a potential £0 public-hosting route, but no Netlify
account or migration is configured in this repository. Source:
https://www.netlify.com/blog/introducing-netlify-free-plan/
https://www.netlify.com/pricing/

A separate lightweight Explore deployment is preferable to mirroring the
entire multi-tenant LevyTate/employer administration codebase onto a free
public host. Reuse audited programme data and isolated public APIs. Paid
backends, domain renewal, provider email volume, live AI requests or limits
could still create costs later.

If the existing Vercel account is already on a paid commercial-eligible plan,
the incremental cost of making Explore installable may be zero, but confirm
account entitlement before claiming this.

## Readiness and safety

The current Preview remains behind Vercel Authentication. Do not use it as
a public distribution URL.

Public enquiries remain intentionally disabled until:
- The correctly identified isolated Supabase project is approved, migration
  040 is applied and verified, and secure lead storage/outbox works.
- A public-specific privacy and retention policy is legally approved.
- Skills England data is refreshed and its API/attribution conditions met.
- End-to-end mobile, privacy, accessibility and performance tests pass.
- A public, commercially permitted hosting destination is selected.

The employee-controlled manager email draft and anonymous programme discovery
do not themselves trigger employer outreach.

App Store and Google Play publication can be considered after a successful
PWA pilot, but paid developer accounts would be required and store review is
not guaranteed.
