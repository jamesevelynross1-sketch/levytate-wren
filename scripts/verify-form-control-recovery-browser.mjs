/** Isolated actual-component check, not authentication or hosted acceptance.
 * Run with Node --import tsx and explicit local --browser / --playwright paths.
 * Uses fictional Lift fixture content and an aborted stub POST on loopback.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { buildLiftFixtureWorkspace } from "../lib/server/levytate-lift-fixtures.ts";

const { values } = parseArgs({ options: { browser: { type: "string" }, playwright: { type: "string" } }, strict: true });
assert(isAbsolute(values.browser ?? "") && isAbsolute(values.playwright ?? ""), "Explicit local browser and Playwright paths required");
const { chromium } = await import(pathToFileURL(values.playwright).href);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = { ...buildLiftFixtureWorkspace("Employee"), mutationRevision: 1 };
const bundle = await build({
  stdin: {
    contents: `import React from "react";import{createRoot}from"react-dom/client";
      import{LiftModule}from"./components/levytate-mvp/LiftModule";
      import{FormTextArea,FormSelect}from"./components/levytate-mvp/MvpUi";
      function Controls(){const[value,setValue]=React.useState(""),[choice,setChoice]=React.useState("First");
        return <section aria-label="Shared controls"><FormTextArea label="Shared reason" value={value} onChange={setValue}/>
          <FormSelect label="Shared choice" value={choice} options={["First","Second"]} onChange={setChoice}/></section>;}
      createRoot(document.getElementById("root")).render(<><Controls/><LiftModule initialWorkspace={${JSON.stringify(fixture)}}
        identity={{email:"fictional@example.test",organisationId:"fictional"}}/></>);`,
    resolveDir: root, loader: "tsx",
  },
  absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
});
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/bundle.js" ? bundle.outputFiles[0].text : '<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
});
let browser, release = () => {}, stage = "listen";
const observations = {};
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  stage = "launch";
  browser = await chromium.launch({ headless: true, executablePath: values.browser });
  const context = await browser.newContext({ serviceWorkers: "block" }), page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", error => errors.push(["Error", "TypeError"].includes(error.name) ? error.name : "Error"));
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  stage = "shared-controls";
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const controls = page.getByRole("region", { name: "Shared controls", exact: true });
  const shared = controls.getByRole("textbox", { name: "Shared reason", exact: true });
  const choice = controls.getByRole("combobox", { name: "Shared choice", exact: true });
  await shared.waitFor();
  observations.sharedBefore = { textareaLabel: await controls.getByLabel("Shared reason", { exact: true }).count(), textareaRole: await shared.count(), selectLabel: await controls.getByLabel("Shared choice", { exact: true }).count(), selectRole: await choice.count() };
  await shared.fill("First synthetic text");
  observations.sharedFilled = { textareaLabel: await controls.getByLabel("Shared reason", { exact: true }).count(), textareaRole: await shared.count() };
  await shared.fill("Second synthetic text");
  await choice.selectOption("Second");
  observations.sharedAfter = { refillRetained: await shared.inputValue() === "Second synthetic text", selected: await choice.inputValue() === "Second" };
  assert.equal(observations.sharedBefore.textareaRole, 1);
  assert.equal(observations.sharedFilled.textareaRole, 1);
  assert.equal(observations.sharedBefore.selectRole, 1);
  assert.equal(observations.sharedAfter.refillRetained, true);
  assert.equal(observations.sharedAfter.selected, true);

  stage = "lift-fill";
  const label = page.getByLabel("Your context or clarification", { exact: true });
  const role = page.getByRole("textbox", { name: "Your context or clarification", exact: true, includeHidden: true });
  observations.liftBefore = { labelCount: await label.count(), roleCount: await role.count() };
  const text = "Synthetic retained selector probe";
  await role.fill(text);
  observations.liftFilled = { labelCount: await label.count(), roleCount: await role.count() };
  let mark;
  const held = new Promise(resolve => { mark = resolve; }), gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/levytate-lift", async route => { mark(); await gate; await route.abort(); });
  stage = "lift-pending";
  await page.getByRole("button", { name: "Record my context", exact: true }).click();
  let timer;
  try { await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Stub request missing")), 5000); })]); }
  finally { clearTimeout(timer); }
  observations.pending = { labelCount: await label.count(), roleCount: await role.count(), valueRetained: await role.inputValue() === text, disabled: await role.isDisabled() };
  release();
  stage = "lift-failed-response";
  await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).waitFor();
  observations.failed = { labelCount: await label.count(), roleCount: await role.count(), valueRetained: await role.inputValue() === text, disabled: await role.isDisabled() };
  for (const observation of [observations.pending, observations.failed]) {
    assert.equal(observation.roleCount, 1);
    assert.equal(observation.valueRetained, true);
    assert.equal(observation.disabled, true);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", kind: "isolated-actual-components-stub-transport-not-auth", assertions: 12, observations }));
  await context.close();
} catch (cause) {
  console.log(JSON.stringify({ result: "FAIL", safeStage: stage, safeErrorClass: ["TimeoutError", "TypeError"].includes(cause?.name) ? cause.name : "Error", observations }));
  process.exitCode = 1;
} finally {
  release();
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
