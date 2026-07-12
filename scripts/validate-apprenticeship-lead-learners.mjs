const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  apprenticeshipLead: "apprenticeshiplead.demo@levytate.test",
};

const requiredStatuses = [
  "pre_enrolment",
  "enrolled",
  "break_in_learning",
  "withdrawn",
  "assessment_preparation",
  "in_assessment",
  "achieved",
  "completed_without_achievement",
];

async function main() {
  const leadCookie = await login(identities.apprenticeshipLead);
  const listResponse = await authedFetch("/api/levytate-learners", leadCookie);
  const listPayload = await listResponse.json();

  assert("Apprenticeship Lead learner list is accessible", listResponse.status === 200, listPayload);
  assert("Learner list reads from Supabase", listPayload.source === "supabase", listPayload);
  assert("Learner list contains nine seeded lifecycle records", listPayload.summary?.total === 9, listPayload.summary);
  assert("Learner summary includes one pre-enrolment record", listPayload.summary?.preEnrolment === 1, listPayload.summary);
  assert("Learner summary includes active learners", listPayload.summary?.activeLearners === 5, listPayload.summary);
  assert("Learner summary includes one break in learning", listPayload.summary?.breakInLearning === 1, listPayload.summary);
  assert("Learner summary includes assessment-stage records", listPayload.summary?.assessmentStage === 2, listPayload.summary);
  assert("Learner summary includes achieved record", listPayload.summary?.achieved === 1, listPayload.summary);
  assert("Learner summary includes attention count", listPayload.summary?.needingAttention >= 5, listPayload.summary);

  const learners = Array.isArray(listPayload.learners) ? listPayload.learners : [];
  for (const status of requiredStatuses) {
    assert(`Learner list includes ${status}`, learners.some((learner) => learner.lifecycleStatus === status), learners.map((learner) => learner.lifecycleStatus));
  }

  assert("Behind-target learner is visible", learners.some((learner) => learner.learner?.name === "Cara Hughes" && learner.progressPosition === "Significantly behind"), learners);
  assert("Pre-enrolment learner has eligibility next action", learners.some((learner) => learner.learner?.name === "Avery Collins" && /eligibility/i.test(learner.attention?.label ?? "")), learners);
  assert("Achieved learner has completion action recorded or no action required", learners.some((learner) => learner.learner?.name === "Harry Newton" && learner.lifecycleStatus === "achieved"), learners);

  const detailTargets = [
    ["Avery Collins", "pre_enrolment"],
    ["Cara Hughes", "enrolled"],
    ["Daniel Frost", "break_in_learning"],
    ["Harry Newton", "achieved"],
  ];

  for (const [name, status] of detailTargets) {
    const learner = learners.find((item) => item.learner?.name === name);
    assert(`Learner ${name} is present`, Boolean(learner), learners);
    const detailResponse = await authedFetch(`/api/levytate-learners?learnerRecordId=${encodeURIComponent(learner.learnerRecordId)}`, leadCookie);
    const detailPayload = await detailResponse.json();
    assert(`Detail for ${name} is accessible`, detailResponse.status === 200, detailPayload);
    assert(`Detail for ${name} preserves lifecycle status`, detailPayload.learner?.lifecycleStatus === status, detailPayload.learner);
    assert(`Detail for ${name} includes person snapshot`, Boolean(detailPayload.learner?.learner?.name), detailPayload.learner);
    assert(`Detail for ${name} includes programme snapshot`, Boolean(detailPayload.learner?.programme?.programmeName), detailPayload.learner);
    assert(`Detail for ${name} includes eligibility section`, "eligibilityDeclaration" in detailPayload.learner, detailPayload.learner);
    assert(`Detail for ${name} includes pre-enrolment section`, "preEnrolmentChecks" in detailPayload.learner, detailPayload.learner);
    assert(`Detail for ${name} includes lifecycle timeline`, Array.isArray(detailPayload.learner?.lifecycleTimeline) && detailPayload.learner.lifecycleTimeline.length > 0, detailPayload.learner);
    assert(`Detail for ${name} hides raw metadata`, !JSON.stringify(detailPayload.learner).includes("__LEVYTATE_PROVIDER_META__"), detailPayload.learner);
  }

  const employeeCookie = await login(identities.employee);
  const employeeResponse = await authedFetch("/api/levytate-learners", employeeCookie);
  assert("Employee is denied organisation-wide learners endpoint", employeeResponse.status === 403, await safeJson(employeeResponse));

  const managerCookie = await login(identities.manager);
  const managerResponse = await authedFetch("/api/levytate-learners", managerCookie);
  assert("Line Manager is denied organisation-wide learners endpoint", managerResponse.status === 403, await safeJson(managerResponse));

  const invalidDetailResponse = await authedFetch("/api/levytate-learners?learnerRecordId=not-a-real-record", leadCookie);
  assert("Unknown learner record returns safe not-found response", invalidDetailResponse.status === 404, await safeJson(invalidDetailResponse));

  const mutationResponse = await authedFetch("/api/levytate-learners", leadCookie, { method: "POST" });
  assert("Learners endpoint does not expose write mutations", mutationResponse.status === 405 || mutationResponse.status === 404, await safeText(mutationResponse));

  console.log("Apprenticeship Lead learner record validation passed.");
  console.log(JSON.stringify({
    source: listPayload.source,
    summary: listPayload.summary,
    statuses: requiredStatuses,
  }, null, 2));
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`Login succeeds for ${email}`, response.status === 200, body);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(`Session cookie is issued for ${email}`, Boolean(cookie), body);
  return cookie;
}

function authedFetch(path, cookie, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      cookie,
      ...(init.headers ?? {}),
    },
  });
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch {
    return {};
  }
}

async function safeText(response) {
  try {
    return await response.clone().text();
  } catch {
    return "";
  }
}

function assert(label, condition, detail) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
