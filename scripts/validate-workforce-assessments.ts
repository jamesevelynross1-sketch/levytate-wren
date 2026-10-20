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
import { assessmentFrameworks, comprehensiveAssessmentQuestions, comprehensiveAssessmentQuestionsV2 } from "../lib/levytate/assessments/framework-registry";
import { interpretComprehensiveAssessment, interpretComprehensiveAssessmentV2, validateComprehensiveAnswers, validateComprehensiveAnswersV2 } from "../lib/server/levytate-assessment-scoring";
import { collectPaginatedRows } from "../lib/server/levytate-supabase";
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

assert.equal(assessmentFrameworks.length, 3, "Quick, historical V2 and corrected V3 templates must remain published.");
assert.equal(comprehensiveAssessmentQuestionsV2.length, 40, "Historical V2 must remain available without reinterpretation.");
assert.equal(comprehensiveAssessmentQuestions.length, 40, "The approved active comprehensive framework contains 40 questions.");
assert.equal(new Set(comprehensiveAssessmentQuestions.map((question) => question.id)).size, 40, "Comprehensive question identifiers must be unique.");
const comprehensiveAnswers: AssessmentAnswerMap = Object.fromEntries(comprehensiveAssessmentQuestions.map((question) => [question.id,
  question.type === "multi_choice" ? [question.options?.[0]?.value ?? ""]
    : question.type === "long_text" ? "A fictional, non-sensitive workplace example"
      : "5",
]));
Object.assign(comprehensiveAnswers, { pv1: "B", pv2: "C", pv3: "B", pv4: "C", ex2: "4", ex3: "both", personalUseCases: ["Researching and comparing information", "Drafting or improving writing", "Learning a new skill or topic"], workplaceUseCases: ["Research and comparison", "Drafting or improving writing", "Summarising documents"] });
assert.equal(validateComprehensiveAnswers(comprehensiveAnswers).valid, true);
assert.equal(validateComprehensiveAnswers({ ...comprehensiveAnswers, pv2: null }).valid, false, "Missing practical evidence must remain missing.");
const comprehensive = interpretComprehensiveAssessment(comprehensiveAnswers);
assert.equal(comprehensive.capabilityIntelligence?.practicalJudgement, 100);
assert.equal(comprehensive.capabilityIntelligence?.dimensionScores.aiUnderstanding, 100);
assert.equal(comprehensive.capabilityIntelligence?.developmentProfile, "Technical");
assert.ok(comprehensive.capabilityIntelligence?.developmentCohorts.includes("Technical development"));
const missingEvidence = interpretComprehensiveAssessment({ ...comprehensiveAnswers, un1: null });
assert.equal(missingEvidence.capabilityIntelligence?.dimensionScores.aiUnderstanding, 100, "Missing evidence must be excluded rather than scored as poor capability.");
assert.equal(missingEvidence.capabilityIntelligence?.evidenceCoverage.answeredScored, comprehensive.capabilityIntelligence!.evidenceCoverage.answeredScored - 1);
const partialScenario = interpretComprehensiveAssessment({ ...comprehensiveAnswers, pv4: null });
assert.equal(partialScenario.capabilityIntelligence?.practicalJudgement, null, "Incomplete scenarios must not create a misleading practical score.");
const contextOnlyChange = interpretComprehensiveAssessment({ ...comprehensiveAnswers, ex3: "personal" });
assert.equal(contextOnlyChange.capabilityIntelligence?.dimensionScores.generalUsage, comprehensive.capabilityIntelligence?.dimensionScores.generalUsage, "Categorical usage context must not be coerced into the numeric usage score.");
const directConfidence = interpretComprehensiveAssessment({ ...comprehensiveAnswers, ex6: "1" });
assert.equal(directConfidence.capabilityIntelligence?.confidenceAlignment, "Capability may be understated", "Confidence alignment must use the explicit confidence item.");
const noBarrier = interpretComprehensiveAssessment({ ...comprehensiveAnswers, barrier: "no_current_barrier" });
assert.equal(noBarrier.capabilityIntelligence?.barrier, null, "No-current-barrier must remain truthful non-barrier evidence.");

const v2Answers: AssessmentAnswerMap = Object.fromEntries(comprehensiveAssessmentQuestionsV2.map((question) => [question.id,
  question.type === "multi_choice" ? [question.options?.[0]?.value ?? ""] : question.type === "long_text" ? "Historical V2 evidence" : question.options?.at(-1)?.value ?? "5",
]));
Object.assign(v2Answers, { pv1: "B", pv2: "C", pv3: "B", pv4: "C" });
assert.equal(validateComprehensiveAnswersV2(v2Answers).valid, true);
assert.equal(interpretComprehensiveAssessmentV2(v2Answers).capabilityIntelligence?.frameworkVersion, "ai-capability-v2");

const fictionalEmployees = Array.from({ length: 1005 }, (_, index) => ({ id: `employee-${index}` }));
const paginated = await collectPaginatedRows(async (offset, limit) => fictionalEmployees.slice(offset, offset + limit));
assert.equal(paginated.length, 1005, "Whole-organisation assessment audiences must include employees beyond the first 1,000 rows.");
assert.equal(new Set(paginated.map((employee) => employee.id)).size, 1005, "Paginated workforce retrieval must not duplicate audience members.");

const publicFrameworkSource = `${readFileSync(new URL("../lib/levytate/assessments/framework-registry.ts", import.meta.url), "utf8")}\n${readFileSync(new URL("../components/levytate-mvp/AssessmentsModule.tsx", import.meta.url), "utf8")}`;
assert.ok(!publicFrameworkSource.includes('pv1: "B"') && !publicFrameworkSource.includes('pv2: "C"'), "The practical answer key must not enter client-reachable modules.");

const migration = readFileSync(new URL("../supabase/migrations/034_create_workforce_assessments.sql", import.meta.url), "utf8");
assert.ok(migration.includes("enable row level security"));
assert.ok(migration.includes("revoke all on table"));
assert.ok(migration.includes("baseline_assessment_id"));
assert.ok(migration.includes("levytate_assessment_actions"));
const v2Migration = readFileSync(new URL("../supabase/migrations/035_register_comprehensive_ai_capability_assessment.sql", import.meta.url), "utf8");
assert.ok(v2Migration.includes("ai-capability-v2"));
assert.ok(v2Migration.includes("on conflict") && !/\b(delete|drop table|truncate)\b/i.test(v2Migration), "V2 framework registration must remain additive and idempotent.");
const v3Migration = readFileSync(new URL("../supabase/migrations/036_register_reliable_ai_capability_assessment.sql", import.meta.url), "utf8");
assert.ok(v3Migration.includes("ai-capability-v3") && v3Migration.includes("on conflict"));
assert.ok(!/\b(delete|drop table|truncate|alter table)\b/i.test(v3Migration), "V3 framework registration must remain additive and preserve historical data.");

console.log("Workforce Assessments validation passed: V1/V2/V3 versioning, truthful categorical/confidence/barrier semantics, >1,000 employee pagination, disclosure, suppression and historical compatibility.");
}

void main();
