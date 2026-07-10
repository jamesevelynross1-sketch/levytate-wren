import { execFileSync } from "node:child_process";

const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  lead: "apprenticeshiplead.demo@levytate.test",
};

const checks = [];

async function main() {
  await scenarioApprove();
  await scenarioRequestMoreInformation();
  await scenarioDecline();
  await scenarioSafeguards();
  resetSeed();

  console.log(JSON.stringify({
    ok: checks.every((check) => check.ok),
    baseUrl,
    checks,
    summary: {
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
    },
  }, null, 2));

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}

async function scenarioApprove() {
  resetSeed();
  const manager = await loginOk("manager approve scenario", identities.manager);
  const lead = await loginOk("lead approve scenario", identities.lead);
  const workspace = await getWorkspaceJson(manager.cookie);
  const queue = managerReviewQueue(workspace);
  assert("manager approval queue has Erin awaiting review", queue.some((item) => item.id === "gc-rbac-app-erin"));

  const response = await postWorkspaceJson(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Approved by Line Manager",
    note: [
      "Manager decision by Morgan Price: approved for Apprenticeship Lead review.",
      "Why supported: The programme supports Erin's reporting responsibilities.",
      "Workplace opportunity or support: Morgan can allocate operational reporting project evidence.",
      "Notes for Apprenticeship Lead: Confirm cohort timing.",
    ].join("\n"),
  });

  const approved = findApplication(response, "gc-rbac-app-erin");
  assert("approve sets canonical manager-approved status", approved?.status === "Approved by Line Manager", approved);
  assert("approve hands ownership to Apprenticeship Lead", approved?.currentOwner === "Apprenticeship Lead", approved);
  assert("approve records manager note in history", latestHistoryNote(approved).includes("approved for Apprenticeship Lead review"));

  const leadWorkspace = await getWorkspaceJson(lead.cookie);
  const leadApplication = findApplication(leadWorkspace, "gc-rbac-app-erin");
  assert("lead can see manager-approved application", leadApplication?.status === "Approved by Line Manager", leadApplication);
}

async function scenarioRequestMoreInformation() {
  resetSeed();
  const manager = await loginOk("manager request-info scenario", identities.manager);
  const employee = await loginOk("employee request-info scenario", identities.employee);

  const requested = await postWorkspaceJson(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "More information requested",
    note: "Manager decision by Morgan Price: more information requested.\nRequest: Please explain how this programme applies to your current reporting responsibilities.",
  });
  const returnedApplication = findApplication(requested, "gc-rbac-app-erin");
  assert("request info returns ownership to Employee", returnedApplication?.currentOwner === "Employee", returnedApplication);
  assert("request info uses canonical status", returnedApplication?.status === "More information requested", returnedApplication);

  const employeeWorkspace = await getWorkspaceJson(employee.cookie);
  const employeeApplication = findApplication(employeeWorkspace, "gc-rbac-app-erin");
  assert("employee sees manager request feedback", latestHistoryNote(employeeApplication).includes("Please explain how this programme applies"), employeeApplication);

  const resubmitted = await postWorkspaceJson(employee.cookie, {
    type: "saveApplication",
    application: {
      ...employeeApplication,
      status: "Submitted to Line Manager",
      currentOwner: "Line Manager",
      reason: `${employeeApplication.reason} I will use the programme to improve weekly job-completion reporting and handover quality.`,
      updatedAt: new Date().toISOString(),
    },
  });
  const resubmittedApplication = findApplication(resubmitted, "gc-rbac-app-erin");
  assert("employee can resubmit after manager request", resubmittedApplication?.status === "Submitted to Line Manager", resubmittedApplication);

  const managerReload = await getWorkspaceJson(manager.cookie);
  assert("manager queue includes resubmitted application", managerReviewQueue(managerReload).some((item) => item.id === "gc-rbac-app-erin"));
}

async function scenarioDecline() {
  resetSeed();
  const manager = await loginOk("manager decline scenario", identities.manager);
  const employee = await loginOk("employee decline scenario", identities.employee);

  const declined = await postWorkspaceJson(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Declined by Line Manager",
    note: "Manager decision by Morgan Price: declined.\nReason: The current role does not yet provide enough evidence opportunities.\nSuggested next step: Revisit after the reporting project scope is confirmed.",
  });
  const declinedApplication = findApplication(declined, "gc-rbac-app-erin");
  assert("decline sets canonical declined status", declinedApplication?.status === "Declined by Line Manager", declinedApplication);
  assert("decline returns ownership to Employee as closed outcome", declinedApplication?.currentOwner === "Employee", declinedApplication);

  const employeeWorkspace = await getWorkspaceJson(employee.cookie);
  const employeeApplication = findApplication(employeeWorkspace, "gc-rbac-app-erin");
  assert("employee sees decline feedback", latestHistoryNote(employeeApplication).includes("The current role does not yet provide enough evidence opportunities"), employeeApplication);
}

async function scenarioSafeguards() {
  resetSeed();
  const manager = await loginOk("manager safeguard scenario", identities.manager);

  await expectStatus("manager cannot decide outside reporting scope", () => postWorkspace(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-nadia",
    status: "Approved by Line Manager",
    note: "Should be denied.",
  }), 403);

  await expectStatus("manager cannot decide without note", () => postWorkspace(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Approved by Line Manager",
    note: "",
  }), 403);

  await expectStatus("manager cannot final approve", () => postWorkspace(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Approved for Enrolment",
    note: "Should be denied.",
  }), 403);

  await expectStatus("manager first decision allowed for double-decision setup", () => postWorkspace(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Approved by Line Manager",
    note: "Manager decision by Morgan Price: approved.",
  }), 200);

  await expectStatus("manager cannot decide twice", () => postWorkspace(manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Declined by Line Manager",
    note: "Should be denied after the first decision.",
  }), 403);
}

function resetSeed() {
  execFileSync("node", ["scripts/seed-operational-rbac-test-identities.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: process.env,
  });
}

function managerReviewQueue(workspaceBody) {
  return workspaceBody.workspace.data.applications.filter((application) =>
    ["Submitted to Line Manager", "Awaiting Manager Review"].includes(application.status)
  );
}

function findApplication(workspaceBody, id) {
  return workspaceBody?.workspace?.data?.applications?.find((application) => application.id === id) ?? null;
}

function latestHistoryNote(application) {
  return application?.history?.at(-1)?.note ?? "";
}

async function loginOk(label, email) {
  const response = await request("/api/levytate-beta-login", "", {
    method: "POST",
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`${label} login accepted`, response.status === 200, { status: response.status, body });
  const cookie = cookieHeader(response);
  assert(`${label} session cookie set`, Boolean(cookie));
  return { response, body, cookie };
}

async function getWorkspaceJson(cookie) {
  const response = await request("/api/levytate-workspace", cookie);
  const body = await safeJson(response);
  assert("workspace GET ok", response.status === 200 && body?.ok === true, {
    status: response.status,
    role: body?.workspace?.meta?.userRole,
    employees: body?.workspace?.data?.employees?.length,
    applications: body?.workspace?.data?.applications?.length,
  });
  return body;
}

async function postWorkspaceJson(cookie, mutation) {
  const response = await postWorkspace(cookie, mutation);
  const body = await safeJson(response);
  assert(`workspace POST ${mutation.type} ok`, response.status === 200 && body?.ok === true, {
    status: response.status,
    body: summariseBody(body),
  });
  return body;
}

function postWorkspace(cookie, mutation) {
  return request("/api/levytate-workspace", cookie, {
    method: "POST",
    body: JSON.stringify(mutation),
  });
}

async function expectStatus(label, action, expectedStatus) {
  const response = await action();
  const body = await safeJson(response);
  assert(label, response.status === expectedStatus, { expectedStatus, actualStatus: response.status, body: summariseBody(body) });
}

function request(pathName, cookie = "", init = {}) {
  return fetch(`${baseUrl}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
}

function cookieHeader(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.split(",").map((item) => item.trim()).find((item) => item.startsWith("levytate_beta_session="))?.split(";")[0] ?? "";
}

async function safeJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
}

function assert(label, ok, detail = undefined) {
  checks.push({ label, ok: Boolean(ok), detail });
}

function summariseBody(body) {
  if (!body || typeof body !== "object") return body;
  if (body.workspace) {
    return {
      ok: body.ok,
      role: body.workspace.meta?.userRole,
      employees: body.workspace.data?.employees?.length,
      applications: body.workspace.data?.applications?.length,
    };
  }
  return body;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
