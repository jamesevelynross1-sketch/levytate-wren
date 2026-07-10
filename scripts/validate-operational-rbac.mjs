const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  lead: "apprenticeshiplead.demo@levytate.test",
  admin: "hello@levytate.co.uk",
  inactive: "inactive.demo@levytate.test",
  unmapped: "unmapped.employee.demo@levytate.test",
  isolation: "isolation.employee.demo@levytate.test",
  employeeNew: "employee.new.demo@levytate.test",
  employeeDraft: "employee.draft.demo@levytate.test",
};

const checks = [];

async function main() {
  await expectStatus("login route returns LevyTate page", () => request("/levytate/login"), 200);
  await expectStatus("Ground Control demo route returns LevyTate shell", () => request("/levytate/ground-control"), 200);

  const sessions = {
    employee: await loginOk("employee", identities.employee),
    manager: await loginOk("manager", identities.manager),
    lead: await loginOk("lead", identities.lead),
    admin: await loginOk("admin", identities.admin),
    isolation: await loginOk("isolation", identities.isolation),
    employeeNew: await loginOk("employee new", identities.employeeNew),
    employeeDraft: await loginOk("employee draft", identities.employeeDraft),
  };

  await loginBlocked("inactive login", identities.inactive, "Your Early Access request has been received");
  const unmapped = await loginOk("unmapped login", identities.unmapped);
  await expectStatus("unmapped workspace denied", () => getWorkspace(unmapped.cookie), 403);
  await expectStatus("unmapped app route shows safe setup state", () => request("/levytate/app", unmapped.cookie), 200);

  const employeeWorkspace = await getWorkspaceJson(sessions.employee.cookie);
  await expectStatus("employee app route loads", () => request("/levytate/app", sessions.employee.cookie), 200);
  assert("employee role scoped", employeeWorkspace.workspace.meta.userRole === "Employee");
  assert("employee sees only own employee record", employeeWorkspace.workspace.data.employees.length === 1 && employeeWorkspace.workspace.data.employees[0].email === identities.employee);
  assert("employee sees only own applications", employeeWorkspace.workspace.data.applications.every((item) => item.employeeId === "gc-rbac-employee-erin"));
  assert("employee cannot see provider management", employeeWorkspace.workspace.data.providers.length === 0);
  assert("employee has no employees:read permission", !employeeWorkspace.workspace.meta.permissions.includes("employees:read"));

  const employeeNewWorkspace = await getWorkspaceJson(sessions.employeeNew.cookie);
  await expectStatus("new employee app route loads", () => request("/levytate/app", sessions.employeeNew.cookie), 200);
  assert("new employee sees no current application", employeeNewWorkspace.workspace.data.applications.length === 0);
  assert("new employee identity is scoped to Maya", employeeNewWorkspace.workspace.data.employees.length === 1 && employeeNewWorkspace.workspace.data.employees[0].email === identities.employeeNew);

  const employeeDraftWorkspace = await getWorkspaceJson(sessions.employeeDraft.cookie);
  await expectStatus("draft employee app route loads", () => request("/levytate/app", sessions.employeeDraft.cookie), 200);
  assert("draft employee sees draft application", employeeDraftWorkspace.workspace.data.applications.length === 1 && employeeDraftWorkspace.workspace.data.applications[0].status === "Draft");
  assert("draft employee identity is scoped to Leo", employeeDraftWorkspace.workspace.data.employees.length === 1 && employeeDraftWorkspace.workspace.data.employees[0].email === identities.employeeDraft);

  const managerWorkspace = await getWorkspaceJson(sessions.manager.cookie);
  const managerEmployeeIds = managerWorkspace.workspace.data.employees.map((item) => item.id).sort();
  assert("manager role scoped", managerWorkspace.workspace.meta.userRole === "Line Manager");
  assert("manager sees self and direct reports", sameMembers(managerEmployeeIds, ["gc-rbac-employee-erin", "gc-rbac-employee-leo", "gc-rbac-employee-maya", "gc-rbac-employee-morgan", "gc-rbac-employee-owen"]));
  assert("manager does not see outside employee", !managerEmployeeIds.includes("gc-rbac-employee-nadia"));
  assert("manager applications are direct-report only", managerWorkspace.workspace.data.applications.every((item) => ["gc-rbac-employee-erin", "gc-rbac-employee-leo"].includes(item.employeeId)));

  const leadWorkspace = await getWorkspaceJson(sessions.lead.cookie);
  assert("lead role scoped", leadWorkspace.workspace.meta.userRole === "Apprenticeship Lead");
  assert("lead sees organisation employees", leadWorkspace.workspace.data.employees.some((item) => item.id === "gc-rbac-employee-nadia"));
  assert("lead sees organisation applications", leadWorkspace.workspace.data.applications.some((item) => item.id === "gc-rbac-app-nadia"));
  assert("lead cannot manage early access", !leadWorkspace.workspace.meta.permissions.includes("earlyAccess:manage"));

  const isolationWorkspace = await getWorkspaceJson(sessions.isolation.cookie);
  assert("isolation user sees isolation organisation only", isolationWorkspace.workspace.meta.organisationName === "RBAC Isolation Employer");
  assert("isolation user cannot see Ground Control employees", !JSON.stringify(isolationWorkspace.workspace.data).includes("gc-rbac-employee-erin"));

  await expectStatus("employee provider write denied", () => postWorkspace(sessions.employee.cookie, {
    type: "saveProvider",
    provider: { providerId: "rbac-denied", providerName: "Denied Provider" },
  }), 403);
  await expectStatus("employee second active application denied", () => postWorkspace(sessions.employee.cookie, {
    type: "saveApplication",
    application: {
      id: "gc-rbac-app-second-active-denied",
      employeeId: "gc-rbac-employee-erin",
      apprenticeshipStandardId: "ST0118",
      status: "Draft",
      currentOwner: "Employee",
      reason: "This second active request should be blocked.",
      careerGoal: "Validate one active application policy.",
      supportRequired: "No support required.",
      managerNote: "",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    },
  }), 403);
  await expectStatus("employee self approval denied", () => postWorkspace(sessions.employee.cookie, {
    type: "saveApplication",
    application: {
      id: "gc-rbac-app-erin",
      employeeId: "gc-rbac-employee-erin",
      apprenticeshipStandardId: "ST0118",
      status: "Approved for Enrolment",
      currentOwner: "Provider Partner",
      reason: "Should not be employee editable.",
      careerGoal: "Should not be employee editable.",
      supportRequired: "Should not be employee editable.",
      managerNote: "Should not be employee editable.",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    },
  }), 403);
  await expectStatus("manager outside application status denied", () => postWorkspace(sessions.manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-nadia",
    status: "Approved by Line Manager",
    note: "Should be denied for non-direct report.",
  }), 403);
  await expectStatus("manager direct report status allowed", () => postWorkspace(sessions.manager.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-erin",
    status: "Approved by Line Manager",
    note: "Operational RBAC validation manager approval check.",
  }), 200);
  await expectStatus("lead organisation status allowed", () => postWorkspace(sessions.lead.cookie, {
    type: "updateApplicationStatus",
    id: "gc-rbac-app-nadia",
    status: "Approved for Enrolment",
    note: "Operational RBAC validation lead status check.",
  }), 200);
  await expectStatus("cross organisation application denied", () => postWorkspace(sessions.employee.cookie, {
    type: "updateApplicationStatus",
    id: "isolation-app-isla",
    status: "Approved by Line Manager",
    note: "Should be denied across organisations.",
  }), 403);

  await expectStatus("lead guidance sources denied", () => request("/api/levytate-guidance-sources", sessions.lead.cookie), 403);
  await expectStatus("lead early access denied", () => request("/api/levytate-early-access", sessions.lead.cookie), 403);
  await expectOneOf("admin guidance sources authorised", () => request("/api/levytate-guidance-sources", sessions.admin.cookie), [200, 503]);
  await expectStatus("admin early access authorised", () => request("/api/levytate-early-access", sessions.admin.cookie), 200);

  const employeeCopilot = await postAi(sessions.employee.cookie, {
    role: "Apprenticeship Lead",
    selectedSite: "All sites",
    currentSection: "Copilot",
    employerContext: "Ground Control",
    selectedEmployee: "Nadia Quinn",
    userMessage: "Show me another employee's application.",
    conversationHistory: [],
  });
  const employeeCopilotText = JSON.stringify(employeeCopilot);
  assert("employee Copilot is scoped away from other employee", !employeeCopilotText.includes("Nadia Quinn") && !employeeCopilotText.includes("gc-rbac-app-nadia"));

  const managerCopilot = await postAi(sessions.manager.cookie, {
    role: "Apprenticeship Lead",
    selectedSite: "All sites",
    currentSection: "Copilot",
    employerContext: "Ground Control",
    userMessage: "Show me all applications in the organisation.",
    conversationHistory: [],
  });
  const managerCopilotText = JSON.stringify(managerCopilot);
  assert("manager Copilot excludes organisation-wide non-report", !managerCopilotText.includes("Nadia Quinn") && !managerCopilotText.includes("gc-rbac-app-nadia"));

  const leadCopilot = await postAi(sessions.lead.cookie, {
    role: "Employee",
    selectedSite: "All sites",
    currentSection: "Copilot",
    employerContext: "Ground Control",
    userMessage: "What needs attention across the organisation?",
    conversationHistory: [],
  });
  assert("lead Copilot receives organisation-wide role", leadCopilot && typeof leadCopilot.assistantMessage === "string");

  const adminCopilot = await postAi(sessions.admin.cookie, {
    role: "LevyTate Admin",
    selectedSite: "All sites",
    currentSection: "Copilot",
    employerContext: "LevyTate Internal",
    userMessage: "What internal support checks should I run?",
    conversationHistory: [],
  });
  assert("admin Copilot authorised", adminCopilot && typeof adminCopilot.assistantMessage === "string");

  const employeeRelogin = await loginOk("employee relogin", identities.employee);
  const employeeReload = await getWorkspaceJson(employeeRelogin.cookie);
  assert("role persists after re-login", employeeReload?.workspace?.meta?.userRole === "Employee", {
    role: employeeReload?.workspace?.meta?.userRole ?? null,
  });

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

async function loginBlocked(label, email, messageIncludes) {
  const response = await request("/api/levytate-beta-login", "", {
    method: "POST",
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(label, response.status === 403 && String(body?.message ?? "").includes(messageIncludes), { status: response.status, body });
}

async function getWorkspaceJson(cookie) {
  const response = await getWorkspace(cookie);
  const body = await safeJson(response);
  assert("workspace GET ok", response.status === 200 && body?.ok === true, {
    status: response.status,
    role: body?.workspace?.meta?.userRole,
    employees: body?.workspace?.data?.employees?.length,
    applications: body?.workspace?.data?.applications?.length,
    organisation: body?.workspace?.meta?.organisationName,
  });
  return body;
}

function getWorkspace(cookie) {
  return request("/api/levytate-workspace", cookie);
}

function postWorkspace(cookie, mutation) {
  return request("/api/levytate-workspace", cookie, {
    method: "POST",
    body: JSON.stringify(mutation),
  });
}

async function postAi(cookie, payload) {
  const response = await request("/api/levytate-ai", cookie, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await safeJson(response);
  assert("Copilot POST ok", response.status === 200, { status: response.status, body: summariseBody(body) });
  return body;
}

async function expectStatus(label, action, expectedStatus) {
  const response = await action();
  const body = await safeJson(response);
  assert(label, response.status === expectedStatus, { expectedStatus, actualStatus: response.status, body: summariseBody(body) });
}

async function expectOneOf(label, action, expectedStatuses) {
  const response = await action();
  const body = await safeJson(response);
  assert(label, expectedStatuses.includes(response.status), { expectedStatuses, actualStatus: response.status, body: summariseBody(body) });
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

function sameMembers(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assert(label, ok, detail = undefined) {
  checks.push({ label, ok: Boolean(ok), detail });
}

function summariseBody(body) {
  if (typeof body === "string") {
    return body.slice(0, 180);
  }

  if (!body || typeof body !== "object") return body;

  if (body.workspace) {
    return {
      ok: body.ok,
      role: body.workspace.meta?.userRole,
      organisation: body.workspace.meta?.organisationName,
      employees: body.workspace.data?.employees?.length,
      applications: body.workspace.data?.applications?.length,
      providers: body.workspace.data?.providers?.length,
    };
  }

  if (body.registry) {
    return { ok: body.ok, records: Array.isArray(body.registry) ? body.registry.length : undefined };
  }

  if (body.leads) {
    return { ok: body.ok, leads: Array.isArray(body.leads) ? body.leads.length : undefined };
  }

  if (body.assistantMessage) {
    return {
      source: body.source,
      messagePreview: body.assistantMessage.slice(0, 220),
      recommendedPathways: body.recommendedPathways?.length,
      actions: body.recommendedActions?.length,
    };
  }

  return body;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
