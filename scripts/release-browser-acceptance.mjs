/**
 * Genuine local sign-in-link acceptance. No admin-generated links, password
 * login, injected sessions, demo switcher, traces or authentication screenshots.
 * Mailpit proves local SMTP capture, not delivery to a real external inbox.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { localUrl, releaseBackend } from "./release-local-fixtures.mjs";

const results = [];
let browser;
let phase = "initialisation";
function failureBudgetWritesSince(since) {
  const root=process.env.RELEASE_LOCAL_RUNTIME;
  if(!root?.startsWith("/private/tmp/levytate-release-runtime."))return null;
  const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),db=new URL(state.env.DB_URL);
  if(db.hostname!=="127.0.0.1")throw new Error("Local failure-budget observation required");
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(since))throw new Error("Invalid observation timestamp");
  const r=spawnSync(process.env.RELEASE_PSQL??"/opt/homebrew/opt/postgresql@17/bin/psql",["-X","-A","-t","-q","-v","ON_ERROR_STOP=1"],{env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},input:`select count(*) from public.levytate_auth_rate_limits where action='magic_link.callback.failure' and updated_at>='${since}'::timestamptz;`,encoding:"utf8"});
  if(r.status||!/^\d+$/.test(r.stdout.trim()))throw new Error("Failure-budget observation unavailable");
  return Number(r.stdout.trim());
}
function check(name, condition) {
  results.push({ name, status: condition ? "PASS" : "FAIL" });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) throw new Error("Acceptance assertion failed");
}
async function waitForCapturedLink(mailpit, email, appOrigin, after) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await fetch(`${mailpit}/api/v1/messages`).then((response) => response.json());
    const message = list.messages?.find((item) => item.To?.some((to) => to.Address === email) && new Date(item.Created).getTime() >= after - 1000);
    if (message) {
      const detail = await fetch(`${mailpit}/api/v1/message/${message.ID}`).then((response) => response.json());
      const links = [...`${detail.HTML ?? ""}\n${detail.Text ?? ""}`.matchAll(/https?:\/\/[^\s<>"']+/g)].map((match) => match[0].replaceAll("&amp;", "&"));
      // The template must contain the app callback with TokenHash. Following a
      // generic GoTrue confirmation URL would consume a token outside this flow.
      const link = links.find((candidate) => {
        try { const url = new URL(candidate); return url.origin === appOrigin && url.pathname === "/levytate/auth/callback" && url.searchParams.has("token_hash"); }
        catch { return false; }
      });
      if (!link) throw new Error("Captured email lacks the approved app callback template");
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Sign-in email was not captured locally");
}

try {
  const app = localUrl(process.env.RELEASE_APP_URL, "RELEASE_APP_URL");
  const mailpit = localUrl(process.env.RELEASE_MAILPIT_URL, "RELEASE_MAILPIT_URL");
  if (!process.env.RELEASE_FIXTURE_MANIFEST) throw new Error("BLOCKED: synthetic fixture manifest unavailable");
  const manifest = JSON.parse(readFileSync(process.env.RELEASE_FIXTURE_MANIFEST, "utf8"));
  if (!manifest.synthetic || manifest.environment !== "local" || manifest.tenants.length !== 2) throw new Error("BLOCKED: exactly two local synthetic tenants required");
  const modulePath = process.env.RELEASE_PLAYWRIGHT_MODULE;
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
  browser = await chromium.launch({ headless: true });
  const backend = releaseBackend();
  const contexts = new Map();
  const peopleUiOnly=process.env.RELEASE_PEOPLE_UI_ONLY==="true";
  const failureBudgetStartedAt=new Date().toISOString();
  for (const tenant of manifest.tenants) {
    for (const user of tenant.users) {
      if(peopleUiOnly&&(tenant.key!=="a"||user.key!=="lead"))continue;
      const label = `${tenant.key} ${user.role}`;
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith("/api/levytate-auth/") && response.status() >= 400) console.log(`DIAGNOSTIC auth API status ${response.status()} at ${path}`);
        if(path==="/api/levytate-workspace"&&response.status()>=400)console.log(`DIAGNOSTIC workspace API status ${response.status()}`);
      });
      contexts.set(`${tenant.key}:${user.key}`, { context, page, user, tenant });
      await page.goto(`${app}/levytate/login`);
      check(`${label}: no demo login required`, !(await page.getByText("Internal demonstration access", { exact: true }).count()));
      const after = Date.now();
      const memberships = await backend(`rest/v1/levytate_users?id=eq.${user.membershipId}&select=auth_binding_status,invitation_generation`);
      if (user.key === "lead" || memberships[0]?.auth_binding_status === "bound") {
        phase = `${label}: submit login form`;
        await page.getByLabel("Work email", { exact: true }).fill(user.email);
        await page.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
        phase = `${label}: wait for request confirmation`;
        await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
      } else {
        phase = `${label}: controlled invitation`;
        const lead = contexts.get(`${tenant.key}:lead`);
        const requestId = randomUUID();
        const invitation = { action: "invite_user", userId: user.membershipId, requestId, expectedGeneration: memberships[0]?.invitation_generation ?? 0 };
        const invite = await lead.context.request.post(`${app}/api/levytate-workspace/invitations`, { headers: { Origin: app }, data: invitation });
        const accepted = await invite.json();
        if (invite.status() !== 200 || accepted.user?.invitationStatus !== "accepted") console.log("Invitation diagnostic", JSON.stringify({ status: invite.status(), invitationStatus: accepted.user?.invitationStatus, deliveryStatus: accepted.user?.deliveryStatus, message: accepted.message }));
        check(`${label}: Lead-controlled invitation accepted by real Auth`, invite.status() === 200 && accepted.user?.invitationStatus === "accepted");
        const repeated = await lead.context.request.post(`${app}/api/levytate-workspace/invitations`, { headers: { Origin: app }, data: invitation });
        check(`${label}: invitation request retry is idempotent`, repeated.status() === 200 && (await repeated.json()).user?.invitationGeneration === accepted.user.invitationGeneration);
      }
      phase = `${label}: await local capture`;
      const link = await waitForCapturedLink(mailpit, user.email, app, after);
      contexts.get(`${tenant.key}:${user.key}`).consumedLink = link;
      check(`${label}: actual sign-in request reached local SMTP capture`, true);
      const callbackResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/levytate/auth/callback");
      phase = `${label}: redeem app callback`;
      await page.goto(link);
      const callbackCookies = (await (await callbackResponse).headersArray()).filter((header) => header.name.toLowerCase() === "set-cookie").map((header) => header.value);
      if (user.key === "lead" && new URL(page.url()).pathname === "/levytate/accept-terms") {
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Accept Early Access Terms", exact: true }).click();
        await page.waitForURL((url) => url.pathname.includes("/app"));
        await page.waitForLoadState("load");
      }
      check(`${label}: callback stays on application origin`, new URL(page.url()).origin === app && new URL(page.url()).pathname.includes("/app"));
      const authCookies = (await context.cookies()).filter((cookie) => /^levytate_(beta_session|auth_access|auth_refresh)$/.test(cookie.name));
      const activeHeaders = callbackCookies.filter((value) => !/Max-Age=0/i.test(value));
      check(`${label}: three HttpOnly host-only cookies`, authCookies.length === 3 && authCookies.every((cookie) => cookie.httpOnly && cookie.path === "/" && cookie.domain === new URL(app).hostname && cookie.sameSite !== "None") && activeHeaders.every((value) => !/Domain=/i.test(value)));
      if (user.key === "employee" && process.env.RELEASE_SUPABASE_ANON_KEY) {
        const origin = localUrl(process.env.RELEASE_SUPABASE_URL, "RELEASE_SUPABASE_URL");
        const access = authCookies.find((cookie) => cookie.name === "levytate_auth_access").value;
        const direct = await fetch(`${origin}/rest/v1/levytate_employees?select=id`, { headers: { apikey: process.env.RELEASE_SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` } });
        check(`${label}: genuine authenticated Data API cannot read employer tables directly`, [401, 403].includes(direct.status));
        const anonymous = await fetch(`${origin}/rest/v1/levytate_users?select=id`, { headers: { apikey: process.env.RELEASE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.RELEASE_SUPABASE_ANON_KEY}` } });
        check(`${label}: anonymous Data API cannot enumerate memberships`, [401, 403].includes(anonymous.status));
        const budget = await fetch(`${origin}/rest/v1/rpc/levytate_check_auth_callback_failures`, { method:"POST",headers: { apikey: process.env.RELEASE_SUPABASE_ANON_KEY, Authorization: `Bearer ${access}`,"Content-Type":"application/json" },body:JSON.stringify({p_environment_namespace:"local",p_key_hash:"a".repeat(64)}) });
        check(`${label}: actual authenticated identity cannot inspect callback budgets`, [401,403].includes(budget.status));
      }
      const workspace = await context.request.get(`${app}/api/levytate-workspace`);
      const data = await workspace.json();
      check(`${label}: canonical role and tenant resolved`, workspace.status() === 200 && data.workspace?.meta?.userRole === user.role && data.workspace?.meta?.organisationId === tenant.id);
      const ownPeople = data.workspace?.data?.employees ?? [];
      check(`${label}: other tenant is absent`, ownPeople.every((person) => !person.id.startsWith(tenant.key === "a" ? "b-" : "a-")));
      if (user.key === "employee") check(`${label}: employee has own People only`, ownPeople.length === 1 && ownPeople[0].id === user.personId);
      phase = `${label}: browser reload`;
      await page.reload();
      phase = `${label}: workspace after reload`;
      check(`${label}: authenticated refresh persists`, (await context.request.get(`${app}/api/levytate-workspace`)).status() === 200);
      phase = `${label}: provider refresh`;
      const refresh = await context.request.post(`${app}/api/levytate-auth/session`, { headers: { Origin: app } });
      check(`${label}: provider session refresh succeeds`, refresh.status() === 200);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        check(`${label}: no horizontal overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      }
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  }
  const failureWrites=failureBudgetWritesSince(failureBudgetStartedAt);
  if(failureWrites!==null)check(`${contexts.size} genuine successful callbacks do not consume failed-link budget`,failureWrites===0);
  for(const key of peopleUiOnly?["a:lead"]:["a:employee","a:manager","a:lead"]) {
    const actor=contexts.get(key);
    for(const path of ["levytate-lift","levytate-learning-time","levytate-requests","levytate-pastoral"]){
      const gated=await actor.context.request.get(`${app}/api/${path}`);
      check(`${key}: unapproved ${path} remains tenant-gated`,gated.status()===404);
    }
  }
  if (process.env.RELEASE_UI_RECOVERY === "true") {
    phase = "People form survives genuine session loss and reauthentication";
    const lead = contexts.get("a:lead"), page = lead.page;
    await page.goto(`${app}/levytate/app?module=People`);
    await page.getByRole("button", { name: "Add employee", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add employee", exact: true });
    const syntheticName = `Synthetic retained draft ${manifest.run.slice(0, 8)}`, syntheticEmail = `ui.${manifest.run}.person@example.test`;
    await dialog.getByLabel("Employee name", { exact: true }).fill(syntheticName);
    await dialog.getByLabel("Work email", { exact: true }).fill(syntheticEmail);
    await dialog.getByLabel("Job title", { exact: true }).fill("Synthetic role");
    await dialog.getByLabel("Department", { exact: true }).fill("Synthetic department");
    const ended = await lead.context.request.post(`${app}/api/levytate-beta-logout`, { headers: { Origin: app }, maxRedirects: 0 });
    check("real provider logout invalidates session while unsaved form remains", ended.status() === 303);
    await dialog.getByRole("button", { name: "Save employee", exact: true }).click();
    await dialog.getByRole("button", { name: "Reconnect workspace", exact: true }).waitFor();
    check("401 retains unsaved People form", await dialog.getByLabel("Employee name", { exact: true }).inputValue() === syntheticName);
    const reached = new Set();
    await dialog.getByRole("button", { name: "Close dialog" }).focus();
    for (let index = 0; index < 16; index++) { await page.keyboard.press("Tab"); reached.add(await page.evaluate(() => document.activeElement?.textContent?.trim())); }
    check("keyboard trap includes both session recovery controls", reached.has("Sign in in new tab") && reached.has("Reconnect workspace"));
    const opened = lead.context.waitForEvent("page");
    await dialog.getByRole("button", { name: "Sign in in new tab", exact: true }).click();
    const login = await opened;
    await login.waitForLoadState();
    const sentAt = Date.now();
    await login.getByLabel("Work email", { exact: true }).fill(lead.user.email);
    await login.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
    await login.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
    await login.goto(await waitForCapturedLink(mailpit, lead.user.email, app, sentAt));
    check("same-account recovery uses a genuine new Auth callback", new URL(login.url()).pathname.includes("/app"));
    await login.close();
    await dialog.getByRole("button", { name: "Reconnect workspace", exact: true }).click();
    // Reconnect changes its own label to Reconnecting immediately. Wait for the
    // stable sibling to disappear so the server reload, not just busy UI, ended.
    await dialog.getByRole("button", { name: "Sign in in new tab", exact: true }).waitFor({ state: "detached" });
    check("reconnected form retains original typed values", await dialog.getByLabel("Employee name", { exact: true }).inputValue() === syntheticName && await dialog.getByLabel("Work email", { exact: true }).inputValue() === syntheticEmail);
    await dialog.getByRole("button", { name: "Save employee", exact: true }).click();
    try{await dialog.waitFor({ state: "detached" });}
    catch(error){console.log("People inline messages",(await dialog.locator("p").allTextContents()).join(" | ").slice(0,1600));throw error;}
    const stored = await backend(`rest/v1/levytate_employees?organisation_id=eq.${lead.tenant.id}&email=eq.${encodeURIComponent(syntheticEmail)}&select=id,name`);
    check("recovered People form durably saves exactly once", stored.length === 1 && stored[0].name === syntheticName);
  }
  // Exercise replay only after all real identities have independently signed in.
  for (const key of peopleUiOnly?[]:["a:employee", "b:manager"]) {
    const item = contexts.get(key);
    const replay = await item.context.request.get(item.consumedLink, { maxRedirects: 0 });
    check(`${key}: consumed magic link cannot replay`, replay.status() >= 300 && replay.status() < 400 && (replay.headers().location ?? "").includes("invalid-link"));
  }
  if (manifest.catalogue&&!peopleUiOnly) {
    phase = "separate-role application and enrolment handoff";
    const employeeA = contexts.get("a:employee"), managerA = contexts.get("a:manager"), leadA = contexts.get("a:lead"), leadB = contexts.get("b:lead");
    const post = (actor, data) => actor.context.request.post(`${app}/api/levytate-workspace`, { headers: { Origin: app }, data });
    const applicationId = `browser-${manifest.run}`;
    const application = { id: applicationId, employeeId: employeeA.user.personId, apprenticeshipStandardId: manifest.catalogue.standardId, reason: "Synthetic acceptance work need", careerGoal: "Synthetic professional development", supportRequired: "None", status: "Awaiting Manager Review", currentOwner: "Line Manager", revision: 0 };
    const submit = { type: "saveApplication", application, expectedRevision: 0, idempotencyKey: `browser-submit-${manifest.run}` };
    const result = await post(employeeA, submit), persisted = await result.json();
    if (result.status() !== 200) console.log("Application diagnostic", JSON.stringify({ status: result.status(), message: persisted.message }));
    check("real Employee submits durable application", result.status() === 200 && persisted.workspace?.data?.applications?.some((item) => item.id === applicationId && item.status === "Awaiting Manager Review" && item.revision === 1));
    check("real Employee lost-response retry succeeds", (await post(employeeA, submit)).status() === 200);
    check("real Employee cannot create second active application", (await post(employeeA, { ...submit, application: { ...application, id: `${applicationId}-second` }, idempotencyKey: randomUUID() })).status() === 409);
    const decide = (actor, status, expectedRevision) => post(actor, { type: "updateApplicationStatus", id: applicationId, status, expectedRevision, idempotencyKey: randomUUID(), note: "Synthetic acceptance review" });
    check("real Lead cannot bypass manager review", [403, 409].includes((await decide(leadA, "Approved for Enrolment", 1)).status()));
    check("other tenant Lead cannot decide application", [403, 404, 409].includes((await decide(leadB, "Approved for Enrolment", 1)).status()));
    const managerDecision = await decide(managerA, "Awaiting Final Approval", 1);
    check("real direct Line Manager advances to Lead", managerDecision.status() === 200 && (await managerDecision.json()).workspace?.data?.applications?.some((item) => item.id === applicationId && item.status === "Awaiting Final Approval" && item.revision === 2));
    check("stale real manager decision rejected", (await decide(managerA, "Awaiting Final Approval", 1)).status() === 409);
    const final = await decide(leadA, "Approved for Enrolment", 2);
    check("real Lead final approval persists after manager", final.status() === 200 && (await final.json()).workspace?.data?.applications?.some((item) => item.id === applicationId && item.status === "Approved for Enrolment" && item.revision === 3));
    await employeeA.page.reload();
    const afterRefresh = await employeeA.context.request.get(`${app}/api/levytate-workspace`);
    check("Employee sees final approval after browser refresh", (await afterRefresh.json()).workspace?.data?.applications?.some((item) => item.id === applicationId && item.status === "Approved for Enrolment"));
    const handoff = { applicationId, employeeId: employeeA.user.personId, programmeId: manifest.catalogue.programmeId, providerId: manifest.catalogue.providerId, lifecycleStatus: "pre_enrolment", employmentRoute: "existing_employee_upskill", expectedStartDate: "2027-01-01", expectedEndDate: "2028-01-01", expectedApplicationRevision: 3, idempotencyKey: randomUUID() };
    const start = (actor, data) => actor.context.request.post(`${app}/api/levytate-learners`, { headers: { Origin: app }, data });
    check("Employee cannot initiate employer enrolment handoff", (await start(employeeA, handoff)).status() === 403);
    check("direct enrolled status bypass is rejected", (await start(leadA, { ...handoff, lifecycleStatus: "enrolled" })).status() === 400);
    const started = await start(leadA, handoff), startedBody = await started.json();
    check("approved application creates genuine pre-enrolment", started.status() === 201 && startedBody.source === "supabase" && startedBody.learner?.lifecycleStatus === "pre_enrolment");
    check("handoff lost-response retry returns persisted learner", (await start(leadA, handoff)).status() === 201);
    const row = await backend(`rest/v1/levytate_learner_records?organisation_id=eq.${employeeA.tenant.id}&application_id=eq.${applicationId}&select=id,lifecycle_status`);
    check("database holds exactly one pre-enrolment handoff", row.length === 1 && row[0].lifecycle_status === "pre_enrolment");
    if(process.env.RELEASE_LEARNER_JOURNEY==="true"){
      phase="genuine Employee declaration and employer enrolment";
      const base=`${app}/api/levytate-learners/${row[0].id}`,today=new Date().toISOString().slice(0,10),reviewDay=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
      const detail=async actor=>{const response=await actor.context.request.get(base);check(`learner detail is genuinely available to ${actor.user.role}`,response.status()===200);return(await response.json()).learner;};
      const mutation=async(actor,suffix,data,method="POST")=>{const response=await actor.context.request.fetch(`${base}/${suffix}`,{method,headers:{Origin:app},data});if(response.status()>=500)console.log(`DIAGNOSTIC learner ${suffix} status ${response.status()}`);return response;};
      let learner=await detail(employeeA);
      const declaration={idempotencyKey:randomUUID(),expectedUpdatedAt:learner.updatedAt,confirmed:true,expectedEnglandWorkingHoursPercentage:100};
      check("Lead cannot fabricate genuine employee declaration",(await mutation(leadA,"employee-declaration",declaration)).status()===403);
      check("other tenant Employee cannot confirm this learner declaration",[403,404].includes((await mutation(contexts.get("b:employee"),"employee-declaration",declaration)).status()));
      const declared=await mutation(employeeA,"employee-declaration",declaration),declaredBody=await declared.json();
      check("real Employee declaration persists before employer verification",declared.status()===200&&declaredBody.learner?.eligibilityDeclaration?.verificationStatus==="employee_confirmed");
      check("real employee declaration retry returns durable receipt",(await mutation(employeeA,"employee-declaration",declaration)).status()===200);
      learner=await detail(leadA);
      const verification={idempotencyKey:randomUUID(),expectedUpdatedAt:learner.updatedAt,eligibilityVerification:{verificationStatus:"employer_verified",notes:"Synthetic verified employment evidence"},probation:{probationStatus:"not_required"},hrApproval:{hrApprovalStatus:"approved",hrApprovedDate:today},programme:{actualStartDate:today}};
      check("Employee cannot verify employer eligibility",(await mutation(employeeA,"pre-enrolment",verification,"PATCH")).status()===403);
      const verified=await mutation(leadA,"pre-enrolment",verification,"PATCH"),verifiedBody=await verified.json();
      check("real Lead verification completes required readiness",verified.status()===200&&verifiedBody.learner?.enrolmentReadiness?.readyForEnrolment===true);
      learner=verifiedBody.learner;
      const enrol={idempotencyKey:randomUUID(),expectedActivityVersion:learner.activityVersion,initialProgress:{updateDate:today,targetProgressPercentage:0,actualProgressPercentage:0,summary:"Synthetic explicit initial provider baseline"},firstReviewDate:reviewDay,firstReviewerName:"Synthetic provider reviewer"};
      check("Line Manager cannot bypass employer enrolment role",(await mutation(managerA,"enrol",enrol)).status()===403);
      check("missing initial progress cannot be silently fabricated",(await mutation(leadA,"enrol",{...enrol,initialProgress:undefined})).status()===400);
      const enrolled=await mutation(leadA,"enrol",enrol),enrolledBody=await enrolled.json();
      check("real Lead enrols learner with explicit initial evidence",enrolled.status()===200&&enrolledBody.learner?.lifecycleStatus==="enrolled");
      check("real enrolment retry does not duplicate records",(await mutation(leadA,"enrol",enrol)).status()===200);
      const connected=await backend(`rest/v1/levytate_enrolments?organisation_id=eq.${employeeA.tenant.id}&application_id=eq.${applicationId}&select=id,status`);
      check("actual database links one Live learner enrolment",connected.length===1&&connected[0].status==="Live learner");
      await employeeA.page.reload();
      check("Employee new page session reads durable enrolled journey",(await detail(employeeA)).lifecycleStatus==="enrolled");
      const finalWorkspace=await employeeA.context.request.get(`${app}/api/levytate-workspace`);
      check("Employee application and enrolment show connected completed handoff",(await finalWorkspace.json()).workspace?.data?.applications?.some(item=>item.id===applicationId&&item.status==="Completed"));
      learner=await detail(leadA);
      const withdrawal={outcome:"withdrawal",idempotencyKey:randomUUID(),expectedActivityVersion:learner.activityVersion,effectiveDate:today,reasonCategory:"other",initiatedBy:"learner",notes:"Synthetic agreed withdrawal for end-to-end acceptance",providerNotified:false,employeeNotified:false};
      check("Employee cannot set official withdrawal outcome",(await mutation(employeeA,"outcome",withdrawal)).status()===403);
      const outcome=await mutation(leadA,"outcome",withdrawal),outcomeBody=await outcome.json();
      check("real Lead terminal outcome commits durable withdrawal",outcome.status()===200&&outcomeBody.learner?.lifecycleStatus==="withdrawn");
      check("terminal outcome retry returns committed result",(await mutation(leadA,"outcome",withdrawal)).status()===200);
      const ended=await backend(`rest/v1/levytate_enrolments?organisation_id=eq.${employeeA.tenant.id}&application_id=eq.${applicationId}&select=id,status`);
      check("terminal outcome updates corresponding enrolment to Cancelled",ended.length===1&&ended[0].status==="Cancelled");
      check("no fictional notification claimed delivered",outcomeBody.learner?.withdrawal?.providerNotified===false&&outcomeBody.learner?.withdrawal?.employeeNotified===false);
    }
  }
  if(!peopleUiOnly){
  const employee = contexts.get("a:employee");
  const forged = await employee.context.request.post(`${app}/api/levytate-workspace`, {
    headers: { Origin: app }, data: { type: "saveEmployeeDevelopmentProfile", profile: { employeeId: "b-employee" } },
  });
  check("cross-tenant employee profile write denied", [400, 403, 404, 422].includes(forged.status()));
  const manager = contexts.get("a:manager");
  await backend(`rest/v1/levytate_users?id=eq.${manager.user.membershipId}`, "PATCH", { active: false });
  check("revoked Manager blocked on next authenticated API request", [401, 403].includes((await manager.context.request.get(`${app}/api/levytate-workspace`)).status()));
  check("revocation leaves second tenant unaffected", (await contexts.get("b:manager").context.request.get(`${app}/api/levytate-workspace`)).status() === 200);
  }
  for (const { context, user, tenant } of contexts.values()) {
    const logout = await context.request.post(`${app}/api/levytate-beta-logout`, { headers: { Origin: app }, maxRedirects: 0 });
    check(`${tenant.key} ${user.role}: logout confirmed`, logout.status() === 303);
    check(`${tenant.key} ${user.role}: no access after logout`, (await context.request.get(`${app}/api/levytate-workspace`)).status() === 401);
    check(`${tenant.key} ${user.role}: refresh cannot restore logged-out session`, (await context.request.post(`${app}/api/levytate-auth/session`, { headers: { Origin: app } })).status() === 401);
    await context.close();
  }
  results.push({ name: "External inbox delivery", status: "BLOCKED", reason: "Local SMTP capture proves no external inbox delivery" });
} catch (error) {
  const blocked = error.message?.startsWith("BLOCKED:");
  results.push({ name: "Acceptance execution", status: blocked ? "BLOCKED" : "FAIL", reason: blocked ? error.message : "A browser/API contract failed; authentication state omitted" });
  const networkCode = error.message?.match(/net::[A-Z_]+|ECONNREFUSED|ECONNRESET|Target page, context or browser has been closed|Page crashed/)?.[0] ?? "";
  console.error(blocked ? error.message : `FAIL release browser acceptance at ${phase} (${error.name} ${networkCode}); authentication state and raw errors withheld`);
  process.exitCode = blocked ? 2 : 1;
} finally {
  await browser?.close();
  const evidence = { schemaVersion: 1, environment: "local", authenticationMethod: "requested-sign-in-link-through-local-smtp", authenticatedRolesVerified: results.filter((item) => item.name.endsWith("canonical role and tenant resolved") && item.status === "PASS").length, emailEvidence: "local-smtp-capture-only", results };
  if (process.env.RELEASE_EVIDENCE_PATH?.startsWith("/private/tmp/")) {
    const requested = process.env.RELEASE_EVIDENCE_PATH;
    const path = existsSync(requested) ? requested.replace(/\.json$/, `-${Date.now()}.json`) : requested;
    writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  }
  console.log(`Release browser evidence: ${results.filter((item) => item.status === "PASS").length} PASS, ${results.filter((item) => item.status === "FAIL").length} FAIL, ${results.filter((item) => item.status === "BLOCKED").length} BLOCKED`);
}
