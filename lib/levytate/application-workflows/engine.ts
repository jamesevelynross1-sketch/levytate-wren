import {
  assertValidApplicationWorkflowSteps,
  type ApplicationWorkflowAction,
  type ApplicationWorkflowActor,
  type ApplicationWorkflowEvent,
  type ApplicationWorkflowInstance,
  type ApplicationWorkflowVersion,
} from "@/lib/levytate/application-workflows/domain";

export type WorkflowTransitionInput = {
  instance: ApplicationWorkflowInstance;
  workflow: ApplicationWorkflowVersion;
  actor: ApplicationWorkflowActor;
  action: ApplicationWorkflowAction;
  idempotencyKey: string;
  expectedLockVersion: number;
  previousEvents?: ApplicationWorkflowEvent[];
  note?: string;
  now?: string;
};

export function createApplicationWorkflowInstance(applicationId: string, workflow: ApplicationWorkflowVersion, now = new Date().toISOString()): ApplicationWorkflowInstance {
  assertValidApplicationWorkflowSteps(workflow.steps);
  return {
    id: `instance:${applicationId}`,
    organisationId: workflow.organisationId,
    applicationId,
    workflowVersionId: workflow.id,
    currentStepId: workflow.steps[0].id,
    state: "active",
    lockVersion: 0,
    lastProgressedAt: now,
  };
}

export function transitionApplicationWorkflow(input: WorkflowTransitionInput): { instance: ApplicationWorkflowInstance; event: ApplicationWorkflowEvent; replayed: boolean } {
  assertValidApplicationWorkflowSteps(input.workflow.steps);
  if (input.instance.workflowVersionId !== input.workflow.id || input.instance.organisationId !== input.workflow.organisationId) throw new Error("Workflow instance does not belong to this version.");
  const replay = input.previousEvents?.find((event) => event.idempotencyKey === input.idempotencyKey);
  if (replay) {
    if (replay.action !== input.action || replay.applicationId !== input.instance.applicationId) throw new Error("Idempotency key was already used for a different transition.");
    return { instance: input.instance, event: replay, replayed: true };
  }
  if (!input.idempotencyKey.trim()) throw new Error("An idempotency key is required.");
  if (input.expectedLockVersion !== input.instance.lockVersion) throw new Error("Workflow state changed; refresh before trying again.");
  if (["declined", "ready_for_provider"].includes(input.instance.state)) throw new Error("This application workflow is terminal.");

  const index = input.workflow.steps.findIndex((step) => step.id === input.instance.currentStepId);
  const step = input.workflow.steps[index];
  if (!step) throw new Error("Current workflow step is invalid.");
  let nextStepId = step.id;
  let nextState = input.instance.state;
  let returnStepId = input.instance.returnStepId;

  if (input.instance.state === "needs_information") {
    if (input.action !== "resubmit" || input.actor.role !== "Employee" || !returnStepId) throw new Error("Only the employee may resubmit requested information.");
    nextStepId = returnStepId;
    nextState = "active";
    returnStepId = undefined;
  } else if (input.action === "request_information") {
    authorise(step.responsibleRole, input.actor);
    if (!["role_review", "role_approval"].includes(step.type)) throw new Error("Information can only be requested during an employer decision step.");
    nextState = "needs_information";
    returnStepId = step.id;
  } else if (input.action === "decline") {
    authorise(step.responsibleRole, input.actor);
    if (!step.allowDecline) throw new Error("Decline is not allowed at this step.");
    nextState = "declined";
  } else {
    authorise(step.responsibleRole, input.actor);
    const expected = step.type === "employee_submission" ? "submit" : step.type === "role_approval" ? "approve" : step.type === "role_review" ? "continue" : null;
    if (!expected || input.action !== expected) throw new Error(`Action ${input.action} is not allowed at ${step.label}.`);
    const next = input.workflow.steps[index + 1];
    if (!next) throw new Error("A workflow transition cannot skip beyond provider handoff.");
    nextStepId = next.id;
    nextState = next.type === "provider_handoff" ? "ready_for_provider" : "active";
  }

  const now = input.now ?? new Date().toISOString();
  const instance = { ...input.instance, currentStepId: nextStepId, state: nextState, returnStepId, lockVersion: input.instance.lockVersion + 1, lastProgressedAt: now };
  const event: ApplicationWorkflowEvent = {
    id: `event:${input.instance.applicationId}:${input.instance.lockVersion + 1}`,
    organisationId: input.instance.organisationId,
    applicationId: input.instance.applicationId,
    workflowVersionId: input.instance.workflowVersionId,
    stepId: step.id,
    action: input.action,
    actorRole: input.actor.role,
    note: input.note?.trim() || undefined,
    idempotencyKey: input.idempotencyKey,
    fromLockVersion: input.instance.lockVersion,
    toLockVersion: instance.lockVersion,
    createdAt: now,
  };
  return { instance, event, replayed: false };
}

function authorise(responsibleRole: string, actor: ApplicationWorkflowActor) {
  if (responsibleRole === "Employee") {
    if (actor.role !== "Employee") throw new Error("Only the employee may act at this step.");
    return;
  }
  if (actor.role !== responsibleRole) throw new Error(`This step requires ${responsibleRole}.`);
  if (responsibleRole === "Line Manager" && actor.isDirectManager !== true) throw new Error("Only the employee's current direct manager may act at this step.");
}
