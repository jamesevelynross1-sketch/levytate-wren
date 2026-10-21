import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liftCapabilities, liftInterpretationVersion, liftOpportunityGroupingVersion, liftQuestionnaireVersion, type LiftAnswerMap, type LiftProofRecord } from "../lib/levytate/lift/domain";
import { liftAssessmentQuestions, liftQuestionnaire } from "../lib/levytate/lift/framework";
import { canManagerAccessLiftParticipant, employeeFindingsReleased, runLiftSaveAndSubmit } from "../lib/levytate/lift/behaviour";
import { discloseLiftAggregates } from "../lib/levytate/lift/privacy";
import { calculateLiftCapacityValue, canTransitionLiftProof, overlappingBenefitWarning } from "../lib/levytate/lift/value";
import { buildLiftFixtureWorkspace } from "../lib/server/levytate-lift-fixtures";
import { buildLiftOpportunities, interpretLiftAssessment, validateLiftAnswers, validateOpportunityReferences } from "../lib/server/levytate-lift-interpretation";
import { liftRubricMatrix } from "../lib/server/levytate-lift-rubric";
import { groupLiftOpportunityCandidates, type LiftOpportunityCandidateForGrouping } from "../lib/server/levytate-lift-grouping";

async function main() {
const answers: LiftAnswerMap = Object.fromEntries(liftQuestionnaire.map((item) => { const rubric = liftRubricMatrix.find((entry) => entry.itemId === item.id); return [item.id, item.type === "long_text" ? `A fictional bounded response for ${item.id}` : rubric?.supportedValues[0] ?? rubric?.contextValues[0] ?? null]; }));
assert.equal(liftAssessmentQuestions.length, 30, "The pilot contains 30 substantive prompts.");
assert.equal(liftQuestionnaire.length, 33, "Three unscored context prompts precede the 30 substantive prompts.");
assert.equal(new Set(liftQuestionnaire.map((item) => item.id)).size, 33, "Item IDs are stable and unique.");
assert.equal(new Set(liftAssessmentQuestions.map((item) => item.episode)).size, 6, "All six workplace episodes are present.");
assert.equal(liftRubricMatrix.length, 30, "Every substantive item has a server-side evidence rule.");
const structuredRubrics = liftRubricMatrix.filter((item) => item.automaticallyInterpreted && item.supportedValues.length > 0 && liftAssessmentQuestions.find((question) => question.id === item.itemId)?.evidenceType !== "anchored_experience");
const supportedPositions = structuredRubrics.map((rubric) => liftAssessmentQuestions.find((question) => question.id === rubric.itemId)!.options!.findIndex((option) => option.value === rubric.supportedValues[0]) + 1);
assert.deepEqual([1,2,3,4].map((position) => supportedPositions.filter((value) => value === position).length), [5,4,5,4], "Supported answer positions are deliberately balanced.");
assert.ok(liftAssessmentQuestions.flatMap((item) => item.options ?? []).every((option) => !/^[A-D]$/.test(option.value)), "Published answers use stable semantic identifiers, not positional letters.");
assert.equal(liftRubricMatrix.filter((item) => !item.automaticallyInterpreted).length, 6, "Work samples remain distinct from automatic interpretation.");
assert.ok(liftRubricMatrix.every((item) => item.intendedToReveal && item.whySupported && item.otherResponsesIndicate && item.alternativeDefensibleAnswers), "Each item has a specific review rationale.");
for (const capability of liftCapabilities) {
  const items = liftAssessmentQuestions.filter((item) => item.capabilityIds.includes(capability));
  assert.ok(items.length >= 2, `${capability} has more than one evidence point.`);
  assert.ok(new Set(items.map((item) => item.episode)).size >= 2, `${capability} spans distinct situations.`);
}
assert.equal(validateLiftAnswers(answers).valid, true);
assert.equal(validateLiftAnswers({ ...answers, check_01: null }).valid, false, "Missing remains distinct from a weak response.");
assert.equal(validateLiftAnswers({ ...answers, check_05: "not_enough_opportunity" }).valid, true, "Not enough opportunity is a valid unknown response.");

const interpreted = interpretLiftAssessment({ assessmentId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", employeeId: "employee-a", answers, submittedAt: "2026-10-21T09:00:00Z" });
assert.equal(interpreted.findings.length, 10);
assert.ok(interpreted.findings.every((item) => !item.label.includes("100") && !item.label.includes("score")), "Findings are non-numeric evidence states.");
assert.ok(interpreted.evidence.every((item) => !item.id.startsWith("pastoral")));
const changedAnswers = { ...answers, check_01: "defer_for_full_coverage", data_01: "not_comparable", pressure_04: "owner_risk_acceptance" };
const changed = interpretLiftAssessment({ assessmentId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", employeeId: "employee-a", answers: changedAnswers, submittedAt: "2026-10-21T09:00:00Z" });
assert.notDeepEqual(changed.findings, interpreted.findings, "Changing relevant evidence changes the interpretation instead of returning a fixed narrative.");

const manager = {
  employeeId: "employee-a",
  observationId: "cccccccc-cccc-4ccc-accc-cccccccccccc",
  observationRevision: 1,
  workflowGroup: "reporting_and_insight" as const,
  observedCapabilityIds: ["think_clearly", "make_information_useful", "turn_priorities_into_progress"] as const,
  workThatCouldImprove: "Prepare a weekly fictional operations brief",
  intendedOutcome: "Reduce reconciliation effort while preserving accuracy",
  concreteExamples: ["A recent fictional example was independently recorded."],
  opportunityToObserve: "enough" as const,
  conditions: { time: "Two hours agreed", tools: "available", access: "available", supervision: "Manager review", suitableWork: "available" },
  recordedAt: "2026-10-21T10:00:00Z",
};
const opportunities = buildLiftOpportunities({ assessmentId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", employeeId: "employee-a", findings: interpreted.findings, employeeEvidence: interpreted.evidence, manager, generatedAt: "2026-10-21T11:00:00Z" });
assert.equal(opportunities.length, 1, "Grounded employee and manager evidence creates a candidate opportunity.");
assert.equal(validateOpportunityReferences(opportunities[0]!, [...interpreted.evidence, { id: opportunities[0]!.supportingEvidenceIds.at(-1)!, source: "manager_observation", version: liftInterpretationVersion, recordedAt: manager.recordedAt, subject: "employee-a", permissions: "released_pair", description: "Manager observation", limitations: [] }]), true, "Every opportunity reference resolves to authorised evidence.");
assert.equal(validateOpportunityReferences({ ...opportunities[0]!, supportingEvidenceIds: ["unsupported-id"] }, interpreted.evidence), false, "Unsupported references are rejected.");
const unknownAnswers = Object.fromEntries(liftQuestionnaire.map((item) => [item.id, item.evidenceType === "anchored_experience" ? "not_enough_opportunity" : null])) as LiftAnswerMap;
const weak = interpretLiftAssessment({ assessmentId: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", employeeId: "employee-b", answers: unknownAnswers, submittedAt: "2026-10-21T09:00:00Z" });
assert.equal(buildLiftOpportunities({ assessmentId: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", employeeId: "employee-b", findings: weak.findings, employeeEvidence: weak.evidence, manager, generatedAt: "2026-10-21T11:00:00Z" }).length, 0, "Weak or contradictory evidence does not manufacture an opportunity.");
assert.equal(buildLiftOpportunities({ assessmentId: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", employeeId: "employee-b", findings: interpreted.findings, employeeEvidence: interpreted.evidence, manager: null, generatedAt: "2026-10-21T11:00:00Z" }).length, 0, "Missing manager evidence is absent, not interpreted as low capability.");

assert.equal(employeeFindingsReleased({ employeeSubmitted: true, managerSubmitted: false }), false, "Manager input does not block employee completion or reveal findings early.");
assert.equal(employeeFindingsReleased({ employeeSubmitted: true, managerSubmitted: true }), true);
assert.equal(canManagerAccessLiftParticipant({ currentManagerEmployeeId: "manager-a", participantEmployeeId: "employee-a", participantManagerEmployeeId: "manager-a", observationStatus: "draft" }), true);
assert.equal(canManagerAccessLiftParticipant({ currentManagerEmployeeId: "manager-old", participantEmployeeId: "employee-a", participantManagerEmployeeId: "manager-new", observationStatus: "submitted" }), false, "Reassigned managers lose access.");
assert.equal(canManagerAccessLiftParticipant({ currentManagerEmployeeId: "employee-a", participantEmployeeId: "employee-a", participantManagerEmployeeId: "employee-a", observationStatus: "draft" }), false, "Self-review is denied.");

let submitCount = 0;
assert.equal(await runLiftSaveAndSubmit(async () => false, async () => { submitCount += 1; return true; }), false);
assert.equal(submitCount, 0, "Failed saving stops submission.");

const four = discloseLiftAggregates({ submittedEmployeeIds: ["a","b","c","d"], candidates: [{ id: "route", contributorEmployeeIds: ["a","b","c","d"] }] });
assert.equal(four.available.length, 0);
const sixPlusOne = discloseLiftAggregates({ submittedEmployeeIds: ["a","b","c","d","e","f","g"], candidates: [{ id: "large", cohort: "A", contributorEmployeeIds: ["a","b","c","d","e","f"] }, { id: "small", cohort: "B", contributorEmployeeIds: ["g"] }] });
assert.equal(sixPlusOne.available.length, 0, "6+1 complementary reconstruction is suppressed.");
const fivePlusFour = discloseLiftAggregates({ submittedEmployeeIds: ["a","b","c","d","e","f","g","h","i"], candidates: [{ id: "five", cohort: "A", contributorEmployeeIds: ["a","b","c","d","e"] }, { id: "four", cohort: "B", contributorEmployeeIds: ["f","g","h","i"] }] });
assert.equal(fivePlusFour.available.length, 0, "5+4 complementary reconstruction is suppressed.");

const routeCandidate = (id: string, employeeId: string, campaignId = "campaign-a", workflowGroup: LiftOpportunityCandidateForGrouping["workflowGroup"] = "reporting_and_insight"): LiftOpportunityCandidateForGrouping => ({ id, campaignId, employeeId, frameworkKey: "lift-workforce-v1", questionnaireVersion: liftQuestionnaireVersion, interpretationVersion: liftInterpretationVersion, groupingVersion: liftOpportunityGroupingVersion, workflowGroup, capabilityIds: ["make_information_useful"], relationship: "supported", supportingEvidenceIds: [`e-${id}`], contradictoryEvidenceIds: [] });
const grouping = groupLiftOpportunityCandidates({ candidates: ["a","b","c","d","e"].map((employeeId, index) => routeCandidate(`candidate-${index}`, employeeId)), submittedEmployeeIdsByCampaign: new Map([["campaign-a", ["a","b","c","d","e"]]]), stableId: (...parts) => parts.join(":"), });
assert.equal(grouping.length, 1, "Naturally different free-text descriptions share a reviewed workflow route.");
assert.equal(grouping[0]!.contributorEmployeeIds.length, 5);
assert.equal(groupLiftOpportunityCandidates({ candidates: [routeCandidate("one", "a"), routeCandidate("two", "b", "campaign-a", "quality_and_compliance")], submittedEmployeeIdsByCampaign: new Map([["campaign-a", ["a","b","c","d","e"]]]), stableId: (...parts) => parts.join(":") }).length, 0, "Similar wording does not merge unrelated controlled workflow groups.");
assert.equal(groupLiftOpportunityCandidates({ candidates: [["a","b","c","d","e"].map((employeeId, index) => routeCandidate(`a-${index}`, employeeId, "campaign-a")), ["f","g","h","i","j"].map((employeeId, index) => routeCandidate(`b-${index}`, employeeId, "campaign-b"))].flat(), submittedEmployeeIdsByCampaign: new Map([["campaign-a", ["a","b","c","d","e"]], ["campaign-b", ["f","g","h","i","j"]]]), stableId: (...parts) => parts.join(":") }).length, 2, "Matching wording across campaigns remains separated.");

const capacity = calculateLiftCapacityValue({ affectedPeople: 6, minutesReleasedPerPersonPerWeek: 35, applicableWeeks: 4, realisedFraction: 0.75, employerLoadedHourlyRate: null, basis: "modelled_scenario", period: "Four weeks" });
assert.equal(capacity.hours, 10.5);
assert.equal(capacity.capacityEquivalentValue, null, "No supplied rate means no monetary value.");
assert.match(capacity.limitations.join(" "), /not automatically a cash saving/);
assert.throws(() => calculateLiftCapacityValue({ affectedPeople: 6, minutesReleasedPerPersonPerWeek: 35, applicableWeeks: 4, realisedFraction: 1.2, employerLoadedHourlyRate: null, basis: "modelled_scenario", period: "Four weeks" }));
assert.deepEqual(overlappingBenefitWarning([["shared-a"], ["shared-a","shared-b"]]), ["shared-a"], "Shared benefit IDs expose double counting.");

const proofBase: LiftProofRecord = { opportunityId: "opportunity-a", revision: 0, state: "work_context_confirmed", baseline: null, outcome: null, agreedScope: "", owner: "", intendedMeasure: "", reviewedBy: null, verification: "not_reviewed", otherRelevantChanges: [], limitations: [], followUpAt: null, updatedAt: "2026-10-21T09:00:00Z" };
assert.equal(canTransitionLiftProof({ current: proofBase, nextState: "change_tested", decisionRecorded: true }), false, "A click cannot start a trial without owner, scope, measure and baseline.");
const quantity = { id: "evidence-a", source: "operational_baseline" as const, version: "v1", recordedAt: "2026-10-01T09:00:00Z", subject: "process", permissions: "authorised_employer" as const, description: "Fictional evidence", limitations: [], quantity: { value: 10, unit: "minutes", population: "weekly report", period: "four weeks" } };
const trial = { ...proofBase, baseline: quantity, agreedScope: "One report", owner: "Owner", intendedMeasure: "Minutes" };
assert.equal(canTransitionLiftProof({ current: trial, nextState: "change_tested", decisionRecorded: true }), true);
assert.equal(canTransitionLiftProof({ current: { ...trial, outcome: { ...quantity, id: "evidence-b", source: "measured_outcome" }, reviewedBy: "Reviewer", verification: "internal_review" }, nextState: "outcome_evidenced", decisionRecorded: true }), true);
assert.equal(canTransitionLiftProof({ current: trial, nextState: "no_improvement", decisionRecorded: true }), true, "No-improvement evidence remains a permitted durable outcome rather than being hidden.");

const leadFixture = buildLiftFixtureWorkspace("Apprenticeship Lead");
assert.equal(leadFixture.opportunities.length, 3, "Three evidence-driven fictional examples are available.");
assert.ok(leadFixture.proofs.some((item) => item.state === "outcome_evidenced"));
assert.equal(buildLiftFixtureWorkspace("Employee").decisions.length, 0, "Employee fixture cannot access employer decisions.");
assert.equal(buildLiftFixtureWorkspace("Line Manager").opportunities.length, 0, "Manager fixture cannot access organisation aggregate opportunities.");

const migration = readFileSync(new URL("../supabase/migrations/039_create_levytate_lift_foundation.sql", import.meta.url), "utf8");
assert.ok(migration.includes("lift_enabled boolean not null default false"));
assert.ok(migration.includes("enable row level security") && migration.includes("force row level security"));
assert.ok(migration.includes("revoke all on table") && migration.includes("to service_role"));
assert.ok(!/\b(drop table|drop column|truncate|delete from)\b/i.test(migration), "Migration 039 contains no destructive table, column or data operation.");
assert.ok(!/\b(update|insert into)\s+public\.levytate_(organisations|users|employees|applications|learner_records|assessment_results|operational_actions|pastoral_)\b/i.test(migration), "Migration does not mutate existing business or pastoral records.");
assert.match(migration, /lift-workforce-questionnaire-v1\.1/);
assert.match(migration, /levytate_lift_opportunity_candidates/);
assert.match(migration, /levytate_lift_opportunity_route_members/);
assert.match(migration, /levytate_guard_lift_manager_observation_revision/);

const clientSources = ["../lib/levytate/lift/framework.ts","../components/levytate-mvp/LiftModule.tsx","../lib/levytate/lift/domain.ts"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
assert.ok(!clientSources.includes("check_01:B") && !clientSources.includes("supportedValues"), "Answer keys remain server-only.");
assert.ok(!clientSources.includes("levytate_pastoral_") && !readFileSync(new URL("../lib/server/levytate-lift.ts", import.meta.url), "utf8").includes("levytate_pastoral_"), "Lift does not query pastoral data.");
assert.ok(!/30\s*\/\s*60\s*\/\s*90|30-day|60-day|90-day/i.test(clientSources), "Lift does not generate a generic 30/60/90-day plan.");
const capabilitySource = readFileSync(new URL("../lib/server/levytate-lift-capability.ts", import.meta.url), "utf8");
assert.match(capabilitySource, /LEVYTATE_LIFT_RUNTIME_SCOPE/);
assert.match(capabilitySource, /LEVYTATE_LIFT_ALLOWED_BRANCH/);
assert.match(capabilitySource, /LEVYTATE_LIFT_ALLOWED_ORGANISATION_ID/);
assert.match(capabilitySource, /lift_enabled: "eq\.true"/);
const routeSource = readFileSync(new URL("../app/api/levytate-lift/route.ts", import.meta.url), "utf8");
assert.match(routeSource, /request\.headers\.get\("origin"\)/);
assert.match(routeSource, /private, no-store/);
const fixturePreviewSource = readFileSync(new URL("../app/levytate/lift-preview/page.tsx", import.meta.url), "utf8");
assert.match(fixturePreviewSource, /NODE_ENV !== "development"/);
assert.match(fixturePreviewSource, /LEVYTATE_LIFT_FIXTURE_PREVIEW !== "true"/);
assert.equal(liftQuestionnaireVersion, "lift-workforce-questionnaire-v1.1");
assert.equal(liftInterpretationVersion, "lift-workforce-rules-v1.1");

console.log("Lift validation passed: 30-item coverage, independent perspectives, grounded opportunities, privacy suppression, transparent value and proof gates.");
}

void main();
