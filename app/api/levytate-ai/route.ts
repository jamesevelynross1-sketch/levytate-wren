import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { enforceLevyTateAiActions } from "@/lib/levytate/ai/actions";
import { buildLevyTateAiContext } from "@/lib/levytate/ai/context";
import { buildLevyTateAiFallbackResponse } from "@/lib/levytate/ai/fallbackResponses";
import {
  applyConversationMemoryToFallback,
  finaliseConversationProfile,
  withConversationMemory,
} from "@/lib/levytate/ai/memory";
import { levyTateAiEnabled, requestLevyTateOpenAI, type LevyTateGeneratedGuidance } from "@/lib/levytate/ai/openai";
import { buildLevyTateAiSystemPrompt, buildLevyTateAiUserPrompt } from "@/lib/levytate/ai/prompts";
import {
  applyPlatformRecommendations,
  buildLevyTateRecommendations,
  buildPlatformRecommendationExplanation,
  recommendationNarrativeIsAligned,
} from "@/lib/levytate/ai/recommendationEngine";
import {
  parseLevyTateAiRequest,
  type LevyTateAiRequest,
  type LevyTateAiResponse,
  type LevyTateRole,
  type LevyTateWorkspaceEmployeeContext,
} from "@/lib/levytate/ai/types";
import { applyLevyTateAiSafety } from "@/lib/levytate-ai/safety";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import type { MvpApplication, MvpEmployee, MvpEmployeeDevelopmentProfile, MvpRole } from "@/lib/levytate/mvp/workspace";
import { getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";
import { getCopilotGuidanceItems } from "@/lib/server/levytate-guidance-sources";
import { routeOperationalCopilotQuery } from "@/lib/server/levytate-copilot-tools";

const requestWindowMs = 5 * 60 * 1000;
const duplicateWindowMs = 1_500;
const maxRequestsPerWindow = 24;
const requestBuckets = new Map<string, { count: number; startedAt: number; lastMessage: string; lastRequestAt: number }>();

function rateLimitKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(key: string, message: string) {
  const now = Date.now();
  const normalisedMessage = message.trim().toLowerCase().slice(0, 240);
  const existing = requestBuckets.get(key);

  if (!existing || now - existing.startedAt >= requestWindowMs) {
    requestBuckets.set(key, { count: 1, startedAt: now, lastMessage: normalisedMessage, lastRequestAt: now });
    return false;
  }

  if (existing.lastMessage === normalisedMessage && now - existing.lastRequestAt < duplicateWindowMs) return true;

  existing.count += 1;
  existing.lastMessage = normalisedMessage;
  existing.lastRequestAt = now;
  requestBuckets.set(key, existing);
  return existing.count > maxRequestsPerWindow;
}

function mergeSafetyNotes(fallback: string[], generated: string[]) {
  const seen = new Set<string>();
  return [...generated, ...fallback].filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function mergeGeneratedGuidance(fallback: LevyTateAiResponse, generated: LevyTateGeneratedGuidance): LevyTateAiResponse {
  const actionsByType = new Map(fallback.recommendedActions.map((action) => [action.type, action] as const));
  const selectedActions = generated.suggestedActionTypes
    .map((type) => actionsByType.get(type))
    .filter((action): action is NonNullable<typeof action> => Boolean(action));
  const recommendationResult = fallback.recommendationResult;
  const generatedMessage = generated.assistantMessage ?? fallback.assistantMessage;
  const aligned = !recommendationResult || recommendationNarrativeIsAligned(generatedMessage, recommendationResult);

  return {
    ...fallback,
    source: generated.assistantMessage && aligned ? "openai" : "mock",
    assistantMessage: aligned
      ? generatedMessage
      : recommendationResult
        ? buildPlatformRecommendationExplanation(recommendationResult)
        : fallback.assistantMessage,
    followUpQuestion: generated.followUpQuestion,
    quickReplies: generated.quickReplies,
    shouldShowActions: generated.shouldShowActions && selectedActions.length > 0,
    recommendedActions: selectedActions,
    suggestedActions: selectedActions,
    safetyNotes: mergeSafetyNotes(
      fallback.safetyNotes,
      aligned ? generated.safetyNotes : ["Generated recommendation language did not match the platform ranking and was replaced."],
    ),
    managerMessageDraft: generated.managerMessageDraft ?? fallback.managerMessageDraft,
  };
}

function progressiveEmployeeFollowUp(request: LevyTateAiRequest) {
  if (request.role !== "Employee" || !request.selectedEmployee || !request.employeeDiscovery) return null;
  if (request.employeeDiscovery.stage === "future_capability" && request.employeeDiscovery.futureCapabilities.length === 0) {
    const name = request.selectedEmployee.trim().split(/\s+/)[0] || request.selectedEmployee;
    return `What would you like ${name} to be able to do over the next 12 months that they cannot do confidently today?`;
  }
  return null;
}
function buildGroundedFallback(request: LevyTateAiRequest) {
  const recommendationResult = buildLevyTateRecommendations(request);
  const baseFallback = buildLevyTateAiFallbackResponse(request);
  if (isDeterministicEmployeeStateResponse(request, baseFallback)) {
    const grounded = applyPlatformRecommendations(request, baseFallback, recommendationResult);
    return {
      ...grounded,
      recommendedActions: baseFallback.recommendedActions,
      suggestedActions: baseFallback.suggestedActions,
      applicationPrefill: baseFallback.applicationPrefill,
      applicationDraft: baseFallback.applicationDraft ?? baseFallback.applicationPrefill,
    };
  }
  const conversationalFallback = applyConversationMemoryToFallback(
    request,
    baseFallback,
  );
  const grounded = applyPlatformRecommendations(request, conversationalFallback, recommendationResult);
  if (recommendationResult.shouldRevealRecommendations && !recommendationNarrativeIsAligned(grounded.assistantMessage, recommendationResult)) {
    return { ...grounded, assistantMessage: buildPlatformRecommendationExplanation(recommendationResult) };
  }
  return grounded;
}

function finaliseResponse(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  const withProfile = finaliseConversationProfile(request, response);
  const enforced = enforceLevyTateAiActions(request, applyLevyTateAiSafety(request, withProfile));
  const shouldShowActions = Boolean(enforced.applicationWarning) || enforced.shouldShowActions !== false;
  const shouldShowPathways = enforced.recommendationResult?.shouldRevealRecommendations === true;
  const deterministicEmployeeResponse = isDeterministicEmployeeStateResponse(request, enforced);
  const progressiveFollowUp = deterministicEmployeeResponse ? null : progressiveEmployeeFollowUp(request);

  return {
    ...enforced,
    followUpQuestion: progressiveFollowUp ?? enforced.followUpQuestion,
    shouldShowActions,
    shouldShowPathways,
    recommendedActions: shouldShowActions ? enforced.recommendedActions : [],
    suggestedActions: shouldShowActions ? enforced.suggestedActions : [],
    recommendedPathways: shouldShowPathways ? enforced.recommendedPathways : [],
  };
}

export async function POST(request: Request) {
  let parsedRequest: LevyTateAiRequest | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
    }
    if (session.accessLevel === "beta_admin") {
      return NextResponse.json({ message: "Employer operational Copilot is not available to Platform Admin." }, { status: 403 });
    }

    parsedRequest = parseLevyTateAiRequest(await request.json());
    if (!parsedRequest) {
      return NextResponse.json({ message: "Invalid LevyTate Copilot request payload." }, { status: 400 });
    }

    if (isRateLimited(rateLimitKey(request), parsedRequest.userMessage)) {
      return NextResponse.json({ message: "Please wait a moment before asking another question." }, { status: 429 });
    }

    const operationalResponse = await routeOperationalCopilotQuery(session, parsedRequest);
    if (operationalResponse) return NextResponse.json(operationalResponse);

    const workspace = await getWorkspaceBootstrapForSession(session);
    parsedRequest = sanitiseCopilotRequest(parsedRequest, workspace);

    parsedRequest = withConversationMemory(parsedRequest);

    const fallback = buildGroundedFallback(parsedRequest);
    if (isDeterministicEmployeeStateResponse(parsedRequest, fallback)) {
      return NextResponse.json(finaliseResponse(parsedRequest, fallback));
    }
    if (!levyTateAiEnabled()) {
      return NextResponse.json(finaliseResponse(parsedRequest, fallback));
    }

    const guidanceItems = await getCopilotGuidanceItems({
      asOf: new Date().toISOString().slice(0, 10),
    });
    const groundedContext = buildLevyTateAiContext(parsedRequest, guidanceItems);
    const generated = await requestLevyTateOpenAI({
      request: parsedRequest,
      systemPrompt: buildLevyTateAiSystemPrompt(parsedRequest),
      contextPrompt: buildLevyTateAiUserPrompt({ request: parsedRequest, groundedContext, fallback }),
    });

    return NextResponse.json(finaliseResponse(parsedRequest, mergeGeneratedGuidance(fallback, generated)));
  } catch (error) {
    console.error("LevyTate Copilot request failed", { error });

    if (parsedRequest) {
      return NextResponse.json(finaliseResponse(parsedRequest, buildGroundedFallback(parsedRequest)));
    }

    return NextResponse.json({ message: "LevyTate Copilot could not process this request." }, { status: 500 });
  }
}

function isDeterministicEmployeeStateResponse(request: LevyTateAiRequest, response: LevyTateAiResponse) {
  return request.role === "Employee"
    && response.safetyNotes.some((note) => note.includes("server-scoped employee record"));
}

async function getSession() {
  const cookieStore = await cookies();
  return readAuthorisedLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);
}

function allowedCopilotRole(requestedRole: LevyTateRole, workspace: LevyTateWorkspaceBootstrap): LevyTateRole {
  if (workspace.meta.userRole === "Platform Admin") return requestedRole === "LevyTate Admin" ? requestedRole : "LevyTate Admin";
  if (workspace.meta.userRole === "Apprenticeship Lead" || workspace.meta.userRole === "Employer Admin") return "Apprenticeship Lead";
  if (workspace.meta.userRole === "Line Manager") return "Line Manager";
  return "Employee";
}

function sanitiseCopilotRequest(request: LevyTateAiRequest, workspace: LevyTateWorkspaceBootstrap): LevyTateAiRequest {
  const data = workspace.data;
  const role = allowedCopilotRole(request.role, workspace);
  const employee = resolveScopedEmployee(data.employees, request, role);
  const roleRecord = employee ? data.roles.find((item) => item.id === employee.roleId) ?? null : null;
  const application = employee ? latestApplicationForEmployee(data.applications, employee.id) : null;
  const standardId = application?.apprenticeshipStandardId ?? roleRecord?.pathwayMappings[0]?.apprenticeshipStandardId;
  const standard = standardId ? getApprenticeshipStandard(standardId) : null;
  const employeeProfile = employee ? data.employeeDevelopmentProfiles.find((profile) => profile.employeeId === employee.id) ?? null : null;
  const providerProgramme = providerProgrammeForStandard(data, standardId);
  const enrolment = application ? data.enrolments.find((item) => item.applicationId === application.id) ?? null : null;

  return {
    ...request,
    role,
    userRole: role,
    selectedEmployee: employee?.name,
    selectedSite: employee?.site || data.profile.defaultSite || "All sites",
    employerContext: data.profile.employerName || workspace.meta.organisationName,
    currentWorkspace: {
      employerName: data.profile.employerName || workspace.meta.organisationName,
      selectedSite: employee?.site || data.profile.defaultSite || "All sites",
      activeModule: request.currentSection,
    },
    currentApplication: employee && application ? {
      id: Math.max(1, data.applications.findIndex((item) => item.id === application.id) + 1),
      name: employee.name,
      role: employee.jobTitle || roleRecord?.title || "Role to confirm",
      department: employee.department,
      team: employee.department,
      site: employee.site || "Site to confirm",
      pathway: standard?.title ?? application.apprenticeshipStandardId,
      manager: managerNameForEmployee(data.employees, employee),
      status: application.status,
      note: application.reason,
      careerGoal: application.careerGoal,
      supportRequired: application.supportRequired,
      submittedDate: application.submittedAt.slice(0, 10),
      decisionNotes: application.managerNote,
    } : null,
    roleMappings: roleRecord ? roleMappingContext(roleRecord) : [],
    availablePathways: roleRecord ? pathwayContext(roleRecord) : [],
    providerCatalogue: role === "Apprenticeship Lead" || role === "LevyTate Admin"
      ? data.providers.filter((provider) => provider.status === "Active").slice(0, 16).map((provider) => ({
          providerName: provider.providerName,
          sectors: provider.sectors,
          deliveryModels: provider.deliveryModels,
          verificationStatus: provider.verificationStatus,
        }))
      : [],
    employerPriorities: data.profile.priorities.map((priority) => ({ name: priority.name, importance: priority.importance })),
    employeeDiscovery: employeeProfile && employee ? {
      roleTitle: employee.jobTitle || roleRecord?.title || undefined,
      department: employee.department,
      responsibilities: employeeProfile.responsibilities,
      currentSkills: employeeProfile.currentSkills,
      businessFunctions: employeeProfile.businessFunctions,
      currentCapabilities: employeeProfile.currentCapabilities,
      apprenticeshipIndicators: employeeProfile.apprenticeshipIndicators,
      aiOpportunities: employeeProfile.aiOpportunities,
      dataOpportunities: employeeProfile.dataOpportunities,
      automationOpportunities: employeeProfile.automationOpportunities,
      futureCapabilities: employeeProfile.futureCapabilities,
      stage: employeeProfile.stage,
    } : undefined,
    workspaceEmployeeContext: buildScopedEmployeeContext(data.employees, employee, roleRecord, application, employeeProfile ?? undefined, request, {
      providerName: providerProgramme.provider?.providerName,
      programmeName: providerProgramme.programme?.programmeName,
      linkedStandard: standard?.title,
      verificationStatus: providerProgramme.provider?.verificationStatus,
      deliveryModels: providerProgramme.programme?.deliveryModels,
      enrolmentStatus: enrolment?.status,
    }),
    preferredStandardId: employeeProfile?.preferredStandardId || standardId,
    contextData: {
      selectedPersona: employee ? {
        name: employee.name,
        role: employee.jobTitle || roleRecord?.title || "Role to confirm",
        department: employee.department,
        site: employee.site,
        manager: managerNameForEmployee(data.employees, employee),
        careerGoal: application?.careerGoal ?? "",
        recommendedPathways: roleRecord?.pathwayMappings.length ?? 0,
        savedOpportunities: 0,
        passportActivities: 0,
      } : undefined,
      activeApplication: employee && application ? {
        id: Math.max(1, data.applications.findIndex((item) => item.id === application.id) + 1),
        name: employee.name,
        role: employee.jobTitle || roleRecord?.title || "Role to confirm",
        department: employee.department,
        team: employee.department,
        site: employee.site,
        pathway: standard?.title ?? application.apprenticeshipStandardId,
        manager: managerNameForEmployee(data.employees, employee),
        status: application.status,
        note: application.reason,
        careerGoal: application.careerGoal,
        supportRequired: application.supportRequired,
        submittedDate: application.submittedAt.slice(0, 10),
        decisionNotes: application.managerNote,
      } : null,
      requests: data.applications.slice(0, 30).flatMap((item, index) => {
        const owner = data.employees.find((candidate) => candidate.id === item.employeeId);
        if (!owner) return [];
        return [{
          id: index + 1,
          name: owner.name,
          role: owner.jobTitle || "Role to confirm",
          department: owner.department,
          team: owner.department,
          site: owner.site,
          pathway: getApprenticeshipStandard(item.apprenticeshipStandardId)?.title ?? item.apprenticeshipStandardId,
          manager: managerNameForEmployee(data.employees, owner),
          status: item.status,
          note: item.reason,
          careerGoal: item.careerGoal,
          supportRequired: item.supportRequired,
          submittedDate: item.submittedAt.slice(0, 10),
          decisionNotes: item.managerNote,
        }];
      }),
    },
  };
}

function providerProgrammeForStandard(data: LevyTateWorkspaceBootstrap["data"], standardId: string | undefined) {
  if (!standardId) return { provider: null, programme: null };
  const programme = data.providerProgrammes.find((item) => item.linkedStandardId === standardId || item.linkedStandardIds.includes(standardId)) ?? null;
  const provider = programme ? data.providers.find((item) => item.providerId === programme.providerId) ?? null : null;
  return { provider, programme };
}

function resolveScopedEmployee(employees: MvpEmployee[], request: LevyTateAiRequest, role: LevyTateRole) {
  if (!employees.length) return null;
  const selected = request.selectedEmployee?.trim().toLowerCase();
  const bySelected = selected
    ? employees.find((employee) => employee.id.toLowerCase() === selected || employee.name.toLowerCase() === selected)
    : null;
  if (bySelected) return bySelected;

  const message = request.userMessage.toLowerCase();
  const byMessage = employees.find((employee) => employee.name.toLowerCase().split(/\s+/).every((part) => message.includes(part)));
  if (byMessage) return byMessage;

  return role === "Employee" ? employees[0] : null;
}

function latestApplicationForEmployee(applications: MvpApplication[], employeeId: string) {
  return applications
    .filter((application) => application.employeeId === employeeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function managerNameForEmployee(employees: MvpEmployee[], employee: MvpEmployee) {
  return employee.managerName || employees.find((item) => item.id === employee.managerId)?.name || "Line manager to confirm";
}

function roleMappingContext(roleRecord: MvpRole) {
  const mappings = roleRecord.pathwayMappings.slice().sort((left, right) => left.priority - right.priority);
  const primary = mappings.find((mapping) => mapping.recommendationType === "Primary") ?? mappings[0];
  if (!primary) return [];
  return [{
    roleTitle: roleRecord.title,
    primaryPathway: getApprenticeshipStandard(primary.apprenticeshipStandardId)?.title ?? primary.apprenticeshipStandardId,
    alternativePathways: mappings.filter((mapping) => mapping.id !== primary.id).flatMap((mapping) => {
      const standard = getApprenticeshipStandard(mapping.apprenticeshipStandardId);
      return standard ? [standard.title] : [];
    }),
    businessRationale: primary.businessRationale,
  }];
}

function pathwayContext(roleRecord: MvpRole) {
  return roleRecord.pathwayMappings
    .slice()
    .sort((left, right) => left.priority - right.priority)
    .flatMap((mapping) => {
      const standard = getApprenticeshipStandard(mapping.apprenticeshipStandardId);
      return standard ? [{
        title: standard.title,
        standard: `${standard.referenceCode} - Level ${standard.level}`,
        status: standard.status,
        deliveryModel: mapping.deliveryPreference,
      }] : [];
    });
}

function buildScopedEmployeeContext(
  employees: MvpEmployee[],
  employee: MvpEmployee | null,
  roleRecord: MvpRole | null,
  application: MvpApplication | null,
  profile: MvpEmployeeDevelopmentProfile | undefined,
  request: LevyTateAiRequest,
  programmeContext?: {
    providerName?: string;
    programmeName?: string;
    linkedStandard?: string;
    verificationStatus?: string;
    deliveryModels?: string[];
    enrolmentStatus?: string;
  },
): LevyTateWorkspaceEmployeeContext {
  if (!employee) {
    return {
      resolution: request.selectedEmployee ? "not_found" : "none",
      searchText: request.selectedEmployee,
      missingData: ["employee record in your permitted scope"],
      matchedEmployees: [],
    };
  }

  const standard = application ? getApprenticeshipStandard(application.apprenticeshipStandardId) : null;
  const topRecommendation = profile?.recommendationResult?.topRecommendation ?? profile?.recommendationResult?.recommendations[0] ?? null;
  const latestComment = application?.history.at(-1)?.note ?? "";
  const ownerName = application ? applicationOwnerLabelForEmployee(employees, employee, application, programmeContext?.providerName) : "";

  return {
    resolution: "selected_employee",
    missingData: [
      !employee.jobTitle && !roleRecord?.title ? "job title" : "",
      !employee.department ? "department" : "",
      !employee.site ? "site" : "",
      !roleRecord ? "assigned role" : "",
      !application ? "application record" : "",
    ].filter(Boolean),
    employee: {
      id: employee.id,
      name: employee.name,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle || roleRecord?.title || "",
      department: employee.department,
      manager: managerNameForEmployee(employees, employee),
      location: employee.site,
      platformRole: employee.platformRole,
    },
    role: roleRecord ? {
      title: roleRecord.title,
      businessArea: roleRecord.businessArea,
      careerLevel: roleRecord.careerLevel,
      skillsTags: roleRecord.skillsTags,
      progression: roleRecord.progression,
      preferredPathway: roleMappingContext(roleRecord)[0]?.primaryPathway,
      alternativePathways: roleMappingContext(roleRecord)[0]?.alternativePathways,
      businessRationale: roleMappingContext(roleRecord)[0]?.businessRationale,
    } : undefined,
    application: application ? {
      id: application.id,
      status: application.status,
      currentOwner: application.currentOwner,
      currentOwnerName: ownerName,
      pathway: standard?.title ?? application.apprenticeshipStandardId,
      provider: programmeContext?.providerName,
      submittedDate: application.submittedAt.slice(0, 10),
      reason: application.reason,
      careerGoal: application.careerGoal,
      supportRequired: application.supportRequired,
      managerNote: application.managerNote,
      latestComment,
      requestedInformation: application.status === "More information requested" ? application.managerNote || latestComment : "",
      enrolmentStatus: programmeContext?.enrolmentStatus,
      approvalHistory: application.history.map((entry) => `${entry.status}: ${entry.note}`).slice(-6),
    } : null,
    development: profile ? {
      roleTitle: employee.jobTitle || roleRecord?.title || undefined,
      department: employee.department,
      responsibilities: profile.responsibilities,
      currentSkills: profile.currentSkills,
      businessFunctions: profile.businessFunctions,
      currentCapabilities: profile.currentCapabilities,
      apprenticeshipIndicators: profile.apprenticeshipIndicators,
      aiOpportunities: profile.aiOpportunities,
      dataOpportunities: profile.dataOpportunities,
      automationOpportunities: profile.automationOpportunities,
      futureCapabilities: profile.futureCapabilities,
      stage: profile.stage,
    } : undefined,
    recommendation: topRecommendation ? {
      topRecommendation: topRecommendation.title,
      fitScore: topRecommendation.fitScore,
      confidence: topRecommendation.confidence,
      rationale: topRecommendation.rationale,
      evidence: topRecommendation.evidence.map((item) => item.label).slice(0, 8),
      currentCapabilityProfile: profile?.recommendationResult?.currentCapabilityProfile,
      futureCapabilityProfile: profile?.recommendationResult?.futureCapabilityProfile,
    } : null,
    providerProgramme: programmeContext?.providerName || programmeContext?.programmeName ? {
      providerName: programmeContext.providerName,
      programmeName: programmeContext.programmeName,
      linkedStandard: programmeContext.linkedStandard,
      verificationStatus: programmeContext.verificationStatus,
      deliveryModels: programmeContext.deliveryModels,
    } : null,
  };
}

function applicationOwnerLabelForEmployee(
  employees: MvpEmployee[],
  employee: MvpEmployee,
  application: MvpApplication,
  providerName?: string,
) {
  if (application.currentOwner === "Line Manager") return managerNameForEmployee(employees, employee);
  if (application.currentOwner === "Employee") return employee.name;
  if (application.currentOwner === "Provider Partner") return providerName || "Approved delivery partner";
  return application.currentOwner;
}
