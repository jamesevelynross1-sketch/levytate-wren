/** Genuine local application lifecycle acceptance. Authentication tokens and
 * private recipient keys stay in process memory; no traces, screenshots, saved
 * sessions, password sign-in, generated links or cookie injection are used.
 * Called only by the runtime owner's locked browser acceptance orchestrator.
 */
import { createHash, randomUUID, generateKeyPairSync, privateDecrypt, constants, createDecipheriv } from "node:crypto";
import { assertLifecycleManifest } from "./release-lifecycle-fixtures.mjs";
import { localUrl } from "./release-local-fixtures.mjs";
const endpoint = "/api/levytate-platform/offboarding";
const classes = ["Identity and access", "People", "Applications", "Learner records", "Finance", "Programmes and providers", "Uploaded files", "Assessments", "Lift", "Private support", "Audit evidence"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const localMinute = (offset) => new Date(Date.now() + offset).toISOString().slice(0, 16);
async function downloadJson(download) {
  try {
    const stream = await download.createReadStream(); if (!stream) throw new Error("Download unavailable");
    const chunks = []; let size = 0;
    for await (const chunk of stream) { size += chunk.length; if (size > 24 * 1024 * 1024) throw new Error("Bounded lifecycle download required"); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await download.delete(); }
}
export async function verifyLifecycle({ app: value, mailpit: mailValue, browser, manifest, extension, backend, waitForCapturedLink, check }) {
  const app = localUrl(value, "lifecycle app"), mailpit = localUrl(mailValue, "lifecycle capture");
  const plan = assertLifecycleManifest(extension, manifest.run, true), actors = new Map();
  let phase = "normal sign-in";
  const report = (label, condition) => check(`Lifecycle: ${label}`, condition);
  const headers = (actor) => ({ Origin: app, "X-LevyTate-Account": actor.user.email, "X-LevyTate-Organisation": actor.user.organisationId });
  const post = (actor, data) => actor.context.request.post(`${app}${endpoint}`, { headers: headers(actor), data });
  const read = async (actor) => { const response = await actor.context.request.get(`${app}${endpoint}`, { headers: headers(actor) }); if (response.status() !== 200) throw new Error("Lifecycle state unavailable"); return response.json(); };
  const fixtureMailCount = async () => { const list = await fetch(`${mailpit}/api/v1/messages`).then((response) => response.json()); return (list.messages ?? []).filter((item) => item.To?.some((to) => plan.users.some((user) => user.email === to.Address))).length; };
  async function reload(actor) {
    await actor.page.goto(`${app}/levytate/app?module=Home`);
    await actor.page.getByRole("heading", { name: "Employer workspace support", exact: true }).waitFor();
    await actor.page.getByRole("button", { name: "Refresh cases", exact: true }).waitFor();
  }
  function caseCard(actor, id) { return actor.page.locator("article").filter({ hasText: `Case ${id}.` }); }
  async function action(actor, id, name, configure, downloaded = false) {
    await caseCard(actor, id).getByRole("button", { name, exact: true }).click();
    const dialog = actor.page.getByRole("dialog");
    if (configure) await configure(dialog);
    const response = actor.page.waitForResponse((item) => new URL(item.url()).pathname === endpoint && item.request().method() === "POST");
    const file = downloaded ? actor.page.waitForEvent("download") : null;
    await dialog.getByRole("button", { name: "Confirm recorded action", exact: true }).click();
    const result = await response; report(`${name} is confirmed by application API`, result.status() === 200);
    if (file) return downloadJson(await file);
    return result.json();
  }
  async function suspend(actor) {
    await reload(actor);
    const card = actor.page.locator("article").filter({ hasText: plan.target.name }).filter({ has: actor.page.getByRole("button", { name: "Suspend employer", exact: true }) });
    await card.getByRole("button", { name: "Suspend employer", exact: true }).click();
    const dialog = actor.page.getByRole("dialog");
    await dialog.getByLabel("Reason for suspension", { exact: true }).fill(`Synthetic isolated lifecycle acceptance ${plan.run}`);
    const response = actor.page.waitForResponse((item) => new URL(item.url()).pathname === "/api/levytate-platform/workspaces" && item.request().method() === "POST");
    await dialog.getByRole("button", { name: "Confirm suspension", exact: true }).click();
    report("Platform Admin UI suspends only the owned target", (await response).status() === 200);
    report("suspension is durable", (await backend(`rest/v1/levytate_organisations?id=eq.${plan.target.id}&select=status`))[0]?.status === "Suspended");
  }
  try {
    for (const user of plan.users) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "UTC", acceptDownloads: true });
      const page = await context.newPage(); page.setDefaultTimeout(20000); const actor = { context, page, user }; actors.set(user.key, actor);
      await page.goto(`${app}/levytate/login`); const after = Date.now();
      await page.getByLabel("Work email", { exact: true }).fill(user.email);
      const requested = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/levytate-auth/request" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
      const requestResponse = await requested;
      if (requestResponse.status() === 429) throw new Error("BLOCKED: natural authentication rate budget not yet available");
      report(`${user.key} public sign-in request accepted`, requestResponse.status() === 200);
      await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
      const link = await waitForCapturedLink(mailpit, user.email, app, after);
      const callback = page.waitForResponse((response) => new URL(response.url()).pathname === "/levytate/auth/callback");
      await page.goto(link);
      const cookieHeaders = (await (await callback).headersArray()).filter((header) => header.name.toLowerCase() === "set-cookie" && !/Max-Age=0/i.test(header.value));
      if (new URL(page.url()).pathname === "/levytate/accept-terms") {
        report("only the employer Lead accepts its synthetic terms", user.key === "member");
        await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Accept Early Access Terms", exact: true }).click();
        await page.waitForURL((url) => url.pathname.includes("/app"));
      }
      report(`${user.key} callback stays on the application origin`, new URL(page.url()).origin === app && new URL(page.url()).pathname.includes("/app"));
      const cookies = (await context.cookies()).filter((cookie) => /^levytate_(beta_session|auth_access|auth_refresh)$/.test(cookie.name));
      report(`${user.key} receives genuine HttpOnly host-only cookies`, cookies.length === 3 && cookies.every((cookie) => cookie.httpOnly && cookie.domain === new URL(app).hostname && cookie.path === "/") && cookieHeaders.every((header) => !/Domain=/i.test(header.value)));
      const response = await context.request.get(`${app}/api/levytate-workspace`, { headers: headers(actor) }), payload = await response.json();
      report(`${user.key} resolves its distinct canonical role and tenant`, response.status() === 200 && payload.workspace?.meta?.userRole === user.role && payload.workspace.meta.organisationId === user.organisationId);
      await page.reload(); report(`${user.key} survives a browser refresh`, (await context.request.get(`${app}/api/levytate-workspace`, { headers: headers(actor) })).status() === 200);
      report(`${user.key} refreshes its real provider session`, (await context.request.post(`${app}/api/levytate-auth/session`, { headers: headers(actor) })).status() === 200);
    }
    const a = actors.get("admin-a"), b = actors.get("admin-b"), member = actors.get("member");
    const initialMailCount = await fixtureMailCount();
    const initialOther = await backend(`rest/v1/levytate_organisations?id=eq.${manifest.tenants[1].id}&select=id,status,updated_at`);
    phase = "role denial and suspension";
    report("employer Lead cannot read platform lifecycle cases", (await member.context.request.get(`${app}${endpoint}`, { headers: headers(member) })).status() === 403);
    report("retained administrator form cannot switch accounts", (await a.context.request.get(`${app}${endpoint}`, { headers: { ...headers(a), "X-LevyTate-Account": b.user.email } })).status() === 409);
    await suspend(a);
    report("previous employer application session is denied after suspension", (await member.context.request.get(`${app}/api/levytate-workspace`)).status() === 401);
    phase = "reactivation request lost response";
    await a.page.getByRole("button", { name: "Request reactivation", exact: true }).click();
    const draft = a.page.getByRole("dialog");
    await draft.getByLabel("Suspended employer", { exact: true }).selectOption(plan.target.id);
    for (const label of ["Approved reactivation reference", "Approved client notice reference", "Support handover reference", "Recovery boundary reference"]) await draft.getByLabel(label, { exact: true }).fill(`synthetic-reviewed-${plan.run}`);
    let originalHash, attempts = 0, reactivationId;
    const intercept = async (route) => {
      const request = route.request(); if (request.method() !== "POST" || request.postDataJSON()?.action !== "request_reactivation") return route.continue();
      const body = request.postData(); attempts++; if (!originalHash) { originalHash = hash(body); reactivationId = request.postDataJSON().reactivationId; }
      report("reactivation retry preserves exact original command", hash(body) === originalHash);
      if (attempts === 1) { const committed = await route.fetch(); report("lost response follows a real committed request", committed.status() === 200); return route.abort("failed"); }
      return route.continue();
    };
    await a.page.route(`**${endpoint}`, intercept);
    await draft.getByRole("button", { name: "Record request", exact: true }).click();
    await draft.getByRole("button", { name: "Retry original request", exact: true }).waitFor();
    report("uncertain reactivation locks the reviewed form", await draft.getByLabel("Approved reactivation reference", { exact: true }).isDisabled());
    const retryResponse = a.page.waitForResponse((item) => new URL(item.url()).pathname === endpoint && item.request().method() === "POST");
    const retryDownload = a.page.waitForEvent("download");
    await draft.getByRole("button", { name: "Retry original request", exact: true }).click();
    report("reactivation replay confirms the durable request", (await retryResponse).status() === 200 && attempts === 2); await (await retryDownload).delete();
    await a.page.unroute(`**${endpoint}`, intercept);
    report("requester cannot approve their own reactivation", (await post(a, { action: "approve_reactivation", reactivationId, requestId: randomUUID(), approvalReference: `synthetic-self-${plan.run}` })).status() === 403);
    phase = "independent reactivation approval";
    await reload(b);
    const approval = b.page.locator("article").filter({ hasText: plan.target.name }).filter({ has: b.page.getByRole("button", { name: "Independently approve", exact: true }) });
    await approval.getByRole("button", { name: "Independently approve", exact: true }).click();
    await b.page.getByRole("dialog").getByLabel("Approved reactivation reference", { exact: true }).fill(`synthetic-independent-${plan.run}`);
    const approvedResponse = b.page.waitForResponse((item) => new URL(item.url()).pathname === endpoint && item.request().method() === "POST"), approvalDownload = b.page.waitForEvent("download");
    await b.page.getByRole("button", { name: "Approve controlled reactivation", exact: true }).click();
    report("a different genuine administrator approves reactivation through UI", (await approvedResponse).status() === 200); await (await approvalDownload).delete();
    report("reactivated organisation is Active", (await backend(`rest/v1/levytate_organisations?id=eq.${plan.target.id}&select=status`))[0]?.status === "Active");
    const revoked = (await backend(`rest/v1/levytate_users?id=eq.${member.user.membershipId}&select=active,auth_subject,auth_binding_status,invitation_status`))[0];
    report("reactivation does not restore old access or invitation credentials", revoked?.active === false && revoked.auth_subject === null && revoked.auth_binding_status === "pending" && revoked.invitation_status === "revoked");
    report("old genuine session remains denied after reactivation", (await member.context.request.get(`${app}/api/levytate-workspace`)).status() === 401);
    phase = "structured disposal request";
    await suspend(a);
    const keys = generateKeyPairSync("rsa", { modulusLength: 3072 });
    await a.page.getByRole("button", { name: "Request lifecycle case", exact: true }).click();
    const requestDialog = a.page.getByRole("dialog");
    await requestDialog.getByLabel("Suspended employer", { exact: true }).selectOption(plan.target.id);
    await requestDialog.getByLabel("Purpose", { exact: true }).selectOption("delete");
    await requestDialog.getByLabel("Export expiry (your local time, within seven days)", { exact: true }).fill(localMinute(3600_000));
    await requestDialog.getByLabel("Data owner", { exact: true }).selectOption(a.user.membershipId);
    await requestDialog.getByLabel("Service owner", { exact: true }).selectOption(b.user.membershipId);
    for (const label of ["Retention policy approval reference", "Approved client notice reference", "Support handover reference", "Recovery and irreversibility boundary reference"]) await requestDialog.getByLabel(label, { exact: true }).fill(`synthetic-approved-${plan.run}`);
    await requestDialog.getByLabel("Retain lifecycle evidence until (your local time)", { exact: true }).fill(localMinute(86400_000));
    for (const label of classes) {
      await requestDialog.getByLabel(`${label} action`, { exact: true }).selectOption("delete");
      await requestDialog.getByLabel(`${label} retain until (local time)`, { exact: true }).fill(localMinute(-86400_000));
      await requestDialog.getByLabel(`${label} schedule approval reference`, { exact: true }).fill(`synthetic-schedule-${plan.run}`);
    }
    await requestDialog.getByLabel("Recipient RSA public key (3072 bits or stronger)", { exact: true }).fill(keys.publicKey.export({ type: "spki", format: "pem" }).toString());
    const requestedCase = a.page.waitForResponse((item) => new URL(item.url()).pathname === endpoint && item.request().method() === "POST");
    await requestDialog.getByRole("button", { name: "Request independent approval", exact: true }).click();
    report("structured policy creates a real lifecycle case", (await requestedCase).status() === 200);
    let current = (await read(a)).cases.find((item) => item.tenant_id === plan.target.id && item.status === "requested");
    report("all eleven explicit class decisions and distinct owners are retained", current?.policy?.schedules?.length === 11 && current.policy.dataOwnerUserId === a.user.membershipId && current.policy.serviceOwnerUserId === b.user.membershipId);
    const caseId = current.id;
    report("requester cannot approve their own disposal", (await post(a, { action: "approve", caseId, requestId: randomUUID(), expectedRevision: current.revision, approvalReference: `synthetic-self-${plan.run}` })).status() === 403);
    await reload(b); await action(b, caseId, "approve", (dialog) => dialog.getByLabel("Approved evidence reference", { exact: true }).fill(`synthetic-second-approval-${plan.run}`));
    phase = "encrypted export and delivery";
    await reload(a); await action(a, caseId, "export");
    const envelope = await action(a, caseId, "download", undefined, true);
    const key = privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64")); decipher.setAAD(Buffer.from(`${envelope.manifestSha256}\n${envelope.expiresAt}`)); decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]); key.fill(0);
    try {
      const contents = plaintext.toString("utf8");
      report("recipient decrypts owned fictional Storage bytes", contents.includes(Buffer.from("Synthetic lifecycle browser evidence\n").toString("base64")));
      report("encrypted export excludes other tenant and Auth subjects", !contents.includes(manifest.tenants[1].id) && plan.users.every((user) => !contents.includes(user.authSubject)));
    } finally { plaintext.fill(0); }
    await action(a, caseId, "record delivery", (dialog) => dialog.getByLabel("Approved evidence reference", { exact: true }).fill(`synthetic-recipient-decryption-confirmed-${plan.run}`));
    phase = "hold and guarded disposal";
    current = (await read(a)).cases.find((item) => item.id === caseId);
    report("a legal hold is recorded", (await post(a, { action: "hold", caseId, requestId: randomUUID(), expectedRevision: current.revision, active: true, reference: `synthetic-hold-${plan.run}` })).status() === 200);
    current = (await read(a)).cases.find((item) => item.id === caseId);
    report("hold denies disposal even to the independent approver", (await post(b, { action: "execute_delete", caseId, requestId: randomUUID(), expectedRevision: current.revision })).status() === 409);
    report("independent current approver can release the recorded hold", (await post(b, { action: "hold", caseId, requestId: randomUUID(), expectedRevision: current.revision, active: false, reference: `synthetic-independent-release-${plan.run}` })).status() === 200);
    await reload(b);
    const evidence = await action(b, caseId, "Execute approved disposal", (dialog) => dialog.getByRole("checkbox").check(), true);
    report("application returns signed completion evidence", typeof evidence.signature?.value === "string" && evidence.signature.value.length > 20);
    report("owned tenant is durably absent", (await backend(`rest/v1/levytate_organisations?id=eq.${plan.target.id}&select=id`)).length === 0);
    let removed = false; try { await backend(`auth/v1/admin/users/${member.user.authSubject}`); } catch (error) { if (!error.message.includes("(404)")) throw new Error("Auth removal check unavailable"); removed = true; }
    report("exclusive target Auth identity is removed through provider API", removed);
    report("other employer remains unchanged", JSON.stringify(initialOther) === JSON.stringify(await backend(`rest/v1/levytate_organisations?id=eq.${manifest.tenants[1].id}&select=id,status,updated_at`)));
    report("deleted organisation cannot be reactivated", [403,404,409].includes((await post(a, { action: "request_reactivation", requestId: randomUUID(), reactivationId: randomUUID(), organisationId: plan.target.id, approvalReference: `synthetic-terminal-${plan.run}`, clientNoticeReference: "synthetic-notice", supportHandoverReference: "synthetic-support", recoveryBoundaryReference: "synthetic-terminal" })).status()));
    report("lifecycle operations deliver no additional email", await fixtureMailCount() === initialMailCount);
    phase = "administrator logout";
    for (const actor of [a,b]) { await actor.context.request.post(`${app}/api/levytate-beta-logout`, { headers: headers(actor), maxRedirects: 0 }); report(`${actor.user.key} logout ends its real session`, (await actor.context.request.get(`${app}/api/levytate-workspace`)).status() === 401); }
    return { fixtureRun: plan.run, caseId, reactivationId, result: "PASS", authentication: "public request, local signed Auth email hook, SMTP capture, application callback", physicalStorageInspection: "separate native backend inspection required" };
  } catch (error) {
    if (error.message === "BLOCKED: natural authentication rate budget not yet available") throw error;
    throw new Error(`Lifecycle browser acceptance failed during ${phase}; private authentication state omitted`);
  } finally {
    for (const actor of actors.values()) {
      try { await actor.context.request.post(`${app}/api/levytate-beta-logout`, { headers: headers(actor), maxRedirects: 0, timeout: 10000 }); } catch { /* Best effort only; never disclose an authentication response or URL. */ }
      try { await actor.context.close(); } catch { /* Cleanup must not replace the safely redacted acceptance failure. */ }
    }
  }
}
