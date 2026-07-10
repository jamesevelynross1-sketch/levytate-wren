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
    "open_provider_relationships",
    "request_provider_matching",
    "compare_routes",
    "open_reporting",
    "ask_follow_up",
  ]),
  "LevyTate Admin": new Set([
    "open_provider_relationships",
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

const editableEmployeeStatuses = new Set(["Draft", "More information requested"]);
const employeeActiveStatuses = new Set([
  "Draft",
  "Submitted to Line Manager",
  "Awaiting Manager Review",
  "More information requested",
  "Approved by Line Manager",
  "Submitted to Apprenticeship Lead",
  "Awaiting Final Approval",
  "Approved for Enrolment",
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
    .slice(0, 3);
}

export function enforceLevyTateAiActions(request: LevyTateAiRequest, response: LevyTateAiResponse): LevyTateAiResponse {
  let actions = normaliseActions(request.role, response.recommendedActions);
  const activeApplication = request.currentApplication ?? request.contextData?.activeApplication ?? null;
  const isEmployeePlatformTask = request.role === "Employee"
    && response.safetyNotes.some((note) => note.includes("platform task intent"));
  const hasEmployeeProgrammeContext = Boolean(
    request.role === "Employee"
    && (
      request.preferredStandardId
      || request.workspaceEmployeeContext?.recommendation?.topRecommendation
      || request.workspaceEmployeeContext?.role?.preferredPathway
      || request.availablePathways?.length
      || request.roleMappings?.length
    ),
  );

  if (!request.preferredStandardId && !hasEmployeeProgrammeContext) {
    actions = actions.filter((action) => action.type !== "request_provider_matching" && action.type !== "start_application");
  }

  if (request.role === "Employee" && activeApplication) {
    const isEditable = editableEmployeeStatuses.has(activeApplication.status);
    const isActive = employeeActiveStatuses.has(activeApplication.status);
    actions = actions.filter((action) => action.type !== "start_application");
    if (!isEditable) {
      actions = actions.filter((action) => action.type !== "draft_application_reason");
    }
    if (!isEmployeePlatformTask && !actions.some((action) => action.type === "open_my_applications")) {
      actions = [
        { label: isEditable ? "Continue application" : "View current application", type: "open_my_applications" as const, target: "My Application", requiresConfirmation: false },
        ...actions,
      ].slice(0, 3);
    }
    if (!isActive && /Declined|Completed|Cancelled|Withdrawn/.test(activeApplication.status)) {
      actions = normaliseActions(request.role, response.recommendedActions).filter((action) => action.type !== "request_provider_matching").slice(0, 3);
    }
  }

  return {
    ...response,
    recommendedActions: actions,
    suggestedActions: actions,
    applicationPrefill: activeApplication ? null : response.applicationPrefill,
    applicationDraft: activeApplication ? null : (response.applicationDraft ?? response.applicationPrefill),
    nextStep: activeApplication && request.role === "Employee" ? "open_my_applications" : response.nextStep,
    applicationWarning: response.applicationWarning,
  };
}
