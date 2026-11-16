/** Genuine current Lead context; native browser setting, no CSS/viewport emulation. */
import { writeFileSync } from "node:fs";
import { setNativeBrowserZoom, nativeZoomMetrics, assertNativeZoomDoubled, captureNativeZoomViewport } from "./verify-native-browser-zoom.mjs";

export async function verifyNativeApplicationZoom({ app, lead, check, root, appCodeCommit }) {
  if (!lead?.nativePersistent || lead.user.role !== "Apprenticeship Lead" || lead.page.viewportSize() !== null
    || !/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "")) throw Error("Original fresh persistent genuine Lead context required");
  const { context, page } = lead, evidence = { environment: "local", role: "Apprenticeship Lead", appCodeCommit, method: "native Edge Appearance 100/200 percent", browserVersion: context.browser().version(), captures: [], visualReview: "pending independent image inspection" };
  const report = (name, result) => check(`Native Lead zoom: ${name}`, result);
  let baseline, changed = false;
  try {
    await setNativeBrowserZoom(context, 100, { product: "edge" });
    await page.goto(`${app}/levytate/app?module=Home`);
    const response = await context.request.get(`${app}/api/levytate-workspace`), body = await response.json();
    report("actual current role, account and employer remain authenticated", response.status() === 200 && body.workspace?.meta?.userEmail === lead.user.email && body.workspace.meta.userRole === lead.user.role && body.workspace.meta.organisationId === lead.tenant.id);
    await page.getByRole("button", { name: "Open account menu", exact: true }).waitFor();
    await page.getByRole("heading", { name: "What needs attention?", exact: true }).waitFor();
    baseline = await nativeZoomMetrics(page); evidence.baseline = baseline;
    report("100 percent uses original native viewport without overflow", baseline.scrollWidth <= baseline.innerWidth + 1);
    const prefix = `${root}/native-lead-${Date.now()}`;
    const capture = async label => { const path = `${prefix}-${label}.png`; evidence.captures.push({ label, path, ...await captureNativeZoomViewport(context, page, path) }); };
    await capture("100-top");
    await setNativeBrowserZoom(context, 200, { product: "edge" }); changed = true;
    evidence.zoomed = await assertNativeZoomDoubled(page, baseline);
    report("native zoom halves CSS viewport and doubles DPR at fixed physical window", true);
    report("200 percent reflows without document horizontal overflow", evidence.zoomed.scrollWidth <= evidence.zoomed.innerWidth + 1);
    await page.evaluate(() => window.scrollTo(0, 0)); await capture("200-top");
    const navigation = page.getByRole("button", { name: "Open navigation", exact: true });
    report("actual responsive navigation is available at native 200 percent", await navigation.isVisible());
    await navigation.focus(); await page.keyboard.press("Enter");
    await page.getByRole("navigation", { name: "Mobile workspace navigation", exact: true }).waitFor();
    await capture("200-navigation"); await page.keyboard.press("Escape");
    report("keyboard closes navigation and restores trigger focus", await navigation.evaluate(button => button === document.activeElement));
    await page.getByRole("navigation", { name: "Trust and support", exact: true }).scrollIntoViewIfNeeded();
    report("bottom support navigation remains visible after actual scrolling", await page.getByRole("navigation", { name: "Trust and support", exact: true }).isVisible());
    await capture("200-bottom");
    report("authenticated application contains no MPR marketing chrome", !(await page.locator("body").innerText()).match(/MPR Consulting|Book a Conversation/));
    evidence.status = "PASS";
  } catch(error) {
    evidence.status="FAIL"; evidence.safeErrorClass=["Error","TimeoutError","TypeError"].includes(error.name)?error.name:"UnclassifiedError";
    throw error;
  } finally {
    try {
      if (changed) {
        await setNativeBrowserZoom(context, 100, { product: "edge" });
        await page.waitForFunction(before => devicePixelRatio === before.devicePixelRatio && innerWidth === before.innerWidth, baseline);
        evidence.restored = await nativeZoomMetrics(page);
        report("original native 100 percent setting is restored", evidence.restored.innerWidth === baseline.innerWidth);
      }
    } catch(error) { evidence.status="FAIL";evidence.restorationFailed=true;throw error; }
    finally { writeFileSync(`${root}/native-lead-zoom-evidence-${Date.now()}.json`, JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 }); }
  }
  return evidence;
}
