import { z } from "zod";
import type { LearningTimeWorkspace } from "@/lib/levytate/off-the-job/api";
import type { LiftWorkspace } from "@/lib/levytate/lift/domain";

const text = z.string(), texts = z.array(text), count = z.number().int().nonnegative().safe();
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const role = z.enum(["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"]);
const timestamp = text.refine(value => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)));
const plan = object({ planId: text, versionId: text, versionNumber: count, status: text, policyRegime: text, practicalPeriodStartDate: text, practicalPeriodEndDate: text, standardId: text, standardVersion: text, individualMinimumMinutes: count, plannedDeliveryMinutes: count, trainingPlanReference: text });
const priority = object({ id: text, learnerRecordId: text, label: text, description: text, ksbReferences: texts });
const confirmation = object({ id: text, activityId: text, outcome: text, confirmedMinutes: count, sourceReference: text });
const activity = object({ id: text, learnerRecordId: text, activityDate: text, startedAt: text, endedAt: text, breakMinutes: count, durationMinutes: count, category: text, title: text, description: text, whatWasNew: text, standardRelevance: text, reflection: text, workingHoursBasis: text, compensationNote: text, separateFromProductiveWork: z.boolean().nullable(), ksbReferences: texts, evidenceReference: text, deterministicReasons: texts, status: text, lockVersion: count, confirmation: confirmation.nullable() });
const learner = object({ learnerRecordId: text, employeeId: text, canCreateActivities: z.boolean(), learnerName: text, jobTitle: text, department: text, site: text, programmeId: text, programmeName: text, standardId: text, providerId: text, providerName: text, lifecycleStatus: text, activeBreak: z.boolean(), plan: plan.nullable(), priorities: z.array(priority), activities: z.array(activity), totals: object({ learnerRecordedMinutes: count, employerCheckedMinutes: count, providerConfirmedMinutes: count, remainingMinutes: count }), attention: z.array(object({ type: text, label: text, detail: text })) });
const learningTime = object({ generatedAt: timestamp, role, capabilityEnabled: z.literal(true), canManagePlans: z.boolean(), canReviewActivities: z.boolean(), canCreateActivities: z.boolean(), learners: z.array(learner), portfolio: object({ activeLearnerPlans: count, providerConfirmedMinutes: count, candidateMinutesAwaitingCheck: count, activitiesAwaitingProviderConfirmation: count, plansNeedingSetup: count, operationalAttention: count }), regulatoryNotice: text });

const finding = object({ capabilityId: text, label: text, state: text, evidenceIds: texts, contradictoryEvidenceIds: texts, limitation: text });
const question = object({ id: text, episode: text, capabilityIds: texts, evidenceType: text, prompt: text, helpText: text, type: z.enum(["single_choice", "multi_choice", "long_text"]), required: z.boolean(), scored: z.boolean(), options: z.array(object({ value: text, label: text })).optional() });
const assessment = object({ id: text, status: z.enum(["not_started", "draft", "submitted"]), currentQuestionIndex: count, answers: z.record(text, z.union([text, texts, z.null()])), findings: z.array(finding), managerPerspectiveStatus: text, releasedManagerObservation: object({ id: text, observedWork: text, concreteExamples: texts, suitableOpportunity: text, intendedOutcome: text, workplaceConditions: texts }).nullable() });
const manager = object({ teamContextSubmitted: z.boolean(), directReports: z.array(object({ employeeId: text, employeeName: text, perspectiveStatus: text, employeeFindingsReleased: z.boolean(), employeeFindings: z.array(finding), draft: z.record(text, z.unknown()).optional() })) });
const opportunity = object({ id: text, title: text, capabilityIds: texts, capabilityEvidence: text, workThatCouldImprove: text, constraint: text, outcomeWorthPursuing: text, relationship: text, supportingEvidenceIds: texts, contradictoryEvidenceIds: texts, missingInputs: texts, decisionQuestion: text, evidenceNeeded: texts, state: text });
const scenario = object({ affectedPeople: z.number().finite().nullable(), minutesReleasedPerPersonPerWeek: z.number().finite().nullable(), applicableWeeks: z.number().finite().nullable(), realisedFraction: z.number().finite().nullable(), employerLoadedHourlyRate: z.number().finite().nullable(), basis: text, period: text });
const decision = object({ id: text, opportunityId: text, status: text, selectedOptionId: text, rationale: text, owner: text, intendedMeasure: text, assumptions: z.array(object({ id: text, label: text, value: text, unit: text.nullable(), status: text })), valueScenario: scenario.nullable(), sharedBenefitIds: texts });
const evidence = object({ id: text, source: text, version: text, recordedAt: text, subject: text, permissions: text, description: text, limitations: texts, quantity: object({ value: z.number().finite(), unit: text, population: text, period: text }).optional() });
const proof = object({ opportunityId: text, revision: count, state: text, baseline: evidence.nullable(), outcome: evidence.nullable(), agreedScope: text, owner: text, intendedMeasure: text, verification: text, otherRelevantChanges: texts, limitations: texts });
const lift = object({ enabled: z.literal(true), mutationRevision: count, generatedAt: timestamp, role, framework: object({ key: text, questionnaireVersion: text, interpretationVersion: text, questions: z.array(question).min(1) }), coverage: object({ invited: count, submitted: count, workplacePerspectives: count, applicablePopulation: count, evidenceFrom: text.nullable(), evidenceTo: text.nullable() }), assessment: assessment.nullable(), manager: manager.nullable(), availableEmployees: z.array(object({ employeeId: text, employeeName: text, department: text, managerEmployeeId: text.nullable() })), opportunities: z.array(opportunity), decisions: z.array(decision), proofs: z.array(proof), selectedOpportunityId: text.nullable(), historicalAssessmentsAvailable: z.boolean(), privacyNotice: text });

/** Validate before publishing server JSON to React state. These checks preserve
 * source values; they never fill an unavailable workspace with fixture data. */
export function decodeLearningTimeReadResponse(value: unknown): LearningTimeWorkspace {
  if (!learningTime.safeParse(value).success) throw new Error("Learning Time returned an incomplete response. Retry to load the current workspace.");
  return value as LearningTimeWorkspace;
}

export function decodeLiftReadResponse(value: unknown): LiftWorkspace {
  const parsed = object({ ok: z.literal(true), workspace: lift }).safeParse(value);
  if (!parsed.success || (parsed.data.workspace.assessment && parsed.data.workspace.assessment.currentQuestionIndex >= parsed.data.workspace.framework.questions.length)) throw new Error("Lift returned an incomplete response. Retry to load the current workspace.");
  return (value as { workspace: LiftWorkspace }).workspace;
}
