# Native browser zoom verification

This probe establishes the native zoom method for the client usability acceptance cases. Its synthetic page has no application authentication or customer records. It does not close authenticated application usability acceptance.

## Method

`scripts/verify-native-browser-zoom.mjs` launches the explicitly supplied Chrome or Edge executable with a new temporary persistent profile and `viewport: null`. It requests a 1280×900 outer window and asserts the actual OS-sized window stays fixed. It uses the native **Page zoom** control: Chrome's `chrome://settings/appearance` select or Edge's `edge://settings/appearance` menu, first at 100%, then at 200%, and finally restores 100%. It does not set CSS zoom, device scale factor, browser emulation or pinch scale.

The assertions require all of:

- The actual browser select or checked native menu item reports 100% and 200% at the corresponding steps.
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
  --browser '/absolute/path/to/Microsoft Edge' \
  --playwright '/absolute/path/to/playwright/index.mjs' \
  --product edge \
  --output '/private/tmp/levytate-native-zoom-evidence'
```

Choose `--product edge` for Edge or `--product chrome` for Chrome (the default). The default is a headed browser. `--headless` is available for a separate diagnostic run; record which mode was used. The output directory must be under `/private/tmp/`. No installed browser profile is opened or changed.

## Reuse for genuine application acceptance

Use a fresh `launchPersistentContext` with `viewport: null`, then the application's ordinary sign-in request, captured fictional email and callback in that context. Do not inject cookies, export a session, load a stored profile or pass a device-scale override. Import `setNativeBrowserZoom`, `nativeZoomMetrics`, `assertNativeZoomDoubled` and, if needed, `captureNativeZoomViewport` from the probe. Capture the baseline at 100%, select 200% through the settings helper, verify the numeric invariants, then exercise the actual application at that setting. For Edge, pass `{ product: "edge" }` as the third argument to `setNativeBrowserZoom`; its checked menu item is verified after selection. Reset to 100% and close/remove the temporary profile in a final cleanup block.

The settings helper requires the original persistent context. Playwright 1.65 explicitly refuses the settings page in `browser.newContext()` because opening it there can crash the browser. Do not bypass that refusal. No additional product login is performed by this probe; the independent acceptance owner must authorise fixture use and check the natural rate budget before the separate genuine journey.

## Sources

- [Chrome for Testing official availability and stable assets](https://googlechromelabs.github.io/chrome-for-testing/)
- [Playwright persistent browser contexts](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)
- [Chrome native text/image/zoom controls](https://support.google.com/chrome/answer/96810?co=GENIE.Platform%3DDesktop&hl=en)
- [Chrome DevTools screenshot capture](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)

## 16 November 2026 current browser proof — PASS

Current Stable Edge **157.0.4341.60**, published 13 November, was downloaded from the artifact linked in Microsoft's [official Stable release API](https://edgeupdates.microsoft.com/api/products/stable). The package SHA-256 matches the published value `01a3976ac110c8c408d86650c0342056ce1cfc5097bcfbafdd42af797eb69ad3`. `pkgutil --check-signature` confirms a trusted, notarized Microsoft installer; `codesign --verify --deep --strict` passes with Developer ID Application Microsoft Corporation, TeamIdentifier `UBF8T346G9`. The executable reports the exact expected version. It was extracted under `/private/tmp/levytate-current-browser-20261116`, with no system installation or existing profile change. The isolated driver is Playwright **1.65.0**.

The headed run at **09:45:07 UTC** passes:

| Measurement | 100% | Native 200% | Restored 100% |
| --- | --- | --- | --- |
| Outer window | 1280×871 | 1280×871 | 1280×871 |
| Layout viewport | 1272×787 | 636×393 | 1272×787 |
| Device-pixel ratio | 2 | 4 | 2 |
| Pinch scale | 1 | 1 | 1 |
| Root/body CSS zoom | 1 / 1 | 1 / 1 | 1 / 1 |
| Synthetic columns | 3 | 1 | — |

Native screenshots retain the full **2544×1574** physical viewport and were visually checked for cropping. A separate current Edge headless run also passes. Both runs use only one synthetic loopback GET, make zero application/Auth requests, restore 100%, and close/remove their temporary profiles. The safe numeric headed evidence and accepted browser provenance are retained in `docs/evidence/LEVYTATE_NATIVE_ZOOM_2026-11-16.json`.

The initial Edge harness timed out when reselecting 100% because the native menu stays open for the current value. The corrected helper closes the menu with Escape before reopening it to verify the checked item. Numeric zoom assertions were preserved. Exploratory cached Chrome151 results establish no current-browser or authenticated-application acceptance claim. Genuine application use at 200% remains independently owned and pending.

## 16 November 2026 rejected browser artifact

The official Chrome for Testing 157.0.8103.78 mac-arm64 archive has SHA-256 `bf3b49d0fe62a62397e98641aa736ef813c46014f03ec13d4913442e6966c7fc`. Its bytes match Google’s published CRC32C `34GNRQ==` and MD5 ETag. The first download check incorrectly assumed an MD5 entry in `x-goog-hash`; the header provides CRC32C instead, which was subsequently verified.

The archive’s app failed `codesign --verify --deep --strict`: “code has no resources but signature indicates they must be present”; its TeamIdentifier was unset. It is rejected for genuine acceptance. The initial shell lacked fail-fast sequencing, so a final `--version` probe executed after this failure. No browser context was opened and no application or Auth request occurred. It was not executed again, re-signed, or given a signature override. The replacement signed Edge downloader stops before execution unless published SHA-256, package-signature and deep strict app-signature checks pass.
