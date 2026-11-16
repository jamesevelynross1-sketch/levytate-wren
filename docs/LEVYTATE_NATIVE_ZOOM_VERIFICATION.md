# Native browser zoom verification

This probe establishes the native zoom method for the client usability acceptance cases. Its synthetic page has no application authentication or customer records. It does not close authenticated application usability acceptance.

## Method

`scripts/verify-native-browser-zoom.mjs` launches the explicitly supplied Chrome executable with a new temporary persistent profile, a fixed 1280×900 outer window and `viewport: null`. It uses Chrome's native `chrome://settings/appearance` **Page zoom** select, first at 100%, then at 200%, and finally restores 100%. It does not set CSS zoom, device scale factor, browser emulation or pinch scale.

The assertions require all of:

- The actual Chrome select reports 100% and 200% at the corresponding steps.
- Outer window width and height remain unchanged.
- The layout viewport width and height halve, within integer rounding tolerance.
- Device-pixel ratio doubles; visual viewport scale remains 1.
- Computed root and body CSS zoom remain 1/normal.
- The synthetic media-query layout changes from three columns to one without horizontal document overflow.
- Restoring 100% restores the original viewport and device-pixel ratio.

Screenshots use `Page.captureScreenshot` without a clip or emulation commands, and assert the image includes the entire physical viewport width. The initial exploratory Playwright `fullPage` capture cropped a 200% image to its CSS width; that artifact is not evidence of a product layout defect. Native viewport capture avoids this crop. Screenshots cover the visible viewport, not the entire document.

The script blocks non-loopback page requests, serves only synthetic GET content, writes safe numeric evidence and PNGs, then closes and removes the profile. No application/Auth request is required.

## Execution

Supply explicitly reviewed local executable and Playwright paths:

```sh
node scripts/verify-native-browser-zoom.mjs \
  --browser '/absolute/path/to/Google Chrome for Testing' \
  --playwright '/absolute/path/to/playwright/index.mjs' \
  --output '/private/tmp/levytate-native-zoom-evidence'
```

The default is a headed browser. `--headless` is available for a separate diagnostic run; record which mode was used. The output directory must be under `/private/tmp/`. No installed browser profile is opened or changed.

## Reuse for genuine application acceptance

Use a fresh `launchPersistentContext` with `viewport: null`, then the application's ordinary sign-in request, captured fictional email and callback in that context. Do not inject cookies, export a session, load a stored profile or pass a device-scale override. Import `setNativeBrowserZoom`, `nativeZoomMetrics`, `assertNativeZoomDoubled` and, if needed, `captureNativeZoomViewport` from the probe. Capture the baseline at 100%, select 200% through the settings helper, verify the numeric invariants, then exercise the actual application at that setting. Reset to 100% and close/remove the temporary profile in a final cleanup block.

The settings helper requires the original persistent context. Playwright 1.65 explicitly refuses the settings page in `browser.newContext()` because opening it there can crash the browser. Do not bypass that refusal. No additional product login is performed by this probe; the independent acceptance owner must authorise fixture use and check the natural rate budget before the separate genuine journey.

## Sources

- [Chrome for Testing official availability and stable assets](https://googlechromelabs.github.io/chrome-for-testing/)
- [Playwright persistent browser contexts](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)
- [Chrome native text/image/zoom controls](https://support.google.com/chrome/answer/96810?co=GENIE.Platform%3DDesktop&hl=en)
- [Chrome DevTools screenshot capture](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)

Dated browser provenance and current headed results are recorded after the official browser restoration completes; exploratory cached Chrome151 results are not a current-browser acceptance claim.
