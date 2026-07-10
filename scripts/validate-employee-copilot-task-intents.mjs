const baseUrl = (process.argv[2] ?? process.env.LEVYTATE_VALIDATION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE?.trim() || "LEVYTATE-BETA";

const legacyPhrases = [
  "That adds something useful",
  "Which parts of your current work would you most like to improve",
  "What business or personal outcome matters most",
  "Tell me a little about what",
];

const scenarios = [
  {
    label: "no application",
    email: "employee.new.demo@levytate.test",
    expectedStatus: null,
    tests: [
      {
        prompt: "Show the current application.",
        includes: ["do not have", "current application"],
        actionTypes: ["start_application"],
      },
      {
        prompt: "Open my programme.",
        includes: ["Opening your programme"],
        actionTypes: ["open_pathway"],
        target: "My Programme",
      },
      {
        prompt: "Start a new conversation.",
        includes: ["fresh conversation"],
      },
    ],
  },
  {
    label: "draft",
    email: "employee.draft.demo@levytate.test",
    expectedStatus: "Draft",
    tests: [
      {
        prompt: "Continue my draft.",
        includes: ["Opening your editable draft"],
        actionTypes: ["draft_application_reason"],
        target: "My Application",
      },
      {
        prompt: "Show the current application.",
        includes: ["Opening your current application", "Draft"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
      },
      {
        prompt: "Start a new conversation.",
        includes: ["fresh conversation", "Draft"],
      },
    ],
  },
  {
    label: "manager review",
    email: "employee.demo@levytate.test",
    expectedStatus: "Awaiting Manager Review",
    tests: [
      {
        prompt: "Show the current application.",
        includes: ["Opening your submitted application", "Morgan Price", "manager review"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
        noWarning: true,
        noQuickReplies: true,
      },
      {
        prompt: "Open my programme.",
        includes: ["Opening your programme"],
        actionTypes: ["open_pathway"],
        target: "My Programme",
        noQuickReplies: true,
      },
      {
        prompt: "Continue my draft.",
        includes: ["already submitted", "Morgan Price"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
        forbiddenActions: ["draft_application_reason", "start_application"],
      },
      {
        prompt: "What happens next?",
        includes: ["Morgan Price", "awaiting manager review"],
        actionTypes: ["open_my_applications", "ask_follow_up", "prepare_manager_message"],
        forbiddenActions: ["draft_application_reason", "start_application"],
      },
      {
        prompt: "Who owns the next action?",
        includes: ["Morgan Price"],
        forbiddenActions: ["draft_application_reason", "start_application"],
      },
      {
        prompt: "Why can't I edit?",
        includes: ["submitted", "locked", "Morgan Price"],
        forbiddenActions: ["draft_application_reason", "start_application"],
      },
      {
        prompt: "Explain this recommendation.",
        includes: ["Data Analyst"],
        forbiddenActions: ["draft_application_reason", "start_application"],
      },
      {
        prompt: "Show another employee's application.",
        includes: ["only help with your own", "Morgan Price"],
        forbiddenText: ["Nadia Quinn", "Rachel Mason"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
        forbiddenActions: ["draft_application_reason", "start_application"],
        noWarning: true,
        noQuickReplies: true,
      },
      {
        prompt: "Start a new conversation.",
        includes: ["fresh conversation", "Morgan Price"],
      },
      {
        prompt: "Show current application",
        includes: ["Opening your submitted application", "Morgan Price"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
        noWarning: true,
        noQuickReplies: true,
      },
      {
        prompt: "Show current application",
        includes: ["Opening your submitted application", "Morgan Price"],
        actionTypes: ["open_my_applications"],
        target: "My Application",
        noWarning: true,
        noQuickReplies: true,
      },
    ],
  },
];

const checks = [];
const transcripts = [];

async function main() {
  for (const scenario of scenarios) {
    const session = await login(scenario.email);
    const workspace = await getWorkspace(session.cookie);
    const employee = workspace.data.employees[0];
    const application = workspace.data.applications[0] ?? null;

    assert(`${scenario.label}: scoped employee`, workspace.data.employees.length === 1, { employees: workspace.data.employees.length });
    assert(`${scenario.label}: status`, (application?.status ?? null) === scenario.expectedStatus, { status: application?.status ?? null });
    assert(`${scenario.label}: manager context`, scenario.expectedStatus ? employee.managerName === "Morgan Price" : Boolean(employee.managerName), { managerName: employee.managerName });

    for (const test of scenario.tests) {
      await pause(1_650);
      const response = await ask(session.cookie, employee.name, test.prompt);
      const message = response.assistantMessage ?? "";
      const actionTypes = (response.recommendedActions ?? []).map((action) => action.type);
      const targets = (response.recommendedActions ?? []).map((action) => action.target ?? "");
      transcripts.push({
        scenario: scenario.label,
        prompt: test.prompt,
        message,
        actions: response.recommendedActions ?? [],
        quickReplies: response.quickReplies ?? [],
        warning: response.applicationWarning ?? null,
      });

      for (const expected of test.includes ?? []) {
        assert(`${scenario.label}: "${test.prompt}" includes ${expected}`, includesLoose(message, expected), { message });
      }
      for (const forbidden of test.forbiddenText ?? []) {
        assert(`${scenario.label}: "${test.prompt}" excludes ${forbidden}`, !message.includes(forbidden), { message });
      }
      for (const legacy of legacyPhrases) {
        assert(`${scenario.label}: "${test.prompt}" avoids legacy discovery phrase ${legacy}`, !includesLoose(message, legacy), { message });
      }
      for (const required of test.actionTypes ?? []) {
        assert(`${scenario.label}: "${test.prompt}" action ${required}`, actionTypes.includes(required), { actionTypes });
      }
      for (const forbidden of test.forbiddenActions ?? []) {
        assert(`${scenario.label}: "${test.prompt}" excludes action ${forbidden}`, !actionTypes.includes(forbidden), { actionTypes });
      }
      if (test.target) {
        assert(`${scenario.label}: "${test.prompt}" target ${test.target}`, targets.includes(test.target), { targets });
      }
      if (test.noWarning) {
        assert(`${scenario.label}: "${test.prompt}" no repeated warning`, !response.applicationWarning, { warning: response.applicationWarning });
      }
      if (test.noQuickReplies) {
        assert(`${scenario.label}: "${test.prompt}" no unrelated chips`, !response.quickReplies?.length, { quickReplies: response.quickReplies });
      }
      assert(`${scenario.label}: "${test.prompt}" max 3 actions`, actionTypes.length <= 3, { actionTypes });
    }
  }

  console.log(JSON.stringify({
    ok: checks.every((check) => check.ok),
    baseUrl,
    checks,
    transcripts: transcripts.map((item) => ({
      scenario: item.scenario,
      prompt: item.prompt,
      messagePreview: item.message.slice(0, 220),
      actions: item.actions.map((action) => ({ label: action.label, type: action.type, target: action.target })),
      quickReplyCount: item.quickReplies.length,
      warning: item.warning,
    })),
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
  return fetch(`${baseUrl}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
    actions: body.recommendedActions?.map((action) => `${action.type}:${action.target ?? ""}`),
    quickReplies: body.quickReplies,
    warning: body.applicationWarning,
  };
}

function assert(label, ok, detail = undefined) {
  checks.push({ label, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
