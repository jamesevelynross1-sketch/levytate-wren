import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import {
  activeApplicationStatuses,
  type MvpApplication,
  type MvpEmployee,
  type MvpProviderRelationshipCategory,
  type MvpWorkspaceData,
} from "@/lib/levytate/mvp/workspace";

export type WorkspaceNotification = {
  id: string;
  title: string;
  copy: string;
  module: "Home" | "Employees" | "Applications" | "Provider Relationships" | "Reports" | "Enrolments" | "Ask LevyTate AI";
  tone: "green" | "yellow" | "blue" | "red";
};

const relationshipCategories: MvpProviderRelationshipCategory[] = [
  "Digital",
  "Engineering",
  "Business Improvement",
  "Marketing",
  "Leadership",
  "Data",
  "Customer",
  "Procurement",
];

export function workspaceManagers(data: MvpWorkspaceData) {
  return data.employees.filter((employee) => employee.status === "Active" && employee.platformRole === "Line Manager");
}

export function activeEmployees(data: MvpWorkspaceData) {
  return data.employees.filter((employee) => employee.status === "Active");
}

export function activeApplications(data: MvpWorkspaceData) {
  const active = new Set(activeApplicationStatuses());
  return data.applications.filter((application) => active.has(application.status));
}

export function employeeCurrentApplication(data: MvpWorkspaceData, employeeId: string) {
  return activeApplications(data).find((application) => application.employeeId === employeeId) ?? null;
}

export function employeeRecommendedPathway(data: MvpWorkspaceData, employeeId: string) {
  return data.employeeDevelopmentProfiles.find((profile) => profile.employeeId === employeeId)?.recommendationResult?.topRecommendation ?? null;
}

export function employeeDevelopmentInterests(data: MvpWorkspaceData, employeeId: string) {
  const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employeeId);
  if (!profile) return [];
  return [...new Set([
    ...profile.aiOpportunities,
    ...profile.dataOpportunities,
    ...profile.automationOpportunities,
    ...profile.futureCapabilities,
  ])].slice(0, 6);
}

export function employerWorkspaceSummary(data: MvpWorkspaceData) {
  const managers = workspaceManagers(data).length;
  const applications = activeApplications(data);
  return {
    sites: data.profile.sites.length,
    departments: data.profile.departments.length,
    managers,
    employees: activeEmployees(data).length,
    applicationsAwaitingApproval: applications.filter((application) => application.currentOwner === "Line Manager" || application.currentOwner === "Apprenticeship Lead").length,
    providerPartners: data.providerRelationships.filter((relationship) => relationship.preferredProviderId).length,
  };
}

export function buildNotifications(data: MvpWorkspaceData): WorkspaceNotification[] {
  const notifications: WorkspaceNotification[] = [];
  const applications = activeApplications(data);
  const lineManagerQueue = applications.filter((application) => application.currentOwner === "Line Manager");
  const leadQueue = applications.filter((application) => application.currentOwner === "Apprenticeship Lead");
  if (lineManagerQueue.length) {
    notifications.push({
      id: "manager-queue",
      title: `${lineManagerQueue.length} applications awaiting manager review`,
      copy: "Managers need to decide whether these requests should progress into formal approval.",
      module: "Applications",
      tone: "yellow",
    });
  }
  if (leadQueue.length) {
    notifications.push({
      id: "lead-queue",
      title: `${leadQueue.length} applications awaiting apprenticeship lead review`,
      copy: "Final approval is required before provider allocation and enrolment can begin.",
      module: "Applications",
      tone: "yellow",
    });
  }

  const recommendationReady = data.employeeDevelopmentProfiles.filter((profile) => profile.stage === "recommendation_ready" && profile.recommendationResult?.topRecommendation).length;
  if (recommendationReady) {
    notifications.push({
      id: "recommendation-ready",
      title: `${recommendationReady} employee records have live pathway recommendations`,
      copy: "Use LevyTate Copilot or the employee record to turn those recommendations into applications.",
      module: "Employees",
      tone: "blue",
    });
  }

  const relationshipGaps = relationshipCategories.filter((category) => !data.providerRelationships.some((relationship) => relationship.category === category && relationship.preferredProviderId));
  if (relationshipGaps.length) {
    notifications.push({
      id: "relationship-gaps",
      title: `${relationshipGaps.length} provider relationship gaps need coverage`,
      copy: "Preferred delivery partners are missing in categories the employer may need later.",
      module: "Provider Relationships",
      tone: "red",
    });
  }

  const upcomingEnrolments = data.enrolments.filter((enrolment) => enrolment.startDate && enrolment.status !== "Completed" && enrolment.status !== "Cancelled").length;
  if (upcomingEnrolments) {
    notifications.push({
      id: "enrolments",
      title: `${upcomingEnrolments} enrolments are in flight`,
      copy: "Check provider allocations, dates, and learner readiness before start dates land.",
      module: "Enrolments",
      tone: "green",
    });
  }

  return notifications.slice(0, 8);
}

export function employeesNeedingSupport(data: MvpWorkspaceData) {
  return activeEmployees(data)
    .filter((employee) => {
      const profile = data.employeeDevelopmentProfiles.find((item) => item.employeeId === employee.id);
      return !employee.roleId || !profile || profile.stage !== "recommendation_ready";
    })
    .slice(0, 6);
}

export function recentRecommendations(data: MvpWorkspaceData) {
  return activeEmployees(data)
    .flatMap((employee) => {
      const recommendation = employeeRecommendedPathway(data, employee.id);
      return recommendation ? [{ employee, recommendation }] : [];
    })
    .slice(0, 6);
}

export function upcomingEnrolments(data: MvpWorkspaceData) {
  return data.enrolments
    .filter((enrolment) => enrolment.status !== "Completed" && enrolment.status !== "Cancelled")
    .sort((left, right) => (left.startDate || "9999").localeCompare(right.startDate || "9999"))
    .slice(0, 6);
}

export function providerCoverageSummary(data: MvpWorkspaceData) {
  const covered = relationshipCategories.filter((category) => data.providerRelationships.some((relationship) => relationship.category === category && relationship.preferredProviderId));
  return {
    covered: covered.length,
    total: relationshipCategories.length,
    missing: relationshipCategories.filter((category) => !covered.includes(category)),
  };
}

export function departmentCapabilityRows(data: MvpWorkspaceData) {
  const departments = data.profile.departments.length ? data.profile.departments : [...new Set(activeEmployees(data).map((employee) => employee.department).filter(Boolean))];
  return departments.map((department) => {
    const employees = activeEmployees(data).filter((employee) => employee.department === department);
    const profiles = data.employeeDevelopmentProfiles.filter((profile) => employees.some((employee) => employee.id === profile.employeeId));
    const recommendationCount = profiles.filter((profile) => profile.recommendationResult?.topRecommendation).length;
    const aiReady = profiles.filter((profile) => profile.aiOpportunities.length || profile.automationOpportunities.length).length;
    return {
      department,
      employees: employees.length,
      recommendationCount,
      aiCapability: employees.length ? Math.round((aiReady / employees.length) * 100) : 0,
      activeApplications: data.applications.filter((application) => employees.some((employee) => employee.id === application.employeeId) && activeApplicationStatuses().includes(application.status)).length,
    };
  }).filter((row) => row.department);
}

export function reportingInsights(data: MvpWorkspaceData) {
  const activeLearners = data.enrolments.filter((enrolment) => enrolment.status === "Live learner").length;
  const upcoming = data.enrolments.filter((enrolment) => ["Ready for provider", "Submitted to provider", "Enrolment in progress"].includes(enrolment.status)).length;
  const approvalQueue = activeApplications(data).filter((application) => application.currentOwner === "Line Manager" || application.currentOwner === "Apprenticeship Lead").length;
  const providerCoverage = providerCoverageSummary(data);
  const workforceReadiness = activeEmployees(data).length ? Math.round((data.employeeDevelopmentProfiles.filter((profile) => profile.stage === "recommendation_ready").length / activeEmployees(data).length) * 100) : 0;
  const levyUtilisation = Math.min(100, Math.round((activeLearners * 12 + upcoming * 8 + approvalQueue * 4) / Math.max(1, activeEmployees(data).length) * 10));

  return [
    {
      title: "Applications awaiting approval",
      value: approvalQueue,
      copy: "Requests currently with line managers or apprenticeship leads.",
      detail: approvalQueue ? "Why it matters: pending approvals are the main blocker to starts. Suggested next action: clear the oldest queue first." : "Why it matters: there is no approval backlog today. Suggested next action: focus on provider readiness and employee engagement.",
    },
    {
      title: "Workforce readiness",
      value: `${workforceReadiness}%`,
      copy: "Active employees with recommendation-ready development records.",
      detail: "Why it matters: recommendation coverage shows whether employees can move from conversations into real applications. Suggested next action: complete discovery on records still in role-context mode.",
    },
    {
      title: "Levy utilisation",
      value: `${levyUtilisation}%`,
      copy: "Live and near-term learner activity as a proxy for workforce investment.",
      detail: "Why it matters: the operational view should show whether apprenticeship demand is turning into starts. Suggested next action: prioritise enrolment records that are ready for provider submission.",
    },
    {
      title: "Provider coverage",
      value: `${providerCoverage.covered}/${providerCoverage.total}`,
      copy: "Relationship categories with a named preferred provider partner.",
      detail: providerCoverage.missing.length ? `Why it matters: missing coverage creates risk when new demand appears. Suggested next action: add preferred partners for ${providerCoverage.missing.slice(0, 2).join(" and ")}.` : "Why it matters: every major delivery category has a preferred partner. Suggested next action: review relationship dates and fallback partners.",
    },
  ];
}

export function applicationStageLabel(application: MvpApplication) {
  const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
  return standard?.title ?? application.apprenticeshipStandardId;
}

export function employeeName(data: MvpWorkspaceData, employeeId: string) {
  return data.employees.find((employee) => employee.id === employeeId)?.name ?? "Unknown employee";
}

export function managerName(data: MvpWorkspaceData, employee: MvpEmployee) {
  return data.employees.find((item) => item.id === employee.managerId)?.name ?? "Manager not assigned";
}
