import type { RequestStatus } from "@/lib/levytate/domain";
import type { MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";
import type { ApplicationWorkflowInstance, ApplicationWorkflowVersion } from "@/lib/levytate/application-workflows/domain";

export type ApplicationWorkflowContext = { instance: ApplicationWorkflowInstance; version: ApplicationWorkflowVersion; events?: import("@/lib/levytate/application-workflows/domain").ApplicationWorkflowEvent[] };

export type ApplicationWorkflowPreview = {
  version: ApplicationWorkflowVersion;
  appliesAtSubmission: true;
};

type WorkflowApplicabilityApplication = {
  status: RequestStatus;
  submittedAt: string;
  history: Array<{ status: RequestStatus; createdAt: string }>;
};

/**
 * An unpinned draft is intentionally routed through the workflow published at
 * submission time. A progressed application is grandfathered only when its
 * first non-draft history event demonstrably predates configurable workflows.
 * Missing or invalid evidence fails closed so a new application cannot use a
 * legacy status mutation to bypass a published workflow.
 */
export function applicationRequiresPublishedWorkflow(
  application: WorkflowApplicabilityApplication,
  firstPublishedAt: string,
) {
  if (application.status === "Draft") return true;
  const boundary = Date.parse(firstPublishedAt);
  if (!Number.isFinite(boundary)) return true;
  const firstProgression = application.history
    .filter((entry) => entry.status !== "Draft")
    .map((entry) => Date.parse(entry.createdAt))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  if (firstProgression !== undefined) return firstProgression >= boundary;
  const submittedAt = Date.parse(application.submittedAt);
  return !Number.isFinite(submittedAt) || submittedAt >= boundary;
}

export function deriveApplicationWorkflowCompatibility(application: { status: RequestStatus; currentOwner: MvpApplicationOwner; updatedAt: string; workflow?: ApplicationWorkflowContext }) {
  if (!application.workflow) return { status: application.status, currentOwner: application.currentOwner, currentStepLabel: application.status, currentResponsibleRole: application.currentOwner, lastProgressedAt: application.updatedAt, configurable: false };
  const { instance, version } = application.workflow;
  const step = version.steps.find((candidate) => candidate.id === instance.currentStepId);
  if (!step) throw new Error("Application references an unknown workflow step.");
  const currentOwner = instance.state === "needs_information" ? "Employee" : instance.state === "declined" ? "Completed" : step.responsibleRole as MvpApplicationOwner;
  const status: RequestStatus = instance.state === "needs_information" ? "More information requested" : instance.state === "declined" ? step.responsibleRole === "Line Manager" ? "Declined by Line Manager" : "Declined by Apprenticeship Lead" : instance.state === "ready_for_provider" ? "Approved for Enrolment" : step.responsibleRole === "Line Manager" ? "Awaiting Manager Review" : ["Apprenticeship Lead", "Employer Admin"].includes(step.responsibleRole) ? "Awaiting Final Approval" : application.status;
  return { status, currentOwner, currentStepLabel: step.label, currentResponsibleRole: currentOwner, lastProgressedAt: instance.lastProgressedAt, configurable: true };
}
