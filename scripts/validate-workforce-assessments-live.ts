import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "../lib/levytate/config/beta-access";
import { workforceAssessmentQuestions } from "../lib/levytate/assessments/framework";
import type { AssessmentAnswerMap } from "../lib/levytate/assessments/domain";
import {
  applyAssessmentActionForSession,
  getAssessmentWorkspaceForSession,
  LevyTateAssessmentError,
} from "../lib/server/levytate-assessments";

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration is required.");
if (process.env.LEVYTATE_ALLOW_ISOLATED_ASSESSMENT_ACCEPTANCE !== "true") throw new Error("Set LEVYTATE_ALLOW_ISOLATED_ASSESSMENT_ACCEPTANCE=true to run the isolated live acceptance journey.");

const run = randomUUID();
const runKey = run.slice(0, 8);
const organisationId = randomUUID();
const secondOrganisationId = randomUUID();
const now = new Date().toISOString();
const testDomain = `assessments-${runKey}.test`;
const checks: string[] = [];
const check = (label: string, condition: unknown) => { assert.ok(condition, label); checks.push(label); };

const identities = {
  lead: identity("lead", "Apprenticeship Lead"),
  managerA: identity("manager-a", "Line Manager"),
  managerB: identity("manager-b", "Line Manager"),
  employee1: identity("employee-1", "Employee"),
  employee2: identity("employee-2", "Employee"),
  employee3: identity("employee-3", "Employee"),
  employee4: identity("employee-4", "Employee"),
  employee5: identity("employee-5", "Employee"),
  employee6: identity("employee-6", "Employee"),
  platform: identity("platform", "Platform Admin"),
};
const crossOrgLead = { id: randomUUID(), email: `cross-org-lead@${testDomain}`, authSubject: randomUUID(), role: "Apprenticeship Lead" } as const;

function identity(label: string, role: "Employee" | "Line Manager" | "Apprenticeship Lead" | "Platform Admin") {
  return { id: randomUUID(), email: `${label}@${testDomain}`, authSubject: randomUUID(), role };
}

function session(identityRecord: { email: string; authSubject: string }): LevyTateBetaSession {
  return { email: identityRecord.email, accessLevel: "beta_user", authMode: "supabase_email", authSubject: identityRecord.authSubject, issuedAt: 0, expiresAt: Number.MAX_SAFE_INTEGER };
}

async function rest<T>(table: string, options: { method?: string; query?: Record<string, string>; body?: unknown; prefer?: string } = {}) {
  const query = new URLSearchParams(options.query ?? {}).toString();
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) throw new Error(`${table} ${options.method ?? "GET"} failed (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : []) as T;
}

async function seed() {
  await archivePreviousIncompleteFixtures();
  await rest("levytate_organisations", { method: "POST", body: [{ id: organisationId, name: `Assessments Acceptance ${runKey}`, slug: `assessments-acceptance-${runKey}`, workspace_name: "Assessments isolated acceptance", primary_contact: "Fictional QA Lead", contact_email: identities.lead.email, default_site: "Test Site", sites: ["Test Site"], departments: ["Digital", "Operations"], priorities: [], status: "Active" }] });
  await rest("levytate_organisations", { method: "POST", body: [{ id: secondOrganisationId, name: `Assessments Cross Org ${runKey}`, slug: `assessments-cross-org-${runKey}`, workspace_name: "Cross-organisation denial fixture", primary_contact: "Fictional QA Lead", contact_email: crossOrgLead.email, default_site: "Other Test Site", sites: ["Other Test Site"], departments: ["Other"], priorities: [], status: "Active" }] });
  await rest("levytate_users", { method: "POST", body: [
    ...Object.values(identities).map((item) => ({ id: item.id, organisation_id: organisationId, email: item.email, role: item.role, access_level: "beta_user", display_name: item.email.split("@")[0], active: true, auth_subject: item.authSubject, auth_binding_status: "bound", auth_bound_at: now, last_authentication_at: now })),
    { id: crossOrgLead.id, organisation_id: secondOrganisationId, email: crossOrgLead.email, role: crossOrgLead.role, access_level: "beta_user", display_name: "Cross org lead", active: true, auth_subject: crossOrgLead.authSubject, auth_binding_status: "bound", auth_bound_at: now, last_authentication_at: now },
  ] });
  const employeeRows = [
    employee(identities.managerA, "manager-a", "Digital Manager", "Digital", ""),
    employee(identities.managerB, "manager-b", "Operations Manager", "Operations", ""),
    employee(identities.employee1, "employee-1", "Data Analyst", "Digital", "manager-a"),
    employee(identities.employee2, "employee-2", "Data Analyst", "Digital", "manager-a"),
    employee(identities.employee3, "employee-3", "Data Analyst", "Digital", "manager-a"),
    employee(identities.employee4, "employee-4", "Data Analyst", "Digital", "manager-a"),
    employee(identities.employee5, "employee-5", "Data Analyst", "Digital", "manager-a"),
    employee(identities.employee6, "employee-6", "Operations Coordinator", "Operations", "manager-b"),
  ];
  await rest("levytate_employees", { method: "POST", body: employeeRows });
  await rest("levytate_roles", { method: "POST", body: [{ organisation_id: organisationId, id: "assessment-qa-role", title: "Assessment QA role", department: "Digital", business_area: "Quality assurance", career_level: "Professional", skills_tags: [], progression: [], status: "Active" }] });
  await rest("levytate_role_pathway_mappings", { method: "POST", body: [{ organisation_id: organisationId, id: "assessment-qa-st0118", role_id: "assessment-qa-role", apprenticeship_standard_id: "ST0118", recommendation_type: "Primary", priority: 1, business_rationale: "Fictional connected acceptance mapping", funding_route: "potentially levy-funded", delivery_preference: "Test only" }] });
  const canonical = (await rest<Array<{ id: string }>>("levytate_organisations", { query: { select: "id", slug: "eq.levytate-internal", limit: "1" } }))[0];
  assert.ok(canonical, "The canonical LevyTate catalogue organisation is required.");
  const programmes = await rest<Array<{ id: string; provider_id: string; linked_standard_id: string; linked_standard_ids: string[]; status: string; record_status: string }>>("levytate_provider_programmes", { query: { select: "id,provider_id,linked_standard_id,linked_standard_ids,status,record_status", organisation_id: `eq.${canonical.id}`, status: "eq.Active", record_status: "eq.Active", limit: "1000" } });
  const programme = programmes.find((item) => item.linked_standard_id === "ST0118" || item.linked_standard_ids?.includes("ST0118"));
  assert.ok(programme, "An active canonical ST0118 programme is required for the application handoff acceptance.");
  await rest("levytate_organisation_providers", { method: "POST", body: [{ organisation_id: organisationId, provider_id: programme.provider_id, status: "Active", selected_by: identities.lead.email }] });
  await rest("levytate_organisation_programmes", { method: "POST", body: [{ organisation_id: organisationId, programme_id: programme.id, provider_id: programme.provider_id, status: "Active", selected_by: identities.lead.email }] });
}

async function archivePreviousIncompleteFixtures() {
  const organisations = await rest<Array<{ id: string }>>("levytate_organisations", { query: { select: "id", slug: "like.assessments-acceptance-*", status: "eq.Active", limit: "100" } });
  for (const organisation of organisations) {
    await rest("levytate_organisations", { method: "PATCH", query: { id: `eq.${organisation.id}` }, body: { status: "Archived" } });
    await rest("levytate_users", { method: "PATCH", query: { organisation_id: `eq.${organisation.id}` }, body: { active: false } });
    await rest("levytate_employees", { method: "PATCH", query: { organisation_id: `eq.${organisation.id}` }, body: { status: "Archived" } });
  }
}

function employee(identityRecord: { email: string; role: string }, id: string, jobTitle: string, department: string, managerId: string) {
  return { organisation_id: organisationId, id, employee_number: `QA-${id}`, name: id.replaceAll("-", " "), email: identityRecord.email, job_title: jobTitle, role_id: "assessment-qa-role", manager_id: managerId, department, site: "Test Site", platform_role: identityRecord.role, status: "Active", start_date: "2026-01-01" };
}

function completeAnswers(employeeNumber: number): AssessmentAnswerMap {
  return Object.fromEntries(workforceAssessmentQuestions.map((question) => [question.id,
    question.type === "multi_choice" ? [question.options?.[0]?.value ?? "not_sure"]
      : question.type === "long_text" ? `Fictional evidence for employee ${employeeNumber}`
        : question.options?.[0]?.value ?? "not_sure",
  ]));
}

function key(label: string) { return `${label}:${randomUUID()}`; }

async function count(table: string, query: Record<string, string>) {
  const rows = await rest<Array<{ id: string }>>(table, { query: { select: "id", ...query } });
  return rows.length;
}

async function expectAssessmentError(operation: () => Promise<unknown>, status: number) {
  try {
    await operation();
    assert.fail(`Expected assessment error ${status}.`);
  } catch (error) {
    assert.ok(error instanceof LevyTateAssessmentError && error.status === status, `Expected LevyTateAssessmentError ${status}, received ${String(error)}`);
  }
}

async function main() {
  let result: Record<string, unknown> | null = null;
  try {
    await seed();
  const leadSession = session(identities.lead);
  const managerASession = session(identities.managerA);
  const managerBSession = session(identities.managerB);
  const employeeSessions = [identities.employee1, identities.employee2, identities.employee3, identities.employee4, identities.employee5, identities.employee6].map(session);

  let leadWorkspace = await applyAssessmentActionForSession(leadSession, {
    action: "create_campaign", idempotencyKey: key("campaign-create"), title: `Connected acceptance ${runKey}`,
    purpose: "Understand fictional AI, automation and data development needs for the isolated acceptance workspace.",
    businessObjectives: ["Validate connected assessment controls"], departments: ["Digital", "Operations"],
    employeeIds: ["employee-1", "employee-2", "employee-3", "employee-4", "employee-5", "employee-6"],
    sharingPolicy: "manager_and_campaign_owner",
  });
  const campaign = leadWorkspace.campaigns.find((item) => item.title === `Connected acceptance ${runKey}`);
  assert.ok(campaign);
  await applyAssessmentActionForSession(leadSession, { action: "open_campaign", idempotencyKey: key("campaign-open"), campaignId: campaign.id });
  check("campaign created and opened with a six-person recorded audience", (await getAssessmentWorkspaceForSession(leadSession)).campaigns.find((item) => item.id === campaign.id)?.invited === 6);

  await applyAssessmentActionForSession(employeeSessions[0], { action: "start_assessment", idempotencyKey: key("start-1"), campaignId: campaign.id });
  let employeeWorkspace = await getAssessmentWorkspaceForSession(employeeSessions[0]);
  const employeeAssessment = employeeWorkspace.assessments.find((item) => item.campaignId === campaign.id);
  assert.ok(employeeAssessment);
  const answers1 = completeAnswers(1);
  await applyAssessmentActionForSession(employeeSessions[0], { action: "save_answers", idempotencyKey: key("save-1"), assessmentId: employeeAssessment.id, answers: answers1 });
  employeeWorkspace = await getAssessmentWorkspaceForSession(employeeSessions[0]);
  check("saved answers resume from durable draft state", employeeWorkspace.assessments.find((item) => item.id === employeeAssessment.id)?.answers.automation_opportunity === answers1.automation_opportunity);
  check("draft remains private from the manager before submission", !(await getAssessmentWorkspaceForSession(managerASession)).assessments.some((item) => item.id === employeeAssessment.id));
  await applyAssessmentActionForSession(employeeSessions[0], { action: "submit", idempotencyKey: key("submit-1"), assessmentId: employeeAssessment.id });

  for (let index = 1; index < 5; index += 1) {
    const employeeSession = employeeSessions[index];
    const started = await applyAssessmentActionForSession(employeeSession, { action: "start_assessment", idempotencyKey: key(`start-${index + 1}`), campaignId: campaign.id });
    const assessment = started.assessments.find((item) => item.campaignId === campaign.id);
    assert.ok(assessment);
    await applyAssessmentActionForSession(employeeSession, { action: "save_answers", idempotencyKey: key(`save-${index + 1}`), assessmentId: assessment.id, answers: completeAnswers(index + 1) });
    await applyAssessmentActionForSession(employeeSession, { action: "submit", idempotencyKey: key(`submit-${index + 1}`), assessmentId: assessment.id });
  }

  leadWorkspace = await getAssessmentWorkspaceForSession(leadSession);
  let campaignView = leadWorkspace.campaigns.find((item) => item.id === campaign.id);
  let campaignReport = leadWorkspace.reporting.find((item) => item.campaignId === campaign.id);
  check("five submissions preserve 83 percent organisation participation", campaignView?.submitted === 5 && campaignView.participationPercent === 83);
  check("recorded audience includes zero-response departments", campaignReport?.groups.some((group) => group.department === "Operations" && group.invited === 1 && group.submitted === 0 && group.participationPercent === 0));
  check("five Digital submissions make only Digital aggregate findings visible", campaignReport?.groups.some((group) => group.department === "Digital" && !group.suppressed) && campaignReport.groups.some((group) => group.department === "Operations" && group.suppressed));

  await applyAssessmentActionForSession(employeeSessions[0], { action: "share_with_manager", idempotencyKey: key("campaign-share"), assessmentId: employeeAssessment.id });
  leadWorkspace = await getAssessmentWorkspaceForSession(leadSession);
  campaignView = leadWorkspace.campaigns.find((item) => item.id === campaign.id);
  campaignReport = leadWorkspace.reporting.find((item) => item.campaignId === campaign.id);
  check("explicit manager sharing is additive to campaign visibility", leadWorkspace.assessments.some((item) => item.id === employeeAssessment.id && item.visibility === "campaign_shared"));
  check("sharing one campaign response leaves submissions, participation and suppression unchanged", campaignView?.submitted === 5 && campaignView.participationPercent === 83 && campaignReport?.groups.find((group) => group.department === "Digital")?.suppressed === false);

  await applyAssessmentActionForSession(managerASession, { action: "review", idempotencyKey: key("campaign-review"), assessmentId: employeeAssessment.id, status: "relevant", businessContext: "Fictional manager context", supportAvailable: "Fictional support", constraints: "No real-world constraint", recommendedAction: "Discuss a fictional workplace project", managerComment: "Connected acceptance review" });
  check("authorised manager review is visible to the employee", (await getAssessmentWorkspaceForSession(employeeSessions[0])).assessments.find((item) => item.id === employeeAssessment.id)?.review?.managerComment === "Connected acceptance review");

  await applyAssessmentActionForSession(employeeSessions[0], { action: "create_application_draft", idempotencyKey: key("handoff-one"), assessmentId: employeeAssessment.id, apprenticeshipStandardId: "ST0118" });
  await applyAssessmentActionForSession(employeeSessions[0], { action: "create_application_draft", idempotencyKey: key("handoff-retry"), assessmentId: employeeAssessment.id, apprenticeshipStandardId: "ST0118" });
  const applications = await rest<Array<{ id: string; status: string }>>("levytate_applications", { query: { select: "id,status", organisation_id: `eq.${organisationId}`, id: `eq.assessment-${employeeAssessment.id}` } });
  check("retrying application handoff creates exactly one draft", applications.length === 1 && applications[0]?.status === "Draft");
  check("assessment submission and review do not approve an application", applications[0]?.status === "Draft");

  const baselineBefore = (await getAssessmentWorkspaceForSession(employeeSessions[0])).assessments.find((item) => item.id === employeeAssessment.id);
  await applyAssessmentActionForSession(employeeSessions[0], { action: "start_reassessment", idempotencyKey: key("reassessment"), baselineAssessmentId: employeeAssessment.id });
  const afterReassessment = await getAssessmentWorkspaceForSession(employeeSessions[0]);
  const baselineAfter = afterReassessment.assessments.find((item) => item.id === employeeAssessment.id);
  const reassessment = afterReassessment.assessments.find((item) => item.id !== employeeAssessment.id && item.campaignId === null);
  check("linked reassessment starts as a distinct private draft", Boolean(reassessment && reassessment.status === "draft" && reassessment.visibility === "private"));
  check("reassessment preserves its submitted baseline", baselineAfter?.activeSubmittedRevision === baselineBefore?.activeSubmittedRevision && baselineAfter?.result?.practicalOpportunity === baselineBefore?.result?.practicalOpportunity);

  const personalStarted = await applyAssessmentActionForSession(employeeSessions[0], { action: "start_assessment", idempotencyKey: key("personal-start") });
  const personal = personalStarted.assessments.find((item) => item.campaignId === null && item.id !== reassessment?.id);
  assert.ok(personal);
  await applyAssessmentActionForSession(employeeSessions[0], { action: "save_answers", idempotencyKey: key("personal-save"), assessmentId: personal.id, answers: completeAnswers(7) });
  await applyAssessmentActionForSession(employeeSessions[0], { action: "submit", idempotencyKey: key("personal-submit"), assessmentId: personal.id });
  await applyAssessmentActionForSession(employeeSessions[0], { action: "share_with_manager", idempotencyKey: key("personal-share-a"), assessmentId: personal.id });
  await rest("levytate_employees", { method: "PATCH", query: { organisation_id: `eq.${organisationId}`, id: "eq.employee-1" }, body: { manager_id: "manager-b" } });
  check("manager B cannot read a personal assessment shared only with manager A", !(await getAssessmentWorkspaceForSession(managerBSession)).assessments.some((item) => item.id === personal.id));
  const beforeDenied = {
    reviews: await count("levytate_assessment_reviews", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}` }),
    actions: await count("levytate_assessment_actions", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}` }),
    events: await count("levytate_assessment_events", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}`, event_type: "like.assessment.review*" }),
    status: (await rest<Array<{ status: string }>>("levytate_workforce_assessments", { query: { select: "status", organisation_id: `eq.${organisationId}`, id: `eq.${personal.id}` } }))[0]?.status,
  };
  await expectAssessmentError(() => applyAssessmentActionForSession(managerBSession, { action: "review", idempotencyKey: key("denied-review"), assessmentId: personal.id, status: "relevant", businessContext: "Denied", supportAvailable: "Denied", constraints: "Denied", recommendedAction: "Denied action", managerComment: "This must not persist" }), 403);
  const afterDenied = {
    reviews: await count("levytate_assessment_reviews", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}` }),
    actions: await count("levytate_assessment_actions", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}` }),
    events: await count("levytate_assessment_events", { organisation_id: `eq.${organisationId}`, assessment_id: `eq.${personal.id}`, event_type: "like.assessment.review*" }),
    status: (await rest<Array<{ status: string }>>("levytate_workforce_assessments", { query: { select: "status", organisation_id: `eq.${organisationId}`, id: `eq.${personal.id}` } }))[0]?.status,
  };
  check("denied manager review creates no review, action, status change or success event", JSON.stringify(beforeDenied) === JSON.stringify(afterDenied));
  check("employee sharing indicator clears after manager reassignment", (await getAssessmentWorkspaceForSession(employeeSessions[0])).assessments.find((item) => item.id === personal.id)?.sharedWithManager === false);
  await applyAssessmentActionForSession(employeeSessions[0], { action: "share_with_manager", idempotencyKey: key("personal-share-b"), assessmentId: personal.id });
  check("employee can explicitly re-share with the new current manager", (await getAssessmentWorkspaceForSession(employeeSessions[0])).assessments.find((item) => item.id === personal.id)?.sharedWithManager === true && (await getAssessmentWorkspaceForSession(managerBSession)).assessments.some((item) => item.id === personal.id));

  await expectAssessmentError(() => applyAssessmentActionForSession(session(identities.employee2), { action: "review", idempotencyKey: key("employee-denied"), assessmentId: employeeAssessment.id, status: "relevant", businessContext: "", supportAvailable: "", constraints: "", recommendedAction: "", managerComment: "Denied" }), 403);
  await expectAssessmentError(() => getAssessmentWorkspaceForSession(session(identities.platform)), 403);
  await expectAssessmentError(() => applyAssessmentActionForSession(session(crossOrgLead), { action: "review", idempotencyKey: key("cross-org-denied"), assessmentId: employeeAssessment.id, status: "relevant", businessContext: "", supportAvailable: "", constraints: "", recommendedAction: "", managerComment: "Denied" }), 404);
  check("Employee, Platform Admin and cross-organisation assessment access remain denied", true);

    result = { verdict: "PASS", projectRef: new URL(supabaseUrl).hostname.split(".")[0], fixture: "isolated fictional .test workspace (archived after validation)", checks: checks.length, labels: checks };
  } finally {
    await archiveCurrentFixture();
  }
  console.log(JSON.stringify(result, null, 2));
}

async function archiveCurrentFixture() {
  await rest("levytate_organisations", { method: "PATCH", query: { id: `eq.${organisationId}` }, body: { status: "Archived" } });
  await rest("levytate_organisations", { method: "PATCH", query: { id: `eq.${secondOrganisationId}` }, body: { status: "Archived" } });
  await rest("levytate_users", { method: "PATCH", query: { organisation_id: `in.(${organisationId},${secondOrganisationId})` }, body: { active: false } });
  await rest("levytate_employees", { method: "PATCH", query: { organisation_id: `eq.${organisationId}` }, body: { status: "Archived" } });
}

void main();
