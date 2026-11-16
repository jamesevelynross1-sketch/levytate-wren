/** Native Chrome page-zoom probe. Isolated synthetic layout; no application/Auth proof.
 * Uses the built-in Appearance UI, a new temporary profile, and no viewport/DPR emulation.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export async function nativeZoomMetrics(page) {
  assert.equal(page.viewportSize(), null, "Disable Playwright viewport emulation before native zoom testing");
  return page.evaluate(() => ({
    innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio,
    visualViewportScale: visualViewport?.scale,
    rootZoom: getComputedStyle(document.documentElement).zoom,
    bodyZoom: getComputedStyle(document.body).zoom,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

/** Requires the original launchPersistentContext context in a disposable profile.
 * Do not call in browser.newContext(): Playwright explicitly forbids settings there.
 * Chrome settings affect this profile; close and remove it after the test. */
export async function setNativeBrowserZoom(context, percent) {
  assert([100, 200].includes(percent), "This bounded probe only supports 100% and 200%");
  const settings = await context.newPage();
  try {
    await settings.goto("chrome://settings/appearance");
    // Native Chrome settings control, observed in the actual browser, not a page style/API.
    const control = settings.locator("select#zoomLevel");
    await control.waitFor({ state: "visible" });
    await control.selectOption({ label: `${percent}%` });
    assert.equal(await control.inputValue(), String(percent / 100));
    assert.equal((await control.locator("option:checked").innerText()).trim(), `${percent}%`);
    return { settingsUrl: settings.url(), selectedPercent: percent, method: "native-appearance-select" };
  } finally { await settings.close(); }
}

export async function assertNativeZoomDoubled(page, baseline) {
  await page.waitForFunction(before => Math.abs(devicePixelRatio / before.devicePixelRatio - 2) < 0.02
    && Math.abs(innerWidth * 2 - before.innerWidth) <= 2, baseline, { timeout: 10000 });
  const zoomed = await nativeZoomMetrics(page);
  assert.equal(zoomed.outerWidth, baseline.outerWidth, "Window width must stay fixed");
  assert.equal(zoomed.outerHeight, baseline.outerHeight, "Window height must stay fixed");
  assert(Math.abs(zoomed.devicePixelRatio / baseline.devicePixelRatio - 2) < 0.02);
  assert(Math.abs(zoomed.innerWidth * 2 - baseline.innerWidth) <= 2);
  assert(Math.abs(zoomed.innerHeight * 2 - baseline.innerHeight) <= 2);
  assert.equal(baseline.visualViewportScale, 1); assert.equal(zoomed.visualViewportScale, 1);
  for (const metrics of [baseline, zoomed]) for (const key of ["rootZoom", "bodyZoom"]) assert(["1", "normal"].includes(metrics[key]), "CSS zoom must remain unmodified");
  return zoomed;
}

// CDP is used only to capture the unchanged native viewport. Playwright fullPage
// capture in native zoom can crop to CSS width; no emulation/zoom CDP command is used.
export async function captureNativeZoomViewport(context, page, path) {
  const session = await context.newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const png = Buffer.from(data, "base64");
    const metrics = await nativeZoomMetrics(page);
    assert(Math.abs(png.readUInt32BE(16) - metrics.innerWidth * metrics.devicePixelRatio) <= 2, "Native screenshot must include the entire physical viewport width");
    await writeFile(path, png);
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  } finally { await session.detach(); }
}

async function main() {
  const { values } = parseArgs({ options: { browser: { type: "string" }, playwright: { type: "string" }, output: { type: "string" }, headless: { type: "boolean", default: false } }, strict: true });
  for (const key of ["browser", "playwright", "output"]) assert(isAbsolute(values[key] ?? ""), `Explicit absolute ${key} path required`);
  const output = resolve(values.output);
  assert(output.startsWith("/private/tmp/"), "Evidence and fresh browser profile must stay in temporary test storage");
  await mkdir(output, { recursive: true });
  assert((await realpath(output)).startsWith("/private/tmp/"), "Output symlinks must not escape temporary test storage");
  const { chromium } = await import(pathToFileURL(values.playwright).href);
  const profile = await mkdtemp(join(output, "native-zoom-profile-"));
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native zoom verification — synthetic content</title>
<style>body{margin:0;font:16px system-ui;background:#f3f7f5;color:#102c3d}main{max-width:1120px;margin:auto;padding:24px}header{display:flex;flex-wrap:wrap;gap:16px;align-items:center}h1{font-size:28px;margin:0}nav{display:flex;flex-wrap:wrap;gap:16px}a{color:#075f55}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:24px 0}article{padding:20px;background:white;border-radius:12px}input,button{font:inherit;padding:10px;max-width:100%;box-sizing:border-box}button{background:#075f55;color:white;border:0;border-radius:8px}label{display:grid;gap:8px}p{line-height:1.5}@media(max-width:800px){section{grid-template-columns:1fr}h1{font-size:24px}}</style>
<main><header><h1>Native browser zoom verification</h1><nav aria-label="Probe navigation"><a href="#summary">Summary</a><a href="#entry">Entry</a></nav></header><p>This is a synthetic layout probe. It contains no authenticated application, customer records or API calls.</p><section id="summary"><article><h2>Window size</h2><p>The outer browser window stays fixed between observations.</p></article><article><h2>Native page zoom</h2><p>Chrome Appearance changes from 100% to 200%.</p></article><article><h2>Responsive layout</h2><p>The real media query changes three columns into one.</p></article></section><form id="entry"><label>Fictional reference<input value="Synthetic local-only entry"></label><p><button type="button">Local probe control</button></p></form></main>`;
  let context, stage = "listen", requests = 0, blocked = 0;
  const evidence = { kind: "native-browser-zoom-synthetic-layout-not-authenticated-app", date: new Date().toISOString(), headless: values.headless };
  const server = createServer((req, res) => { requests++; assert.equal(req.method, "GET"); res.setHeader("Content-Type", "text/html"); res.end(html); });
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    stage = "launch-fresh-profile";
    context = await chromium.launchPersistentContext(profile, { executablePath: values.browser, headless: values.headless, viewport: null, args: ["--window-size=1280,900"], serviceWorkers: "block" });
    context.setDefaultTimeout(10000);
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin && request.method() === "GET") return route.continue();
      blocked++; return route.abort();
    });
    evidence.browserVersion = context.browser().version();
    const page = await context.newPage();
    stage = "native-100-percent";
    evidence.baselineSetting = await setNativeBrowserZoom(context, 100);
    await page.goto(origin);
    evidence.baseline = await nativeZoomMetrics(page);
    evidence.baselineColumns = await page.locator("section").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    evidence.baselineImage = await captureNativeZoomViewport(context, page, join(output, "native-zoom-100.png"));
    stage = "native-200-percent";
    evidence.zoomSetting = await setNativeBrowserZoom(context, 200);
    evidence.zoomed = await assertNativeZoomDoubled(page, evidence.baseline);
    evidence.zoomedColumns = await page.locator("section").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    assert.equal(evidence.baselineColumns, 3); assert.equal(evidence.zoomedColumns, 1);
    assert(evidence.zoomed.scrollWidth <= evidence.zoomed.innerWidth, "Synthetic page must reflow without horizontal document overflow");
    evidence.zoomedImage = await captureNativeZoomViewport(context, page, join(output, "native-zoom-200.png"));
    stage = "restore-native-100-percent";
    await setNativeBrowserZoom(context, 100);
    await page.waitForFunction(before => devicePixelRatio === before.devicePixelRatio && innerWidth === before.innerWidth, evidence.baseline);
    evidence.restored = await nativeZoomMetrics(page);
    evidence.result = "PASS"; evidence.authRequests = 0; evidence.loopbackRequests = requests; evidence.blockedExternalPageRequests = blocked;
  } catch (error) {
    evidence.result = "FAIL"; evidence.safeStage = stage; evidence.safeErrorClass = ["TimeoutError", "TypeError", "AssertionError"].includes(error?.name) ? error.name : "Error";
    process.exitCode = 1;
  } finally {
    try { await context?.close(); } finally { await rm(profile, { recursive: true }); evidence.temporaryProfileRemoved = true; }
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await writeFile(join(output, "native-zoom-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify(evidence));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
