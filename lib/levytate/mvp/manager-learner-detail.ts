import type { RequestStatus } from "@/lib/levytate/domain";
import type {
  LearnerAssessmentStatus,
  LearnerLifecycleStatus,
  LearnerProgressSource,
  LearnerReviewStatus,
  LearnerReviewType,
} from "@/lib/levytate/mvp/learner-lifecycle";
import type { LearnerProgressPosition } from "@/lib/levytate/mvp/learner-record-view";
import type { OperationalItem } from "@/lib/levytate/mvp/operations-centre";

export type ManagerSupportState =
  | "application_decision"
  | "employee_information_received"
  | "manager_check_in"
  | "workplace_opportunity"
  | "progress_support"
  | "break_return"
  | "assessment_readiness"
  | "no_action";

export type ManagerSupportSummary = {
  state: ManagerSupportState;
  title: string;
  whyItMatters: string;
  nextAction: string;
  relevantDate: string;
  destination: string;
  destinationLabel: string;
};

export type ManagerDirectReportLearnerDetail = {
  employee: {
    name: string;
    jobTitle: string;
    department: string;
    team: string;
    site: string;
    managerName: string;
  };
  application: {
    status: RequestStatus;
    currentOwner: string;
    submittedAt: string;
    stageEnteredAt: string;
    programmeTitle: string;
    canReview: boolean;
  } | null;
  journey: {
    hasActivity: boolean;
    stage: string;
    stageEnteredAt: string;
    currentOwner: string;
    nextExpectedStep: string;
    managerResponsibility: string;
    lifecycleStatus: LearnerLifecycleStatus | null;
    lifecycleStatusLabel: string;
    employmentRoute: string;
    actualStartDate: string;
    expectedEndDate: string;
  };
  programme: {
    programmeName: string;
    providerName: string;
    standardTitle: string;
    standardReference: string;
    expectedDuration: string;
    deliveryInformation: string[];
    assessmentModel: string;
    fundingSummary: string;
  } | null;
  progress: {
    position: LearnerProgressPosition;
    target: number;
    actual: number;
    variance: number;
    varianceLabel: string;
    updatedAt: string;
    source: string;
    summary: string;
    supportAction: string;
    history: Array<{
      date: string;
      target: number;
      actual: number;
      variance: number;
      varianceLabel: string;
      position: LearnerProgressPosition;
    }>;
  } | null;
  reviews: {
    latest: {
      provider: ManagerSafeReview | null;
      lAndD: ManagerSafeReview | null;
      manager: ManagerSafeReview | null;
    };
    history: ManagerSafeReview[];
  };
  breakInLearning: {
    status: string;
    startDate: string;
    expectedReturnDate: string;
    actualReturnDate: string;
    durationDays: number;
    managerNotified: boolean;
    managerReturnConfirmation: boolean;
    returnPlanSummary: string;
    nextStep: string;
  } | null;
  assessment: {
    model: string;
    status: string;
    expectedReadinessDate: string;
    gatewayDate: string;
    organisation: string;
    managerConfirmationStatus: string;
    outstandingManagerCheck: string;
    expectedStartDate: string;
  } | null;
  managerSupport: ManagerSupportSummary;
  actions: Array<{
    title: string;
    priority: string;
    status: string;
    owner: string;
    dueDate: string;
    reason: string;
  }>;
  timeline: Array<{
    date: string;
    event: string;
    summary: string;
  }>;
};

export type ManagerSafeReview = {
  type: LearnerReviewType;
  typeLabel: string;
  date: string;
  nextDate: string;
  status: LearnerReviewStatus;
  statusLabel: string;
  summary: string;
  agreedActions: string[];
  supportRequired: string;
};

export type ManagerSupportInput = {
  application: {
    status: RequestStatus;
    submittedAt: string;
    informationWasRequested: boolean;
  } | null;
  lifecycleStatus: LearnerLifecycleStatus | null;
  progress: {
    position: LearnerProgressPosition;
    updatedAt: string;
    supportAction: string;
  } | null;
  managerReview: {
    overdue: boolean;
    nextDate: string;
    status: LearnerReviewStatus | null;
  };
  activeBreak: {
    expectedReturnDate: string;
    managerReturnConfirmed: boolean;
  } | null;
  assessment: {
    expectedReadinessDate: string;
    managerConfirmationStatus: string;
  } | null;
  actions: OperationalItem[];
};

export function deriveManagerSupportSummary(input: ManagerSupportInput): ManagerSupportSummary {
  if (input.application && ["Submitted to Line Manager", "Awaiting Manager Review"].includes(input.application.status)) {
    const informationReceived = input.application.informationWasRequested;
    return {
      state: informationReceived ? "employee_information_received" : "application_decision",
      title: informationReceived ? "Further employee information received" : "Application decision required",
      whyItMatters: informationReceived
        ? "The employee has returned their application after your request for more information."
        : "This application cannot move to final review until you record a fair manager decision.",
      nextAction: "Review the application and approve, request more information or decline.",
      relevantDate: input.application.submittedAt,
      destination: "/levytate/app?module=Approvals",
      destinationLabel: "Review application",
    };
  }

  if (input.activeBreak && !input.activeBreak.managerReturnConfirmed) {
    return {
      state: "break_return",
      title: "Break return plan requires manager confirmation",
      whyItMatters: "The return plan needs workplace confirmation before learning can restart smoothly.",
      nextAction: "Confirm the expected return plan with the Apprenticeship Lead.",
      relevantDate: input.activeBreak.expectedReturnDate,
      destination: "",
      destinationLabel: "",
    };
  }

  if (input.assessment && input.assessment.managerConfirmationStatus !== "confirmed") {
    return {
      state: "assessment_readiness",
      title: "Assessment readiness confirmation required",
      whyItMatters: "Manager confirmation helps demonstrate that the learner has suitable workplace evidence and support.",
      nextAction: "Review workplace readiness with the learner and Apprenticeship Lead.",
      relevantDate: input.assessment.expectedReadinessDate,
      destination: "",
      destinationLabel: "",
    };
  }

  if (input.managerReview.overdue || input.managerReview.status === "action_required") {
    return {
      state: "manager_check_in",
      title: "Manager check-in recommended",
      whyItMatters: "A current check-in keeps workplace support aligned with programme progress.",
      nextAction: "Discuss progress and workplace support with the learner.",
      relevantDate: input.managerReview.nextDate,
      destination: "",
      destinationLabel: "",
    };
  }

  const workplaceAction = input.actions.find((action) => action.sourceCondition === "support_intervention" || /workplace opportunity/i.test(action.reason));
  if (workplaceAction || /workplace opportunity/i.test(input.progress?.supportAction ?? "")) {
    return {
      state: "workplace_opportunity",
      title: "Workplace opportunity required",
      whyItMatters: "The learner needs relevant workplace evidence to convert learning into demonstrated capability.",
      nextAction: "Agree a suitable project or workplace opportunity with the learner.",
      relevantDate: workplaceAction?.dueDate ?? input.progress?.updatedAt ?? "",
      destination: "",
      destinationLabel: "",
    };
  }

  if (input.progress && ["Slightly behind", "Significantly behind"].includes(input.progress.position)) {
    return {
      state: "progress_support",
      title: "Progress support required",
      whyItMatters: "Current progress is behind the planned position and may need a practical workplace intervention.",
      nextAction: "Discuss the recovery plan, protected learning time and evidence opportunities with the learner.",
      relevantDate: input.progress.updatedAt,
      destination: "",
      destinationLabel: "",
    };
  }

  return {
    state: "no_action",
    title: "No immediate manager action required",
    whyItMatters: input.lifecycleStatus ? "The learner's current records do not show a manager-owned exception." : "No active apprenticeship journey is currently recorded.",
    nextAction: input.lifecycleStatus ? "Continue normal workplace support and review the next scheduled check-in." : "Use the next development conversation to discuss suitable progression options.",
    relevantDate: input.managerReview.nextDate,
    destination: "",
    destinationLabel: "",
  };
}

export function isManagerRelevantOperationalAction(item: OperationalItem) {
  return item.ownerType === "Line Manager"
    || item.sourceCondition.includes("manager_check_in")
    || item.sourceCondition.includes("line_manager")
    || item.sourceCondition === "support_intervention";
}

export function progressSourceLabel(source: LearnerProgressSource) {
  return source === "provider_report" ? "Provider report"
    : source === "provider_review" ? "Provider review"
      : source === "manual_l_and_d_update" ? "L&D update"
        : source === "integration" ? "System integration"
          : "Other";
}

export function assessmentStatusLabel(status: LearnerAssessmentStatus) {
  return status.replace(/_/g, " ").replace(/^./, (value) => value.toUpperCase());
}
