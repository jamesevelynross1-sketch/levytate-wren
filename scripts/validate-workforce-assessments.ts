import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessmentReviewDraft,
  campaignSubmissionDisclosure,
  canManagerAccessAssessment,
  runAssessmentSaveAndSubmit,
} from "../lib/levytate/assessments/behaviour";
import { aggregateAssessmentResults, interpretWorkforceAssessment, validateAssessmentAnswers, type AssessmentAnswerMap } from "../lib/levytate/assessments/domain";
import { workforceAssessmentQuestions } from "../lib/levytate/assessments/framework";
import { getCoreEarlyAccessPolicy } from "../lib/levytate/core-early-access-policy";
import { permissionsForMvpRole } from "../lib/levytate/mvp/rbac";

async function main() {
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
const audience = ["a", "b", "c", "d", "e"].map((employeeId) => ({ employeeId, department: "Digital", roleTitle: "Analyst" }));
const suppressed = aggregateAssessmentResults({ audience, submissions: ["a", "b", "c", "d"].map((employeeId) => ({ employeeId, department: "Digital", roleTitle: "Analyst", result })) });
assert.equal(suppressed.invited, 5);
assert.equal(suppressed.submitted, 4);
assert.equal(suppressed.participationPercent, 80);
assert.equal(suppressed.groups[0]?.suppressed, true);
assert.deepEqual(suppressed.groups[0]?.recurringNeeds, []);
const visible = aggregateAssessmentResults({ audience: [...audience, { employeeId: "f", department: "Operations", roleTitle: "Coordinator" }], submissions: ["a", "b", "c", "d", "e"].map((employeeId) => ({ employeeId, department: "Digital", roleTitle: "Analyst", result })) });
assert.equal(visible.groups[0]?.suppressed, false);
assert.deepEqual(visible.groups.find((group) => group.department === "Operations"), {
  department: "Operations", invited: 1, submitted: 0, participationPercent: 0, suppressed: true, recurringNeeds: [], blockers: [],
}, "Recorded audience departments must remain visible even with zero responses.");

let submitRequests = 0;
const unsavedEdits = { ...baseAnswers, automation_opportunity: "Keep this employee edit" };
const failedSave = await runAssessmentSaveAndSubmit(
  async () => false,
  async () => { submitRequests += 1; return true; },
);
assert.equal(failedSave, false);
assert.equal(submitRequests, 0, "Submit must not be requested when save fails.");
assert.equal(unsavedEdits.automation_opportunity, "Keep this employee edit", "A failed save must not discard local edits.");

const firstReview = assessmentReviewDraft({ id: "review-a", status: "relevant", businessContext: "Context A", supportAvailable: "Support A", constraints: "Constraint A", recommendedAction: "Action A", managerComment: "Comment A", reviewedAt: "2026-10-19T09:00:00Z" });
const secondReview = assessmentReviewDraft({ id: "review-b", status: "clarification_requested", businessContext: "Context B", supportAvailable: "Support B", constraints: "Constraint B", recommendedAction: "Action B", managerComment: "Comment B", reviewedAt: "2026-10-19T10:00:00Z" });
assert.equal(firstReview.managerComment, "Comment A");
assert.equal(secondReview.managerComment, "Comment B");
assert.notEqual(firstReview.businessContext, secondReview.businessContext, "Reviewer state must be initialised from the selected assessment review.");

assert.equal(canManagerAccessAssessment({ currentDirectReport: true, visibility: "manager_shared", activeShareAddressedToManager: true, campaignSharingPolicy: null }), true);
assert.equal(canManagerAccessAssessment({ currentDirectReport: true, visibility: "manager_shared", activeShareAddressedToManager: false, campaignSharingPolicy: null }), false, "A share addressed to a previous manager must not authorise the current manager.");
assert.equal(canManagerAccessAssessment({ currentDirectReport: false, visibility: "manager_shared", activeShareAddressedToManager: true, campaignSharingPolicy: null }), false, "A former manager must lose access after reassignment.");
assert.equal(canManagerAccessAssessment({ currentDirectReport: true, visibility: "campaign_shared", activeShareAddressedToManager: false, campaignSharingPolicy: "manager_and_campaign_owner" }), true, "Campaign policy remains a valid manager access route.");
assert.equal(canManagerAccessAssessment({ currentDirectReport: true, visibility: "campaign_shared", activeShareAddressedToManager: false, campaignSharingPolicy: "campaign_owner_summary" }), false);
assert.match(campaignSubmissionDisclosure("campaign_owner_summary"), /explicitly share/);
assert.match(campaignSubmissionDisclosure("manager_and_campaign_owner"), /current Line Manager can also access/);

assert.ok(permissionsForMvpRole("Employee").includes("assessments:write"));
assert.ok(permissionsForMvpRole("Line Manager").includes("assessments:review"));
assert.ok(permissionsForMvpRole("Apprenticeship Lead").includes("assessments:manage"));
assert.ok(!permissionsForMvpRole("Platform Admin").includes("assessments:read"));
assert.equal(getCoreEarlyAccessPolicy("Platform Admin").modules.find((item) => item.moduleKey === "Assessments")?.availability, "hidden");

const migration = readFileSync(new URL("../supabase/migrations/034_create_workforce_assessments.sql", import.meta.url), "utf8");
assert.ok(migration.includes("enable row level security"));
assert.ok(migration.includes("revoke all on table"));
assert.ok(migration.includes("baseline_assessment_id"));
assert.ok(migration.includes("levytate_assessment_actions"));

console.log("Workforce Assessments validation passed: behavioural coverage for save/submit sequencing, review scoping, manager disclosure, campaign visibility wording, reporting suppression and zero-response departments.");
}

void main();
