/** Genuine authenticated account UI checks. All new accounts remain uninvited. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
function authCount(email) {
  if (!/^release\.[a-f0-9-]+\.a\.[a-z-]+@example\.test$/.test(email)) throw new Error("Synthetic account required");
  const root = process.env.RELEASE_LOCAL_RUNTIME;
  if (!root?.startsWith("/private/tmp/levytate-release-runtime.")) throw new Error("Local runtime required");
  const db = new URL(JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8")).env.DB_URL);
  if (db.hostname !== "127.0.0.1") throw new Error("Loopback only");
  const r = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { input: `select count(*) from auth.users where email='${email}';`, encoding: "utf8", env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) } });
  if (r.status) throw new Error("Local account observation unavailable"); return Number(r.stdout.trim());
}
const formOn = page => page.locator("form").filter({ has: page.getByRole("button", { name: "Prepare account", exact: true }) });
export async function verifyAccountPreparation({ app, manifest, contexts, backend, check }) {
  const lead = contexts.get("a:lead"), other = contexts.get("b:lead"), page = lead.page;
  const endpoint = `${app}/api/levytate-workspace/invitations`;
  const denied = await lead.context.request.get(endpoint, { headers: { "X-LevyTate-Account": other.user.email } });
  check("account listing rejects a different retained account fingerprint", denied.status() === 409);
  for (const key of ["a:employee", "a:manager"]) check(`${key}: cannot list individual account administration`, (await contexts.get(key).context.request.get(endpoint)).status() === 403);
  await page.goto(`${app}/levytate/app?module=People`);
  await page.getByRole("heading", { name: "Individual account access", exact: true }).waitFor();
  const form = formOn(page), email = `release.${manifest.run}.a.prepared@example.test`;
  await form.getByLabel("Name", { exact: true }).fill("Synthetic prepared account");
  await form.getByLabel("Work email", { exact: true }).fill(email);
  await form.getByLabel("Account role", { exact: true }).selectOption("Apprenticeship Lead");
  let intercepted = false;
  const disconnect = async route => {
    if (!intercepted && route.request().method() === "POST" && route.request().postDataJSON()?.action === "provision_user") {
      intercepted = true; const response = await route.fetch();
      if (response.status() !== 200) throw new Error("Account preparation failed before simulated response loss");
      await route.abort("connectionreset");
    } else await route.continue();
  };
  await page.route("**/api/levytate-workspace/invitations", disconnect);
  try { await form.getByRole("button", { name: "Prepare account", exact: true }).click(); await page.getByRole("alert").filter({ hasText: /failed|confirmed|fetch|network/i }).first().waitFor(); }
  finally { await page.unroute("**/api/levytate-workspace/invitations", disconnect); }
  const persisted = await backend(`rest/v1/levytate_users?organisation_id=eq.${lead.tenant.id}&email=eq.${encodeURIComponent(email)}&select=id,active,invitation_status,invitation_generation`);
  check("lost account response retains one pending membership and no Auth identity", intercepted && persisted.length === 1 && !persisted[0].active && persisted[0].invitation_status === "not_requested" && authCount(email) === 0);
  const retryResponse = page.waitForResponse(r => r.url() === endpoint && r.request().method() === "POST");
  await form.getByRole("button", { name: "Prepare account", exact: true }).click();
  check("UI retry confirms original prepared membership", (await retryResponse).status() === 200);
  await page.getByText("Synthetic prepared account", { exact: true }).waitFor();
  await page.reload(); await page.getByText("Synthetic prepared account", { exact: true }).waitFor();
  const after = await backend(`rest/v1/levytate_users?email=eq.${encodeURIComponent(email)}&select=id`);
  check("prepared account survives refresh without duplicate membership or email activation", after.length === 1 && after[0].id === persisted[0].id && authCount(email) === 0);
  const foreign = await other.context.request.post(endpoint, { headers: { Origin: app }, data: { action: "revoke_user", userId: persisted[0].id, requestId: randomUUID(), expectedGeneration: 0, role: "Apprenticeship Lead" } });
  check("other tenant cannot revoke prepared membership", [403, 404].includes(foreign.status()));
}
export async function verifyRetainedAccountSwitch({ app, mailpit, manifest, contexts, backend, waitForCapturedLink, check }) {
  const lead = contexts.get("a:lead"), other = contexts.get("b:lead"), page = lead.page;
  await page.goto(`${app}/levytate/app?module=People`);
  await page.getByRole("heading", { name: "Individual account access", exact: true }).waitFor();
  const form = formOn(page), email = `release.${manifest.run}.a.retained@example.test`;
  await form.getByLabel("Name", { exact: true }).fill("Synthetic retained account draft");
  await form.getByLabel("Work email", { exact: true }).fill(email);
  await form.getByLabel("Account role", { exact: true }).selectOption("Apprenticeship Lead");
  check("genuine logout leaves a retained unsent account form", (await lead.context.request.post(`${app}/api/levytate-beta-logout`, { headers: { Origin: app }, maxRedirects: 0 })).status() === 303);
  const login = await lead.context.newPage();
  await login.goto(`${app}/levytate/login`);
  const after = Date.now();
  await login.getByLabel("Work email", { exact: true }).fill(other.user.email);
  const requested = login.waitForResponse(r => new URL(r.url()).pathname === "/api/levytate-auth/request" && r.request().method() === "POST");
  await login.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
  const response = await requested;
  if (response.status() === 429) throw new Error("BLOCKED: genuine local authentication rate budget reached; wait without changing limiter");
  check("replacement account uses a genuine sign-in request", response.status() === 200);
  const link = await waitForCapturedLink(mailpit, other.user.email, app, after);
  await login.goto(link); await login.waitForURL(url => url.pathname.includes("/app"));
  const workspace = await lead.context.request.get(`${app}/api/levytate-workspace`);
  check("same browser cookie jar now resolves the other genuine tenant", (await workspace.json()).workspace?.meta?.organisationId === other.tenant.id);
  const submitted = page.waitForResponse(r => new URL(r.url()).pathname === "/api/levytate-workspace/invitations" && r.request().method() === "POST");
  await form.getByRole("button", { name: "Prepare account", exact: true }).click();
  check("retained old account draft receives409 after actual account switch", (await submitted).status() === 409);
  check("stale account draft creates no membership in either tenant and no Auth identity", (await backend(`rest/v1/levytate_users?email=eq.${encodeURIComponent(email)}&select=id`)).length === 0 && authCount(email) === 0);
  await login.close();
}
