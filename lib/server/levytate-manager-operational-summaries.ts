import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  deriveEmployeeOperationalSummary,
  type EmployeeOperationalSummary,
} from "@/lib/levytate/mvp/employee-operational-summary";
import { activeApplicationStatuses, type MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";
import { listManagerDirectReportLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";
import { deriveManagerOperationalContext } from "@/lib/server/levytate-manager-learner-detail";
import {
  getManagerDirectReportContext,
  listManagerDirectReportApplications,
  type ManagerDirectReportApplication,
} from "@/lib/server/levytate-manager-scope";

export async function listManagerDirectReportOperationalSummaries(
  session: LevyTateBetaSession,
  workspace: MvpWorkspaceData,
): Promise<EmployeeOperationalSummary[]> {
  const scope = await getManagerDirectReportContext(session);
  const [applications, lifecycleDetails] = await Promise.all([
    listManagerDirectReportApplications(session, scope),
    listManagerDirectReportLearnerLifecycleDetails(session, scope),
  ]);

  return scope.directReports.map((employee) => {
    const application = currentApplication(applications.filter((item) => item.employee.id === employee.id));
    const learner = lifecycleDetails.find((item) => item.learner.id === employee.id) ?? null;
    const profile = workspace.employeeDevelopmentProfiles.find((item) => item.employeeId === employee.id) ?? null;
    const { managerSupport } = deriveManagerOperationalContext(application, learner);
    const applicationProgramme = application
      ? getApprenticeshipStandard(application.apprenticeshipStandardId)?.title ?? application.apprenticeshipStandardId
      : "";
    const developmentProgramme = profile?.recommendationResult?.topRecommendation?.title ?? "";

    return deriveEmployeeOperationalSummary({
      employeeId: employee.id,
      learner: learner ? {
        lifecycleStatus: learner.lifecycleStatus,
        programme: learner.programme.programmeName,
        progressPosition: learner.progressPosition,
        managerSupportSummary: managerSupport.title,
        managerSupportState: managerSupport.state,
        nextAction: managerSupport.nextAction,
        expectedEndDate: learner.expectedEndDate,
      } : null,
      application: application ? {
        status: application.status,
        programme: applicationProgramme,
        nextAction: managerSupport.nextAction,
      } : null,
      development: {
        status: profile
          ? profile.stage === "recommendation_ready" ? "Recommendation ready" : "Discovery in progress"
          : "Needs discovery",
        programme: developmentProgramme,
        nextAction: profile
          ? "Continue the employee's development conversation."
          : "Discuss development goals at the next one-to-one.",
      },
    });
  });
}

function currentApplication(applications: ManagerDirectReportApplication[]) {
  return applications.find((application) => activeApplicationStatuses().includes(application.status)) ?? applications[0] ?? null;
}
