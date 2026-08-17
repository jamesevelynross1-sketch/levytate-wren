import type { LevyTateOperationalCopilotFilters, LevyTateOperationalCopilotIntent } from "./ai/types.ts";

export type ContextualCopilotIntent = {
  intent: LevyTateOperationalCopilotIntent;
  filters: LevyTateOperationalCopilotFilters;
  direct: true;
};

export function resolveContextualCopilotIntent({ message, currentSection }: { message: string; currentSection?: string }): ContextualCopilotIntent | null {
  if (!isOperationsCentreContext(currentSection)) return null;
  const text = normalise(message);

  if (/\b(show|which|who|list|find)\b.{0,24}\b(learners?|people|who)\b.{0,24}\b(need(?:ing|s)? attention|at risk|flagged|issues?)\b|\bwho (needs? attention|should i look at first)\b|\bshow current learner issues\b/.test(text)) {
    return { intent: "learners_needing_attention", filters: { dueState: "attention_today", status: "open" }, direct: true };
  }
  if (/\b(highest[- ]risk|most urgent|prioriti[sz]e first|what should i prioriti[sz]e|what is most urgent)\b/.test(text)) {
    return { intent: "highest_risk_actions", filters: { status: "open" }, direct: true };
  }
  if (/\b(overdue reviews?|reviews? overdue|why (?:are )?reviews? overdue)\b/.test(text)) {
    return { intent: "overdue_reviews", filters: {}, direct: true };
  }
  if (/\b(ready to enrol|ready for enrolment|ready to be enrolled)\b/.test(text)) {
    return { intent: "ready_to_enrol", filters: {}, direct: true };
  }
  if (/\b(on a break|active breaks?|breaks? in learning)\b/.test(text)) {
    return { intent: "active_breaks", filters: {}, direct: true };
  }
  return null;
}

export function isOperationsCentreContext(currentSection?: string) {
  return /\boperations centre\b/i.test(currentSection ?? "");
}

function normalise(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
}
