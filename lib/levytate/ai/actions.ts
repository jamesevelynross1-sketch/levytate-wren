import type { LevyTateAiAction, LevyTateAiRequest, LevyTateAiResponse, LevyTateRole } from "@/lib/levytate/ai/types";

const allowedActionTypes: Record<LevyTateRole, Set<LevyTateAiAction["type"]>> = {
  Employee: new Set([
    "open_pathway",
    "start_application",
    "open_my_applications",
    "compare_routes",
    "save_interest",
    "prepare_manager_message",
    "draft_application_reason",
    "ask_follow_up",
  ]),
  "Line Manager": new Set([
    "open_review_queue",
    "open_team_development",
    "compare_routes",
    "prepare_approval_rationale",
    "ask_follow_up",
  ]),
  "Department Head": new Set([
    "open_department_analytics",
    "open_site_breakdown",
    "open_reporting",
    "ask_follow_up",
  ]),
  "Apprenticeship Lead": new Set([
    "open_final_approvals",
    "request_provider_matching",
    "compare_routes",
    "open_reporting",
    "ask_follow_up",
  ]),
  "LevyTate Admin": new Set([
    "request_provider_matching",
    "create_admin_follow_up_task",
    "compare_routes",
    "open_reporting",
    "ask_follow_up",
  ]),
};

const confirmationActionTypes = new Set<LevyTateAiAction["type"]>([
  "start_application",
  "request_provider_matching",
  "create_admin_follow_up_task",
]);

function normaliseActions(role: LevyTateRole, actions: LevyTateAiAction[]) {
  const seen = new Set<string>();
  return actions
    .filter((action) => allowedActionTypes[role].has(action.type))
    .map((action) => ({
      ...action,
      requiresConfirmation: action.requiresConfirmation ?? confirmationActionTypes.has(action.type),
    }))
    .filter((action) => {
      const key = `${action.type}:${action.target ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

export function enforceLevyTateAiActions(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  let actions = normaliseActions(request.role, response.recommendedActions);
  const activeApplication = request.currentApplication ?? request.contextData?.activeApplication ?? null;

  if (request.role === "Employee" && activeApplication) {
    actions = actions.filter((action) => action.type !== "start_application" && action.type !== "draft_application_reason");
    if (!actions.some((action) => action.type === "open_my_applications")) {
      actions = [
        { label: "View current application", type: "open_my_applications" as const, target: "My Applications", requiresConfirmation: false },
        ...actions,
      ].slice(0, 4);
    }
  }

  return {
    ...response,
    recommendedActions: actions,
    suggestedActions: actions,
    applicationPrefill: activeApplication ? null : response.applicationPrefill,
    applicationDraft: activeApplication ? null : (response.applicationDraft ?? response.applicationPrefill),
    nextStep: activeApplication && request.role === "Employee" ? "open_my_applications" : response.nextStep,
    applicationWarning: activeApplication && request.role === "Employee"
      ? response.applicationWarning ?? "You already have an active apprenticeship application in progress. You can track this in My Applications."
      : response.applicationWarning,
  };
}
