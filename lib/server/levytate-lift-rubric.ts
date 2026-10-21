import type { LiftCapability } from "@/lib/levytate/lift/domain";
import { liftAssessmentQuestions } from "@/lib/levytate/lift/framework";

export type LiftRubricItem = {
  itemId: string;
  capabilities: LiftCapability[];
  evidenceType: string;
  taskPurpose: string;
  interpretationRule: string;
  supportedValues: string[];
  emergingValues: string[];
  unknownValues: string[];
  contradictoryValues: string[];
  alternativeDefensibleAnswers: string;
  missingTreatment: string;
  inferenceLimit: string;
};

const structuredSupported = new Set([
  "check_01:B", "check_02:B", "check_04:B",
  "flow_01:B", "flow_02:B", "flow_04:B",
  "team_01:B", "team_02:B", "team_04:B",
  "data_01:B", "data_02:B", "data_04:B",
  "change_01:B", "change_02:B", "change_03:B",
  "pressure_01:B", "pressure_02:B", "pressure_04:B",
]);

export const liftRubricMatrix: readonly LiftRubricItem[] = liftAssessmentQuestions.map((item) => {
  const anchored = item.evidenceType === "anchored_experience";
  const workSample = item.evidenceType === "short_work_sample";
  return {
    itemId: item.id,
    capabilities: [...item.capabilityIds],
    evidenceType: item.evidenceType,
    taskPurpose: item.prompt,
    interpretationRule: workSample
      ? "Retain as employee-authored context. It can support a human discussion but is never language-model scored or treated as standalone proof."
      : anchored
        ? "A describes insufficient opportunity, C emerging supported practice and D established reported practice. B is a development signal, not a grade."
        : "A structured response contributes only to the mapped capabilities and is combined across distinct episodes; one answer never establishes a capability.",
    supportedValues: workSample ? [] : anchored ? ["D"] : structuredSupported.has(`${item.id}:B`) ? ["B"] : [],
    emergingValues: workSample ? [] : anchored ? ["C"] : [],
    unknownValues: workSample ? [] : anchored ? ["A"] : [],
    contradictoryValues: workSample ? [] : anchored ? ["B"] : ["A", "C", "D"],
    alternativeDefensibleAnswers: workSample
      ? "Different wording, communication style and use of assistive technology are valid. Review focuses on stated reasoning and boundaries."
      : "A non-key response may still be defensible with context. It is retained for review rather than converted into a personal failure label.",
    missingTreatment: "Missing, not applicable and not enough opportunity remain unknown and are excluded from negative interpretation.",
    inferenceLimit: "This pilot item is indicative evidence in a fictional scenario. It does not prove workplace behaviour, competence, potential or employment suitability.",
  };
});

export function rubricFor(itemId: string) {
  return liftRubricMatrix.find((item) => item.itemId === itemId) ?? null;
}
