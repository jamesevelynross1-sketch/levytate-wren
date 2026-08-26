const baseUrl = (process.argv.find((value) => value.startsWith("http")) || "http://localhost:3000").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const checks = [];

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  lead: "apprenticeshiplead.demo@levytate.test",
  admin: "hello@levytate.co.uk",
};

const sessions = Object.fromEntries(await Promise.all(Object.entries(identities).map(async ([role, email]) => [role, await login(email)])));
const workspaces = Object.fromEntries(await Promise.all(Object.entries(sessions).map(async ([role, cookie]) => [role, await workspace(cookie)])));

for (const role of ["employee", "manager", "lead"]) {
  const current = workspaces[role];
  assert(`${role} receives active catalogue records`, current.data.providers.length > 0 && current.data.providerProgrammes.length > 0);
  assert(`${role} has provider read access`, current.meta.permissions.includes("providers:read"));
  if (role !== "lead") assert(`${role} has no provider write access`, !current.meta.permissions.includes("providers:write"));
  assert(`${role} provider internals are removed`, current.data.providers.every((provider) => !provider.contactEmail && !provider.notes && !provider.ofstedRating && provider.sourceUrls.length === 0 && !provider.commercialProfile.commercialNotes && !provider.commercialProfile.achievementRate));
  assert(`${role} programme internals are removed`, current.data.providerProgrammes.every((programme) => !programme.commercialNotes && !programme.notes && !programme.sourceUrl && !programme.commercialProfile.confidenceLabel));
}

assert("Platform Admin retains provider maintenance permission", workspaces.admin.meta.permissions.includes("providers:write"));
assert("Platform Admin retains internal catalogue data", workspaces.admin.data.providers.some((provider) => provider.sourceUrls.length > 0));
const leadProgrammeIds = new Set(workspaces.lead.data.providerProgrammes.map((programme) => programme.id));
const leadProviderIds = new Set(workspaces.lead.data.providers.map((provider) => provider.providerId));
assert("learner programme references remain intact", workspaces.lead.data.learnerRecords.every((record) => !record.programmeId || leadProgrammeIds.has(record.programmeId)));
assert("learner provider references remain intact", workspaces.lead.data.learnerRecords.every((record) => !record.providerId || leadProviderIds.has(record.providerId)));
assert("provider reviews remain linked to learner records", workspaces.lead.data.learnerReviews.filter((review) => review.reviewType === "provider_review").every((review) => workspaces.lead.data.learnerRecords.some((record) => record.id === review.learnerRecordId)));
assert("applications retain apprenticeship-standard references", workspaces.lead.data.applications.every((application) => Boolean(application.apprenticeshipStandardId)));

const prompts = [
  "Show Data Analyst programmes.",
  "Which providers offer AI programmes?",
  "Show Level 3 programmes.",
  "Which programmes are available nationally?",
  "What programmes does QA offer?",
  "What programmes does SRSCC offer?",
];

for (const prompt of prompts) {
  const result = await ask(sessions.lead, prompt);
  assert(`${prompt} returns deterministic programme results`, result.executionMode === "deterministic" && ["programme_results", "no_results"].includes(result.structuredResult?.type));
  assert(`${prompt} uses factual directory title`, result.structuredResult?.title === "Programmes matching your selected filters");
  assert(`${prompt} contains no score fields or claims`, !/top match|match score|fit score|confidence|ranking|recommendation percentage/i.test(JSON.stringify(result)));
  assert(`${prompt} deep-links to programme and provider profiles`, result.structuredResult?.rows.every((row) => row.actions?.some((action) => action.url.includes("module=Providers&programme=")) && row.actions?.some((action) => action.url.includes("module=Providers&provider="))));
}

const qa = await ask(sessions.lead, "What programmes does QA offer?");
assert("high-volume provider query returns the complete active QA catalogue", qa.structuredResult?.totalCount === 19 && qa.structuredResult.rows.every((row) => row.cells.provider === "QA"));
const srscc = await ask(sessions.lead, "What programmes does SRSCC offer?");
assert("specialist provider query returns the complete active SRSCC catalogue", srscc.structuredResult?.totalCount === 3 && srscc.structuredResult.rows.every((row) => row.cells.provider === "SRSCC"));

const employeeResult = await ask(sessions.employee, "Show Level 3 programmes.", "Employee");
assert("Employee Copilot can browse factual programmes", employeeResult.executionMode === "deterministic" && employeeResult.structuredResult?.type === "programme_results");

console.log(JSON.stringify({ ok: true, checksPassed: checks.length, programmeCounts: { employee: workspaces.employee.data.providerProgrammes.length, manager: workspaces.manager.data.providerProgrammes.length, lead: workspaces.lead.data.providerProgrammes.length }, prompts }, null, 2));

async function login(email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }) });
  assert(`login succeeds for ${email}`, response.status === 200);
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function workspace(cookie) {
  const response = await fetch(`${baseUrl}/api/levytate-workspace`, { headers: { cookie } });
  const body = await response.json();
  assert("workspace loads", response.status === 200 && body.ok);
  return body.workspace;
}

async function ask(cookie, userMessage, role = "Apprenticeship Lead") {
  const response = await fetch(`${baseUrl}/api/levytate-ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-forwarded-for": "198.51.100.184" },
    body: JSON.stringify({ role, userRole: role, selectedSite: "All sites", currentSection: "Copilot", employerContext: "Ground Control", userMessage, conversationHistory: [] }),
  });
  const body = await response.json();
  assert(`Copilot responds to ${userMessage}`, response.status === 200);
  return body;
}

function assert(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checks.push(label);
}
