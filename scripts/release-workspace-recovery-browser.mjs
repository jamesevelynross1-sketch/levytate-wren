/** Bounded LOCAL browser challenge. The runtime owner supplies genuine contexts
 * and an own Draft/More-information-requested form with its required answers.
 * No sessions, commands, callbacks, private answers or response bodies are logged
 * or persisted. The caller owns normal logout/close cleanup, including failures.
 * Leaves this application awaiting its distinct manager's review on success.
 */
import { randomUUID } from "node:crypto";

const endpoint = "/api/levytate-workspace";
const reasonLabel = "Why are you interested in this programme?";
const recoveryName = "Update awaiting confirmation";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function local(value) { const url = new URL(value); if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error("Local acceptance origin required"); return url.origin; }

export async function verifyWorkspaceRecovery({ app: origin, applicant, applicationId, backend, check, mailpit, waitForCapturedLink }) {
  const app = local(origin), capture = local(mailpit);
  const { context, page, user, tenant } = applicant;
  if (!uuid.test(tenant.id) || !/^[a-z0-9_-]+$/i.test(applicationId) || !/^release\.[a-f0-9-]+\.[ab]\.[a-z-]+@example\.test$/i.test(user.email) || !["Employee", "Line Manager"].includes(user.role) || new URL(page.url()).origin !== app) throw new Error("Reviewed fictional own applicant required");
  const report = (label, condition) => { check(`${user.role} workspace recovery: ${label}`, Boolean(condition)); if (!condition) throw new Error(`Workspace recovery check failed: ${label}`); };
  const predicate = response => new URL(response.url()).pathname === endpoint && response.request().method() === "POST";
  const pattern = "**/api/levytate-workspace";
  const snapshot = async () => {
    const query = `organisation_id=eq.${tenant.id}&application_id=eq.${encodeURIComponent(applicationId)}`;
    const [applications, history, receipts, audit] = await Promise.all([
      backend(`rest/v1/levytate_applications?organisation_id=eq.${tenant.id}&id=eq.${encodeURIComponent(applicationId)}&select=id,employee_id,status,revision,reason`),
      backend(`rest/v1/levytate_application_history?${query}&select=id`),
      backend(`rest/v1/levytate_application_command_receipts?${query}&select=idempotency_key`),
      backend(`rest/v1/levytate_audit_events?organisation_id=eq.${tenant.id}&entity_type=eq.application&entity_id=eq.${encodeURIComponent(applicationId)}&select=id`),
    ]);
    report("database observation has exactly one own application", applications.length === 1 && applications[0].employee_id === user.personId);
    return { row: applications[0], history: history.length, receipts: receipts.length, audit: audit.length };
  };
  const same = (left, right) => left.row.revision === right.row.revision && left.row.status === right.row.status && left.row.reason === right.row.reason && left.history === right.history && left.receipts === right.receipts && left.audit === right.audit;
  const before = await snapshot();
  report("starts from a genuinely editable own application", ["Draft", "More information requested"].includes(before.row.status));
  const reason = page.getByLabel(reasonLabel, { exact: true });
  const originalAnswer = `Synthetic retained answer ${randomUUID()}`;
  await reason.fill(originalAnswer);
  let originalDraft, upstreamError, intercepted = false;
  const malformed = async route => {
    const request = route.request();
    if (!intercepted && request.method() === "POST" && request.postDataJSON()?.type === "saveApplication" && request.postDataJSON()?.application?.id === applicationId) {
      intercepted = true; originalDraft = request.postData();
      try {
        const response = await route.fetch();
        if (response.status() !== 200 || (await response.json()).ok !== true) throw new Error("Original draft did not commit successfully");
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace: { meta: {}, data: {} } }) });
      } catch { upstreamError = true; await route.abort(); }
    } else await route.continue();
  };
  await page.route(pattern, malformed);
  try { await page.getByRole("button", { name: "Save draft", exact: true }).click(); await page.getByRole("dialog", { name: recoveryName, exact: true }).waitFor(); }
  finally { await page.unroute(pattern, malformed); }
  report("malformed200 follows a real successful draft commit", intercepted && !upstreamError);
  const saved = await snapshot();
  report("draft commits once despite rejected response", saved.row.reason === originalAnswer && saved.row.revision === before.row.revision + 1 && saved.history === before.history + 1 && saved.receipts === before.receipts + 1 && saved.audit === before.audit + 1);
  report("bad200 keeps original answers and freezes editing", (await reason.inputValue()) === originalAnswer && await reason.isDisabled());
  let recovery = page.getByRole("dialog", { name: recoveryName, exact: true });
  const draftReplay = page.waitForResponse(predicate);
  await recovery.getByRole("button", { name: "Retry original update", exact: true }).click();
  const confirmedDraft = await draftReplay;
  report("draft retry uses byte-identical original body", confirmedDraft.status() === 200 && confirmedDraft.request().postData() === originalDraft);
  await recovery.waitFor({ state: "hidden" });
  report("confirmed draft retry creates no duplicate revision, history, receipt or audit", same(saved, await snapshot()));

  let originalSubmit, logoutStatus, committed = false;
  const expireAfterCommit = async route => {
    const request = route.request();
    if (!committed && request.method() === "POST" && request.postDataJSON()?.type === "saveApplication" && request.postDataJSON()?.application?.id === applicationId && request.postDataJSON()?.application?.status === "Submitted to Line Manager") {
      committed = true; originalSubmit = request.postData();
      try {
        const response = await route.fetch();
        if (response.status() !== 200 || (await response.json()).ok !== true) throw new Error("Original submission did not commit successfully");
        // Revoke the actual provider session and clear the genuine browser jar.
        // The automatic refresh below must fail for real, not a mocked endpoint.
        logoutStatus = (await context.request.post(`${app}/api/levytate-beta-logout`, { headers: { Origin: app }, maxRedirects: 0 })).status();
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Sign in to continue." }) });
      } catch { upstreamError = true; await route.abort(); }
    } else await route.continue();
  };
  const expiredRefresh = page.waitForResponse(response => new URL(response.url()).pathname === "/api/levytate-auth/session" && response.request().method() === "POST");
  await page.route(pattern, expireAfterCommit);
  try { await page.getByRole("button", { name: /^(Submit to line manager|Submit application|Respond and resubmit)$/, exact: true }).click(); await recovery.waitFor(); }
  finally { await page.unroute(pattern, expireAfterCommit); }
  report("submission commits before genuine logout and refresh denial", committed && !upstreamError && logoutStatus === 303 && (await expiredRefresh).status() === 401);
  const submitted = await snapshot();
  report("submitted outcome persists exactly once before session recovery", ["Awaiting Manager Review", "Submitted to Line Manager"].includes(submitted.row.status) && submitted.row.revision === saved.row.revision + 1 && submitted.history === saved.history + 1 && submitted.receipts === saved.receipts + 1 && submitted.audit === saved.audit + 1);
  report("expired session still retains the original form", await reason.isDisabled() && (await reason.inputValue()) === originalAnswer);
  report("recovery dialog exposes sign-in and reconnect without dismissing retained update", await recovery.getByRole("button", { name: "Sign in in new tab", exact: true }).count() === 1 && await recovery.getByRole("button", { name: "Reconnect workspace", exact: true }).count() === 1);

  const popup = context.waitForEvent("page");
  await recovery.getByRole("button", { name: "Sign in in new tab", exact: true }).click();
  const login = await popup;
  try {
    await login.getByLabel("Work email", { exact: true }).fill(user.email);
    const after = Date.now();
    const requested = login.waitForResponse(response => new URL(response.url()).pathname === "/api/levytate-auth/request" && response.request().method() === "POST");
    await login.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
    const response = await requested;
    if (response.status() === 429) throw new Error("BLOCKED: natural authentication rate budget reached; no reset permitted");
    report("retained form signs in again through actual captured email route", response.status() === 200);
    await login.goto(await waitForCapturedLink(capture, user.email, app, after));
    await login.waitForURL(url => url.origin === app && url.pathname.includes("/app"));
    const reconnected = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === "GET");
    await recovery.getByRole("button", { name: "Reconnect workspace", exact: true }).click();
    const read = await reconnected;
    const actual = (await read.json()).workspace;
    report("visible reconnect reads genuine same-account submitted state", read.status() === 200 && actual.meta?.userEmail === user.email && actual.meta.organisationId === tenant.id && actual.data.applications.some(row => row.id === applicationId && ["Awaiting Manager Review", "Submitted to Line Manager"].includes(row.status)));
    // The application is now read-only, but its exact retained receipt must be
    // recoverable. A fresh edited command would still be denied by the server.
    await page.getByText(originalAnswer, { exact: true }).waitFor();
    report("pending update stays open after reconnect", await recovery.isVisible());
    const submitReplay = page.waitForResponse(predicate);
    await recovery.getByRole("button", { name: "Retry original update", exact: true }).click();
    const confirmation = await submitReplay;
    report("post-reconnect retry sends the exact original revision and body", confirmation.status() === 200 && confirmation.request().postData() === originalSubmit);
    await recovery.waitFor({ state: "hidden" });
    report("confirmed submission receipt creates no duplicate revision, history, receipt or audit", same(submitted, await snapshot()));
    await page.reload();
    await page.getByRole("heading", { name: "My application", exact: true }).waitFor();
    await page.getByText(originalAnswer, { exact: true }).waitFor();
    report("recorded answers survive refresh after successful genuine recovery", (await snapshot()).row.reason === originalAnswer && await page.getByText(originalAnswer, { exact: true }).count() === 1);
  } finally { await login.close(); }
  return { applicationId, status: submitted.row.status, revision: submitted.row.revision };
}
