import { writeFileSync } from "node:fs";
import { liftCapabilityLabels } from "../lib/levytate/lift/domain";
import { liftAssessmentQuestions, liftQuestionnaire } from "../lib/levytate/lift/framework";
import { liftRubricMatrix } from "../lib/server/levytate-lift-rubric";

const lines = [
  "# LevyTate Lift Workforce Capability Assessment — pilot instrument",
  "",
  "> Review status: original pilot candidate. Software verification does not make this a scientifically validated, accredited or occupational-competence assessment.",
  "",
  "Framework: `lift-workforce-v1`",
  "Questionnaire: `lift-workforce-questionnaire-v1`",
  "Interpretation rules: `lift-workforce-rules-v1`",
  "",
  "The instrument contains three unscored context prompts and 30 substantive prompts across six workplace episodes. It produces evidence states—supported, emerging, insufficient or contradictory—not a score out of 100, pass/fail result or employee ranking.",
  "",
  "## Assessment content",
  "",
];

let episode = "";
for (const item of liftQuestionnaire) {
  if (item.episode !== episode) {
    episode = item.episode;
    lines.push(`### ${episode}`, "");
  }
  lines.push(`#### ${item.id} — ${item.prompt}`, "", item.helpText, "");
  if (item.options?.length) lines.push(...item.options.map((option) => `- ${option.value}. ${option.label}`), "");
  else lines.push("Response: bounded free text. Writing style, spelling and disclosure of personal history are not separately scored.", "");
  lines.push(`Evidence type: ${item.evidenceType}. ${item.scored ? `Capabilities: ${item.capabilityIds.map((capability) => liftCapabilityLabels[capability]).join("; ")}.` : "Unscored context only."}`, "");
}

lines.push("## Evidence and rubric matrix", "", "The published client receives prompts and options only. Expected-response keys and deterministic rules remain in server-only code. Free text supplies provisional context and can never be the sole basis of a capability conclusion.", "", "| Item | Episode | Capability coverage | Evidence type | Task purpose | Interpretation rule | Alternative defensible answers | Missing-data treatment | Inference limit |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const rubric of liftRubricMatrix) {
  const question = liftAssessmentQuestions.find((item) => item.id === rubric.itemId)!;
  const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
  lines.push(`| ${rubric.itemId} | ${cell(question.episode)} | ${rubric.capabilities.map((capability) => liftCapabilityLabels[capability]).join("; ")} | ${rubric.evidenceType} | ${cell(rubric.taskPurpose)} | ${cell(rubric.interpretationRule)} | ${cell(rubric.alternativeDefensibleAnswers)} | ${cell(rubric.missingTreatment)} | ${cell(rubric.inferenceLimit)} |`);
}

lines.push("", "## Coverage check", "", ...Object.entries(liftCapabilityLabels).map(([capability, label]) => {
  const items = liftAssessmentQuestions.filter((item) => item.capabilityIds.includes(capability as keyof typeof liftCapabilityLabels));
  return `- **${label}:** ${items.map((item) => item.id).join(", ")} across ${new Set(items.map((item) => item.episode)).size} episodes.`;
}), "", "Every capability has more than one evidence point across more than one episode. Multiple answers in one episode remain related evidence, not independent proof.", "");

writeFileSync(new URL("../docs/LEVYTATE_LIFT_ASSESSMENT_BLUEPRINT.md", import.meta.url), `${lines.join("\n").trimEnd()}\n`, "utf8");
