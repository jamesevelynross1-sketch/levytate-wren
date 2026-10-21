import { createHash, randomUUID } from "node:crypto";
import {
  liftCapabilities,
  liftCapabilityLabels,
  liftInterpretationVersion,
  type LiftAnswerMap,
  type LiftCapability,
  type LiftCapabilityFinding,
  type LiftEvidenceReference,
  type LiftOpportunity,
} from "@/lib/levytate/lift/domain";
import { liftQuestionnaire } from "@/lib/levytate/lift/framework";
import { rubricFor } from "@/lib/server/levytate-lift-rubric";

type ManagerContext = {
  employeeId: string;
  observedCapabilityIds: readonly LiftCapability[];
  workThatCouldImprove: string;
  intendedOutcome: string;
  concreteExamples: string[];
  opportunityToObserve: "enough" | "limited" | "not_enough";
  conditions: { time: string; tools: string; access: string; supervision: string; suitableWork: string };
  recordedAt: string;
};

export function validateLiftAnswers(answers: LiftAnswerMap) {
  const allowed = new Set(liftQuestionnaire.map((item) => item.id));
  const unknown = Object.keys(answers).find((id) => !allowed.has(id));
  if (unknown) return { valid: false, message: `Unknown Lift item ${unknown}.`, missing: [] } as const;
  const missing = liftQuestionnaire.filter((item) => item.required && isMissing(answers[item.id])).map((item) => item.id);
  return missing.length
    ? { valid: false, message: `Complete ${missing.length} remaining item${missing.length === 1 ? "" : "s"}.`, missing } as const
    : { valid: true, message: "", missing: [] } as const;
}

export function interpretLiftAssessment(input: { assessmentId: string; employeeId: string; answers: LiftAnswerMap; submittedAt: string }) {
  const findings = liftCapabilities.map((capabilityId) => findingFor(capabilityId, input.assessmentId, input.answers));
  const evidence: LiftEvidenceReference[] = liftQuestionnaire.flatMap((item) => {
    const value = input.answers[item.id];
    if (isMissing(value)) return [];
    return [{
      id: stableEvidenceId(input.assessmentId, item.id),
      source: item.evidenceType === "anchored_experience" || item.evidenceType === "unscored_context" ? "employee_report" : "employee_task",
      version: liftInterpretationVersion,
      recordedAt: input.submittedAt,
      subject: input.employeeId,
      permissions: "private_employee",
      description: `${item.episode}: ${item.prompt}`,
      limitations: item.scored
        ? ["Pilot assessment evidence; not proof of workplace behaviour or occupational competence."]
        : ["Volunteered context only; not scored or used as capability evidence."],
    } satisfies LiftEvidenceReference];
  });
  return { findings, evidence };
}

export function buildLiftOpportunities(input: {
  assessmentId: string;
  employeeId: string;
  findings: LiftCapabilityFinding[];
  employeeEvidence: LiftEvidenceReference[];
  manager: ManagerContext | null;
  generatedAt: string;
}): LiftOpportunity[] {
  if (!input.manager || input.manager.opportunityToObserve === "not_enough") return [];
  const candidateCapabilities = input.findings.filter((finding) =>
    (finding.state === "supported" || finding.state === "emerging") && input.manager!.observedCapabilityIds.includes(finding.capabilityId),
  );
  const constraintParts = Object.entries(input.manager.conditions).filter(([, value]) => value.trim() && !/^available|agreed|yes$/i.test(value.trim())).map(([key, value]) => `${humanise(key)}: ${value.trim()}`);
  const managerEvidenceId = liftManagerEvidenceId(input.assessmentId, input.manager.employeeId, input.manager.recordedAt);
  const managerEvidence = {
    id: managerEvidenceId,
    source: "manager_observation" as const,
    version: liftInterpretationVersion,
    recordedAt: input.manager.recordedAt,
    subject: input.employeeId,
    permissions: "released_pair" as const,
    description: input.manager.concreteExamples.join(" ").slice(0, 600),
    limitations: ["Manager-observed context remains independent from the employee assessment and is not averaged with it."],
  };

  if (!candidateCapabilities.length) return [];
  const primary = candidateCapabilities.slice(0, 3);
  const employeeIds = primary.flatMap((finding) => finding.evidenceIds).filter((id) => input.employeeEvidence.some((item) => item.id === id));
  const relationship = primary.every((finding) => finding.state === "supported") && input.manager.concreteExamples.length > 0 ? "supported" : "hypothesis";
  const opportunityId = stableEntityId("opportunity", input.assessmentId, primary.map((item) => item.capabilityId).join(":"), input.manager.workThatCouldImprove);
  return [{
    id: opportunityId,
    title: constraintParts.length ? "Remove a workplace constraint before choosing development" : "Test a grounded improvement in current work",
    capabilityIds: primary.map((finding) => finding.capabilityId),
    capabilityEvidence: primary.map((finding) => `${finding.label}: ${finding.state}`).join(" · "),
    workThatCouldImprove: input.manager.workThatCouldImprove,
    constraint: constraintParts.join(" · ") || "No material workplace constraint recorded; confirm scope and permission before a trial.",
    outcomeWorthPursuing: input.manager.intendedOutcome,
    relationship,
    supportingEvidenceIds: [...new Set([...employeeIds, managerEvidence.id])],
    contradictoryEvidenceIds: [...new Set(primary.flatMap((finding) => finding.contradictoryEvidenceIds))],
    missingInputs: [
      ...(relationship === "hypothesis" ? ["Additional observed workplace evidence"] : []),
      "A defined operational baseline and comparable outcome measure",
    ],
    decisionQuestion: constraintParts.length
      ? "Which workplace condition should be addressed before deciding whether development or a trial is appropriate?"
      : "Is a bounded workplace trial justified, or should more evidence be gathered first?",
    evidenceNeeded: ["Named owner and agreed scope", "Baseline with unit, population and period", "Outcome observed on the same basis", "Authorised review of limitations"],
    interpretationVersion: liftInterpretationVersion,
    generatedAt: input.generatedAt,
    state: relationship === "supported" ? "work_context_confirmed" : "signal_identified",
  }];
}

export function validateOpportunityReferences(opportunity: LiftOpportunity, evidence: LiftEvidenceReference[]) {
  const valid = new Set(evidence.map((item) => item.id));
  const references = [...opportunity.supportingEvidenceIds, ...opportunity.contradictoryEvidenceIds];
  return references.every((id) => valid.has(id)) && !references.some((id) => id.startsWith("pastoral"));
}

function findingFor(capabilityId: LiftCapability, assessmentId: string, answers: LiftAnswerMap): LiftCapabilityFinding {
  const relevant = liftQuestionnaire.filter((item) => item.scored && item.capabilityIds.includes(capabilityId));
  let supported = 0;
  let emerging = 0;
  let contradictory = 0;
  const episodes = new Set<string>();
  const evidenceIds: string[] = [];
  const contradictoryIds: string[] = [];
  for (const item of relevant) {
    const value = scalar(answers[item.id]);
    const rubric = rubricFor(item.id);
    if (!rubric || !value) continue;
    if (rubric.supportedValues.includes(value)) { supported += 2; episodes.add(item.episode); evidenceIds.push(stableEvidenceId(assessmentId, item.id)); }
    else if (rubric.emergingValues.includes(value)) { emerging += 1; episodes.add(item.episode); evidenceIds.push(stableEvidenceId(assessmentId, item.id)); }
    else if (rubric.contradictoryValues.includes(value)) { contradictory += 1; contradictoryIds.push(stableEvidenceId(assessmentId, item.id)); }
  }
  const distinctSituations = episodes.size;
  const state = contradictory >= 2 && supported === 0
    ? "contradictory"
    : supported >= 4 && distinctSituations >= 2
      ? "supported"
      : supported + emerging >= 2
        ? "emerging"
        : "insufficient";
  return {
    capabilityId,
    label: liftCapabilityLabels[capabilityId],
    state,
    evidenceIds,
    contradictoryEvidenceIds: contradictoryIds,
    limitation: distinctSituations < 2
      ? "Evidence does not yet span two distinct situations."
      : "Pilot evidence is indicative and must be considered with workplace context; it is not a competence judgement.",
  };
}

function scalar(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function isMissing(value: unknown) { return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0); }
function stableEvidenceId(assessmentId: string, itemId: string) { return hashUuid(`${assessmentId}:${itemId}`); }
function stableEntityId(...parts: string[]) { return hashUuid(parts.join(":")); }
function hashUuid(value: string) { const hash = createHash("sha256").update(value).digest("hex"); return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`; }
function humanise(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }

export function newLiftId() { return randomUUID(); }
export function liftManagerEvidenceId(assessmentId: string, employeeId: string, recordedAt: string) { return stableEvidenceId(assessmentId, `manager:${employeeId}:${recordedAt}`); }
