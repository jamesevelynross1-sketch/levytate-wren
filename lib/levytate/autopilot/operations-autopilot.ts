import type { MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";
import type { OperationalOwnerType } from "@/lib/levytate/mvp/operations-centre";

export const autopilotAnalyserVersion = "operations-autopilot-v1";
export const autopilotLanes = ["needs_your_decision", "ready_to_action", "waiting_externally", "upcoming", "recently_resolved"] as const;
export type AutopilotLane = typeof autopilotLanes[number];
export type AutopilotPriority = "action_now" | "this_week" | "upcoming";
export type AutopilotCategory = "reviews" | "actions" | "manager_actions" | "applications" | "provider_dependencies";
export type AutopilotSignalType =
  | "review_overdue"
  | "review_due_with_outstanding_actions"
  | "review_upcoming"
  | "operational_action_overdue"
  | "manager_action_overdue"
  | "manager_action_due_soon"
  | "application_stalled"
  | "application_awaiting_manager"
  | "application_awaiting_provider"
  | "provider_dependency_overdue";
export type AutopilotEntityType = "learner" | "application" | "review" | "operational_action";

export type AutopilotEvidence = {
  sourceType: "application" | "learner_review" | "operational_action";
  sourceId: string;
  sourceDate: string;
  label: string;
  value: string;
  url: string;
};

export type AutopilotInterpretation = {
  headline: string;
  whyItMatters: string;
  suggestedNextStep: string;
  draftCommunication: string;
  evidenceSummary: string[];
  source: "deterministic" | "ai";
  modelIdentifier: string;
};

export type DetectedAutopilotSignal = {
  id: string;
  signalKey: string;
  fingerprint: string;
  organisationId: string;
  entityType: AutopilotEntityType;
  entityId: string;
  learnerRecordId?: string;
  applicationId?: string;
  employeeId?: string;
  providerId?: string;
  programmeId?: string;
  subjectLabel: string;
  category: AutopilotCategory;
  signalType: AutopilotSignalType;
  lane: AutopilotLane;
  priority: AutopilotPriority;
  title: string;
  summary: string;
  recommendedAction: string;
  suggestedOwnerType: OperationalOwnerType;
  suggestedDueDate: string;
  suggestedActionType: string;
  evidence: AutopilotEvidence[];
  deterministicPayload: Record<string, unknown>;
  interpretation: AutopilotInterpretation;
  linkedOperationalActionId?: string;
  detectedAt: string;
  lastEvaluatedAt: string;
};

export type AutopilotPersistedSignal = DetectedAutopilotSignal & {
  status: "new" | "acknowledged" | "accepted" | "dismissed" | "resolved";
  resolvedAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissalReason?: string;
};

export type AutopilotReviewInput = {
  id: string;
  type: "provider_review" | "l_and_d_check_in" | "manager_check_in";
  nextReviewDate: string;
  reviewDate: string;
  status: string;
};

export type AutopilotLearnerInput = {
  learnerRecordId: string;
  learnerName: string;
  providerId: string;
  providerName: string;
  programmeId: string;
  programmeName: string;
  reviews: AutopilotReviewInput[];
};

export type AutopilotActionInput = {
  id: string;
  learnerRecordId: string;
  applicationId: string;
  employeeId: string;
  title: string;
  description: string;
  actionType: string;
  ownerType: OperationalOwnerType;
  dueDate: string;
  status: string;
  sourceUrl: string;
  updatedAt: string;
};

export type AutopilotApplicationInput = {
  id: string;
  employeeId: string;
  employeeName: string;
  status: string;
  currentOwner: MvpApplicationOwner;
  updatedAt: string;
  currentStepLabel?: string;
  currentResponsibleRole?: string;
};

export type AutopilotAnalysisInput = {
  organisationId: string;
  now: string;
  learners: AutopilotLearnerInput[];
  actions: AutopilotActionInput[];
  applications: AutopilotApplicationInput[];
};

const terminalActionStatuses = new Set(["completed", "dismissed", "cancelled"]);
const prohibitedInterpretationLanguage = /\b(risk score|high[- ]risk learner|low[- ]quality provider|predict(?:s|ed|ion)?|guarantee(?:d)?|automatically (?:send|change|close|complete))\b/i;

export function analyseOperationsAutopilot(input: AutopilotAnalysisInput) {
  const today = isoDate(input.now);
  const activeActions = input.actions.filter((action) => !terminalActionStatuses.has(action.status));
  const signals: DetectedAutopilotSignal[] = [];
  const consumedActionIds = new Set<string>();

  for (const learner of input.learners) {
    const learnerActions = activeActions.filter((action) => action.learnerRecordId === learner.learnerRecordId);
    const reviewsByType = latestReviewsByType(learner.reviews);
    for (const review of reviewsByType) {
      if (!review.nextReviewDate) continue;
      const days = daysBetween(today, review.nextReviewDate);
      const reviewLabel = reviewTypeLabel(review.type);
      const relatedActions = learnerActions.filter((action) => action.ownerType !== "Provider");
      const matchingReviewAction = learnerActions.find((action) => action.actionType === reviewActionType(review.type));
      if (days < 0) {
        relatedActions.forEach((action) => consumedActionIds.add(action.id));
        signals.push(buildSignal(input, {
          key: `review:${review.id}:overdue`, type: "review_overdue", category: "reviews", lane: "ready_to_action",
          priority: "action_now", entityType: "review", entityId: review.id, learner, subjectLabel: learner.learnerName,
          title: `${reviewLabel} overdue`, summary: `${learner.learnerName}'s ${reviewLabel.toLowerCase()} is ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue.`,
          recommendedAction: `Review the recorded evidence and arrange the ${reviewLabel.toLowerCase()}.`, ownerType: review.type === "manager_check_in" ? "Line Manager" : "Apprenticeship Lead",
          dueDate: today, actionType: reviewActionType(review.type),
          evidence: [reviewEvidence(review, learner)], payload: { rule: "review_overdue", daysOverdue: Math.abs(days), reviewType: review.type }, linkedOperationalActionId: matchingReviewAction?.id,
        }));
      } else if (days <= 7 && relatedActions.length) {
        relatedActions.forEach((action) => consumedActionIds.add(action.id));
        signals.push(buildSignal(input, {
          key: `review:${review.id}:due-with-actions`, type: "review_due_with_outstanding_actions", category: "reviews", lane: "ready_to_action",
          priority: "action_now", entityType: "review", entityId: review.id, learner, subjectLabel: learner.learnerName,
          title: `${reviewLabel} due with open actions`, summary: `${learner.learnerName}'s ${reviewLabel.toLowerCase()} is due in ${days} day${days === 1 ? "" : "s"} with ${relatedActions.length} unresolved action${relatedActions.length === 1 ? "" : "s"}.`,
          recommendedAction: "Review the outstanding actions before the scheduled conversation.", ownerType: "Apprenticeship Lead",
          dueDate: review.nextReviewDate, actionType: reviewActionType(review.type),
          evidence: [reviewEvidence(review, learner), ...relatedActions.slice(0, 3).map(actionEvidence)], payload: { rule: "review_due_with_outstanding_actions", daysUntilDue: days, unresolvedActionIds: relatedActions.map((action) => action.id) }, linkedOperationalActionId: matchingReviewAction?.id,
        }));
      } else if (days <= 14) {
        signals.push(buildSignal(input, {
          key: `review:${review.id}:upcoming`, type: "review_upcoming", category: "reviews", lane: "upcoming",
          priority: "upcoming", entityType: "review", entityId: review.id, learner, subjectLabel: learner.learnerName,
          title: `${reviewLabel} approaching`, summary: `${learner.learnerName}'s ${reviewLabel.toLowerCase()} is due in ${days} day${days === 1 ? "" : "s"}.`,
          recommendedAction: "Prepare evidence and confirm attendance before the review.", ownerType: "Apprenticeship Lead",
          dueDate: review.nextReviewDate, actionType: reviewActionType(review.type), evidence: [reviewEvidence(review, learner)], payload: { rule: "review_upcoming", daysUntilDue: days, reviewType: review.type }, linkedOperationalActionId: matchingReviewAction?.id,
        }));
      }
    }
  }

  for (const action of activeActions) {
    if (!action.dueDate || consumedActionIds.has(action.id)) continue;
    const days = daysBetween(today, action.dueDate);
    if (action.ownerType === "Provider" && days < 0) {
      signals.push(actionSignal(input, action, "provider_dependency_overdue", "provider_dependencies", "waiting_externally", Math.abs(days) >= 5 ? "action_now" : "this_week", today));
      continue;
    }
    if (action.ownerType === "Line Manager" && days < 0) {
      signals.push(actionSignal(input, action, "manager_action_overdue", "manager_actions", "ready_to_action", Math.abs(days) >= 5 ? "action_now" : "this_week", today));
      continue;
    }
    if (action.ownerType === "Line Manager" && days <= 3) {
      signals.push(actionSignal(input, action, "manager_action_due_soon", "manager_actions", "ready_to_action", "this_week", action.dueDate));
      continue;
    }
    if (days < 0) signals.push(actionSignal(input, action, "operational_action_overdue", "actions", "ready_to_action", Math.abs(days) >= 5 ? "action_now" : "this_week", today));
  }

  for (const application of input.applications) {
    const age = Math.max(0, -daysBetween(today, isoDate(application.updatedAt)));
    if (age < 5) continue;
    const evidence = [applicationEvidence(application)];
    const matchingApplicationAction = activeActions.find((action) => action.applicationId === application.id && action.actionType === "review_application");
    if (application.currentOwner === "Line Manager") {
      signals.push(buildSignal(input, {
        key: `application:${application.id}:awaiting-manager`, type: "application_awaiting_manager", category: "applications", lane: "ready_to_action", priority: age >= 14 ? "action_now" : "this_week",
        entityType: "application", entityId: application.id, application, subjectLabel: application.employeeName, title: "Application awaiting manager review",
        summary: `${application.employeeName}'s application has awaited manager review for ${age} days.`, recommendedAction: "Review the application or request the information needed for a decision.",
        ownerType: "Line Manager", dueDate: today, actionType: "review_application", evidence, payload: { rule: "application_awaiting_manager", daysInState: age, status: application.status }, linkedOperationalActionId: matchingApplicationAction?.id,
      }));
    } else if (application.currentOwner === "Provider Partner") {
      signals.push(buildSignal(input, {
        key: `application:${application.id}:awaiting-provider`, type: "application_awaiting_provider", category: "applications", lane: "waiting_externally", priority: age >= 14 ? "action_now" : "this_week",
        entityType: "application", entityId: application.id, application, subjectLabel: application.employeeName, title: "Application awaiting provider",
        summary: `${application.employeeName}'s application has awaited provider progress for ${age} days.`, recommendedAction: "Confirm the outstanding provider dependency and agree a response date.",
        ownerType: "Provider", dueDate: today, actionType: "confirm_provider", evidence, payload: { rule: "application_awaiting_provider", daysInState: age, status: application.status }, linkedOperationalActionId: matchingApplicationAction?.id,
      }));
    } else if (age >= 7 && !["Completed", "Cancelled", "Withdrawn"].includes(application.status)) {
      signals.push(buildSignal(input, {
        key: `application:${application.id}:stalled`, type: "application_stalled", category: "applications", lane: "needs_your_decision", priority: age >= 14 ? "action_now" : "this_week",
        entityType: "application", entityId: application.id, application, subjectLabel: application.employeeName, title: "Application has not progressed",
        summary: `${application.employeeName}'s application has remained at ${application.currentStepLabel ?? application.status} for ${age} days.`, recommendedAction: "Review the application state and confirm the next responsible owner.",
        ownerType: "Apprenticeship Lead", dueDate: today, actionType: "review_application", evidence, payload: { rule: "application_stalled", daysInState: age, status: application.status, currentOwner: application.currentOwner, currentStepLabel: application.currentStepLabel }, linkedOperationalActionId: matchingApplicationAction?.id,
      }));
    }
  }

  return signals.sort(compareSignals);
}

export function reconcileAutopilotSignals(existing: AutopilotPersistedSignal[], detected: DetectedAutopilotSignal[], now = new Date().toISOString()) {
  const byKey = new Map(existing.map((signal) => [signal.signalKey, signal]));
  const detectedKeys = new Set(detected.map((signal) => signal.signalKey));
  const next = detected.map((signal): AutopilotPersistedSignal => {
    const prior = byKey.get(signal.signalKey);
    if (!prior) return { ...signal, status: "new" };
    const materiallyChanged = prior.fingerprint !== signal.fingerprint;
    return {
      ...signal,
      id: prior.id,
      detectedAt: prior.detectedAt,
      status: materiallyChanged ? "new" : prior.status === "resolved" ? "new" : prior.status,
      lane: !materiallyChanged && prior.status === "accepted" ? actionTrackingLane(prior.suggestedOwnerType) : signal.lane,
      linkedOperationalActionId: prior.linkedOperationalActionId || signal.linkedOperationalActionId,
      dismissedAt: materiallyChanged ? undefined : prior.dismissedAt,
      dismissedBy: materiallyChanged ? undefined : prior.dismissedBy,
      dismissalReason: materiallyChanged ? undefined : prior.dismissalReason,
    };
  });
  for (const prior of existing) {
    if (!detectedKeys.has(prior.signalKey) && prior.status !== "resolved") {
      next.push({ ...prior, status: "resolved", lane: "recently_resolved", resolvedAt: now, lastEvaluatedAt: now });
    } else if (!detectedKeys.has(prior.signalKey)) next.push(prior);
  }
  return next;
}

export function buildOperationsBrief(signals: AutopilotPersistedSignal[]) {
  const active = signals.filter((signal) => !["dismissed", "resolved"].includes(signal.status));
  return {
    actionNow: active.filter((signal) => signal.priority === "action_now").length,
    thisWeek: active.filter((signal) => signal.priority === "this_week").length,
    upcoming: active.filter((signal) => signal.priority === "upcoming").length,
    waitingExternally: active.filter((signal) => signal.lane === "waiting_externally").length,
    preparedNextActions: active.filter((signal) => !signal.linkedOperationalActionId).length,
    total: active.length,
  };
}

export function validateAutopilotInterpretation(value: unknown, signal: DetectedAutopilotSignal, modelIdentifier: string): AutopilotInterpretation {
  if (!value || typeof value !== "object") return signal.interpretation;
  const record = value as Record<string, unknown>;
  const headline = cleanInterpretationField(record.headline, 120);
  const whyItMatters = cleanInterpretationField(record.whyItMatters, 420);
  const suggestedNextStep = cleanInterpretationField(record.suggestedNextStep, 300);
  const draftCommunication = cleanInterpretationField(record.draftCommunication, 600);
  const generatedEvidenceSummary = Array.isArray(record.evidenceSummary) ? record.evidenceSummary.map((item) => cleanInterpretationField(item, 180)).filter(Boolean).slice(0, 6) : [];
  if (!headline || !whyItMatters || !suggestedNextStep || !generatedEvidenceSummary.length) return signal.interpretation;
  const generated = [headline, whyItMatters, suggestedNextStep, draftCommunication, ...generatedEvidenceSummary].join(" ");
  if (prohibitedInterpretationLanguage.test(generated) || introducesUnsupportedNumber(generated, signal)) return signal.interpretation;
  return { headline, whyItMatters, suggestedNextStep, draftCommunication, evidenceSummary: signal.interpretation.evidenceSummary, source: "ai", modelIdentifier };
}

type BuildFields = {
  key: string; type: AutopilotSignalType; category: AutopilotCategory; lane: AutopilotLane; priority: AutopilotPriority;
  entityType: AutopilotEntityType; entityId: string; learner?: AutopilotLearnerInput; application?: AutopilotApplicationInput;
  subjectLabel: string; title: string; summary: string; recommendedAction: string; ownerType: OperationalOwnerType; dueDate: string;
  actionType: string; evidence: AutopilotEvidence[]; payload: Record<string, unknown>; linkedOperationalActionId?: string;
};

function buildSignal(input: AutopilotAnalysisInput, fields: BuildFields): DetectedAutopilotSignal {
  const signalKey = `${input.organisationId}:${fields.key}`;
  const fingerprint = stableFingerprint({ signalKey, evidence: fields.evidence, payload: fields.payload });
  const interpretation: AutopilotInterpretation = {
    headline: fields.title,
    whyItMatters: fields.summary,
    suggestedNextStep: fields.recommendedAction,
    draftCommunication: "",
    evidenceSummary: fields.evidence.map((item) => `${item.label}: ${item.value}`),
    source: "deterministic",
    modelIdentifier: "",
  };
  return {
    id: `autopilot-${stableHash(signalKey)}`, signalKey, fingerprint, organisationId: input.organisationId,
    entityType: fields.entityType, entityId: fields.entityId, learnerRecordId: fields.learner?.learnerRecordId,
    applicationId: fields.application?.id, employeeId: fields.application?.employeeId,
    providerId: fields.learner?.providerId, programmeId: fields.learner?.programmeId, subjectLabel: fields.subjectLabel,
    category: fields.category, signalType: fields.type, lane: fields.lane, priority: fields.priority, title: fields.title,
    summary: fields.summary, recommendedAction: fields.recommendedAction, suggestedOwnerType: fields.ownerType,
    suggestedDueDate: fields.dueDate, suggestedActionType: fields.actionType, evidence: fields.evidence,
    deterministicPayload: fields.payload, interpretation, linkedOperationalActionId: fields.linkedOperationalActionId,
    detectedAt: input.now, lastEvaluatedAt: input.now,
  };
}

function actionSignal(input: AutopilotAnalysisInput, action: AutopilotActionInput, type: AutopilotSignalType, category: AutopilotCategory, lane: AutopilotLane, priority: AutopilotPriority, dueDate: string) {
  const overdueDays = Math.max(0, -daysBetween(isoDate(input.now), action.dueDate));
  return buildSignal(input, {
    key: `action:${action.id}:${type}`, type, category, lane, priority, entityType: "operational_action", entityId: action.id,
    subjectLabel: action.title, title: action.title, summary: overdueDays ? `${action.title} is ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue.` : `${action.title} is due within three days.`,
    recommendedAction: "Review the evidence and progress the existing operational action.", ownerType: action.ownerType,
    dueDate, actionType: "", evidence: [actionEvidence(action)], payload: { rule: type, operationalActionId: action.id, dueDate: action.dueDate, overdueDays },
    linkedOperationalActionId: action.id,
  });
}

function latestReviewsByType(reviews: AutopilotReviewInput[]) {
  const result = new Map<AutopilotReviewInput["type"], AutopilotReviewInput>();
  for (const review of reviews) {
    const prior = result.get(review.type);
    if (!prior || (review.reviewDate || review.nextReviewDate) > (prior.reviewDate || prior.nextReviewDate)) result.set(review.type, review);
  }
  return [...result.values()];
}

function reviewEvidence(review: AutopilotReviewInput, learner: AutopilotLearnerInput): AutopilotEvidence {
  return { sourceType: "learner_review", sourceId: review.id, sourceDate: review.nextReviewDate, label: `${reviewTypeLabel(review.type)} due`, value: review.nextReviewDate, url: `/levytate/app?module=Learners&learner=${encodeURIComponent(learner.learnerRecordId)}` };
}
function actionEvidence(action: AutopilotActionInput): AutopilotEvidence {
  return { sourceType: "operational_action", sourceId: action.id, sourceDate: action.dueDate || action.updatedAt, label: "Operational action", value: action.title, url: action.sourceUrl || `/levytate/app?module=Operations&action=${encodeURIComponent(action.id)}` };
}
function applicationEvidence(application: AutopilotApplicationInput): AutopilotEvidence {
  return { sourceType: "application", sourceId: application.id, sourceDate: application.updatedAt, label: "Application state", value: application.status, url: `/levytate/app?module=Applications&application=${encodeURIComponent(application.id)}` };
}
function reviewTypeLabel(type: AutopilotReviewInput["type"]) {
  return type === "provider_review" ? "Provider review" : type === "manager_check_in" ? "Manager check-in" : "L&D check-in";
}
function reviewActionType(type: AutopilotReviewInput["type"]) {
  return type === "provider_review" ? "record_provider_review" : type === "manager_check_in" ? "record_manager_check_in" : "record_l_and_d_check_in";
}
function compareSignals(left: DetectedAutopilotSignal, right: DetectedAutopilotSignal) {
  const rank: Record<AutopilotPriority, number> = { action_now: 0, this_week: 1, upcoming: 2 };
  return rank[left.priority] - rank[right.priority] || left.suggestedDueDate.localeCompare(right.suggestedDueDate) || left.signalKey.localeCompare(right.signalKey);
}
function isoDate(value: string) { return value.slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
function stableFingerprint(value: unknown) { return `apf-${stableHash(JSON.stringify(value))}`; }
function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function actionTrackingLane(ownerType: OperationalOwnerType): AutopilotLane { return ownerType === "Provider" ? "waiting_externally" : "ready_to_action"; }
function cleanInterpretationField(value: unknown, maximum: number) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : ""; }
function introducesUnsupportedNumber(generated: string, signal: DetectedAutopilotSignal) {
  const allowedSource = JSON.stringify({ summary: signal.summary, recommendation: signal.recommendedAction, evidence: signal.evidence, payload: signal.deterministicPayload });
  const allowed = new Set(allowedSource.match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  return (generated.match(/\b\d+(?:\.\d+)?\b/g) ?? []).some((value) => !allowed.has(value));
}
