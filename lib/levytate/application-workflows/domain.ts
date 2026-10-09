export const applicationWorkflowRoles = ["Line Manager", "Apprenticeship Lead", "Employer Admin"] as const;
export type ApplicationWorkflowRole = (typeof applicationWorkflowRoles)[number];

export type ApplicationWorkflowStepType =
  | "employee_submission"
  | "role_review"
  | "role_approval"
  | "provider_handoff";

export type ApplicationWorkflowStep = {
  id: string;
  type: ApplicationWorkflowStepType;
  label: string;
  responsibleRole: "Employee" | ApplicationWorkflowRole | "Provider Partner";
  allowDecline: boolean;
};

export type ApplicationWorkflowVersion = {
  id: string;
  organisationId: string;
  workflowId: string;
  version: number;
  status: "draft" | "published" | "superseded";
  steps: ApplicationWorkflowStep[];
  createdAt: string;
  publishedAt?: string;
};

export type ApplicationWorkflowInstance = {
  id: string;
  organisationId: string;
  applicationId: string;
  workflowVersionId: string;
  currentStepId: string;
  state: "active" | "needs_information" | "declined" | "ready_for_provider";
  returnStepId?: string;
  lockVersion: number;
  lastProgressedAt: string;
};

export type ApplicationWorkflowAction = "submit" | "approve" | "continue" | "request_information" | "resubmit" | "decline";

export type ApplicationWorkflowActor = {
  role: "Employee" | ApplicationWorkflowRole;
  isDirectManager?: boolean;
};

export type ApplicationWorkflowEvent = {
  id: string;
  organisationId: string;
  applicationId: string;
  workflowVersionId: string;
  stepId: string;
  action: ApplicationWorkflowAction;
  actorRole: ApplicationWorkflowActor["role"];
  actorLabel?: string;
  note?: string;
  idempotencyKey: string;
  fromLockVersion: number;
  toLockVersion: number;
  createdAt: string;
};

const safeLabel = /^[\p{L}\p{N}][\p{L}\p{N} &'(),.\-/]{1,78}$/u;

export function createDefaultApplicationWorkflow(organisationId: string, now = new Date().toISOString()): ApplicationWorkflowVersion {
  return {
    id: `default:${organisationId}:1`,
    organisationId,
    workflowId: `default:${organisationId}`,
    version: 1,
    status: "published",
    createdAt: now,
    publishedAt: now,
    steps: [
      { id: "employee-submission", type: "employee_submission", label: "Employee submission", responsibleRole: "Employee", allowDecline: false },
      { id: "line-manager-review", type: "role_review", label: "Line Manager review", responsibleRole: "Line Manager", allowDecline: true },
      { id: "apprenticeship-lead-approval", type: "role_approval", label: "Apprenticeship Lead approval", responsibleRole: "Apprenticeship Lead", allowDecline: true },
      { id: "provider-handoff", type: "provider_handoff", label: "Ready for provider", responsibleRole: "Provider Partner", allowDecline: false },
    ],
  };
}

export function validateApplicationWorkflowSteps(steps: ApplicationWorkflowStep[]) {
  const errors: string[] = [];
  if (steps.length < 3 || steps.length > 8) errors.push("A workflow must contain between 3 and 8 steps.");
  if (steps[0]?.type !== "employee_submission" || steps[0]?.responsibleRole !== "Employee") errors.push("Employee submission must be the first step.");
  const last = steps.at(-1);
  if (last?.type !== "provider_handoff" || last.responsibleRole !== "Provider Partner") errors.push("Provider handoff must be the last step.");
  if (!steps.slice(1, -1).some((step) => step.type === "role_review" || step.type === "role_approval")) errors.push("At least one employer decision step is required.");
  const ids = new Set<string>();
  for (const step of steps) {
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(step.id)) errors.push(`Step id ${step.id || "(empty)"} is invalid.`);
    if (ids.has(step.id)) errors.push(`Step id ${step.id} is duplicated.`);
    ids.add(step.id);
    if (!safeLabel.test(step.label)) errors.push(`Step label for ${step.id || "(empty)"} is invalid.`);
    if (["role_review", "role_approval"].includes(step.type) && !applicationWorkflowRoles.includes(step.responsibleRole as ApplicationWorkflowRole)) errors.push(`${step.label} has an unsupported responsible role.`);
    if (step.type === "employee_submission" && step.responsibleRole !== "Employee") errors.push("Employee submission must be owned by Employee.");
    if (step.type === "provider_handoff" && step.responsibleRole !== "Provider Partner") errors.push("Provider handoff must be owned by Provider Partner.");
    if (["employee_submission", "provider_handoff"].includes(step.type) && step.allowDecline) errors.push(`${step.label} cannot allow decline.`);
    if (step.type === "role_approval" && !step.allowDecline) errors.push(`${step.label} must allow decline.`);
  }
  return errors;
}

export function assertValidApplicationWorkflowSteps(steps: ApplicationWorkflowStep[]) {
  const errors = validateApplicationWorkflowSteps(steps);
  if (errors.length) throw new Error(errors.join(" "));
}

export function applicationWorkflowPreview(steps: ApplicationWorkflowStep[]) {
  assertValidApplicationWorkflowSteps(steps);
  return steps.map((step, index) => ({ order: index + 1, id: step.id, label: step.label, responsibleRole: step.responsibleRole }));
}
