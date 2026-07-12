const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";
let validationRequestCount = 0;

const identities = [
  {
    label: "no application",
    email: "employee.new.demo@levytate.test",
    manager: "Morgan Price",
    expectedStatus: null,
    prompts: [
      { text: "Explain this recommendation.", mustInclude: ["Data Analyst"], forbiddenActions: [] },
      { text: "Help me draft my application.", mustInclude: ["start", "application"], requiredActions: ["start_application"] },
      { text: "Show me another employee's application.", mustInclude: ["only help with your own"], forbiddenText: ["Nadia Quinn", "Rachel Mason"] },
      { text: "What should I do today?", mustInclude: ["start", "application"] },
    ],
  },
  {
    label: "draft",
    email: "employee.draft.demo@levytate.test",
    manager: "Morgan Price",
    expectedStatus: "Draft",
    prompts: [
      { text: "Explain this recommendation.", mustInclude: ["Data Analyst"], forbiddenActions: ["start_application"] },
      { text: "Help me draft my application.", mustInclude: ["draft"], requiredActions: ["draft_application_reason"], forbiddenActions: ["start_application"] },
      { text: "What happens next?", mustInclude: ["Continue", "draft"], forbiddenActions: ["start_application"] },
      { text: "What should I do today?", mustInclude: ["continue", "draft"], forbiddenActions: ["start_application"] },
    ],
  },
  {
    label: "manager review",
    email: "employee.demo@levytate.test",
    manager: "Morgan Price",
    expectedStatus: "Awaiting Manager Review",
    prompts: [
      { text: "Explain this recommendation.", mustInclude: ["Data Analyst"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "Why can't I edit my application?", mustInclude: ["submitted", "locked", "Morgan Price"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "What happens next?", mustInclude: ["Morgan Price", "manager review"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "Help me draft my application.", mustInclude: ["already submitted"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "Show me another employee's application.", mustInclude: ["only help with your own", "Morgan Price"], forbiddenText: ["Nadia Quinn", "Rachel Mason"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "Who owns the next action?", mustInclude: ["Morgan Price"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "What does manager review mean?", mustInclude: ["Morgan Price", "workload"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "What information does my manager need?", mustInclude: ["submitted reason", "career goal"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "How much time will the programme require?", mustInclude: ["protected learning time"], forbiddenActions: ["start_application", "draft_application_reason"] },
      { text: "What should I do today?", mustInclude: ["do not need to edit", "Morgan Price"], forbiddenActions: ["start_application", "draft_application_reason"] },
    ],
  },
];

const checks = [];

async function main() {
  for (const identity of identities) {
    const session = await login(identity.email);
    const workspace = await getWorkspace(session.cookie);
    const employee = workspace.data.employees[0];
    const application = workspace.data.applications[0] ?? null;
    assert(`${identity.label}: scoped to one employee`, workspace.data.employees.length === 1, { employees: workspace.data.employees.length });
    assert(`${identity.label}: expected application status`, (application?.status ?? null) === identity.expectedStatus, { status: application?.status ?? null });

    for (const prompt of identity.prompts) {
      const result = await ask(session.cookie, employee.name, prompt.text);
      const message = result.assistantMessage ?? "";
      const actionTypes = (result.recommendedActions ?? []).map((action) => action.type);
      for (const required of prompt.mustInclude ?? []) {
        assert(`${identity.label}: "${prompt.text}" includes ${required}`, includesLoose(message, required), { message });
      }
      for (const forbidden of prompt.forbiddenText ?? []) {
        assert(`${identity.label}: "${prompt.text}" excludes ${forbidden}`, !message.includes(forbidden), { message });
      }
      for (const requiredAction of prompt.requiredActions ?? []) {
        assert(`${identity.label}: "${prompt.text}" action ${requiredAction}`, actionTypes.includes(requiredAction), { actionTypes });
      }
      for (const forbiddenAction of prompt.forbiddenActions ?? []) {
        assert(`${identity.label}: "${prompt.text}" excludes action ${forbiddenAction}`, !actionTypes.includes(forbiddenAction), { actionTypes });
      }
      assert(`${identity.label}: "${prompt.text}" action count <= 3`, actionTypes.length <= 3, { actionTypes });
      assert(`${identity.label}: "${prompt.text}" no generic discovery loop`, !/tell me a little about what/i.test(message), { message });
    }
  }

  console.log(JSON.stringify({
    ok: checks.every((check) => check.ok),
    baseUrl,
    checks,
    summary: {
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
    },
  }, null, 2));

  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

async function login(email) {
  const response = await request("/api/levytate-beta-login", "", {
    method: "POST",
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`${email} login accepted`, response.status === 200, { status: response.status, body });
  const cookie = cookieHeader(response);
  assert(`${email} session cookie set`, Boolean(cookie));
  return { cookie };
}

async function getWorkspace(cookie) {
  const response = await request("/api/levytate-workspace", cookie);
  const body = await safeJson(response);
  assert("workspace GET ok", response.status === 200 && body?.ok === true, { status: response.status, role: body?.workspace?.meta?.userRole });
  return body.workspace;
}

async function ask(cookie, selectedEmployee, userMessage) {
  const response = await request("/api/levytate-ai", cookie, {
    method: "POST",
    body: JSON.stringify({
      role: "Employee",
      selectedEmployee,
      selectedSite: "All sites",
      currentSection: "Copilot",
      employerContext: "Ground Control",
      userMessage,
      conversationHistory: [],
    }),
  });
  const body = await safeJson(response);
  assert(`Copilot responds to ${userMessage}`, response.status === 200, { status: response.status, body: summarise(body) });
  return body;
}

function request(pathName, cookie = "", init = {}) {
  validationRequestCount += 1;
  return fetch(`${baseUrl}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `198.51.100.${validationRequestCount}`,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text.slice(0, 400);
  }
}

function cookieHeader(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=\s*[^;=]+=[^;]+)/).map((part) => part.split(";")[0]).join("; ");
}

function includesLoose(value, expected) {
  return value.toLowerCase().includes(String(expected).toLowerCase());
}

function summarise(body) {
  if (!body || typeof body !== "object") return body;
  return {
    source: body.source,
    messagePreview: String(body.assistantMessage ?? "").slice(0, 180),
    actions: body.recommendedActions?.map((action) => action.type),
  };
}

function assert(label, ok, detail = undefined) {
  checks.push({ label, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
