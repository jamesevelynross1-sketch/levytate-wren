import type { RequestStatus } from "@/lib/levytate/domain";
import type { ManagerSupportState } from "@/lib/levytate/mvp/manager-learner-detail";
import type { LearnerLifecycleStatus } from "@/lib/levytate/mvp/learner-lifecycle";
import {
  lifecycleStatusLabel,
  type LearnerProgressPosition,
} from "@/lib/levytate/mvp/learner-record-view";

export type EmployeeOperationalStatusSource = "learner_lifecycle" | "application" | "development";

export type EmployeeOperationalSummary = {
  employeeId: string;
  primaryStatus: string;
  primaryStatusSource: EmployeeOperationalStatusSource;
  programme: string;
  progressPosition: LearnerProgressPosition;
  managerSupportSummary: string;
  managerSupportState: ManagerSupportState;
  applicationOutcome: string;
  nextAction: string;
  expectedEndDate: string;
  hasLearnerLifecycle: boolean;
};

export type EmployeeOperationalDisplaySummary = Omit<EmployeeOperationalSummary, "employeeId">;

export type EmployeeOperationalSummaryInput = {
  employeeId: string;
  learner?: {
    lifecycleStatus: LearnerLifecycleStatus;
    programme: string;
    progressPosition?: LearnerProgressPosition | null;
    managerSupportSummary?: string;
    managerSupportState?: ManagerSupportState;
    nextAction?: string;
    expectedEndDate?: string;
  } | null;
  application?: {
    status: RequestStatus;
    programme?: string;
    nextAction?: string;
  } | null;
  development?: {
    status: string;
    programme?: string;
    nextAction?: string;
  } | null;
};

export function deriveEmployeeOperationalSummary(input: EmployeeOperationalSummaryInput): EmployeeOperationalSummary {
  const applicationOutcome = input.application?.status ?? "No application recorded";

  if (input.learner) {
    return {
      employeeId: input.employeeId,
      primaryStatus: lifecycleStatusLabel(input.learner.lifecycleStatus),
      primaryStatusSource: "learner_lifecycle",
      programme: input.learner.programme || input.application?.programme || "Programme not recorded",
      progressPosition: input.learner.progressPosition ?? "No progress data",
      managerSupportSummary: input.learner.managerSupportSummary || "No immediate manager action",
      managerSupportState: input.learner.managerSupportState ?? "no_action",
      applicationOutcome,
      nextAction: input.learner.nextAction || "Continue supporting the learner through the current programme stage.",
      expectedEndDate: input.learner.expectedEndDate ?? "",
      hasLearnerLifecycle: true,
    };
  }

  if (input.application) {
    return {
      employeeId: input.employeeId,
      primaryStatus: input.application.status,
      primaryStatusSource: "application",
      programme: input.application.programme || input.development?.programme || "Programme not confirmed",
      progressPosition: "No progress data",
      managerSupportSummary: input.application.nextAction || "Follow the current application workflow.",
      managerSupportState: ["Submitted to Line Manager", "Awaiting Manager Review"].includes(input.application.status)
        ? "application_decision"
        : "no_action",
      applicationOutcome,
      nextAction: input.application.nextAction || "Follow the current application workflow.",
      expectedEndDate: "",
      hasLearnerLifecycle: false,
    };
  }

  return {
    employeeId: input.employeeId,
    primaryStatus: input.development?.status || "No active apprenticeship journey",
    primaryStatusSource: "development",
    programme: input.development?.programme || "Programme not confirmed",
    progressPosition: "No progress data",
    managerSupportSummary: input.development?.nextAction || "Discuss development goals at the next one-to-one.",
    managerSupportState: "no_action",
    applicationOutcome,
    nextAction: input.development?.nextAction || "Discuss development goals at the next one-to-one.",
    expectedEndDate: "",
    hasLearnerLifecycle: false,
  };
}

export function toEmployeeOperationalDisplaySummary(summary: EmployeeOperationalSummary): EmployeeOperationalDisplaySummary {
  const display = { ...summary } as Partial<EmployeeOperationalSummary>;
  delete display.employeeId;
  return display as EmployeeOperationalDisplaySummary;
}
