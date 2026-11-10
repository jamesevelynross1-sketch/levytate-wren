/** Actual component with explicit stub GETs. This is not Auth or database acceptance. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";

const { values } = parseArgs({ options: { browser: { type: "string" }, playwright: { type: "string" } }, strict: true });
assert(isAbsolute(values.browser ?? "") && isAbsolute(values.playwright ?? ""));
const { chromium } = await import(pathToFileURL(values.playwright).href);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = { generatedAt: "2026-11-10T09:00:00Z", role: "Line Manager", capabilityEnabled: true, canManagePlans: false, canReviewActivities: false, canCreateActivities: false, learners: [], portfolio: { activeLearnerPlans: 0, providerConfirmedMinutes: 0, candidateMinutesAwaitingCheck: 0, activitiesAwaitingProviderConfirmation: 0, plansNeedingSetup: 0, operationalAttention: 0 }, regulatoryNotice: "Explicit synthetic transport probe" };
const bundle = await build({
  stdin: { contents: 'import React from "react";import{createRoot}from"react-dom/client";import{LearningTimeModule}from"./components/levytate-mvp/LearningTimeModule";createRoot(document.getElementById("root")).render(<React.StrictMode><LearningTimeModule/></React.StrictMode>);', resolveDir: root, loader: "tsx" },
  absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
  plugins: [{ name: "explicit-fictional-workspace-context", setup(builder) {
    builder.onResolve({ filter: /MvpWorkspaceStore$/ }, () => ({ path: "fictional-context", namespace: "probe" }));
    builder.onLoad({ filter: /.*/, namespace: "probe" }, () => ({ contents: 'export const WorkspaceSessionRecovery=()=>null;export const useMvpWorkspace=()=>({meta:{storageMode:"supabase",userEmail:"fictional@example.test",organisationId:"fictional",userRole:"Line Manager"}});', loader: "js" }));
  } }],
});
let mode = "first-only", requests = 0, browser;
const server = createServer((request, response) => {
  if (request.url === "/api/levytate-learning-time") {
    requests++; response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(mode === "all" || mode === "first-only" && requests === 1 ? {} : workspace)); return;
  }
  response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/bundle.js" ? bundle.outputFiles[0].text : '<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
});
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  browser = await chromium.launch({ headless: true, executablePath: values.browser });
  const page = await browser.newPage(); page.setDefaultTimeout(5000);
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await page.getByText(workspace.regulatoryNotice, { exact: true }).waitFor();
  assert.equal(requests, 2); assert.equal(await page.getByText("Learning Time is unavailable", { exact: true }).count(), 0);
  const firstOnlyGets = requests;
  mode = "all"; requests = 0; await page.reload();
  await page.getByText("Learning Time is unavailable", { exact: true }).waitFor();
  assert.equal(requests, 2); assert.equal(await page.getByText(workspace.regulatoryNotice, { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Add learning activity", exact: true }).count(), 0);
  mode = "healthy"; await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText(workspace.regulatoryNotice, { exact: true }).waitFor();
  assert.equal(requests, 3);
  console.log(JSON.stringify({ result: "PASS", kind: "actual-component-stub-transport-not-auth", assertions: 6, firstOnlyGets, allMalformedGets: 2, explicitHealthyRetry: true }));
} catch (error) {
  console.log(JSON.stringify({ result: "FAIL", safeErrorClass: ["TimeoutError", "AssertionError"].includes(error?.name) ? error.name : "Error", mode, requests })); process.exitCode = 1;
} finally { await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
