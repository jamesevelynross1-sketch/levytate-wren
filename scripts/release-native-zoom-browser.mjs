/** Genuine current Lead context; native browser setting, no CSS/viewport emulation. */
import { writeFileSync } from "node:fs";
import { setNativeBrowserZoom, nativeZoomMetrics, assertNativeZoomDoubled, captureNativeZoomViewport } from "./verify-native-browser-zoom.mjs";

export async function verifyNativeApplicationZoom({ app, lead, check, root, appCodeCommit }) {
  if (!lead?.nativePersistent || lead.user.role !== "Apprenticeship Lead" || lead.page.viewportSize() !== null
    || !/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "")) throw Error("Original fresh persistent genuine Lead context required");
  const { context, page } = lead, evidence = { environment: "local", role: "Apprenticeship Lead", appCodeCommit, method: "native Edge Appearance 100/200 percent", browserVersion: context.browser().version(), captures: [], visualReview: "pending independent image inspection" };
  const report = (name, result) => check(`Native Lead zoom: ${name}`, result);
  let baseline, changed = false, phase="native initial settings";
  try {
    await setNativeBrowserZoom(context, 100, { product: "edge" });
    phase="authoritative Home state";
    await page.goto(`${app}/levytate/app?module=Home`);
    const response = await context.request.get(`${app}/api/levytate-workspace`), body = await response.json();
    report("actual current role, account and employer remain authenticated", response.status() === 200 && body.workspace?.meta?.userEmail === lead.user.email && body.workspace.meta.userRole === lead.user.role && body.workspace.meta.organisationId === lead.tenant.id);
    await page.getByRole("button", { name: "Open account menu", exact: true }).waitFor();
    const data=body.workspace.data,permissions=body.workspace.meta.permissions;
    report("Home state is based on actual employer priorities and permission",Array.isArray(data?.profile?.priorities)&&Array.isArray(permissions));
    const configured=data.profile.priorities.length>0,canConfigure=permissions.includes("settings:write");
    const heading=configured?"What needs attention?":canConfigure?"What are you hoping to achieve?":"Workspace setup required";
    evidence.homeState=configured?"configured-attention-dashboard":canConfigure?"priorities-setup":"priorities-awaiting-authorised-admin";
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    phase="native baseline capture";
    baseline = await nativeZoomMetrics(page); evidence.baseline = baseline;
    report("100 percent uses original native viewport without overflow", baseline.scrollWidth <= baseline.innerWidth + 1);
    const prefix = `${root}/native-lead-${Date.now()}`;
    const capture = async label => { const path = `${prefix}-${label}.png`; evidence.captures.push({ label, path, ...await captureNativeZoomViewport(context, page, path) }); };
    await capture("100-top");
    phase="native 200 percent setting";
    await setNativeBrowserZoom(context, 200, { product: "edge" }); changed = true;
    evidence.zoomed = await assertNativeZoomDoubled(page, baseline);
    report("native zoom halves CSS viewport and doubles DPR at fixed physical window", true);
    report("200 percent reflows without document horizontal overflow", evidence.zoomed.scrollWidth <= evidence.zoomed.innerWidth + 1);
    await page.evaluate(() => window.scrollTo(0, 0)); await capture("200-top");
    phase="native responsive keyboard navigation";
    const navigation = page.getByRole("button", { name: "Open navigation", exact: true });
    report("actual responsive navigation is available at native 200 percent", await navigation.isVisible());
    await navigation.focus(); await page.keyboard.press("Enter");
    await page.getByRole("navigation", { name: "Mobile workspace navigation", exact: true }).waitFor();
    await capture("200-navigation"); await page.keyboard.press("Escape");
    await page.getByRole("navigation", { name: "Mobile workspace navigation", exact: true }).waitFor({state:"hidden"});
    report("keyboard closes navigation and restores trigger focus", await navigation.evaluate(button => button === document.activeElement));
    phase="native bottom viewport capture";
    await page.getByRole("navigation", { name: "Trust and support", exact: true }).scrollIntoViewIfNeeded();
    report("bottom support navigation remains inside the native viewport after actual scrolling", await page.getByRole("navigation", { name: "Trust and support", exact: true }).evaluate(nav=>{const rect=nav.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight+1&&rect.left>=0&&rect.right<=innerWidth+1;}));
    await capture("200-bottom");
    report("authenticated application contains no MPR marketing chrome", !(await page.locator("body").innerText()).match(/MPR Consulting|Book a Conversation/));
    evidence.status = "PASS";
  } catch(error) {
    evidence.status="FAIL"; evidence.safeStage=phase; evidence.safeErrorClass=["Error","TimeoutError","TypeError"].includes(error.name)?error.name:"UnclassifiedError";error.safeStage=phase;
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
