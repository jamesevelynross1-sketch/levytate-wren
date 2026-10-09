import type { RequestStatus } from "@/lib/levytate/domain";
import type { MvpApplicationOwner } from "@/lib/levytate/mvp/workspace";
import type { ApplicationWorkflowInstance, ApplicationWorkflowVersion } from "@/lib/levytate/application-workflows/domain";

export type ApplicationWorkflowContext = { instance: ApplicationWorkflowInstance; version: ApplicationWorkflowVersion; events?: import("@/lib/levytate/application-workflows/domain").ApplicationWorkflowEvent[] };

export function deriveApplicationWorkflowCompatibility(application: { status: RequestStatus; currentOwner: MvpApplicationOwner; updatedAt: string; workflow?: ApplicationWorkflowContext }) {
  if (!application.workflow) return { status: application.status, currentOwner: application.currentOwner, currentStepLabel: application.status, currentResponsibleRole: application.currentOwner, lastProgressedAt: application.updatedAt, configurable: false };
  const { instance, version } = application.workflow;
  const step = version.steps.find((candidate) => candidate.id === instance.currentStepId);
  if (!step) throw new Error("Application references an unknown workflow step.");
  const currentOwner = instance.state === "needs_information" ? "Employee" : instance.state === "declined" ? "Completed" : step.responsibleRole as MvpApplicationOwner;
  const status: RequestStatus = instance.state === "needs_information" ? "More information requested" : instance.state === "declined" ? step.responsibleRole === "Line Manager" ? "Declined by Line Manager" : "Declined by Apprenticeship Lead" : instance.state === "ready_for_provider" ? "Approved for Enrolment" : step.responsibleRole === "Line Manager" ? "Awaiting Manager Review" : ["Apprenticeship Lead", "Employer Admin"].includes(step.responsibleRole) ? "Awaiting Final Approval" : application.status;
  return { status, currentOwner, currentStepLabel: step.label, currentResponsibleRole: currentOwner, lastProgressedAt: instance.lastProgressedAt, configurable: true };
}
