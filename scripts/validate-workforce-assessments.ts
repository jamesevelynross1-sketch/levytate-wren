import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateAssessmentResults, interpretWorkforceAssessment, validateAssessmentAnswers, type AssessmentAnswerMap } from "../lib/levytate/assessments/domain";
import { workforceAssessmentQuestions } from "../lib/levytate/assessments/framework";
import { getCoreEarlyAccessPolicy } from "../lib/levytate/core-early-access-policy";
import { permissionsForMvpRole } from "../lib/levytate/mvp/rbac";

const baseAnswers: AssessmentAnswerMap = Object.fromEntries(workforceAssessmentQuestions.map((question) => [question.id,
  question.type === "multi_choice" ? [question.options?.[0]?.value ?? "not_sure"]
    : question.type === "long_text" ? "A practical role-based example"
      : question.options?.[0]?.value ?? "not_sure",
]));

assert.equal(new Set(workforceAssessmentQuestions.map((question) => question.id)).size, workforceAssessmentQuestions.length, "Question identifiers must be stable and unique.");
assert.ok(workforceAssessmentQuestions.every((question) => question.purpose && question.interpretation), "Every question needs documented purpose and interpretation.");
assert.equal(validateAssessmentAnswers(baseAnswers).valid, true);
assert.equal(validateAssessmentAnswers({ ...baseAnswers, ai_practical_use: null }).valid, false, "Unanswered must remain distinct from not sure.");
assert.equal(validateAssessmentAnswers({ ...baseAnswers, ai_practical_use: "not_sure" }).valid, true);
assert.equal(validateAssessmentAnswers({ ...baseAnswers, ai_practical_use: "not_applicable" }).valid, true);

const enabled = interpretWorkforceAssessment({ ...baseAnswers, tool_access: "yes", ai_practical_use: "independent" });
const blocked = interpretWorkforceAssessment({ ...baseAnswers, tool_access: "no", ai_practical_use: "independent" });
assert.deepEqual(blocked.strengths, enabled.strengths, "Tool access must not reduce an employee capability signal.");
assert.ok(blocked.workplaceConstraints.some((item) => item.includes("tools")), "Tool access must be reported as an organisational condition.");
assert.ok(blocked.disclaimer.includes("does not determine"));

const result = interpretWorkforceAssessment(baseAnswers);
const suppressed = aggregateAssessmentResults({ invited: ["a", "b", "c", "d", "e"], submissions: ["a", "b", "c", "d"].map((employeeId) => ({ employeeId, department: "Digital", roleTitle: "Analyst", result })) });
assert.equal(suppressed.invited, 5);
assert.equal(suppressed.submitted, 4);
assert.equal(suppressed.participationPercent, 80);
assert.equal(suppressed.groups[0]?.suppressed, true);
assert.deepEqual(suppressed.groups[0]?.recurringNeeds, []);
const visible = aggregateAssessmentResults({ invited: ["a", "b", "c", "d", "e"], submissions: ["a", "b", "c", "d", "e"].map((employeeId) => ({ employeeId, department: "Digital", roleTitle: "Analyst", result })) });
assert.equal(visible.groups[0]?.suppressed, false);

assert.ok(permissionsForMvpRole("Employee").includes("assessments:write"));
assert.ok(permissionsForMvpRole("Line Manager").includes("assessments:review"));
assert.ok(permissionsForMvpRole("Apprenticeship Lead").includes("assessments:manage"));
assert.ok(!permissionsForMvpRole("Platform Admin").includes("assessments:read"));
assert.equal(getCoreEarlyAccessPolicy("Platform Admin").modules.find((item) => item.moduleKey === "Assessments")?.availability, "hidden");

const server = readFileSync(new URL("../lib/server/levytate-assessments.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/034_create_workforce_assessments.sql", import.meta.url), "utf8");
assert.ok(server.includes("shared_with_employee_id === currentEmployee?.id"), "Manager disclosure must verify the intended direct manager.");
assert.ok(server.includes("applyWorkspaceMutationForSession"), "Application handoff must use normal workflow rules.");
assert.ok(server.includes("start_reassessment"), "Reassessments must link to a submitted baseline.");
assert.ok(migration.includes("enable row level security"));
assert.ok(migration.includes("revoke all on table"));
assert.ok(migration.includes("baseline_assessment_id"));
assert.ok(migration.includes("levytate_assessment_actions"));

console.log("Workforce Assessments validation passed: 24 assertions across content, interpretation, privacy, reporting, RBAC, history and application handoff.");
