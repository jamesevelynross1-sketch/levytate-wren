/** Genuine LOCAL own-development journey for a Line Manager, their distinct
 * Line Manager and Apprenticeship Lead. No generated links, password login,
 * fabricated sessions, screenshots, traces or persisted browser state.
 * The runtime owner supplies the reviewed fixture and owns the acceptance lock.
 */
import { randomUUID } from "node:crypto";
import { assertManagerManifest } from "./release-manager-fixtures.mjs";
import { localUrl } from "./release-local-fixtures.mjs";
const workspacePath = "/api/levytate-workspace";
const questions = ["Why are you interested in this programme?", "How could it help your current role or future development?", "What support will you need from your manager?"];
export async function verifyManagerDevelopment({ app: value, mailpit: capture, browser, manifest, extension, backend, waitForCapturedLink, check, challengeApplicant, existingContexts, resumeApplication = null }) {
  const app = localUrl(value, "manager journey app"), mailpit = localUrl(capture, "manager journey capture"), plan = assertManagerManifest(extension, manifest, true);
  if(resumeApplication!==null&&(!/^application-[a-f0-9-]{36}$/.test(resumeApplication.id??"")||!Number.isSafeInteger(resumeApplication.revision)||resumeApplication.revision<1))throw Error("Explicit reviewed current application continuation required");
  const tenant = manifest.tenants.find((item) => item.key === "a"), other = manifest.tenants.find((item) => item.key === "b");
  const actors = [], ownedContexts = new Set(), report = (label, condition) => check(`Manager development: ${label}`, condition);
  const headers = (actor) => ({ Origin: app, "X-LevyTate-Account": actor.user.email, "X-LevyTate-Organisation": tenant.id });
  const workspace = async (actor) => { const response = await actor.context.request.get(`${app}${workspacePath}`, { headers: headers(actor) }); report(`${actor.user.key} reads current canonical workspace`, response.status() === 200); return (await response.json()).workspace; };
  const post = (actor, data) => actor.context.request.post(`${app}${workspacePath}`, { headers: headers(actor), data });
  const rows = () => backend(`rest/v1/levytate_applications?organisation_id=eq.${tenant.id}&employee_id=eq.${plan.source.person.id}&select=id,status,revision&order=id`);
  let phase = "genuine sign-in", applicationId, learnerId;
  async function navigate(actor, module) {
    await actor.page.goto(`${app}/levytate/app?module=${encodeURIComponent(module)}`);
  }
  try {
    const beforeOther = await backend(`rest/v1/levytate_organisations?id=eq.${other.id}&select=id,status,updated_at`);
    const reviewerRow = (await backend(`rest/v1/levytate_employees?organisation_id=eq.${tenant.id}&id=eq.${plan.source.person.id}&select=manager_id,status`))[0];
    report("reviewed superior is the current distinct manager", reviewerRow?.status === "Active" && reviewerRow.manager_id === plan.users[0].personId);
    const users = [tenant.users.find((user) => user.key === "manager"), plan.users[0], tenant.users.find((user) => user.key === "lead")];
    for (const user of users) {
      const existing = user.key === "reviewer" ? undefined : existingContexts?.get(`a:${user.key}`);
      if (existing) {
        report(`${user.key} context belongs to the same bounded genuine run`, existing.user?.membershipId === user.membershipId && existing.user.personId === user.personId && existing.user.email === user.email && existing.user.role === user.role && existing.tenant?.id === tenant.id && new URL(existing.page.url()).origin === app);
        const actor = { context: existing.context, page: existing.page, user, tenant }; actors.push(actor);
        const member = (await backend(`rest/v1/levytate_users?id=eq.${user.membershipId}&select=id,organisation_id,email,role,active,auth_binding_status,auth_subject`))[0];
        report(`${user.key} still has the exact active bound membership`, member?.id === user.membershipId && member.organisation_id === tenant.id && member.email === user.email && member.role === user.role && member.active === true && member.auth_binding_status === "bound" && typeof member.auth_subject === "string" && (user.key !== "manager" || member.auth_subject === plan.source.membership.auth_subject));
        const actual = await workspace(actor);
        report(`${user.key} existing real session freshly resolves the expected account and tenant`, actual.meta?.userRole === user.role && actual.meta.organisationId === tenant.id && actual.meta.userEmail === user.email && (user.key !== "manager" || actual.data.employees.some((person) => person.id === user.personId && person.email === user.email)));
        continue;
      }
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "UTC" }), page = await context.newPage();
      ownedContexts.add(context);
      page.setDefaultTimeout(20000); const actor = { context, page, user, tenant }; actors.push(actor);
      await page.goto(`${app}/levytate/login`); const after = Date.now();
      await page.getByLabel("Work email", { exact: true }).fill(user.email);
      const request = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/levytate-auth/request" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Send secure sign-in link", exact: true }).click();
      const outcome = await request;
      if (outcome.status() === 429) throw new Error("BLOCKED: natural authentication rate budget not yet available");
      report(`${user.key} requests a real public sign-in link`, outcome.status() === 200);
      await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
      const callback = page.waitForResponse((response) => new URL(response.url()).pathname === "/levytate/auth/callback");
      await page.goto(await waitForCapturedLink(mailpit, user.email, app, after));
      const cookieHeaders = (await (await callback).headersArray()).filter((header) => header.name.toLowerCase() === "set-cookie" && !/Max-Age=0/i.test(header.value));
      report(`${user.key} callback resolves the application origin`, new URL(page.url()).origin === app && new URL(page.url()).pathname.includes("/app"));
      const cookies = (await context.cookies()).filter((cookie) => /^levytate_(beta_session|auth_access|auth_refresh)$/.test(cookie.name));
      report(`${user.key} receives genuine host-only HttpOnly cookies`, cookies.length === 3 && cookies.every((cookie) => cookie.httpOnly && cookie.path === "/" && cookie.domain === new URL(app).hostname) && cookieHeaders.every((header) => !/Domain=/i.test(header.value)));
      const actual = await workspace(actor);
      report(`${user.key} resolves the exact account, role and employer`, actual.meta?.userRole === user.role && actual.meta.organisationId === tenant.id && actual.meta.userEmail === user.email);
      report(`${user.key} refreshes the actual provider session`, (await context.request.post(`${app}/api/levytate-auth/session`, { headers: headers(actor) })).status() === 200);
    }
    const [applicant, reviewer, lead] = actors;
    if(resumeApplication){
      phase="existing own application continuation";const current=(await rows()).filter(item=>item.id===resumeApplication.id);
      report("continuation uses the exact own application awaiting distinct review",current.length===1&&current[0].status==="Awaiting Manager Review"&&current[0].revision===resumeApplication.revision);
      applicationId=resumeApplication.id;
      report("continuation has one active own application and creates no replacement",(await rows()).filter(item=>!["Declined","Withdrawn","Completed","Cancelled"].includes(item.status)).length===1);
      await navigate(applicant,"My Application");await applicant.page.getByRole("heading",{name:"My application",exact:true}).waitFor();
    }else{
    phase = "own programme selection";
    const initial = await workspace(applicant), published = initial.data.providerProgrammes.find((item) => item.id === manifest.catalogue.programmeId);
    report("own manager has no active personal application before this journey", !(await rows()).some((item) => !["Declined", "Withdrawn", "Completed", "Cancelled"].includes(item.status)));
    report("a published actual programme is available", Boolean(published?.programmeName));
    await navigate(applicant, "My Programme");
    await applicant.page.getByRole("heading", { name: "Explore your programmes", exact: true }).waitFor();
    await applicant.page.getByRole("button", { name: `View ${published.programmeName}`, exact: true }).click();
    const started = applicant.page.waitForResponse((response) => new URL(response.url()).pathname === workspacePath && response.request().method() === "POST");
    await applicant.page.getByRole("dialog").getByRole("button", { name: "Start pathway application", exact: true }).click();
    report("manager starts only their own mapped application through UI", (await started).status() === 200);
    const draftRows = (await rows()).filter((item) => item.status === "Draft");
    report("exactly one personal draft persisted", draftRows.length === 1); applicationId = draftRows[0].id;
    for (const [index, label] of questions.entries()) await applicant.page.getByRole("textbox", { name: label, exact: true }).fill(`Synthetic own-manager acceptance answer ${index + 1} ${plan.run}`);
    phase = "own draft and submission";
    if (challengeApplicant) {
      await challengeApplicant({ app, applicant, reviewer, lead, applicationId, backend, check });
    } else {
      const saved = applicant.page.waitForResponse((response) => new URL(response.url()).pathname === workspacePath && response.request().method() === "POST");
      await applicant.page.getByRole("button", { name: "Save draft", exact: true }).click(); report("manager saves personal answers through UI", (await saved).status() === 200);
      const submitted = applicant.page.waitForResponse((response) => new URL(response.url()).pathname === workspacePath && response.request().method() === "POST");
      await applicant.page.getByRole("button", { name: "Submit to line manager", exact: true }).click(); report("manager submits their own application through UI", (await submitted).status() === 200);
    }
    }
    let application = (await rows()).find((item) => item.id === applicationId);
    report("own submission reaches the distinct manager's review", ["Awaiting Manager Review", "Submitted to Line Manager"].includes(application?.status));
    const decide = (actor, status, revision) => post(actor, { type: "updateApplicationStatus", id: applicationId, status, expectedRevision: revision, idempotencyKey: randomUUID(), note: "Synthetic distinct reviewer decision" });
    report("manager cannot approve their own application", [403,409].includes((await decide(applicant, "Awaiting Final Approval", application.revision)).status()));
    report("Lead cannot bypass the distinct manager review", [403,409].includes((await decide(lead, "Approved for Enrolment", application.revision)).status()));
    report("retained account cannot switch tenant", (await applicant.context.request.get(`${app}${workspacePath}`, { headers: { ...headers(applicant), "X-LevyTate-Organisation": other.id } })).status() === 409);
    phase = "distinct manager review and final approval";
    const reviewed = await decide(reviewer, "Awaiting Final Approval", application.revision);
    report("distinct genuine Line Manager advances their report's application", reviewed.status() === 200);
    application = (await rows()).find((item) => item.id === applicationId);
    report("manager review is durable", application.status === "Awaiting Final Approval");
    const approved = await decide(lead, "Approved for Enrolment", application.revision);
    report("genuine Lead gives final approval after the distinct manager", approved.status() === 200);
    await applicant.page.reload(); report("applicant reads final approval after browser reload", (await workspace(applicant)).data.applications.some((item) => item.id === applicationId && item.status === "Approved for Enrolment"));
    application = (await rows()).find((item) => item.id === applicationId);
    phase = "pre-enrolment handoff";
    const today = new Date().toISOString().slice(0,10), nextYear = new Date(Date.now() + 366 * 86400000).toISOString().slice(0,10);
    const handoff = { applicationId, employeeId: applicant.user.personId, programmeId: manifest.catalogue.programmeId, providerId: manifest.catalogue.providerId, lifecycleStatus: "pre_enrolment", employmentRoute: "existing_employee_upskill", expectedStartDate: today, expectedEndDate: nextYear, expectedApplicationRevision: application.revision, idempotencyKey: randomUUID() };
    const start = (actor) => actor.context.request.post(`${app}/api/levytate-learners`, { headers: headers(actor), data: handoff });
    report("own manager cannot bypass the employer handoff role", (await start(applicant)).status() === 403);
    const initiated = await start(lead), initiatedBody = await initiated.json();
    report("Lead creates a real personal pre-enrolment record", initiated.status() === 201 && initiatedBody.learner?.lifecycleStatus === "pre_enrolment" && typeof initiatedBody.learner.learnerRecordId === "string" && initiatedBody.learner.learnerRecordId.length > 0 && initiatedBody.learner.learner?.id === applicant.user.personId && initiatedBody.learner.programme?.applicationReference === applicationId); learnerId = initiatedBody.learner.learnerRecordId;
    const handedOff=await backend(`rest/v1/levytate_learner_records?organisation_id=eq.${tenant.id}&application_id=eq.${applicationId}&select=id,employee_id`);
    report("handoff detail identifier matches the one durable own learner",handedOff.length===1&&handedOff[0].id===learnerId&&handedOff[0].employee_id===applicant.user.personId);
    report("handoff exact retry is durable", (await start(lead)).status() === 201);
    const learnerPath = `${app}/api/levytate-learners/${learnerId}`;
    const detail = async (actor) => { const response = await actor.context.request.get(learnerPath, { headers: headers(actor) }); report(`${actor.user.key} reads the allowed real learner detail`, response.status() === 200); return (await response.json()).learner; };
    const mutate = (actor, suffix, data, method = "POST") => actor.context.request.fetch(`${learnerPath}/${suffix}`, { method, headers: headers(actor), data });
    phase = "own personal declaration UI";
    let learner = await detail(applicant);
    const forgedDeclaration = { idempotencyKey: randomUUID(), expectedUpdatedAt: learner.updatedAt, confirmed: true, expectedEnglandWorkingHoursPercentage: 100 };
    report("superior cannot sign their report's personal declaration", (await mutate(reviewer, "employee-declaration", forgedDeclaration)).status() === 403);
    report("Lead cannot sign the manager's personal declaration", (await mutate(lead, "employee-declaration", forgedDeclaration)).status() === 403);
    await navigate(applicant, "My Programme");
    await applicant.page.getByRole("heading", { name: "Your pre-enrolment declaration", exact: true }).waitFor();
    await applicant.page.getByLabel("Expected working hours in England (%)", { exact: true }).fill("100");
    await applicant.page.getByLabel("I have read the declaration and confirm that it applies to me.", { exact: true }).check();
    const declared = applicant.page.waitForResponse((response) => new URL(response.url()).pathname === `/api/levytate-learners/${learnerId}/employee-declaration` && response.request().method() === "POST");
    await applicant.page.getByRole("button", { name: "Confirm my declaration", exact: true }).click();
    report("genuine manager confirms only their own declaration in UI", (await declared).status() === 200);
    await applicant.page.reload(); learner = await detail(applicant);
    report("own declaration persists across reload", learner.eligibilityDeclaration?.confirmed === true && learner.eligibilityDeclaration.verificationStatus === "employee_confirmed");
    phase = "employer verification and enrolment";
    learner = await detail(lead);
    const verification = { idempotencyKey: randomUUID(), expectedUpdatedAt: learner.updatedAt, eligibilityVerification: { verificationStatus: "employer_verified", notes: "Synthetic reviewed employment evidence" }, probation: { probationStatus: "not_required" }, hrApproval: { hrApprovalStatus: "approved", hrApprovedDate: today }, programme: { actualStartDate: today } };
    report("own manager cannot verify employer eligibility", (await mutate(applicant, "pre-enrolment", verification, "PATCH")).status() === 403);
    const verified = await mutate(lead, "pre-enrolment", verification, "PATCH"), verifiedBody = await verified.json();
    report("Lead verifies employment readiness", verified.status() === 200 && verifiedBody.learner?.enrolmentReadiness?.readyForEnrolment === true);
    learner = verifiedBody.learner;
    const enrol = { idempotencyKey: randomUUID(), expectedActivityVersion: learner.activityVersion, initialProgress: { updateDate: today, targetProgressPercentage: 0, actualProgressPercentage: 0, summary: "Synthetic initial provider evidence" }, firstReviewDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), firstReviewerName: "Synthetic distinct provider reviewer" };
    report("superior cannot bypass final enrolment role", (await mutate(reviewer, "enrol", enrol)).status() === 403);
    const enrolled = await mutate(lead, "enrol", enrol), enrolledBody = await enrolled.json();
    report("Lead completes connected personal enrolment", enrolled.status() === 200 && enrolledBody.learner?.lifecycleStatus === "enrolled");
    report("enrolment exact retry does not duplicate records", (await mutate(lead, "enrol", enrol)).status() === 200);
    const persisted = await backend(`rest/v1/levytate_enrolments?organisation_id=eq.${tenant.id}&application_id=eq.${applicationId}&select=id,status`);
    report("database holds exactly one linked Live learner enrolment", persisted.length === 1 && persisted[0].status === "Live learner");
    await navigate(applicant, "My Programme");
    await applicant.page.getByRole("heading", { name: "Your recorded journey", exact: true }).waitFor();
    report("own recorded journey renders enrolled status", await applicant.page.getByText("enrolled", { exact: true }).count() > 0);
    report("own application is durably Completed", (await workspace(applicant)).data.applications.some((item) => item.id === applicationId && item.status === "Completed"));
    report("second employer organisation remains unchanged", JSON.stringify(beforeOther) === JSON.stringify(await backend(`rest/v1/levytate_organisations?id=eq.${other.id}&select=id,status,updated_at`)));
    return { fixtureRun: plan.run, applicationId, learnerId, result: "PASS", scope:resumeApplication?"Continuation of exact persisted own application awaiting manager review; no new application or reset":"Full own Manager application journey", authentication: "distinct genuine public sign-in sessions; any existing contexts freshly verified within the same bounded run", newSignIns: ownedContexts.size, adversarialChallenge: Boolean(challengeApplicant) };
  } catch (error) {
    if (error.message === "BLOCKED: natural authentication rate budget not yet available") throw error;
    const safe=new Error(`Manager browser acceptance failed during ${phase}; private authentication state omitted`);safe.safeStage=phase;safe.safeErrorClass=["Error","TimeoutError","TypeError"].includes(error?.name)?error.name:"UnclassifiedError";throw safe;
  } finally {
    for (const actor of actors) {
      if (!ownedContexts.has(actor.context)) continue; // The orchestrator owns reused contexts and their final logout.
      try { await actor.context.request.post(`${app}/api/levytate-beta-logout`, { headers: headers(actor), maxRedirects: 0, timeout: 10000 }); } catch { /* No authentication state in diagnostics. */ }
      try { await actor.context.close(); } catch { /* Preserve the safe acceptance error. */ }
    }
  }
}
