import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

loadEnv(".env.local");

const baseUrl = (process.argv.find((value) => value.startsWith("http")) || "http://localhost:3110").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const betaCode = process.env.LEVYTATE_BETA_CODE;
if (!supabaseUrl || !serviceRoleKey || !betaCode) throw new Error("Client V1 live validation requires the configured local Supabase and beta validation environment.");

const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const identities = {
  leadA: `client-v1-lead-a-${suffix}@levytate.test`,
  managerA: `client-v1-manager-a-${suffix}@levytate.test`,
  employeeA: `client-v1-employee-a-${suffix}@levytate.test`,
  leadB: `client-v1-lead-b-${suffix}@levytate.test`,
};
const authUserIds = new Set();
const grantEmails = new Set();
const organisationIds = [];
const checks = [];
const cleanupTables = ["levytate_intelligence_signal_events", "levytate_intelligence_signals", "levytate_finance_transactions", "levytate_finance_imports", "levytate_finance_balances", "levytate_organisation_programmes", "levytate_organisation_providers"];

try {
  const platform = await betaLogin("hello@levytate.co.uk");
  const employerA = await platformAction(platform, { action: "create_workspace", name: `Founding Employer V1 Test ${suffix}`, workspaceName: "Founding Employer V1 Test", primaryContact: "Validation Lead", contactEmail: identities.leadA, initialRole: "Apprenticeship Lead" });
  const employerB = await platformAction(platform, { action: "create_workspace", name: `Second Blank Employer V1 Test ${suffix}`, workspaceName: "Second Blank Employer V1 Test", primaryContact: "Validation Lead Two", contactEmail: identities.leadB, initialRole: "Apprenticeship Lead" });
  organisationIds.push(employerA.workspace.id, employerB.workspace.id);
  pass("workspaces created through Platform Admin flow");

  await platformAction(platform, { action: "provision_user", organisationId: employerA.workspace.id, email: identities.managerA, displayName: "Validation Manager", role: "Line Manager" });
  await platformAction(platform, { action: "provision_user", organisationId: employerA.workspace.id, email: identities.employeeA, displayName: "Validation Employee", role: "Employee" });
  pass("normal passwordless identities provisioned before data access");
  for (const email of Object.values(identities)) await grantInternalValidationAccess(email);

  const blankA = await operationalCounts(employerA.workspace.id);
  const blankB = await operationalCounts(employerB.workspace.id);
  assertAllZero("first employer starts blank", blankA);
  assertAllZero("second employer starts blank", blankB);

  const leadA = { cookie: await betaLogin(identities.leadA) };
  const leadB = { cookie: await betaLogin(identities.leadB) };
  const initialA = await workspace(leadA.cookie);
  const initialB = await workspace(leadB.cookie);
  assert(initialA.meta.userRole === "Apprenticeship Lead" && initialB.meta.userRole === "Apprenticeship Lead", "canonical lead roles resolve");
  assert(initialA.data.providers.length > 0 && initialA.data.providerProgrammes.length > 0, "global Marketplace is available to blank employer A");
  assert(initialB.data.providers.length === initialA.data.providers.length && initialB.data.providerProgrammes.length === initialA.data.providerProgrammes.length, "blank employer B sees the same global Marketplace");
  const intelligence = await jsonRequest("/api/levytate-provider-intelligence", { cookie: leadA.cookie });
  assert(intelligence.articles?.length > 0, "global Provider Intelligence is available to blank employers");

  const qa = initialA.data.providers.find((provider) => provider.providerName.trim().toLowerCase() === "qa");
  assert(Boolean(qa), "QA exists in the canonical Marketplace");
  const qaProgramme = initialA.data.providerProgrammes.find((programme) => programme.providerId === qa.providerId && programme.status === "Active" && programme.recordStatus === "Active");
  assert(Boolean(qaProgramme), "QA has an active canonical programme");
  const standardId = qaProgramme.linkedStandardId || qaProgramme.linkedStandardIds[0];
  assert(Boolean(standardId), "selected Marketplace programme has a canonical standard");
  const globalCounts = { providers: initialA.data.providers.length, programmes: initialA.data.providerProgrammes.length, articles: intelligence.articles.length };

  const now = new Date().toISOString();
  await mutate(leadA.cookie, { type: "saveOrganisationProvider", selection: { providerId: qa.providerId, status: "Active", selectedAt: now, updatedAt: now } });
  await mutate(leadA.cookie, { type: "saveOrganisationProgramme", selection: { programmeId: qaProgramme.id, providerId: qa.providerId, status: "Active", selectedAt: now, updatedAt: now } });
  let afterSelectionA = await workspace(leadA.cookie);
  const afterSelectionB = await workspace(leadB.cookie);
  assert(afterSelectionA.data.organisationProviders.filter(active).length === 1 && afterSelectionB.data.organisationProviders.length === 0, "My Providers selection is tenant-specific");
  assert(afterSelectionA.data.organisationProgrammes.filter(active).length === 1 && afterSelectionB.data.organisationProgrammes.length === 0, "My Programmes selection is tenant-specific");
  assert(afterSelectionA.data.providers.length === globalCounts.providers && afterSelectionA.data.providerProgrammes.length === globalCounts.programmes, "employer selections do not copy or alter the global Marketplace");

  await mutate(leadB.cookie, { type: "saveOrganisationProvider", selection: { providerId: qa.providerId, status: "Active", selectedAt: now, updatedAt: now } });
  const independentlySelectedA = await workspace(leadA.cookie);
  const independentlySelectedB = await workspace(leadB.cookie);
  assert(independentlySelectedA.data.organisationProviders.filter(active).length === 1 && independentlySelectedB.data.organisationProviders.filter(active).length === 1, "both employers can independently select the same canonical provider");
  await restJson(`levytate_organisation_providers?organisation_id=eq.${employerB.workspace.id}&provider_id=eq.${encodeURIComponent(qa.providerId)}`, { method: "DELETE", prefer: "return=minimal" });
  const resetB = await workspace(leadB.cookie);
  assert(resetB.data.organisationProviders.length === 0 && independentlySelectedA.data.organisationProviders.filter(active).length === 1, "test cleanup returns employer B to blank without affecting employer A");

  const roleId = `client-v1-role-${suffix}`;
  const leadEmployeeId = `client-v1-lead-${suffix}`;
  const managerEmployeeId = `client-v1-manager-${suffix}`;
  const employeeId = `client-v1-employee-${suffix}`;
  await mutate(leadA.cookie, { type: "saveRole", role: { id: roleId, title: "Data Operations Analyst", department: "Operations", businessArea: "Data", careerLevel: "Professional", skillsTags: ["data"], progression: [], pathwayMappings: [{ id: `client-v1-map-${suffix}`, apprenticeshipStandardId: standardId, recommendationType: "Primary", priority: 1, businessRationale: "Approved Client V1 programme.", fundingRoute: "Potentially funded through levy/co-investment", deliveryPreference: "Mixed" }], status: "Active", createdAt: now, updatedAt: now } });
  for (const employee of [
    employeeRecord(leadEmployeeId, "Validation Lead", identities.leadA, "Apprenticeship Lead", roleId, ""),
    employeeRecord(managerEmployeeId, "Validation Manager", identities.managerA, "Line Manager", roleId, ""),
    employeeRecord(employeeId, "Validation Employee", identities.employeeA, "Employee", roleId, managerEmployeeId),
  ]) await mutate(leadA.cookie, { type: "saveEmployee", employee });
  afterSelectionA = await workspace(leadA.cookie);
  assert(afterSelectionA.data.employees.length === 3, "People manual onboarding persists three organisation-scoped records");

  const employee = { cookie: await betaLogin(identities.employeeA) };
  const employeeWorkspace = await workspace(employee.cookie);
  assert(employeeWorkspace.data.providerProgrammes.length === 1 && employeeWorkspace.data.providerProgrammes[0].id === qaProgramme.id, "Employee sees only the active employer programme");
  const manager = { cookie: await betaLogin(identities.managerA) };
  const managerWorkspace = await workspace(manager.cookie);
  assert(managerWorkspace.data.employees.some((item) => item.id === employeeId), "Line Manager sees the current direct report");

  const applicationId = `client-v1-application-${suffix}`;
  await mutate(employee.cookie, { type: "saveApplication", application: { id: applicationId, employeeId, apprenticeshipStandardId: standardId, status: "Submitted to Line Manager", currentOwner: "Line Manager", reason: "Build data capability in the current role.", careerGoal: "Lead operational analysis.", supportRequired: "Protected learning time.", managerNote: "", submittedAt: now, updatedAt: now, history: [{ id: `client-v1-history-submit-${suffix}`, status: "Submitted to Line Manager", owner: "Line Manager", note: "Submitted for manager review.", createdAt: now }] } });
  await mutate(manager.cookie, { type: "updateApplicationStatus", id: applicationId, status: "Approved by Line Manager", note: "Supported with protected learning time and an appropriate workplace project." });
  await mutate(leadA.cookie, { type: "updateApplicationStatus", id: applicationId, status: "Approved for Enrolment", note: "Approved for enrolment against the selected employer programme." });
  const approved = await workspace(employee.cookie);
  assert(approved.data.applications[0]?.status === "Approved for Enrolment", "application decisions persist across Employee, Line Manager and Apprenticeship Lead sessions");

  const enrolmentId = `client-v1-enrolment-${suffix}`;
  await mutate(leadA.cookie, { type: "saveEnrolment", enrolment: { id: enrolmentId, applicationId, employeeId, providerId: qa.providerId, apprenticeshipStandardId: standardId, status: "Live learner", startDate: "2026-06-01", notes: "Client V1 validation enrolment.", createdAt: now, updatedAt: now } });
  const learnerId = `client-v1-learner-${suffix}`;
  const createdLearner = await jsonRequest("/api/levytate-learners", { method: "POST", cookie: leadA.cookie, body: { id: learnerId, employeeId, applicationId, programmeId: qaProgramme.id, providerId: qa.providerId, enrolmentId, lifecycleStatus: "enrolled", employmentRoute: "existing_employee_upskill", expectedStartDate: "2026-06-01", actualStartDate: "2026-06-01", expectedEndDate: "2027-08-31", actualEndDate: "" } }, 201);
  let activityVersion = createdLearner.learner.activityVersion;
  for (const [index, updateDate, target, actual] of [[1, "2026-06-30", 20, 18], [2, "2026-07-31", 35, 25], [3, "2026-08-31", 50, 28]]) {
    const progress = await jsonRequest(`/api/levytate-learners/${learnerId}/progress`, { method: "POST", cookie: leadA.cookie, body: { expectedActivityVersion: activityVersion, idempotencyKey: `client-v1-progress-${suffix}-${index}`, updateDate, targetProgressPercentage: target, actualProgressPercentage: actual, progressSource: "provider_report", summary: "Validated provider progress evidence.", supportAction: "Review progress variance." } });
    activityVersion = progress.learner.activityVersion;
  }
  await jsonRequest(`/api/levytate-learners/${learnerId}/reviews`, { method: "POST", cookie: leadA.cookie, body: { expectedActivityVersion: activityVersion, idempotencyKey: `client-v1-review-${suffix}`, reviewType: "provider_review", reviewDate: "2026-08-31", nextReviewDate: "2026-09-30", reviewerName: "Validation Lead", providerId: qa.providerId, summary: "Progress variance requires employer and provider follow-up.", actions: ["Agree a recovery plan."], supportRequired: "Provider action required.", status: "action_required" } });
  const learners = await jsonRequest("/api/levytate-learners", { cookie: leadA.cookie });
  assert(learners.learners?.length === 1 && learners.learners[0].learnerRecordId === learnerId, "existing learner onboarding, progress and provider review persist");
  const operations = await jsonRequest("/api/levytate-operations?synchronise=true", { cookie: leadA.cookie });
  assert(operations.summary && Object.values(operations.queues || {}).flat().length > 0, "Operations Centre derives queues from live organisation data");

  const analysed = await jsonRequest("/api/levytate-intelligence/signals", { method: "POST", cookie: leadA.cookie, body: { action: "analyse" } });
  assert(analysed.learnersAnalysed === 1 && analysed.signals?.length > 0, "real learner evidence creates persistent Intelligence Signals");
  const accepted = await jsonRequest("/api/levytate-intelligence/signals", { method: "POST", cookie: leadA.cookie, body: { action: "accept", signalId: analysed.signals[0].id } });
  assert(Boolean(accepted.signal?.linkedOperationalActionId), "accepted Intelligence Signal creates a persistent operational action");
  const actionDetail = await jsonRequest(`/api/levytate-operational-actions/${accepted.signal.linkedOperationalActionId}`, { cookie: leadA.cookie });
  await jsonRequest(`/api/levytate-operational-actions/${accepted.signal.linkedOperationalActionId}`, { method: "PATCH", cookie: leadA.cookie, body: { command: "complete", expectedVersion: actionDetail.action.version, completionNote: "Validated and completed in Client V1 acceptance.", resolvedOutsideLevyTate: true } });
  pass("accepted Intelligence action can be completed persistently");

  const financeTransactions = [financeTransaction("2026-08-01", "Levy contribution", "levy_in", 125000, 1), financeTransaction("2026-08-15", "QA training payment", "apprenticeship_spend", -45000, 2, qa.providerName)];
  const financeBody = { action: "import", fileName: "client-v1-das-validation.csv", result: { transactions: financeTransactions, sourceRows: 2, dateRange: { from: "2026-08-01", to: "2026-08-15" } } };
  const firstImport = await jsonRequest("/api/levytate-finance", { method: "POST", cookie: leadA.cookie, body: financeBody });
  const overlap = await jsonRequest("/api/levytate-finance", { method: "POST", cookie: leadA.cookie, body: financeBody });
  await jsonRequest("/api/levytate-finance", { method: "POST", cookie: leadA.cookie, body: { action: "balance", amountPence: 80000 } });
  assert(firstImport.record.newTransactions === 2 && overlap.record.newTransactions === 0 && overlap.record.duplicateRows === 2, "Finance import persists and overlapping transactions deduplicate");

  const copilotCases = [
    ["What programmes does QA offer?", "programme_results"],
    ["Which providers do we use?", "provider_results"],
    ["Which programmes are available to our employees?", "programme_results"],
    ["Find a Level 4 data programme we could add.", "programme_results"],
    ["How many QA learners do we currently have?", "provider_results"],
  ];
  for (const [question, expectedType] of copilotCases) {
    const answer = await askCopilot(leadA.cookie, question);
    assert(answer.executionMode === "deterministic" && [expectedType, "no_results"].includes(answer.structuredResult?.type), `Copilot grounds: ${question}`);
  }

  const access = await jsonRequest("/api/levytate-workspace/access", { cookie: leadA.cookie });
  assert(access.users?.length === 3 && access.users.every((user) => ["Active", "Inactive"].includes(user.accessState)), "Settings lists authorised users, roles and access state");
  const crossOrganisation = await rawRequest(`/api/levytate-learners?learnerRecordId=${encodeURIComponent(learnerId)}`, { cookie: leadB.cookie });
  assert(crossOrganisation.status === 404, "second employer cannot access first employer learner IDs");
  const secondStillBlank = await operationalCounts(employerB.workspace.id);
  assertAllZero("second employer remains blank after first employer operates", secondStillBlank);

  await logout(employee.cookie);
  const employeeAgain = { cookie: await betaLogin(identities.employeeA) };
  const persistedWorkspace = await workspace(employeeAgain.cookie);
  const persistedFinance = await jsonRequest("/api/levytate-finance", { cookie: leadA.cookie });
  assert(persistedWorkspace.data.applications.some((application) => application.id === applicationId && application.status === "Approved for Enrolment"), "application state survives logout and a new authenticated session");
  assert(persistedWorkspace.data.learnerRecords.some((learner) => learner.id === learnerId), "learner state survives logout and a new authenticated session");
  assert(persistedFinance.state.transactions.length === 2 && persistedFinance.state.manualBalancePence === 80000, "Finance data survives independent session reads");

  console.log(JSON.stringify({ ok: true, checksPassed: checks.length, globalMarketplace: globalCounts, firstEmployerFinal: await operationalCounts(employerA.workspace.id), secondEmployerFinal: secondStillBlank }, null, 2));
} finally {
  for (const organisationId of organisationIds) await cleanupOrganisation(organisationId).catch((error) => console.error("Client V1 cleanup warning", safeMessage(error)));
  for (const authUserId of authUserIds) await authRequest(`admin/users/${encodeURIComponent(authUserId)}`, { method: "DELETE" }).catch((error) => console.error("Client V1 Auth cleanup warning", safeMessage(error)));
  for (const email of grantEmails) await restJson(`subscribers?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", prefer: "return=minimal" }).catch((error) => console.error("Client V1 grant cleanup warning", safeMessage(error)));
}

function active(item) { return item.status === "Active"; }
function pass(label) { checks.push(label); console.log(`PASS ${label}`); }
function assert(condition, label) { if (!condition) throw new Error(`FAILED ${label}`); pass(label); }
function assertAllZero(label, counts) { assert(Object.values(counts).every((count) => count === 0), `${label}: ${Object.entries(counts).map(([key, count]) => `${key}=${count}`).join(", ")}`); }

async function platformAction(cookie, body) { return jsonRequest("/api/levytate-platform/workspaces", { method: "POST", cookie, body }, 201); }
async function betaLogin(email) {
  const response = await rawRequest("/api/levytate-beta-login", { method: "POST", body: { email, code: betaCode }, ip: `198.51.100.${Math.floor(Math.random() * 120) + 20}`, redirect: "manual" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Internal validation login failed (${response.status}): ${body.message || "safe response"}`);
  return cookieHeader(response.headers);
}
async function grantInternalValidationAccess(email) {
  grantEmails.add(email);
  await restJson("subscribers?on_conflict=email", { method: "POST", body: [{ email, status: "active", source_page: "/levytate/client-v1-validation", unsubscribe_token: randomUUID(), segments: ["levytate_beta_access"], updated_at: new Date().toISOString() }], prefer: "resolution=merge-duplicates,return=minimal" });
  const authUsers = await authJson("admin/users?page=1&per_page=1000");
  const authUser = authUsers.users?.find((user) => String(user.email || "").trim().toLowerCase() === email);
  if (!authUser?.id) throw new Error("The provisioned passwordless Auth identity was not found.");
  authUserIds.add(authUser.id);
  pass("provisioned passwordless Auth identity is present before internal workflow validation");
}

async function logout(cookie) { const response = await rawRequest("/api/levytate-beta-logout", { method: "POST", cookie, redirect: "manual" }); assert(response.status === 303, "logout clears the authenticated session"); }
async function workspace(cookie) { const result = await jsonRequest("/api/levytate-workspace", { cookie }); return result.workspace; }
async function mutate(cookie, body) { const result = await jsonRequest("/api/levytate-workspace", { method: "POST", cookie, body }); return result.workspace; }
async function askCopilot(cookie, userMessage) { return jsonRequest("/api/levytate-ai", { method: "POST", cookie, ip: `192.0.2.${checks.length + 20}`, body: { role: "Apprenticeship Lead", userRole: "Apprenticeship Lead", selectedSite: "All sites", currentSection: "LevyTate Copilot", userMessage, conversationHistory: [], employerContext: "Client V1 validation" } }); }

function employeeRecord(id, name, email, platformRole, roleId, managerId) { const timestamp = new Date().toISOString(); return { id, employeeNumber: id.slice(-20), name, email, jobTitle: platformRole === "Employee" ? "Data Operations Analyst" : platformRole, roleId, managerId, department: "Operations", site: "London", platformRole, status: "Active", startDate: "2026-01-01", createdAt: timestamp, updatedAt: timestamp }; }
function financeTransaction(date, description, category, amountPence, sourceRow, providerName = "") { const canonical = [date, description.toLowerCase(), amountPence, providerName, "", ""].join("|"); return { transactionId: randomUUID(), transactionDate: date, description, category, amountPence, providerName, sourceRow, fingerprint: createHash("sha256").update(canonical).digest("hex") }; }

async function operationalCounts(organisationId) {
  const tables = { employees: "levytate_employees", applications: "levytate_applications", learners: "levytate_learner_records", providers: "levytate_organisation_providers", programmes: "levytate_organisation_programmes", reviews: "levytate_learner_reviews", progress: "levytate_learner_progress_updates", actions: "levytate_operational_actions", signals: "levytate_intelligence_signals", financeTransactions: "levytate_finance_transactions", financeImports: "levytate_finance_imports", providerRelationships: "levytate_provider_relationships" };
  return Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([key, table]) => [key, (await restJson(`${table}?select=organisation_id&organisation_id=eq.${organisationId}`)).length])));
}

async function cleanupOrganisation(organisationId) { for (const table of cleanupTables) await restJson(`${table}?organisation_id=eq.${organisationId}`, { method: "DELETE", prefer: "return=minimal" }); await restJson(`levytate_organisations?id=eq.${organisationId}`, { method: "DELETE", prefer: "return=minimal" }); }

async function jsonRequest(path, options = {}, expectedStatus = 200) { const response = await rawRequest(path, options); const body = await response.json().catch(() => ({})); if (response.status !== expectedStatus) throw new Error(`${path} failed (${response.status}): ${body.message || body.error || "safe response"}`); return body; }
async function rawRequest(path, { method = "GET", cookie, body, redirect = "follow", ip } = {}) { return fetch(`${baseUrl}${path}`, { method, redirect, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
function cookieHeader(headers) { const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") || ""]; const cookie = values.filter(Boolean).map((value) => value.split(";", 1)[0]).find((value) => value.startsWith("levytate_beta_session=")); if (!cookie) throw new Error("Internal validation session cookie was not issued."); return cookie; }
async function authJson(path, options = {}) { const response = await authRequest(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Supabase Auth validation request failed (${response.status}).`); return body; }
async function authRequest(path, { method = "GET", body } = {}) { return fetch(`${supabaseUrl}/auth/v1/${path}`, { method, headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); }
async function restJson(path, { method = "GET", body, prefer } = {}) { const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { method, headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, ...(body ? { "content-type": "application/json" } : {}), ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined }); if (!response.ok) throw new Error(`Supabase request for ${path.split("?", 1)[0]} failed (${response.status}).`); if (response.status === 204) return []; return response.json().catch(() => []); }
function safeMessage(error) { return error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]") : "cleanup failed"; }
function loadEnv(file) { const source = readFileSync(file, "utf8"); for (const line of source.split(/\r?\n/)) { const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (!match || process.env[match[1]]) continue; let value = match[2].trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1); process.env[match[1]] = value; } }
