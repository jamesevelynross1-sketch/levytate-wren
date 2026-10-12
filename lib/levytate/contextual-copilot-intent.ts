import type { LevyTateOperationalCopilotFilters, LevyTateOperationalCopilotIntent } from "./ai/types.ts";

export type ContextualCopilotIntent = {
  intent: LevyTateOperationalCopilotIntent;
  filters: LevyTateOperationalCopilotFilters;
  direct: true;
};

export function resolveContextualCopilotIntent({ message, currentSection }: { message: string; currentSection?: string }): ContextualCopilotIntent | null {
  const text = normalise(message);

  if (isLearningTimeContext(currentSection)) {
    if (/\b(what|which).{0,20}(could|should|can).{0,18}(i|we).{0,16}(work on|learn|study)|\bplan.{0,24}(learning|protected time)|\bprotected learning time\b/.test(text)) {
      return { intent: "learning_time_planning", filters: {}, direct: true };
    }
    if (/\bprovider confirmation\b|\bitems?.{0,24}need.{0,18}confirmation\b/.test(text)) {
      return { intent: "learning_time_attention", filters: { actionType: "otj_provider_confirmation_pending" }, direct: true };
    }
    if (/\bactivity.{0,30}(waiting|awaiting).{0,18}(review|check)|\bwaiting.{0,30}(employer check|review)\b/.test(text)) {
      return { intent: "learning_time_attention", filters: { actionType: "otj_submission_awaiting_employer_check" }, direct: true };
    }
    if (/\b(waiting|awaiting|need(?:s|ing)?).{0,30}(review|confirmation|employer check)\b/.test(text)) {
      return { intent: "learning_time_attention", filters: {}, direct: true };
    }
    if (/\b(provider[- ]confirmed|learner[- ]recorded|employer[- ]checked).{0,24}(learning )?(hours?|time)|\b(how many|remaining|position|summary).{0,30}(hours?|learning|confirmed)\b/.test(text)) {
      return { intent: "learning_time_summary", filters: {}, direct: true };
    }
  }

  if (!isOperationsCentreContext(currentSection)) return null;

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

export function isLearningTimeContext(currentSection?: string) {
  return /\blearning time\b/i.test(currentSection ?? "");
}

function normalise(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
}
