const baseUrl = (process.argv[2] ?? "http://localhost:3060").replace(/\/$/, "");
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
const learnerRecordId = "gc-lifecycle-record-pre-enrolment";

const identities = {
  employee: "employee.demo@levytate.test",
  manager: "manager.demo@levytate.test",
  lead: "apprenticeshiplead.demo@levytate.test",
  isolation: "isolation.employee.demo@levytate.test",
};

const checks = [];

async function main() {
  const lead = await login("Apprenticeship Lead", identities.lead);
  const employee = await login("Employee", identities.employee);
  const manager = await login("Line Manager", identities.manager);
  const isolation = await login("Isolation employee", identities.isolation);

  const initial = await getLearner(lead.cookie);
  assert("Avery starts as pre-enrolment", initial.lifecycleStatus === "pre_enrolment", initial.lifecycleStatus);
  assert("Employee England declaration is captured", initial.eligibilityDeclaration?.confirmed === true, initial.eligibilityDeclaration);
  assert("Initial readiness is not complete", initial.enrolmentReadiness?.readyForEnrolment === false, initial.enrolmentReadiness);

  await expectStatus("Invalid employment route is rejected", () => patchLearner(lead.cookie, {
    expectedUpdatedAt: initial.updatedAt,
    employmentRoute: "not_a_real_route",
  }), 400);

  await expectStatus("Employee cannot update employer pre-enrolment checks", () => patchLearner(employee.cookie, {
    employmentRoute: "existing_employee_upskill",
  }), 403);
  await expectStatus("Line Manager cannot update employer pre-enrolment checks", () => patchLearner(manager.cookie, {
    employmentRoute: "existing_employee_upskill",
  }), 403);
  await expectStatus("Cross-organisation mutation is denied", () => patchLearner(isolation.cookie, {
    employmentRoute: "existing_employee_upskill",
  }), 403);

  const ineligibleSave = await patchJson(lead.cookie, {
    expectedUpdatedAt: initial.updatedAt,
    eligibilityVerification: {
      verificationStatus: "not_eligible",
      notes: "Employer could not verify the England working-hours requirement for this validation scenario.",
    },
  });
  assert("Ineligible save succeeds", ineligibleSave.response.status === 200, ineligibleSave.body);
  assert("Ineligible readiness blocks enrolment", ineligibleSave.body.learner?.enrolmentReadiness?.readyForEnrolment === false, ineligibleSave.body.learner?.enrolmentReadiness);
  assert("Ineligible message is explicit", JSON.stringify(ineligibleSave.body.learner?.enrolmentReadiness).includes("England working-hours requirement has not been verified"), ineligibleSave.body.learner?.enrolmentReadiness);
  await expectStatus("Ineligible learner cannot be enrolled", () => enrolLearner(lead.cookie), 400);

  await expectStatus("Stale save is rejected", () => patchLearner(lead.cookie, {
    expectedUpdatedAt: initial.updatedAt,
    eligibilityVerification: {
      verificationStatus: "employer_verified",
      notes: "Attempt should be stale.",
    },
  }), 409);

  const readySave = await patchJson(lead.cookie, {
    expectedUpdatedAt: ineligibleSave.body.learner.updatedAt,
    employmentRoute: "existing_employee_upskill",
    eligibilityVerification: {
      verificationStatus: "employer_verified",
      notes: "Employer verified England working-hours eligibility.",
    },
    probation: {
      probationStatus: "passed",
      probationPassedDate: "2026-08-14",
      probationNotes: "Probation passed and confirmed by L&D.",
    },
    hrApproval: {
      hrApprovalStatus: "approved",
      hrApprovedDate: "2026-08-15",
      hrApprovalNotes: "HR approval complete.",
    },
    programme: {
      programmeId: "programme-apprentify-data-technician",
      providerId: "provider-apprentify",
      applicationId: "gc-lifecycle-app-avery",
      expectedStartDate: "2026-09-07",
      actualStartDate: "2026-09-07",
      expectedEndDate: "2028-03-07",
    },
    guides: {
      guidesSent: true,
      guidesSentDate: "2026-08-16",
      guidesVersion: "2026 learner and manager guide pack",
      recipientSummary: "Avery Collins and line manager",
      guidesNotes: "Guides logged for validation.",
    },
  });
  assert("Ready save succeeds", readySave.response.status === 200, readySave.body);
  const ready = readySave.body.learner;
  assert("Readiness is complete after persisted checks", ready?.enrolmentReadiness?.readyForEnrolment === true, ready?.enrolmentReadiness);
  assert("Probation passed persists", ready?.preEnrolmentChecks?.probationStatus === "passed" && ready.preEnrolmentChecks.probationPassedDate === "2026-08-14", ready?.preEnrolmentChecks);
  assert("HR approval persists", ready?.preEnrolmentChecks?.hrApprovalStatus === "approved" && ready.preEnrolmentChecks.hrApprovedDate === "2026-08-15", ready?.preEnrolmentChecks);
  assert("Guides persist", ready?.preEnrolmentChecks?.guidesSent === true && ready.preEnrolmentChecks.guidesSentDate === "2026-08-16", ready?.preEnrolmentChecks);
  assert("Actual start and expected end persist", ready?.actualStartDate === "2026-09-07" && ready.expectedEndDate === "2028-03-07", ready);

  const enrolResponse = await enrolLearner(lead.cookie);
  const enrolBody = await safeJson(enrolResponse);
  assert("Eligible learner enrols", enrolResponse.status === 200, enrolBody);
  assert("Enrolment success message returned", String(enrolBody.message ?? "").includes("Learner marked as enrolled"), enrolBody);
  assert("Lifecycle status is enrolled", enrolBody.learner?.lifecycleStatus === "enrolled", enrolBody.learner);

  const duplicate = await enrolLearner(lead.cookie);
  assert("Duplicate enrolment fails safely", duplicate.status === 409, await safeJson(duplicate));

  const reloggedLead = await login("Apprenticeship Lead relogin", identities.lead);
  const persisted = await getLearner(reloggedLead.cookie);
  assert("Enrolled status persists after re-login", persisted.lifecycleStatus === "enrolled", persisted.lifecycleStatus);
  assert("Lifecycle timeline includes employment route event", eventTypes(persisted).includes("employment_route_confirmed"), eventTypes(persisted));
  assert("Lifecycle timeline includes eligibility verification event", eventTypes(persisted).includes("eligibility_employer_verified"), eventTypes(persisted));
  assert("Lifecycle timeline includes probation event", eventTypes(persisted).includes("probation_updated"), eventTypes(persisted));
  assert("Lifecycle timeline includes HR approval event", eventTypes(persisted).some((event) => event === "hr_approved" || event === "hr_approval_updated"), eventTypes(persisted));
  assert("Lifecycle timeline includes guides event", eventTypes(persisted).includes("guides_sent"), eventTypes(persisted));
  assert("Lifecycle timeline includes enrolment completion event", eventTypes(persisted).includes("enrolment_completed"), eventTypes(persisted));

  console.log(JSON.stringify({
    ok: checks.every((check) => check.ok),
    baseUrl,
    learnerRecordId,
    summary: {
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
  }, null, 2));

  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

async function login(label, email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: betaCode }),
  });
  const body = await safeJson(response);
  assert(`${label} login accepted`, response.status === 200, { status: response.status, body });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(`${label} session cookie set`, Boolean(cookie), body);
  return { cookie, body };
}

async function getLearner(cookie) {
  const response = await request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}`, cookie);
  const body = await safeJson(response);
  assert("Learner detail loads", response.status === 200 && body?.learner, { status: response.status, body });
  return body.learner;
}

function patchLearner(cookie, body) {
  return request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}/pre-enrolment`, cookie, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function patchJson(cookie, body) {
  const response = await patchLearner(cookie, body);
  return { response, body: await safeJson(response) };
}

function enrolLearner(cookie) {
  return request(`/api/levytate-learners/${encodeURIComponent(learnerRecordId)}/enrol`, cookie, { method: "POST" });
}

function request(path, cookie, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(init.headers ?? {}),
    },
  });
}

async function expectStatus(label, action, status) {
  const response = await action();
  const body = await safeJson(response);
  assert(label, response.status === status, { expected: status, actual: response.status, body });
}

function eventTypes(learner) {
  return (learner.lifecycleTimeline ?? []).map((event) => event.eventType);
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch {
    return {};
  }
}

function assert(label, condition, detail) {
  checks.push({ label, ok: Boolean(condition) });
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
