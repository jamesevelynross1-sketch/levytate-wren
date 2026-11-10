/** LOCAL-only Lift recovery challenge, authored for the runtime owner's bounded
 * genuine browser run. Requires already-submitted independent perspectives and
 * a currently enabled synthetic tenant. Never creates identities, signs in,
 * changes capability flags, closes caller contexts or writes fixture SQL.
 * Private synthetic bodies remain in memory. Only check labels leave the helper.
 */
import { randomUUID } from "node:crypto";
import { localUrl } from "./release-local-fixtures.mjs";

export async function verifyLiftRecovery({ app: origin, manifest, contexts, backend, check }) {
  const app = localUrl(origin, "Lift recovery app"), endpoint = "/api/levytate-lift", pattern = `${app}${endpoint}`;
  const employee = contexts.get("a:employee"), manager = contexts.get("a:manager"), lead = contexts.get("a:lead"), other = contexts.get("b:employee");
  if (!manifest.synthetic || manifest.environment !== "local" || !/^[a-f0-9-]{36}$/.test(manifest.run) || employee?.user.role !== "Employee" || manager?.user.role !== "Line Manager" || lead?.user.role !== "Apprenticeship Lead" || other?.user.role !== "Employee" || employee.tenant.id === other.tenant.id || manager.tenant.id !== employee.tenant.id || lead.tenant.id !== employee.tenant.id) throw new Error("Reviewed four-role local Lift contexts required");
  const report = (label, condition) => { check(`Lift recovery: ${label}`, Boolean(condition)); if (!condition) throw new Error(`Lift recovery check failed: ${label}`); };
  const headers = actor => ({ Origin: app, "X-LevyTate-Account": actor.user.email, "X-LevyTate-Organisation": actor.tenant.id });
  for (const actor of [employee, manager, lead, other]) {
    const original = manifest.tenants.find(tenant => tenant.id === actor.tenant.id)?.users.find(user => user.membershipId === actor.user.membershipId);
    report(`${actor.tenant.key}:${actor.user.role} is the exact current-run fictional context`, original?.email === actor.user.email && original?.role === actor.user.role && original?.personId === actor.user.personId && new URL(actor.page.url()).origin === app);
    const response = await actor.context.request.get(`${app}/api/levytate-workspace`, { headers: headers(actor) });
    const current = (await response.json()).workspace?.meta;
    report(`${actor.tenant.key}:${actor.user.role} canonical account and employer still match`, response.status() === 200 && current?.userEmail === actor.user.email && current?.organisationId === actor.tenant.id && current?.userRole === actor.user.role);
  }
  const response = await employee.context.request.get(pattern, { headers: headers(employee) }), initial = (await response.json()).workspace;
  report("starts from an actual submitted assessment and released independent observation", response.status() === 200 && initial?.role === "Employee" && initial.assessment?.status === "submitted" && /^[a-f0-9-]{36}$/i.test(initial.assessment.releasedManagerObservation?.id ?? ""));
  const observationId = initial.assessment.releasedManagerObservation.id;
  report("other employer remains unavailable for Lift", (await other.context.request.get(pattern, { headers: headers(other) })).status() === 404);
  const tenantSnapshot = async tenantId => {
    const [entries, receipts, versions, audit] = await Promise.all([
      backend(`rest/v1/levytate_lift_employee_observation_contexts?organisation_id=eq.${tenantId}&select=id,observation_id,employee_id,context,disputed,created_by&order=id`),
      backend(`rest/v1/levytate_lift_command_receipts?organisation_id=eq.${tenantId}&select=actor_user_id,request_id&order=request_id`),
      backend(`rest/v1/levytate_lift_workspace_revisions?organisation_id=eq.${tenantId}&select=revision`),
      backend(`rest/v1/levytate_audit_events?organisation_id=eq.${tenantId}&entity_type=eq.lift&select=id&order=id`),
    ]);
    return { entries, receipts, revision: Number(versions[0]?.revision ?? 0), audit };
  };
  const snapshot = () => tenantSnapshot(employee.tenant.id), otherBefore = await tenantSnapshot(other.tenant.id);
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const page = employee.page, viewport = page.viewportSize(), recovery = page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true });
  const field = () => page.getByLabel("Your context or clarification", { exact: true });
  let posts = 0; const recordedTexts = [];
  const count = request => { if (new URL(request.url()).pathname === endpoint && request.method() === "POST") posts++; };
  page.on("request", count);
  const readFault = body => async route => {
    if (route.request().method() === "GET") await route.fulfill(body);
    else await route.continue();
  };
  const malformedRead = readFault({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace: {} }) });
  const unavailableRead = readFault({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Synthetic temporary read failure." }) });
  try {
    const beforeRead = await snapshot();
    await page.route(pattern, malformedRead);
    try {
      await page.goto(`${app}/levytate/app?module=Assessments`);
      await page.getByRole("heading", { name: "Lift is unavailable", exact: true }).waitFor();
      report("malformed successful read shows unavailable and never manufactures an assessment", await page.getByTestId("lift-module").count() === 0 && posts === 0);
    } finally { await page.unroute(pattern, malformedRead); }
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await field().waitFor();
    report("read retry returns the actual persisted assessment without a write", same(beforeRead, await snapshot()) && posts === 0);

    for (const fault of ["lost", "malformed"]) {
      const text = `Fictional Lift recovery ${fault} ${randomUUID()}`, before = await snapshot();
      await field().fill(text);
      let command, intercepted = false, failed = false, release, markCommitted;
      const hold = new Promise(resolve => { release = resolve; });
      const committed = new Promise(resolve => { markCommitted = resolve; });
      const intercept = async route => {
        const request = route.request();
        if (intercepted || request.method() !== "POST" || request.postDataJSON()?.action !== "record_employee_context") { await route.continue(); return; }
        intercepted = true; command = request.postData();
        try {
          const value = request.postDataJSON(), pinned = request.headers();
          if (value.managerObservationId !== observationId || value.context !== text || value.expectedWorkspaceRevision !== before.revision || pinned["x-levytate-account"] !== employee.user.email || pinned["x-levytate-organisation"] !== employee.tenant.id) throw new Error("Unexpected owned Lift command");
          const upstream = await route.fetch(), body = await upstream.json();
          if (upstream.status() !== 200 || body.ok !== true || body.workspace?.mutationRevision !== before.revision + 1) throw new Error("Lift update did not commit");
          markCommitted(); await hold;
          if (fault === "lost") await route.abort();
          else { body.workspace.framework = {}; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }); }
        } catch { failed = true; markCommitted(); try { await route.abort(); } catch { /* caller owns cleanup */ } }
      };
      await page.route(pattern, intercept);
      try {
        await page.getByRole("button", { name: "Record my context", exact: true }).click();
        let timeout;
        try { await Promise.race([committed, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Lift commit observation timed out")), 30_000); })]); }
        finally { clearTimeout(timeout); }
        report(`${fault}: original command commits before the held response is released`, intercepted && !failed);
        report(`${fault}: in-flight original input remains unchanged and disabled`, await field().inputValue() === text && await field().isDisabled());
        const durable = await snapshot(), entry = durable.entries.filter(row => row.context === text);
        report(`${fault}: one owned context, receipt, revision and audit exist before response loss`, entry.length === 1 && entry[0].observation_id === observationId && entry[0].employee_id === employee.user.personId && entry[0].created_by === employee.user.membershipId && durable.entries.length === before.entries.length + 1 && durable.receipts.length === before.receipts.length + 1 && durable.revision === before.revision + 1 && durable.audit.length === before.audit.length + 1);
        release(); await recovery.waitFor();
        report(`${fault}: uncertain response retains original input without false success`, await field().inputValue() === text && await field().isDisabled());
        if (fault === "malformed") {
          await page.setViewportSize({ width: 390, height: 844 });
          const box = await recovery.boundingBox();
          report("mobile recovery dialog fits the viewport", box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845);
          await recovery.getByRole("button", { name: "Retry original update", exact: true }).focus();
          await page.keyboard.press("Tab");
          report("mobile keyboard focus stays within the top-layer recovery dialog", await recovery.evaluate(dialog => dialog.contains(document.activeElement)));
          const beforeReconnect = posts, reconnected = page.waitForResponse(value => new URL(value.url()).pathname === "/api/levytate-workspace" && value.request().method() === "GET");
          await recovery.getByRole("button", { name: "Reconnect workspace", exact: true }).focus();
          await page.keyboard.press("Enter");
          const fresh = await reconnected, meta = (await fresh.json()).workspace?.meta;
          report("keyboard reconnect reads the genuine same account without clearing or resending its pending command", fresh.status() === 200 && meta?.userEmail === employee.user.email && meta?.organisationId === employee.tenant.id && posts === beforeReconnect && await recovery.isVisible() && await field().isDisabled());
        }
        const retried = page.waitForResponse(value => new URL(value.url()).pathname === endpoint && value.request().method() === "POST");
        await recovery.getByRole("button", { name: "Retry original update", exact: true }).focus();
        await page.keyboard.press("Enter");
        const confirmation = await retried, request = confirmation.request(), pinned = request.headers();
        report(`${fault}: explicit keyboard retry sends original bytes and original account pins`, confirmation.status() === 200 && request.postData() === command && pinned["x-levytate-account"] === employee.user.email && pinned["x-levytate-organisation"] === employee.tenant.id);
        await recovery.waitFor({ state: "hidden" });
        report(`${fault}: confirmed retry does not duplicate any durable write`, same(durable, await snapshot()));
        await page.getByRole("region", { name: "Your recorded context", exact: true }).getByText(text, { exact: true }).waitFor();
        recordedTexts.push(text);
        report(`${fault}: the confirmed persisted clarification is visible in the employee's history`, await field().inputValue() === "");
      } finally { release(); await page.unroute(pattern, intercept); }
    }
    const confirmed = await snapshot(), confirmedPosts = posts;
    await page.route(pattern, unavailableRead);
    try { await page.reload(); await page.getByRole("heading", { name: "Lift is unavailable", exact: true }).waitFor(); }
    finally { await page.unroute(pattern, unavailableRead); }
    report("failed read after confirmed writes does not replay either mutation", posts === confirmedPosts && same(confirmed, await snapshot()));
    await page.getByRole("button", { name: "Try again", exact: true }).click(); await field().waitFor();
    report("new read recovers actual Lift state and retains both durable context records", posts === confirmedPosts && same(confirmed, await snapshot()));
    for (const text of recordedTexts) await page.getByRole("region", { name: "Your recorded context", exact: true }).getByText(text, { exact: true }).waitFor();
    report("both saved clarifications remain visible after actual page refresh", recordedTexts.length === 2);
    for (const actor of [manager, lead]) {
      const response = await actor.context.request.get(pattern, { headers: headers(actor) }), body = await response.text();
      report(`${actor.user.role} cannot read private employee clarification text`, response.status() === 200 && recordedTexts.every(text => !body.includes(text)));
    }
    report("other employer context, receipts, revisions and audit are unchanged", same(otherBefore, await tenantSnapshot(other.tenant.id)));
    return { contextRecordsAdded: 2, newSignIns: 0, reconnect: "same genuine session", runtimeFixtureChanges: false };
  } finally {
    page.off("request", count);
    await page.unroute(pattern, malformedRead); await page.unroute(pattern, unavailableRead);
    if (viewport) await page.setViewportSize(viewport);
  }
}
