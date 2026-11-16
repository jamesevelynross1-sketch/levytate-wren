/** Actual local login pages with delayed JS; Auth transport is intercepted. */
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
const app = new URL(process.env.RELEASE_APP_URL ?? "http://localhost:3107");
if (!["localhost", "127.0.0.1"].includes(app.hostname) || app.username || app.password || app.search || app.hash) throw Error("Credential-free local app required");
const executable = "/private/tmp/levytate-current-browser-20261116/edge-extracted/MicrosoftEdge-157.0.4341.60.pkg/Payload/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const { chromium } = await import(pathToFileURL(process.env.RELEASE_PLAYWRIGHT_MODULE ?? "/private/tmp/levytate-current-browser-20261116/node_modules/playwright/index.mjs").href);
const browser = await chromium.launch({ headless: true, executablePath: executable });
const results = [];
try {
  for (const kind of ["employer", "provider"]) {
    const path = kind === "employer" ? "/levytate/login" : "/levytate/provider/login";
    const endpoint = kind === "employer" ? "/api/levytate-auth/request" : "/api/levytate-provider-auth/request";
    const context = await browser.newContext(), page = await context.newPage();
    let release; const gate = new Promise(resolve => { release = resolve; });
    let scriptRequests = 0, posts = 0, emailMatches = false, loginGets = 0;
    const pending = new Set();
    const email = "hydration.synthetic@example.test";
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== app.origin) return route.abort();
      if (url.pathname === endpoint) {
        if (request.method() !== "POST") return route.abort();
        posts++; emailMatches = request.postDataJSON()?.email === email;
        return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      }
      if (url.pathname === path && request.method() === "GET") {
        loginGets++; if (loginGets > 1 || url.search) return route.abort();
      }
      if (request.resourceType() === "script" && url.pathname.startsWith("/_next/")) {
        scriptRequests++; const waiting = gate.then(() => route.continue()).catch(() => {});
        pending.add(waiting); try { await waiting; } finally { pending.delete(waiting); } return;
      }
      return route.continue();
    });
    try {
      await page.goto(`${app.origin}${path}`, { waitUntil: "domcontentloaded" });
      const input = page.getByRole("textbox", { name: "Work email", exact: true });
      const submit = page.getByRole("button", { name: "Send secure sign-in link", exact: true });
      await input.waitFor();
      const before = { delayedScripts: scriptRequests, inputDisabled: await input.isDisabled(), submitDisabled: await submit.isDisabled() };
      if (before.inputDisabled && before.submitDisabled) await submit.click({ force: true });
      const noPreHydrationRequest = posts === 0 && loginGets === 1;
      release(); await Promise.allSettled([...pending]); await page.waitForLoadState("load");
      await input.waitFor(); await input.fill(email);
      await submit.click(); await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
      const result = { kind, before, noPreHydrationRequest, exactOneInterceptedPost: posts === 1 && emailMatches, noNativeLoginNavigation: loginGets === 1,
        status: before.delayedScripts > 0 && before.inputDisabled && before.submitDisabled && noPreHydrationRequest && posts === 1 && emailMatches && loginGets === 1 ? "PASS" : "FAIL" };
      results.push(result); console.log(JSON.stringify(result));
    } finally { release(); await context.close(); await Promise.allSettled([...pending]); }
  }
} finally { await browser.close(); }
const evidence = { environment: "local", browserVersion: "157.0.4341.60", actualLoginComponents: true, actualAuthRequests: 0, externalEmail: false, genuineAuthenticationAcceptance: false, results };
if (process.env.RELEASE_HYDRATION_EVIDENCE) writeFileSync(process.env.RELEASE_HYDRATION_EVIDENCE, JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 });
if (results.some(row => row.status !== "PASS")) process.exitCode = 1;
