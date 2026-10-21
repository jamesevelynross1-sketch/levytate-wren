import { writeFileSync } from "node:fs";
import { liftCapabilityLabels, liftFrameworkKey, liftInterpretationVersion, liftQuestionnaireVersion } from "../lib/levytate/lift/domain";
import { liftAssessmentQuestions, liftQuestionnaire } from "../lib/levytate/lift/framework";
import { liftRubricMatrix } from "../lib/server/levytate-lift-rubric";

const lines = [
  "# LevyTate Lift Workforce Capability Assessment — pilot instrument",
  "",
  "> Review status: original pilot candidate. Software verification does not make this a scientifically validated, accredited or occupational-competence assessment.",
  "",
  `Framework: \`${liftFrameworkKey}\``,
  `Questionnaire: \`${liftQuestionnaireVersion}\``,
  `Interpretation rules: \`${liftInterpretationVersion}\``,
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

lines.push("## Evidence and rubric matrix", "", "The published client receives prompts and options only. Expected-response keys and deterministic rules remain in server-only code. Free text is retained as a distinct work sample for human review and is never automatically interpreted.", "", "| Item | Episode | Capability coverage | Evidence type | Intended to reveal | Why supported | Other responses indicate | Defensible alternatives | Automatic interpretation | Missing-data treatment | Inference limit |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const rubric of liftRubricMatrix) {
  const question = liftAssessmentQuestions.find((item) => item.id === rubric.itemId)!;
  const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
  lines.push(`| ${rubric.itemId} | ${cell(question.episode)} | ${rubric.capabilities.map((capability) => liftCapabilityLabels[capability]).join("; ")} | ${rubric.evidenceType} | ${cell(rubric.intendedToReveal)} | ${cell(rubric.whySupported)} | ${cell(rubric.otherResponsesIndicate)} | ${cell(rubric.alternativeDefensibleAnswers)} | ${rubric.automaticallyInterpreted ? "Yes" : "No — human review only"} | ${cell(rubric.missingTreatment)} | ${cell(rubric.inferenceLimit)} |`);
}

lines.push("", "## Coverage check", "", ...Object.entries(liftCapabilityLabels).map(([capability, label]) => {
  const items = liftRubricMatrix.filter((item) => item.automaticallyInterpreted && item.capabilities.includes(capability as keyof typeof liftCapabilityLabels));
  const episodes = new Set(items.map((item) => liftAssessmentQuestions.find((question) => question.id === item.itemId)!.episode));
  return `- **${label}:** ${items.length} automatically interpreted evidence point(s): ${items.map((item) => item.itemId).join(", ")} across ${episodes.size} episode(s).`;
}), "", "Coverage counts only automatically interpreted items. Work samples remain separately reviewable evidence and are not included in interpretation coverage. Multiple answers in one episode remain related evidence, not independent proof.", "");

writeFileSync(new URL("../docs/LEVYTATE_LIFT_ASSESSMENT_BLUEPRINT.md", import.meta.url), `${lines.join("\n").trimEnd()}\n`, "utf8");
