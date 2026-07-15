import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  assessmentStatusLabel,
  deriveManagerSupportSummary,
  isManagerRelevantOperationalAction,
  progressSourceLabel,
  type ManagerDirectReportLearnerDetail,
  type ManagerSafeReview,
} from "@/lib/levytate/mvp/manager-learner-detail";
import {
  learnerBreakStatusLabels,
  learnerReviewStatusLabels,
  learnerReviewTypeLabels,
  type LearnerLifecycleEventType,
  type LearnerReview,
} from "@/lib/levytate/mvp/learner-lifecycle";
import {
  employmentRouteLabel,
  formatProgressVariance,
  lifecycleStatusLabel,
  type LearnerRecordDetail,
} from "@/lib/levytate/mvp/learner-record-view";
import { buildOrganisationOperationalItems } from "@/lib/levytate/mvp/operations-centre";
import {
  assessmentConfirmationStatusLabels,
  assessmentModelLabels,
} from "@/lib/levytate/mvp/assessment-readiness";
import { activeApplicationStatuses } from "@/lib/levytate/mvp/workspace";
import {
  getManagerDirectReportContext,
  listManagerDirectReportApplications,
  type ManagerDirectReportApplication,
  type ManagerDirectReportContext,
} from "@/lib/server/levytate-manager-scope";
import { listManagerDirectReportLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

type ProviderProgrammeManagerRow = {
  id: string;
  duration: string;
  delivery_models: unknown;
};

export class LevyTateManagerDirectReportAccessError extends Error {
  constructor() {
    super("This employee record could not be opened.");
    this.name = "LevyTateManagerDirectReportAccessError";
  }
}

export async function getManagerDirectReportLearnerDetail(
  session: LevyTateBetaSession,
  employeeId: string,
): Promise<ManagerDirectReportLearnerDetail> {
  const scope = await getManagerDirectReportContext(session);
  const employee = scope.directReports.find((candidate) => candidate.id === employeeId);
  if (!employee) throw new LevyTateManagerDirectReportAccessError();

  const [applications, lifecycleDetails] = await Promise.all([
    listManagerDirectReportApplications(session, scope),
    listManagerDirectReportLearnerLifecycleDetails(session, scope),
  ]);
  const employeeApplications = applications.filter((application) => application.employee.id === employee.id);
  const application = currentApplication(employeeApplications);
  const learner = lifecycleDetails.find((detail) => detail.learner.id === employee.id) ?? null;
  const programmeMetadata = learner ? await loadProgrammeMetadata(scope, learner) : null;
  const operationalItems = learner
    ? buildOrganisationOperationalItems([learner]).items
      .filter(isManagerRelevantOperationalAction)
      .filter((item) => !item.persistentActionStatus || !["completed", "dismissed", "cancelled"].includes(item.persistentActionStatus))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.sourceKey === item.sourceKey) === index)
    : [];

  const progress = learner?.latestProgress ? {
    position: learner.progressPosition,
    target: learner.latestProgress.targetProgressPercentage,
    actual: learner.latestProgress.actualProgressPercentage,
    variance: learner.latestProgress.variancePercentage,
    varianceLabel: formatProgressVariance(learner.latestProgress.variancePercentage),
    updatedAt: learner.latestProgress.updateDate,
    source: progressSourceLabel(learner.latestProgress.progressSource),
    summary: learner.latestProgress.summary,
    supportAction: learner.latestProgress.supportAction,
    history: learner.progressHistory.map((item) => ({
      date: item.updateDate,
      target: item.targetProgressPercentage,
      actual: item.actualProgressPercentage,
      variance: item.variancePercentage,
      varianceLabel: formatProgressVariance(item.variancePercentage),
      position: item.variancePercentage >= 3 ? "Ahead of target" as const
        : item.variancePercentage <= -8 ? "Significantly behind" as const
          : item.variancePercentage <= -3 ? "Slightly behind" as const
            : "On target" as const,
    })),
  } : null;
  const reviews = learner?.reviewHistory.filter((review) => review.reviewType !== "other") ?? [];
  const activeBreak = learner?.activeBreak ?? null;
  const latestBreak = activeBreak ?? learner?.latestBreak ?? null;
  const assessment = learner?.assessmentReadiness ?? null;

  const managerSupport = deriveManagerSupportSummary({
    application: application ? {
      status: application.status,
      submittedAt: application.submittedAt,
      informationWasRequested: application.history.some((entry) => entry.status === "More information requested"),
    } : null,
    lifecycleStatus: learner?.lifecycleStatus ?? null,
    progress: progress ? { position: progress.position, updatedAt: progress.updatedAt, supportAction: progress.supportAction } : null,
    managerReview: {
      overdue: learner?.reviewSummaries.manager.overdue ?? false,
      nextDate: learner?.reviewSummaries.manager.nextDate ?? "",
      status: learner?.reviewSummaries.manager.latest?.status ?? null,
    },
    activeBreak: activeBreak ? {
      expectedReturnDate: activeBreak.expectedReturnDate,
      managerReturnConfirmed: activeBreak.managerReturnConfirmed,
    } : null,
    assessment: assessment ? {
      expectedReadinessDate: assessment.expectedAssessmentReadinessDate,
      managerConfirmationStatus: assessment.confirmations.line_manager.status,
    } : null,
    actions: operationalItems,
  });

  return {
    employee: {
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
      team: employee.department,
      site: employee.site,
      managerName: scope.manager.name,
    },
    application: application ? {
      status: application.status,
      currentOwner: application.currentOwner,
      submittedAt: application.submittedAt,
      stageEnteredAt: applicationStageDate(application),
      programmeTitle: getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId,
      canReview: ["Submitted to Line Manager", "Awaiting Manager Review"].includes(application.status),
    } : null,
    journey: buildJourney(application, learner),
    programme: learner ? {
      programmeName: learner.programme.programmeName,
      providerName: learner.programme.providerName,
      standardTitle: learner.programme.apprenticeshipStandardTitle,
      standardReference: learner.programme.apprenticeshipStandardReference,
      expectedDuration: programmeMetadata?.duration || getApprenticeshipStandard(learner.programme.apprenticeshipStandardId)?.typicalDuration || "Not recorded",
      deliveryInformation: stringArray(programmeMetadata?.delivery_models),
      assessmentModel: assessment ? assessmentModelLabels[assessment.assessmentModel] : "Not yet confirmed",
      fundingSummary: "Funding eligibility is confirmed by the Apprenticeship Lead against the linked apprenticeship standard.",
    } : application ? {
      programmeName: getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId,
      providerName: "Not yet confirmed",
      standardTitle: getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId,
      standardReference: getApprenticeshipStandard(application.apprenticeshipStandardId)?.referenceCode ?? "Not recorded",
      expectedDuration: getApprenticeshipStandard(application.apprenticeshipStandardId)?.typicalDuration ?? "Not recorded",
      deliveryInformation: [],
      assessmentModel: "Not yet confirmed",
      fundingSummary: "Funding eligibility is confirmed by the Apprenticeship Lead against the linked apprenticeship standard.",
    } : null,
    progress,
    reviews: {
      latest: {
        provider: safeReview(learner?.reviewSummaries.provider.latest ?? null),
        lAndD: safeReview(learner?.reviewSummaries.lAndD.latest ?? null),
        manager: safeReview(learner?.reviewSummaries.manager.latest ?? null),
      },
      history: reviews.map(safeReview).filter((review): review is ManagerSafeReview => Boolean(review)),
    },
    breakInLearning: latestBreak ? {
      status: learnerBreakStatusLabels[latestBreak.status],
      startDate: latestBreak.startDate,
      expectedReturnDate: latestBreak.expectedReturnDate,
      actualReturnDate: latestBreak.actualReturnDate,
      durationDays: dateDifferenceDays(latestBreak.startDate, latestBreak.actualReturnDate || today()),
      managerNotified: latestBreak.managerNotified,
      managerReturnConfirmation: latestBreak.managerReturnConfirmed,
      returnPlanSummary: latestBreak.returnPlanNotes || "Return plan has not yet been recorded.",
      nextStep: latestBreak.managerReturnConfirmed
        ? "Continue coordinating the return with the learner and Apprenticeship Lead."
        : "Confirm the return plan with the Apprenticeship Lead.",
    } : null,
    assessment: assessment ? {
      model: assessmentModelLabels[assessment.assessmentModel],
      status: assessmentStatusLabel(assessment.assessmentStatus),
      expectedReadinessDate: assessment.expectedAssessmentReadinessDate,
      gatewayDate: assessment.gatewayDate,
      organisation: assessment.assessmentOrganisation || "Not yet confirmed",
      managerConfirmationStatus: assessmentConfirmationStatusLabels[assessment.confirmations.line_manager.status],
      outstandingManagerCheck: assessment.confirmations.line_manager.status === "confirmed"
        ? "Manager workplace readiness is confirmed."
        : "Confirm that suitable workplace evidence and manager support are in place.",
      expectedStartDate: assessment.expectedAssessmentStartDate,
    } : null,
    managerSupport,
    actions: operationalItems.map((item) => ({
      title: item.actionLabel,
      priority: item.priorityLevel,
      status: item.persistentActionStatus ? humanise(item.persistentActionStatus) : "Open",
      owner: item.ownerType,
      dueDate: item.dueDate,
      reason: item.reason,
    })),
    timeline: buildSafeTimeline(application, learner),
  };
}

function currentApplication(applications: ManagerDirectReportApplication[]) {
  return applications.find((application) => activeApplicationStatuses().includes(application.status)) ?? applications[0] ?? null;
}

async function loadProgrammeMetadata(scope: ManagerDirectReportContext, detail: LearnerRecordDetail) {
  const config = getLevyTateSupabaseConfig();
  if (!config || !detail.programme.programmeId) return null;
  const rows = await supabaseSelect<ProviderProgrammeManagerRow>(config, "levytate_provider_programmes", new URLSearchParams({
    select: "id,duration,delivery_models",
    organisation_id: `eq.${scope.organisation.id}`,
    id: `eq.${detail.programme.programmeId}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

function buildJourney(application: ManagerDirectReportApplication | null, learner: LearnerRecordDetail | null): ManagerDirectReportLearnerDetail["journey"] {
  if (learner) {
    return {
      hasActivity: true,
      stage: lifecycleStatusLabel(learner.lifecycleStatus),
      stageEnteredAt: lifecycleStageDate(learner),
      currentOwner: lifecycleOwner(learner.lifecycleStatus),
      nextExpectedStep: lifecycleNextStep(learner.lifecycleStatus),
      managerResponsibility: lifecycleManagerResponsibility(learner.lifecycleStatus),
      lifecycleStatus: learner.lifecycleStatus,
      lifecycleStatusLabel: lifecycleStatusLabel(learner.lifecycleStatus),
      employmentRoute: employmentRouteLabel(learner.employmentRoute),
      actualStartDate: learner.actualStartDate,
      expectedEndDate: learner.expectedEndDate,
    };
  }
  if (application) {
    return {
      hasActivity: true,
      stage: applicationStageLabel(application.status),
      stageEnteredAt: applicationStageDate(application),
      currentOwner: application.currentOwner,
      nextExpectedStep: applicationNextStep(application.status),
      managerResponsibility: applicationManagerResponsibility(application.status),
      lifecycleStatus: null,
      lifecycleStatusLabel: "Not started",
      employmentRoute: "Not yet confirmed",
      actualStartDate: "",
      expectedEndDate: "",
    };
  }
  return {
    hasActivity: false,
    stage: "No active apprenticeship journey",
    stageEnteredAt: "",
    currentOwner: "No current owner",
    nextExpectedStep: "Discuss development goals and suitable progression options at the next one-to-one.",
    managerResponsibility: "Support a focused development conversation when the employee is ready.",
    lifecycleStatus: null,
    lifecycleStatusLabel: "Not started",
    employmentRoute: "Not yet confirmed",
    actualStartDate: "",
    expectedEndDate: "",
  };
}

function safeReview(review: LearnerReview | null): ManagerSafeReview | null {
  if (!review || review.reviewType === "other") return null;
  return {
    type: review.reviewType,
    typeLabel: learnerReviewTypeLabels[review.reviewType],
    date: review.reviewDate,
    nextDate: review.nextReviewDate,
    status: review.status,
    statusLabel: learnerReviewStatusLabels[review.status],
    summary: review.summary,
    agreedActions: review.actions.filter(Boolean),
    supportRequired: review.supportRequired,
  };
}

function buildSafeTimeline(application: ManagerDirectReportApplication | null, learner: LearnerRecordDetail | null) {
  const applicationEvents = application ? application.history.map((entry) => ({
    date: entry.createdAt,
    event: applicationStageLabel(entry.status),
    summary: applicationTimelineSummary(entry.status),
  })) : [];
  const lifecycleEvents = learner ? learner.lifecycleTimeline.flatMap((entry) => {
    const label = safeLifecycleEventLabel(entry.eventType, entry.newStatus);
    return label ? [{ date: entry.eventDate, event: label, summary: safeLifecycleEventSummary(entry.eventType, entry.newStatus) }] : [];
  }) : [];
  return [...applicationEvents, ...lifecycleEvents]
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.date === entry.date && candidate.event === entry.event) === index)
    .slice(0, 20);
}

function safeLifecycleEventLabel(eventType: LearnerLifecycleEventType, newStatus: string) {
  const labels: Partial<Record<LearnerLifecycleEventType, string>> = {
    learner_record_created: "Learner record created",
    enrolled: "Learner enrolled",
    enrolment_completed: "Enrolment completed",
    progress_updated: "Progress updated",
    provider_review_recorded: "Provider review recorded",
    l_and_d_check_in_recorded: "L&D check-in recorded",
    manager_check_in_recorded: "Manager check-in recorded",
    break_started: "Break in learning started",
    returned_from_break: "Returned from break in learning",
    moved_to_assessment_preparation: "Assessment preparation started",
    assessment_readiness_updated: "Assessment readiness updated",
    assessment_readiness_confirmed: "Assessment readiness confirmed",
    learner_entered_assessment: "Learner entered assessment",
    achievement_recorded: "Achievement recorded",
    withdrawn: "Learner withdrawn",
  };
  if (eventType === "lifecycle_status_changed" && newStatus) return humanise(newStatus);
  return labels[eventType] ?? "";
}

function safeLifecycleEventSummary(eventType: LearnerLifecycleEventType, newStatus: string) {
  const label = safeLifecycleEventLabel(eventType, newStatus);
  return label ? `${label}.` : "";
}

function applicationStageLabel(status: string) {
  if (status === "Draft") return "Draft application";
  if (["Submitted to Line Manager", "Awaiting Manager Review"].includes(status)) return "Awaiting manager review";
  if (status === "More information requested") return "More information requested";
  if (status === "Approved by Line Manager") return "Manager approved";
  if (["Submitted to Apprenticeship Lead", "Awaiting Final Approval"].includes(status)) return "Apprenticeship Lead review";
  if (status === "Approved for Enrolment") return "Pre-enrolment";
  return status;
}

function applicationNextStep(status: string) {
  if (status === "Draft") return "Employee completes and submits the application.";
  if (["Submitted to Line Manager", "Awaiting Manager Review"].includes(status)) return "Line Manager reviews the application.";
  if (status === "More information requested") return "Employee provides the requested information.";
  if (["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval"].includes(status)) return "Apprenticeship Lead completes final review.";
  if (status === "Approved for Enrolment") return "Apprenticeship Lead coordinates provider and enrolment readiness.";
  return "Review the recorded outcome with the employee where appropriate.";
}

function applicationManagerResponsibility(status: string) {
  if (["Submitted to Line Manager", "Awaiting Manager Review"].includes(status)) return "Review the application and record a fair decision.";
  if (status === "More information requested") return "Wait for the employee's response, then review the updated application.";
  return "Continue supporting the employee while the current owner completes the next step.";
}

function applicationTimelineSummary(status: string) {
  if (["Submitted to Line Manager", "Awaiting Manager Review"].includes(status)) return "The application is ready for Line Manager review.";
  if (status === "Approved by Line Manager") return "The Line Manager approved the application for final review.";
  if (status === "More information requested") return "The employee was asked to provide more information.";
  if (status === "Approved for Enrolment") return "The application was approved for enrolment preparation.";
  return `${applicationStageLabel(status)} recorded.`;
}

function applicationStageDate(application: ManagerDirectReportApplication) {
  return [...application.history].reverse().find((entry) => entry.status === application.status)?.createdAt ?? application.updatedAt;
}

function lifecycleStageDate(detail: LearnerRecordDetail) {
  return detail.lifecycleTimeline.find((entry) => entry.newStatus === detail.lifecycleStatus)?.eventDate ?? detail.updatedAt;
}

function lifecycleOwner(status: LearnerRecordDetail["lifecycleStatus"]) {
  if (status === "enrolled") return "Learner, Line Manager and approved delivery partner";
  if (status === "break_in_learning") return "Apprenticeship Lead";
  if (status === "assessment_preparation" || status === "in_assessment") return "Learner, Line Manager and Apprenticeship Lead";
  if (status === "pre_enrolment") return "Apprenticeship Lead";
  return "Apprenticeship Lead";
}

function lifecycleNextStep(status: LearnerRecordDetail["lifecycleStatus"]) {
  if (status === "pre_enrolment") return "Complete the remaining enrolment-readiness steps.";
  if (status === "enrolled") return "Continue planned learning, workplace evidence and scheduled reviews.";
  if (status === "break_in_learning") return "Confirm the return plan and workplace readiness to resume learning.";
  if (status === "assessment_preparation") return "Complete readiness checks and prepare for gateway or assessment.";
  if (status === "in_assessment") return "Complete assessment activity and await the outcome.";
  if (status === "achieved") return "Plan progression and workplace application of the new capability.";
  if (status === "withdrawn") return "Review future development options when appropriate.";
  return "Review the recorded outcome and agree any next development step.";
}

function lifecycleManagerResponsibility(status: LearnerRecordDetail["lifecycleStatus"]) {
  if (status === "enrolled") return "Provide protected learning time, workplace opportunities and timely check-ins.";
  if (status === "break_in_learning") return "Support the agreed return plan with the Apprenticeship Lead.";
  if (status === "assessment_preparation" || status === "in_assessment") return "Confirm workplace evidence and practical support for assessment.";
  if (status === "pre_enrolment") return "Confirm the employee has appropriate workplace support for the planned start.";
  return "Support a constructive progression conversation where appropriate.";
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function dateDifferenceDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(`${end.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${start.slice(0, 10)}T12:00:00Z`).getTime()) / 86_400_000));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function humanise(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}
