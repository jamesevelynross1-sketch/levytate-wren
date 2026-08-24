"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { getApprenticeshipStandard, type RequestStatus } from "@/lib/levytate/domain";
import type {
  LevyTateAiAction,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateConversationMessage,
  LevyTateConversationProfile,
  LevyTateRecommendationResult,
  LevyTateRole,
  LevyTateWorkspaceEmployeeContext,
} from "@/lib/levytate/ai/types";
import { updateEmployeeDiscovery } from "@/lib/levytate/mvp/progressive-profiling";
import { activeApplicationStatuses, createEmployeeDevelopmentProfile, nowIso, type MvpEmployee, type MvpRole, type MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";
import { copilotPlaceholderFor, copilotSuggestionsFor, type LevyTateCopilotContext } from "@/lib/levytate/copilot-context";
import { answerLevyFinanceQuestion } from "@/lib/levytate/finance/copilot";
import { createIllustrativeFinanceFixture } from "@/lib/levytate/finance/fixtures";
import { readFinanceState } from "@/lib/levytate/finance/storage";
import { answerProviderIntelligenceQuestion } from "@/lib/levytate/provider-intelligence/copilot";
import type { ProviderIntelligenceArticle } from "@/lib/levytate/provider-intelligence/domain";

type AssistantRole = Exclude<LevyTateRole, "Department Head">;
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: LevyTateAiResponse;
};

const assistantRoles: AssistantRole[] = ["Employee", "Line Manager", "Apprenticeship Lead", "LevyTate Admin"];
const activeStatuses = new Set<RequestStatus>(activeApplicationStatuses());

const roleContent: Record<AssistantRole, { purpose: string; welcome: string; prompts: string[] }> = {
  Employee: {
    purpose: "Explain recommendations, open the current application and prepare useful next-step drafts.",
    welcome: "Select an employee, then I can explain their recommendation, find the current application or prepare the next LevyTate workflow step.",
    prompts: [
      "Explain this recommendation",
      "Show the current application",
      "Generate a manager conversation",
      "What should I do next?",
    ],
  },
  "Line Manager": {
    purpose: "Understand your team's apprenticeship activity, review learner progress and identify where your support is needed.",
    welcome: "Ask about your direct reports and I will answer from current applications, learner progress, reviews, breaks, assessment and manager-relevant actions.",
    prompts: [
      "Which applications need my review?",
      "Show me learners behind target",
      "Who needs a manager check-in?",
      "Which reviews are overdue?",
      "Who is currently on a Break in Learning?",
      "Which learners are approaching assessment?",
      "What actions require my attention?",
      "Summarise apprenticeship activity in my team",
    ],
  },
  "Apprenticeship Lead": {
    purpose: "Understand programme activity, investigate learner exceptions and take the next authorised operational action.",
    welcome: "Ask a programme question and I will answer from current LevyTate learner, review, readiness and operational-action records.",
    prompts: [
      "Show learners behind target",
      "Which reviews are overdue?",
      "Who is ready to enrol?",
      "What needs my attention today?",
      "Which learners are approaching assessment?",
      "Show my open actions",
    ],
  },
  "LevyTate Admin": {
    purpose: "Find platform records, prepare provider notes and create internal follow-up drafts.",
    welcome: "Tell me the platform task. I can find records, structure provider matching notes, identify missing evidence and prepare the next internal action.",
    prompts: [
      "Show provider relationships",
      "Help me add a provider",
      "Generate provider notes",
      "Create a follow-up task",
    ],
  },
};

function messageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function employeeWelcome(name: string) {
  return `Tell me a little about what ${firstName(name)} does during a typical week.`;
}

function employeeCopilotStageContent(application: { status: RequestStatus } | null) {
  if (!application) {
    return {
      purpose: "Explain the recommended programme, help draft application answers and guide the first application step.",
      prompts: ["Explain this recommendation", "Help me draft my application", "What should I do today?"],
    };
  }
  if (application.status === "Draft") {
    return {
      purpose: "Help improve draft answers, explain missing information and prepare the application for manager review.",
      prompts: ["Review my answers", "Help me draft my application", "What should I do today?"],
    };
  }
  if (application.status === "Submitted to Line Manager" || application.status === "Awaiting Manager Review") {
    return {
      purpose: "Explain the submitted application, manager review and what the employee can do while answers are locked.",
      prompts: ["Why can't I edit my application?", "What happens next?", "What does manager review mean?"],
    };
  }
  if (application.status === "More information requested") {
    return {
      purpose: "Explain the manager's request and help draft the reopened response.",
      prompts: ["What information does my manager need?", "Help draft my response", "What should I do today?"],
    };
  }
  if (application.status === "Approved for Enrolment") {
    return {
      purpose: "Explain enrolment preparation, provider details and what happens before the programme starts.",
      prompts: ["What happens next?", "How much time will the programme require?", "What should I do today?"],
    };
  }
  if (application.status === "Approved by Line Manager" || application.status === "Submitted to Apprenticeship Lead" || application.status === "Awaiting Final Approval") {
    return {
      purpose: "Explain final review and help the employee track progress without changing approval status.",
      prompts: ["Who owns the next action?", "What happens next?", "Explain final review"],
    };
  }
  return {
    purpose: "Explain the decision feedback and help prepare a calm follow-up conversation.",
    prompts: ["Review feedback", "Prepare manager conversation", "What should I do today?"],
  };
}

function initialMessages(role: AssistantRole): ChatMessage[] {
  return [{ id: `welcome-${role}`, role: "assistant", content: roleContent[role].welcome }];
}

function initialConversations() {
  return Object.fromEntries(assistantRoles.map((role) => [role, initialMessages(role)])) as Record<AssistantRole, ChatMessage[]>;
}

function initialProfiles() {
  return Object.fromEntries(assistantRoles.map((role) => [role, null])) as Record<AssistantRole, LevyTateConversationProfile | null>;
}

function initialRecommendationResults() {
  return Object.fromEntries(assistantRoles.map((role) => [role, null])) as Record<AssistantRole, LevyTateRecommendationResult | null>;
}

function responseActions(response: LevyTateAiResponse) {
  return response.suggestedActions ?? response.recommendedActions;
}

function targetForCopilotAction(action: LevyTateAiAction) {
  const guidanceText = `${action.label} ${action.target ?? ""}`.toLowerCase();
  if (/guidance|funding|off-the-job|break in learning|gateway|assessment readiness/.test(guidanceText)) {
    const topic = /off-the-job/.test(guidanceText) ? "off-the-job"
      : /break in learning/.test(guidanceText) ? "breaks"
        : /gateway|assessment readiness/.test(guidanceText) ? "assessment"
          : /funding/.test(guidanceText) ? "funding" : "employer-responsibilities";
    return `Guidance Centre:${topic}`;
  }
  if (action.type === "open_my_applications") return action.target === "My Application" ? "My Application" : "Applications";
  if (action.type === "start_application" || action.type === "draft_application_reason") return "My Application";
  if (action.type === "open_pathway") return action.target === "My Programme" || /programme|pathway/i.test(action.label) ? "My Programme" : null;
  if (action.type === "open_review_queue") return "Applications";
  if (action.type === "open_final_approvals") return "Applications";
  if (action.type === "open_team_development") return "Employees";
  if (action.type === "open_department_analytics") return "Reports";
  if (action.type === "open_site_breakdown") return "Reports";
  if (action.type === "open_reporting") return "Reports";
  if (action.type === "open_provider_relationships") return "Programmes & Providers";
  if (action.type === "request_provider_matching") return "Programmes & Providers";
  return null;
}

function isNewConversationRequest(value: string) {
  return /\b(new conversation|start over|reset conversation|fresh conversation)\b/i.test(value);
}

function shouldAutoExecuteAction(response: LevyTateAiResponse, action: LevyTateAiAction | undefined) {
  if (!action || action.requiresConfirmation) return false;
  if (!targetForCopilotAction(action)) return false;
  return response.safetyNotes.some((note) => note.includes("platform task action may be executed immediately"));
}

function toChatMessages(history: LevyTateConversationMessage[], fallback: string): ChatMessage[] {
  if (!history.length) return [{ id: messageId(), role: "assistant", content: fallback }];
  return history.map((message, index) => ({
    id: `${message.role}-${index}-${Math.random().toString(16).slice(2, 7)}`,
    role: message.role,
    content: message.content,
  }));
}

function buildCurrentApplicationSummary(
  application: {
    id: string;
    status: RequestStatus;
    reason: string;
    careerGoal: string;
    managerNote: string;
    submittedAt: string;
  } | undefined,
  employee: {
    name: string;
    jobTitle: string;
    department: string;
    site: string;
  },
  managerName: string,
  pathwayTitle: string,
  index: number,
) {
  if (!application) return null;
  return {
    id: index + 1,
    name: employee.name,
    role: employee.jobTitle,
    department: employee.department,
    team: employee.department,
    site: employee.site || "Unassigned",
    pathway: pathwayTitle,
    manager: managerName,
    status: application.status,
    note: application.reason,
    careerGoal: application.careerGoal,
    supportRequired: "Support to balance the development plan with day-to-day workload.",
    submittedDate: application.submittedAt.slice(0, 10),
    decisionNotes: application.managerNote,
  } satisfies NonNullable<LevyTateAiRequest["currentApplication"]>;
}

function normalisePersonSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNameLikePhrases(message: string) {
  const phrases = new Set<string>();
  const cleaned = message.replace(/[’']/g, "");
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  for (const match of cleaned.matchAll(pattern)) {
    const phrase = match[1].trim();
    if (!/^(Ask LevyTate|Line Manager|Department Head|Apprenticeship Lead|Ground Control)$/i.test(phrase)) {
      phrases.add(phrase);
    }
  }
  return [...phrases];
}

function employeeMatchesMessage(employee: MvpEmployee, message: string) {
  const messageText = normalisePersonSearch(message);
  const fullName = normalisePersonSearch(employee.name);
  const parts = fullName.split(" ").filter(Boolean);
  if (!messageText || !fullName || parts.length < 2) return false;
  return messageText.includes(fullName) || parts.every((part) => messageText.includes(part));
}

function compactText(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim() ?? "").filter(Boolean);
}

function rolePathwayContext(roleRecord: MvpRole | null) {
  const mappings = roleRecord?.pathwayMappings.slice().sort((left, right) => left.priority - right.priority) ?? [];
  const primary = mappings.find((mapping) => mapping.recommendationType === "Primary") ?? mappings[0];
  const primaryStandard = primary ? getApprenticeshipStandard(primary.apprenticeshipStandardId) : null;
  return {
    primary,
    primaryTitle: primaryStandard?.title ?? primary?.apprenticeshipStandardId ?? "",
    alternatives: mappings
      .filter((mapping) => mapping.id !== primary?.id)
      .flatMap((mapping) => {
        const standard = getApprenticeshipStandard(mapping.apprenticeshipStandardId);
        return standard ? [standard.title] : [];
      }),
    rationale: primary?.businessRationale,
  };
}

function providerProgrammeForStandard(data: MvpWorkspaceData, standardId: string | undefined) {
  if (!standardId) return { provider: null, programme: null };
  const programme = data.providerProgrammes.find((item) => item.linkedStandardIds.includes(standardId) || item.linkedStandardId === standardId) ?? null;
  const provider = programme ? data.providers.find((item) => item.providerId === programme.providerId) ?? null : null;
  return { provider, programme };
}

function buildWorkspaceEmployeeResolution(
  data: MvpWorkspaceData,
  message: string,
  selectedEmployeeId: string,
) {
  const activeEmployees = data.employees.filter((employee) => employee.status === "Active");
  const namedMatches = activeEmployees.filter((employee) => employeeMatchesMessage(employee, message));
  const namePhrases = extractNameLikePhrases(message);
  const explicitlyNamed = namedMatches.length > 0 || namePhrases.length > 0;

  if (namedMatches.length > 1) {
    return {
      workspaceEmployeeContext: {
        resolution: "multiple_matches",
        searchText: namePhrases[0] ?? message,
        missingData: [],
        matchedEmployees: namedMatches.map((employee) => ({
          id: employee.id,
          name: employee.name,
          jobTitle: employee.jobTitle,
          department: employee.department,
          site: employee.site,
        })),
      } satisfies LevyTateWorkspaceEmployeeContext,
      employee: null,
      roleRecord: null,
      developmentProfile: null,
      application: null,
      managerName: "",
    };
  }

  if (!namedMatches.length && explicitlyNamed) {
    const phrase = namePhrases[0] ?? message;
    const phraseParts = normalisePersonSearch(phrase).split(" ").filter(Boolean);
    const possibleMatches = activeEmployees
      .filter((employee) => {
        const employeeName = normalisePersonSearch(employee.name);
        return phraseParts.some((part) => part.length > 2 && employeeName.includes(part));
      })
      .slice(0, 5);

    return {
      workspaceEmployeeContext: {
        resolution: "not_found",
        searchText: phrase,
        missingData: ["employee record"],
        matchedEmployees: possibleMatches.map((employee) => ({
          id: employee.id,
          name: employee.name,
          jobTitle: employee.jobTitle,
          department: employee.department,
          site: employee.site,
        })),
      } satisfies LevyTateWorkspaceEmployeeContext,
      employee: null,
      roleRecord: null,
      developmentProfile: null,
      application: null,
      managerName: "",
    };
  }

  const employee = namedMatches[0] ?? activeEmployees.find((item) => item.id === selectedEmployeeId) ?? null;
  if (!employee) {
    return {
      workspaceEmployeeContext: { resolution: "none", missingData: ["employee record"] } satisfies LevyTateWorkspaceEmployeeContext,
      employee: null,
      roleRecord: null,
      developmentProfile: null,
      application: null,
      managerName: "",
    };
  }

  const roleRecord = data.roles.find((item) => item.id === employee.roleId) ?? null;
  const manager = employee.managerId ? data.employees.find((item) => item.id === employee.managerId) ?? null : null;
  const developmentProfile = data.employeeDevelopmentProfiles.find((profile) => profile.employeeId === employee.id) ?? null;
  const application = data.applications.find((item) => item.employeeId === employee.id && activeStatuses.has(item.status))
    ?? data.applications.filter((item) => item.employeeId === employee.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    ?? null;
  const pathway = rolePathwayContext(roleRecord);
  const applicationStandard = application ? getApprenticeshipStandard(application.apprenticeshipStandardId) : null;
  const preferredStandardId = application?.apprenticeshipStandardId || developmentProfile?.preferredStandardId || pathway.primary?.apprenticeshipStandardId;
  const { provider, programme } = providerProgrammeForStandard(data, preferredStandardId);
  const topRecommendation = developmentProfile?.recommendationResult?.topRecommendation ?? developmentProfile?.recommendationResult?.recommendations[0] ?? null;
  const missingData = compactText([
    !employee.jobTitle && !roleRecord?.title ? "job title" : null,
    !employee.department ? "department" : null,
    !employee.site ? "location" : null,
    !manager ? "manager" : null,
    !roleRecord ? "assigned role" : null,
    !developmentProfile ? "capability profile" : null,
    !application ? "application record" : null,
    !preferredStandardId ? "preferred pathway" : null,
  ]);

  return {
    workspaceEmployeeContext: {
      resolution: namedMatches.length ? "matched_by_name" : "selected_employee",
      searchText: namedMatches.length ? employee.name : undefined,
      missingData,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle || roleRecord?.title || "",
        division: roleRecord?.department,
        department: employee.department,
        team: roleRecord?.businessArea,
        manager: manager?.name,
        location: employee.site,
        platformRole: employee.platformRole,
      },
      role: roleRecord ? {
        title: roleRecord.title,
        businessArea: roleRecord.businessArea,
        careerLevel: roleRecord.careerLevel,
        skillsTags: roleRecord.skillsTags,
        progression: roleRecord.progression,
        preferredPathway: pathway.primaryTitle,
        alternativePathways: pathway.alternatives,
        businessRationale: pathway.rationale,
      } : undefined,
      application: application ? {
        id: application.id,
        status: application.status,
        currentOwner: application.currentOwner,
        pathway: applicationStandard?.title ?? application.apprenticeshipStandardId,
        submittedDate: application.submittedAt.slice(0, 10),
        reason: application.reason,
        careerGoal: application.careerGoal,
        supportRequired: application.supportRequired,
        managerNote: application.managerNote,
        approvalHistory: application.history.map((entry) => `${entry.status}: ${entry.note}`).slice(-6),
      } : null,
      development: developmentProfile ? {
        roleTitle: employee.jobTitle || roleRecord?.title || undefined,
        department: employee.department,
        responsibilities: developmentProfile.responsibilities,
        currentSkills: developmentProfile.currentSkills,
        businessFunctions: developmentProfile.businessFunctions,
        currentCapabilities: developmentProfile.currentCapabilities,
        apprenticeshipIndicators: developmentProfile.apprenticeshipIndicators,
        aiOpportunities: developmentProfile.aiOpportunities,
        dataOpportunities: developmentProfile.dataOpportunities,
        automationOpportunities: developmentProfile.automationOpportunities,
        futureCapabilities: developmentProfile.futureCapabilities,
        stage: developmentProfile.stage,
      } : undefined,
      recommendation: topRecommendation ? {
        topRecommendation: topRecommendation.title,
        fitScore: topRecommendation.fitScore,
        confidence: topRecommendation.confidence,
        rationale: topRecommendation.rationale,
        evidence: topRecommendation.evidence.map((item) => item.label).slice(0, 8),
        currentCapabilityProfile: developmentProfile?.recommendationResult?.currentCapabilityProfile,
        futureCapabilityProfile: developmentProfile?.recommendationResult?.futureCapabilityProfile,
      } : pathway.primaryTitle ? {
        topRecommendation: pathway.primaryTitle,
        rationale: pathway.rationale,
        evidence: compactText([roleRecord?.title, roleRecord?.businessArea, roleRecord?.department]),
      } : null,
      providerProgramme: programme || provider ? {
        providerName: provider?.providerName,
        programmeName: programme?.programmeName,
        linkedStandard: applicationStandard?.title ?? programme?.linkedStandardName,
        verificationStatus: programme?.verificationStatus ?? provider?.verificationStatus,
        deliveryModels: programme?.deliveryModels ?? provider?.deliveryModels,
      } : null,
    } satisfies LevyTateWorkspaceEmployeeContext,
    employee,
    roleRecord,
    developmentProfile,
    application,
    managerName: employee.managerName || manager?.name || "Line manager to confirm",
  };
}

export function AskLevyTateAiWorkspace({ initialEmployeeId = null, onNavigate, presentation = "standalone", context }: { initialEmployeeId?: string | null; onNavigate?: (target: string) => void; presentation?: "standalone" | "drawer"; context?: LevyTateCopilotContext }) {
  const { data, meta, saveEmployeeDevelopmentProfile } = useMvpWorkspace();
  const [role, setRole] = useState<AssistantRole>("Employee");
  const [conversations, setConversations] = useState<Record<AssistantRole, ChatMessage[]>>(initialConversations);
  const [profiles, setProfiles] = useState<Record<AssistantRole, LevyTateConversationProfile | null>>(initialProfiles);
  const [recommendationResults, setRecommendationResults] = useState<Record<AssistantRole, LevyTateRecommendationResult | null>>(initialRecommendationResults);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId ?? "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<LevyTateAiAction | null>(null);
  const [revealedAction, setRevealedAction] = useState<LevyTateAiAction | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const loadedEmployeeRef = useRef("");
  const previousContextRef = useRef("");
  const [contextChanges, setContextChanges] = useState<string[]>([]);
  const availableAssistantRoles = useMemo(() => {
    if (meta?.userRole === "Platform Admin") return ["LevyTate Admin"] as AssistantRole[];
    if (meta?.userRole === "Employer Admin" || meta?.userRole === "Apprenticeship Lead") return ["Apprenticeship Lead"] as AssistantRole[];
    if (meta?.userRole === "Line Manager") return ["Line Manager"] as AssistantRole[];
    return ["Employee"] as AssistantRole[];
  }, [meta?.userRole]);

  useEffect(() => {
    if (availableAssistantRoles.includes(role)) return;
    setRole(availableAssistantRoles[0] ?? "Employee");
  }, [availableAssistantRoles, role]);

  const employees = useMemo(
    () => data.employees.filter((employee) => employee.status === "Active"),
    [data.employees],
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const selectedRoleRecord = useMemo(
    () => data.roles.find((roleRecord) => roleRecord.id === selectedEmployee?.roleId) ?? null,
    [data.roles, selectedEmployee?.roleId],
  );

  const selectedManagerName = useMemo(() => {
    if (!selectedEmployee) return "Line manager to confirm";
    return selectedEmployee.managerName
      || data.employees.find((employee) => employee.id === selectedEmployee.managerId)?.name
      || "Line manager to confirm";
  }, [data.employees, selectedEmployee]);

  const selectedDevelopmentProfile = useMemo(
    () => data.employeeDevelopmentProfiles.find((profile) => profile.employeeId === selectedEmployeeId) ?? null,
    [data.employeeDevelopmentProfiles, selectedEmployeeId],
  );

  const selectedApplication = useMemo(() => {
    if (!selectedEmployee) return null;
    return data.applications.find((application) => application.employeeId === selectedEmployee.id && activeStatuses.has(application.status)) ?? null;
  }, [data.applications, selectedEmployee]);

  const selectedApplicationIndex = useMemo(() => {
    if (!selectedApplication) return -1;
    return data.applications.findIndex((application) => application.id === selectedApplication.id);
  }, [data.applications, selectedApplication]);

  const selectedPreferredStandard = useMemo(
    () => selectedDevelopmentProfile?.preferredStandardId ? getApprenticeshipStandard(selectedDevelopmentProfile.preferredStandardId) ?? null : null,
    [selectedDevelopmentProfile?.preferredStandardId],
  );

  const messages = conversations[role];
  const latestResponse = useMemo(
    () => [...messages].reverse().find((message) => message.response)?.response ?? null,
    [messages],
  );
  const employeeStageContent = useMemo(
    () => employeeCopilotStageContent(selectedApplication),
    [selectedApplication],
  );
  const activePurpose = role === "Employee" ? employeeStageContent.purpose : roleContent[role].purpose;
  const activePrompts = presentation === "drawer" && context ? copilotSuggestionsFor(context) : role === "Employee" ? employeeStageContent.prompts : roleContent[role].prompts;

  useEffect(() => {
    if (presentation !== "drawer" || !context) return;
    const key = `${context.module}:${context.entityType ?? "page"}:${context.entityId ?? ""}`;
    if (previousContextRef.current && previousContextRef.current !== key) setContextChanges((current) => [...current, `Context changed to ${context.contextLabel}`].slice(-4));
    previousContextRef.current = key;
  }, [context, presentation]);

  useEffect(() => {
    if (initialEmployeeId && initialEmployeeId !== selectedEmployeeId) {
      setSelectedEmployeeId(initialEmployeeId);
      loadedEmployeeRef.current = "";
    }
  }, [initialEmployeeId, selectedEmployeeId]);

  useEffect(() => {
    if (!employees.length) {
      if (selectedEmployeeId) setSelectedEmployeeId("");
      return;
    }
    if (!selectedEmployee || selectedEmployee.status !== "Active") {
      setSelectedEmployeeId(initialEmployeeId && employees.some((employee) => employee.id === initialEmployeeId) ? initialEmployeeId : employees[0].id);
      loadedEmployeeRef.current = "";
    }
  }, [employees, initialEmployeeId, selectedEmployee, selectedEmployeeId]);

  useEffect(() => {
    if (role !== "Employee") return;
    const nextKey = selectedEmployeeId || "none";
    if (loadedEmployeeRef.current === nextKey) return;
    loadedEmployeeRef.current = nextKey;

    if (!selectedEmployee) {
      setConversations((current) => ({
        ...current,
        Employee: [{ id: "welcome-employee-empty", role: "assistant", content: "Create an employee record first, then I will guide the pathway discovery from there." }],
      }));
      setProfiles((current) => ({ ...current, Employee: null }));
      setRecommendationResults((current) => ({ ...current, Employee: null }));
      return;
    }

    const fallback = employeeWelcome(selectedEmployee.name);
    setConversations((current) => ({
      ...current,
      Employee: toChatMessages(selectedDevelopmentProfile?.conversationHistory ?? [], fallback),
    }));
    setProfiles((current) => ({ ...current, Employee: selectedDevelopmentProfile?.conversationProfile ?? null }));
    setRecommendationResults((current) => ({ ...current, Employee: selectedDevelopmentProfile?.recommendationResult ?? null }));
    setPendingAction(null);
    setRevealedAction(null);
    setActionStatus("");
    setError("");
  }, [role, selectedEmployee, selectedEmployeeId, selectedDevelopmentProfile]);

  function changeRole(nextRole: AssistantRole) {
    setRole(nextRole);
    setInput("");
    setError("");
    setPendingAction(null);
    setRevealedAction(null);
    setActionStatus("");
    if (nextRole === "Employee") loadedEmployeeRef.current = "";
  }

  function chooseEmployee(nextEmployeeId: string) {
    setSelectedEmployeeId(nextEmployeeId);
    loadedEmployeeRef.current = "";
    setInput("");
    setError("");
    setPendingAction(null);
    setRevealedAction(null);
    setActionStatus("");
  }

  function resetConversation() {
    const programme = selectedApplication
      ? getApprenticeshipStandard(selectedApplication.apprenticeshipStandardId)?.title ?? selectedApplication.apprenticeshipStandardId
      : selectedPreferredStandard?.title ?? "your recommended programme";
    const fallback = role === "Employee" && selectedEmployee
      ? selectedApplication
        ? selectedApplication.status === "Submitted to Line Manager" || selectedApplication.status === "Awaiting Manager Review"
          ? `Your ${programme} application is currently with ${selectedManagerName} for review. I can show your submitted application, explain the review stage or help you prepare for the conversation.`
          : `Your ${programme} application is currently ${selectedApplication.status}. I can explain the status, show your submitted answers or help you prepare for the next step.`
        : `Hi ${firstName(selectedEmployee.name)}. ${programme} is your current recommendation. I can explain it, help draft an application or open the programme view.`
      : roleContent[role].welcome;
    setConversations((current) => ({ ...current, [role]: [{ id: `reset-${role}-${messageId()}`, role: "assistant", content: fallback }] }));
    setInput("");
    setError("");
    setPendingAction(null);
    setRevealedAction(null);
    setActionStatus("");
  }

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const activeRole = role;
    if (activeRole === "Employee" && !selectedEmployee) {
      setError("Select an employee before starting the guided recommendation conversation.");
      return;
    }

    if (activeRole === "Employee" && isNewConversationRequest(trimmed)) {
      resetConversation();
      return;
    }

    const roleMessages = conversations[activeRole];
    const userMessage: ChatMessage = { id: messageId(), role: "user", content: trimmed };
    const nextMessages = [...roleMessages, userMessage];
    if (context?.module === "Intelligence") {
      let answer = "Provider Intelligence has no verified cached articles available in this browser yet. Open Intelligence to load the current source-backed feed.";
      try {
        const cached = JSON.parse(sessionStorage.getItem("levytate-provider-intelligence-v1") || "{}") as { articles?: ProviderIntelligenceArticle[] };
        if (cached.articles?.length) answer = answerProviderIntelligenceQuestion(trimmed, cached.articles, (providerId) => data.providers.find((item) => item.providerId === providerId)?.providerName ?? "Provider");
      } catch {}
      setConversations((current) => ({ ...current, [activeRole]: [...nextMessages, { id: messageId(), role: "assistant", content: answer }] }));
      setInput(""); setError(""); return;
    }
    if (context?.module === "Finance") {
      const persistence = meta?.storageMode === "supabase" ? "session" : "local";
      const financeState = readFinanceState(meta?.organisationId ?? "local-demo", persistence)
        ?? (persistence === "local" ? createIllustrativeFinanceFixture() : null);
      const answer = financeState
        ? answerLevyFinanceQuestion(trimmed, financeState).message
        : "There is no imported DAS transaction data to summarise yet. Upload a DAS CSV in Finance first.";
      setConversations((current) => ({ ...current, [activeRole]: [...nextMessages, { id: messageId(), role: "assistant", content: answer }] }));
      setInput("");
      setError("");
      return;
    }
    const conversationHistory: LevyTateConversationMessage[] = roleMessages
      .filter((item) => !item.id.startsWith("welcome-"))
      .map(({ role: messageRole, content }) => ({ role: messageRole, content }));

    const resolvedContext = buildWorkspaceEmployeeResolution(data, trimmed, selectedEmployeeId);
    const contextEmployee = resolvedContext.employee;
    const roleRecord = resolvedContext.roleRecord ?? (activeRole === "Employee" ? selectedRoleRecord : null);
    const existingDevelopmentProfile = resolvedContext.developmentProfile;
    const shouldUpdateSelectedEmployeeProfile = activeRole === "Employee" && selectedEmployee && contextEmployee?.id === selectedEmployee.id;
    const developmentProfile = shouldUpdateSelectedEmployeeProfile && contextEmployee
      ? updateEmployeeDiscovery(existingDevelopmentProfile ?? createEmployeeDevelopmentProfile(contextEmployee.id), contextEmployee.id, trimmed)
      : existingDevelopmentProfile;
    const availablePathways = roleRecord
      ? roleRecord.pathwayMappings
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
          })
      : [];
    const primaryMapping = roleRecord?.pathwayMappings
      .slice()
      .sort((left, right) => left.priority - right.priority)
      .find((mapping) => mapping.recommendationType === "Primary")
      ?? roleRecord?.pathwayMappings.slice().sort((left, right) => left.priority - right.priority)[0];
    const roleMappings = roleRecord && primaryMapping
      ? [{
          roleTitle: roleRecord.title,
          primaryPathway: getApprenticeshipStandard(primaryMapping.apprenticeshipStandardId)?.title ?? primaryMapping.apprenticeshipStandardId,
          alternativePathways: roleRecord.pathwayMappings
            .filter((mapping) => mapping.id !== primaryMapping.id)
            .flatMap((mapping) => {
              const standard = getApprenticeshipStandard(mapping.apprenticeshipStandardId);
              return standard ? [standard.title] : [];
            }),
          businessRationale: primaryMapping.businessRationale,
        }]
      : [];

    const payload: LevyTateAiRequest = {
      role: activeRole,
      userRole: activeRole,
      selectedEmployee: contextEmployee?.name ?? (activeRole === "Employee" ? selectedEmployee?.name : undefined),
      selectedSite: contextEmployee?.site || (activeRole === "Employee" ? selectedEmployee?.site || data.profile.defaultSite || "All sites" : data.profile.defaultSite || "All sites"),
      currentSection: context?.contextLabel ?? "LevyTate Copilot",
      userMessage: trimmed,
      conversationHistory,
      conversationProfile: developmentProfile?.conversationProfile ?? (activeRole === "Employee" ? selectedDevelopmentProfile?.conversationProfile ?? undefined : profiles[activeRole] ?? undefined),
      previousRecommendationResult: developmentProfile?.recommendationResult ?? (activeRole === "Employee" ? selectedDevelopmentProfile?.recommendationResult ?? null : recommendationResults[activeRole]),
      employerContext: data.profile.employerName || "LevyTate beta workspace",
      currentWorkspace: {
        employerName: data.profile.employerName || "LevyTate beta workspace",
        selectedSite: contextEmployee?.site || (activeRole === "Employee" ? selectedEmployee?.site || data.profile.defaultSite || "All sites" : data.profile.defaultSite || "All sites"),
        activeModule: context?.module ?? "LevyTate Copilot",
      },
      currentApplication: contextEmployee
        ? buildCurrentApplicationSummary(
            resolvedContext.application ?? undefined,
            contextEmployee,
            resolvedContext.managerName || selectedManagerName,
            resolvedContext.application ? getApprenticeshipStandard(resolvedContext.application.apprenticeshipStandardId)?.title ?? resolvedContext.application.apprenticeshipStandardId : "No active application",
            resolvedContext.application ? Math.max(0, data.applications.findIndex((application) => application.id === resolvedContext.application?.id)) : selectedApplicationIndex >= 0 ? selectedApplicationIndex : 0,
          )
        : null,
      roleMappings,
      availablePathways,
      providerCatalogue: data.providers
        .filter((provider) => provider.status === "Active")
        .slice(0, 16)
        .map((provider) => ({
          providerName: provider.providerName,
          sectors: provider.sectors,
          deliveryModels: provider.deliveryModels,
          verificationStatus: provider.verificationStatus,
        })),
      employerPriorities: data.profile.priorities.map((priority) => ({ name: priority.name, importance: priority.importance })),
      employeeDiscovery: developmentProfile && contextEmployee
        ? {
            roleTitle: contextEmployee.jobTitle || roleRecord?.title || undefined,
            department: contextEmployee.department,
            responsibilities: developmentProfile.responsibilities,
            currentSkills: developmentProfile.currentSkills,
            businessFunctions: developmentProfile.businessFunctions,
            currentCapabilities: developmentProfile.currentCapabilities,
            apprenticeshipIndicators: developmentProfile.apprenticeshipIndicators,
            aiOpportunities: developmentProfile.aiOpportunities,
            dataOpportunities: developmentProfile.dataOpportunities,
            automationOpportunities: developmentProfile.automationOpportunities,
            futureCapabilities: developmentProfile.futureCapabilities,
            stage: developmentProfile.stage,
          }
        : undefined,
      workspaceEmployeeContext: resolvedContext.workspaceEmployeeContext,
      preferredStandardId: developmentProfile?.preferredStandardId || (activeRole === "Employee" ? selectedDevelopmentProfile?.preferredStandardId || undefined : undefined),
      operationalContext: activeRole === "Line Manager" || activeRole === "Apprenticeship Lead" || activeRole === "LevyTate Admin"
        ? latestResponse?.operationalContext
        : undefined,
    };

    setConversations((current) => ({ ...current, [activeRole]: nextMessages }));
    setInput("");
    setError("");
    setLoading(true);
    setPendingAction(null);
    setRevealedAction(null);
    setActionStatus("");

    try {
      const response = await fetch("/api/levytate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as LevyTateAiResponse & { message?: string };
      if (!response.ok) throw new Error(result.message || "LevyTate Copilot could not respond.");

      const content = [result.assistantMessage, result.followUpQuestion].filter(Boolean).join("\n\n");
      const assistantMessage: ChatMessage = { id: messageId(), role: "assistant", content, response: result };
      setConversations((current) => ({ ...current, [activeRole]: [...current[activeRole], assistantMessage] }));
      setProfiles((current) => ({ ...current, [activeRole]: result.conversationProfile ?? current[activeRole] ?? null }));
      setRecommendationResults((current) => ({ ...current, [activeRole]: result.recommendationResult ?? current[activeRole] ?? null }));

      const firstAction = responseActions(result)[0];
      if (shouldAutoExecuteAction(result, firstAction)) {
        executeCopilotAction(firstAction, true);
      }

      if (shouldUpdateSelectedEmployeeProfile && selectedEmployee && developmentProfile) {
        const existing = selectedDevelopmentProfile ?? createEmployeeDevelopmentProfile(selectedEmployee.id);
        saveEmployeeDevelopmentProfile({
          ...existing,
          ...developmentProfile,
          conversationHistory: [...conversationHistory, { role: "user" as const, content: trimmed }, { role: "assistant" as const, content }].slice(-24),
          conversationProfile: result.conversationProfile ?? existing.conversationProfile,
          recommendationResult: result.recommendationResult ?? existing.recommendationResult,
          preferredStandardId: existing.preferredStandardId,
          updatedAt: nowIso(),
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "LevyTate Copilot could not respond.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = input.trim() || activePrompts[0] || roleContent[role].welcome;
    void sendMessage(nextMessage);
  }

  function executeCopilotAction(action: LevyTateAiAction, automatic = false) {
    setActionStatus("");
    if (action.requiresConfirmation) {
      setPendingAction(action);
      setRevealedAction(null);
      return;
    }
    setPendingAction(null);
    setRevealedAction(action);
    const navigationTarget = targetForCopilotAction(action);
    if (navigationTarget && onNavigate) {
      onNavigate(navigationTarget);
      setActionStatus(automatic ? `Opened ${navigationTarget}.` : `Opened ${navigationTarget}.`);
    }
  }

  function chooseAction(action: LevyTateAiAction) {
    executeCopilotAction(action);
  }

  function confirmAction() {
    if (!pendingAction) return;
    setRevealedAction(pendingAction);
    setActionStatus("Confirmed. The draft is prepared for the product workflow; no external action has been sent automatically.");
    setPendingAction(null);
  }

  function selectRecommendedPathway(title: string) {
    if (role !== "Employee" || !selectedEmployee) return;
    const recommendation = latestResponse?.recommendationResult?.recommendations.find((item) => item.title === title)
      ?? selectedDevelopmentProfile?.recommendationResult?.recommendations.find((item) => item.title === title)
      ?? null;
    if (!recommendation) return;
    const existing = selectedDevelopmentProfile ?? createEmployeeDevelopmentProfile(selectedEmployee.id);
    saveEmployeeDevelopmentProfile({
      ...existing,
      conversationProfile: profiles.Employee ?? existing.conversationProfile,
      recommendationResult: latestResponse?.recommendationResult ?? existing.recommendationResult,
      preferredStandardId: recommendation.pathwayId,
      updatedAt: nowIso(),
    });
    setActionStatus(`${recommendation.title} is now the preferred pathway for provider matching and application support.`);
  }

  const employeePrioritySummary = data.profile.priorities.slice(0, 3);
  const conversationStarted = messages.some((message) => message.role === "user");
  const conversationCtaLabel = conversationStarted ? "Continue conversation" : "Start conversation";
  const conversationDisabled = loading || (role === "Employee" && !selectedEmployee);

  if (presentation === "drawer" && context) {
    return <div className="flex h-full min-h-0 flex-col bg-white">
      {!conversationStarted ? <div className="border-b border-[#102c3d]/[0.07] px-4 py-3">
        <p className="text-xs font-semibold text-[#102c3d]/48">Suggested</p>
        <div className="mt-2 flex flex-wrap gap-2">{activePrompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={conversationDisabled} className="min-h-9 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 py-1.5 text-left text-[13px] font-medium leading-5 text-[#102c3d]/68 transition hover:border-[#0b776e]/30 hover:bg-white hover:text-[#102c3d] disabled:opacity-45">{prompt}</button>)}</div>
      </div> : null}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4" aria-live="polite">
        {contextChanges.map((change, index) => <div key={`${change}-${index}`} className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-[#102c3d]/10" /><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/40">{change}</span><span className="h-px flex-1 bg-[#102c3d]/10" /></div>)}
        {messages.map((message) => <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] text-[14px] leading-6 ${message.role === "user" ? "rounded-2xl rounded-br-md bg-[#102c3d] px-3.5 py-2.5 text-white" : "w-full text-[#102c3d]/72"}`}><p className="whitespace-pre-wrap">{message.content}</p>{message.response ? <InlineResponse response={message.response} onAction={chooseAction} onQuickReply={(reply) => void sendMessage(reply)} onSelectPathway={role === "Employee" ? selectRecommendedPathway : undefined} selectedPathwayTitle={selectedPreferredStandard?.title ?? null} loading={loading} /> : null}</div></article>)}
        {loading ? <p className="text-sm font-medium text-[#0b776e]">Checking {context.module === "Home" ? "learner operations" : context.contextLabel.toLowerCase()}…</p> : null}
        {error ? <p className="border border-[#bf4159]/15 bg-[#fff4f5] px-3 py-2 text-sm text-[#ad344e]">{error}</p> : null}
      </div>
      <form onSubmit={submit} className="border-t border-[#102c3d]/[0.08] bg-white p-3">
        <label htmlFor="levytate-contextual-copilot-message" className="sr-only">Message LevyTate Copilot</label>
        <div className="flex items-end gap-2 rounded-xl border border-[#102c3d]/[0.1] bg-[#f8fbfa] p-1.5 focus-within:border-[#0b776e] focus-within:ring-2 focus-within:ring-[#0b776e]/10"><textarea id="levytate-contextual-copilot-message" value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder={copilotPlaceholderFor(context)} className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-[#102c3d] outline-none" /><button disabled={conversationDisabled} aria-label="Ask Copilot" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#102c3d] text-lg font-semibold text-white disabled:opacity-45">↑</button></div>
        {conversationStarted ? <button type="button" onClick={resetConversation} className="mt-1.5 text-xs font-semibold text-[#102c3d]/42">New conversation</button> : null}
      </form>
    </div>;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_18px_46px_rgba(16,44,61,0.045)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Platform Copilot</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Choose the workflow mode</h2>
            </div>
            {role === "Employee" ? (
              <label className="grid gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/52">Employee in focus</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => chooseEmployee(event.target.value)}
                  className="h-11 min-w-[260px] rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-semibold text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
                >
                  {!employees.length ? <option value="">Create an employee first</option> : null}
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} - {employee.jobTitle || "Role to confirm"}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="grid gap-1 rounded-2xl bg-[#f5f8f6] p-1 sm:grid-cols-2 xl:grid-cols-4" aria-label="LevyTate Copilot role">
            {availableAssistantRoles.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeRole(item)}
                className={`min-h-10 rounded-xl px-3 text-xs font-semibold transition ${role === item ? "bg-white text-[#102c3d] shadow-[0_8px_20px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/52 hover:text-[#102c3d]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid min-h-[620px] overflow-hidden rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white shadow-[0_22px_60px_rgba(16,44,61,0.07)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-[#102c3d]/[0.07] px-5 py-4">
            <div>
              <p className="font-semibold">LevyTate Copilot</p>
              <p className="mt-1 text-xs text-[#102c3d]/48">
                {role === "Employee" && selectedEmployee ? `${selectedEmployee.name} - ${selectedEmployee.department}` : `${role} mode`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={resetConversation} className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/52 ring-1 ring-[#102c3d]/[0.08] transition hover:text-[#102c3d] hover:ring-[#159b8f]/20">
                New conversation
              </button>
              {role === "Employee" && selectedPreferredStandard ? (
                <span className="hidden rounded-full bg-[#edf7f3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63] sm:inline-flex">
                  Preferred pathway: {selectedPreferredStandard.title}
                </span>
              ) : null}
              <span className="rounded-full bg-[#edf7f3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">
                {role === "Line Manager"
                  ? latestResponse?.structuredResult ? "Live direct-report data" : "Direct-report scope"
                  : latestResponse?.structuredResult ? "Live LevyTate data" : latestResponse?.source === "openai" ? "Live Copilot" : "Guided mode"}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8fbfa] px-4 py-5 sm:px-5" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`${message.response?.structuredResult ? "w-full max-w-full" : "max-w-[92%] sm:max-w-[82%]"} rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_8px_20px_rgba(16,44,61,0.04)] ${message.role === "user" ? "bg-[#102c3d] text-white" : "bg-white text-[#102c3d]/72 ring-1 ring-[#102c3d]/[0.06]"}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.response ? (
                    <InlineResponse
                      response={message.response}
                      onAction={chooseAction}
                      onQuickReply={(reply) => void sendMessage(reply)}
                      onSelectPathway={role === "Employee" ? selectRecommendedPathway : undefined}
                      selectedPathwayTitle={selectedPreferredStandard?.title ?? null}
                      loading={loading}
                    />
                  ) : null}
                </div>
              </article>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-[#0b6f63] ring-1 ring-[#102c3d]/[0.06]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#159b8f]/25 border-t-[#159b8f]" />
                  Thinking through the next step
                </div>
              </div>
            ) : null}
            {error ? <p className="rounded-xl bg-[#fff4f5] px-4 py-3 text-sm text-[#ad344e] ring-1 ring-[#bf4159]/[0.12]">{error}</p> : null}
          </div>

          <form onSubmit={submit} className="border-t border-[#102c3d]/[0.07] bg-white p-4">
            <label htmlFor="levytate-ai-message" className="sr-only">Message LevyTate Copilot</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                id="levytate-ai-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim() && !loading) void sendMessage(input);
                  }
                }}
                rows={2}
                placeholder="How can I help you today?"
                className="min-h-[54px] flex-1 resize-none rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3 text-sm font-medium leading-6 text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/34 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
              />
              <button disabled={conversationDisabled} className="min-h-[48px] rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">
                {input.trim() ? "Continue conversation" : conversationCtaLabel}
              </button>
            </div>
          </form>
        </div>

        <aside className="border-t border-[#102c3d]/[0.07] bg-white p-5 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Current purpose</p>
          <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{activePurpose}</p>
          {role === "Employee" && selectedEmployee ? (
            <div className="mt-5 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Employee context</p>
              <p className="mt-2 text-sm font-semibold text-[#102c3d]">{selectedEmployee.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{selectedEmployee.jobTitle || selectedRoleRecord?.title || "Role to confirm"} - {selectedEmployee.department} - {selectedEmployee.site || "Site to confirm"}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">Manager: {selectedManagerName}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">Discovery stage: {selectedDevelopmentProfile?.stage === "future_capability" ? "Future capability" : selectedDevelopmentProfile?.stage === "recommendation_ready" ? "Recommendation ready" : "Role context"}</p>
              {selectedApplication ? <p className="mt-2 text-xs font-semibold leading-5 text-[#0b6f63]">Current application: {getApprenticeshipStandard(selectedApplication.apprenticeshipStandardId)?.title ?? selectedApplication.apprenticeshipStandardId} - {selectedApplication.status}</p> : null}
            </div>
          ) : null}
          {employeePrioritySummary.length ? (
            <div className="mt-5 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Employer priorities</p>
              <div className="mt-3 grid gap-2">
                {employeePrioritySummary.map((priority) => (
                  <div key={priority.id} className="rounded-xl bg-white px-3 py-2 text-xs text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.05]">
                    <p className="font-semibold text-[#102c3d]">{priority.name}</p>
                    <p className="mt-1">{priority.importance}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-5 border-t border-[#102c3d]/[0.07] pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Try asking</p>
            <div className="mt-3 grid gap-2">
              {activePrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={loading || (role === "Employee" && !selectedEmployee)} className="rounded-xl bg-[#f8fbfa] px-3.5 py-3 text-left text-xs font-semibold leading-5 text-[#102c3d]/66 ring-1 ring-[#102c3d]/[0.055] transition hover:bg-white hover:text-[#102c3d] hover:ring-[#159b8f]/20 disabled:opacity-50">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <WorkflowDraft response={latestResponse} action={revealedAction} status={actionStatus} />
          {pendingAction ? (
            <div className="mt-5 rounded-2xl border border-[#ffde59]/50 bg-[#fff9dc] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#765f00]">Confirmation required</p>
              <p className="mt-2 text-sm font-semibold text-[#102c3d]">{pendingAction.label}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/58">Review the prepared information before this moves into a product workflow.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirmAction} className="rounded-full bg-[#102c3d] px-3.5 py-2 text-xs font-semibold text-white">Confirm</button>
                <button type="button" onClick={() => setPendingAction(null)} className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.08]">Cancel</button>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}


function inlineConfidenceLabel(score: number | undefined) {
  if ((score ?? 0) >= 78) return "High confidence";
  if ((score ?? 0) >= 62) return "Good confidence";
  return "Developing confidence";
}

function inlineCapabilityStrength(score: number) {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 35) return "Emerging";
  return "Early signal";
}

function inlineUnique(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

function InlineCapabilityBars({ title, items }: { title: string; items: NonNullable<LevyTateAiResponse["recommendationResult"]>["currentCapabilityProfile"] }) {
  const visible = items.filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 6);

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">{title}</p>
      <div className="mt-3 grid gap-2">
        {visible.length ? visible.map((item) => (
          <div key={title + "-" + item.domain} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#102c3d]/68">{item.domain}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/36">{inlineCapabilityStrength(item.score)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#102c3d]/[0.06]">
              <div className="h-full rounded-full bg-[#159b8f]" style={{ width: Math.max(10, Math.min(100, item.score)) + "%" }} />
            </div>
          </div>
        )) : <p className="text-xs leading-5 text-[#102c3d]/50">Evidence is still being gathered.</p>}
      </div>
    </div>
  );
}

function InlineRecommendationTrust({
  response,
  onSelectPathway,
  selectedPathwayTitle,
}: {
  response: LevyTateAiResponse;
  onSelectPathway?: (title: string) => void;
  selectedPathwayTitle?: string | null;
}) {
  const recommendationResult = response.recommendationResult;
  const top = recommendationResult?.topRecommendation ?? recommendationResult?.recommendations[0];
  if (!recommendationResult || !top) return null;

  const strategic = recommendationResult.strategicRecommendation;
  const alternatives = recommendationResult.recommendations.filter((item) => item.pathwayId !== top.pathwayId).slice(0, 2);
  const evidence = inlineUnique([
    ...top.evidence.map((item) => item.label),
    ...top.capabilityFit.filter((item) => item.score >= 55).map((item) => item.domain + " capability detected"),
    ...top.strategicSignals.filter((item) => item.category === "current_capability" || item.category === "future_capability").map((item) => item.label),
  ]).slice(0, 5);
  const priorities = inlineUnique([
    ...(strategic?.organisationPrioritiesInfluenced ?? []),
    ...top.strategicSignals.filter((item) => item.category === "organisation_priority" || item.category === "business_strategy").map((item) => item.label),
  ]).slice(0, 4);
  const missing = inlineUnique([...(top.missingEvidence ?? []), ...(strategic?.missingEvidence ?? [])]).slice(0, 4);
  const questions = inlineUnique([...(top.suggestedQuestions ?? []), ...(strategic?.suggestedQuestions ?? [])]).slice(0, 3);
  const selected = selectedPathwayTitle === top.title;

  return (
    <div className="grid gap-3 rounded-2xl bg-[#f8fbfa] p-3 ring-1 ring-[#102c3d]/[0.055]">
      <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.055]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Why LevyTate recommended this</p>
            <p className="mt-1 text-sm font-semibold text-[#102c3d]">{top.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#102c3d] px-3 py-1.5 text-[11px] font-semibold text-white">{top.recommendationCategory}</span>
            <span className="rounded-full bg-[#edf8f5] px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63]">{inlineConfidenceLabel(top.confidence)}</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#102c3d]/56">
          Career stage detected: {recommendationResult.careerStage}. This route is inside the sensible recommendation envelope for the role, capability evidence and organisation priorities.
        </p>
        {evidence.length ? (
          <div className="mt-3 grid gap-2">
            {evidence.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg bg-[#f8fbfa] px-3 py-2 text-xs leading-5 text-[#102c3d]/62">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#159b8f]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
        {onSelectPathway ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">
              {selected ? "Preferred route selected" : "Set preferred route"}
            </span>
            <button
              type="button"
              onClick={() => onSelectPathway(top.title)}
              className={selected ? "rounded-full bg-[#edf7f3] px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63]" : "rounded-full bg-[#102c3d] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:-translate-y-0.5"}
            >
              {selected ? "Selected" : "Use this pathway"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InlineCapabilityBars title="Current capability" items={recommendationResult.currentCapabilityProfile} />
        <InlineCapabilityBars title="Future capability" items={recommendationResult.futureCapabilityProfile} />
      </div>

      {priorities.length ? (
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Business priorities</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {priorities.map((item) => <span key={item} className="rounded-full bg-[#edf8f5] px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63]">{item}</span>)}
          </div>
        </div>
      ) : null}

      {alternatives.length ? (
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Alternative programmes</p>
          <div className="mt-3 grid gap-2">
            {alternatives.map((item) => (
              <div key={item.pathwayId} className="rounded-lg bg-[#f8fbfa] px-3 py-2 text-xs leading-5 text-[#102c3d]/58">
                <p className="font-semibold text-[#102c3d]">{item.title}</p>
                <p className="mt-1">{item.whyRankedLower[0] ?? item.missingEvidence[0] ?? "Ranked lower because the current evidence is stronger for the top route."}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Missing evidence</p>
          <div className="mt-3 grid gap-2">
            {missing.length ? missing.map((item, index) => (
              <div key={item} className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fbfa] px-3 py-2 text-xs leading-5 text-[#102c3d]/56">
                <span>{item}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#102c3d]/42 ring-1 ring-[#102c3d]/[0.05]">{index % 2 === 0 ? "Ask employee" : "Ask manager"}</span>
              </div>
            )) : <p className="text-xs leading-5 text-[#102c3d]/50">No major evidence gaps are blocking this recommendation.</p>}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Next best questions</p>
          <div className="mt-3 grid gap-2">
            {questions.length ? questions.map((item) => <p key={item} className="rounded-lg bg-[#f8fbfa] px-3 py-2 text-xs leading-5 text-[#102c3d]/56">{item}</p>) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineResponse({
  response,
  onAction,
  onQuickReply,
  onSelectPathway,
  selectedPathwayTitle,
  loading,
}: {
  response: LevyTateAiResponse;
  onAction: (action: LevyTateAiAction) => void;
  onQuickReply: (reply: string) => void;
  onSelectPathway?: (title: string) => void;
  selectedPathwayTitle?: string | null;
  loading: boolean;
}) {
  const actions = responseActions(response);
  const showPathways = (response.shouldShowPathways ?? true) && response.recommendedPathways.length > 0;
  const showActions = (response.shouldShowActions ?? true) && actions.length > 0;
  const showQuickReplies = Boolean(response.quickReplies?.length);
  const showWarning = Boolean(response.applicationWarning);
  const showStructuredResult = Boolean(response.structuredResult);

  if (!showPathways && !showActions && !showQuickReplies && !showWarning && !showStructuredResult) return null;

  return (
    <div className="mt-4 grid gap-3 border-t border-[#102c3d]/[0.07] pt-4">
      {showWarning ? <p className="rounded-xl bg-[#fff9dc] px-3 py-2 text-xs leading-5 text-[#765f00]">{response.applicationWarning}</p> : null}
      {response.structuredResult ? <CopilotStructuredResultView result={response.structuredResult} /> : null}
      {showPathways ? (
        <InlineRecommendationTrust
          response={response}
          onSelectPathway={onSelectPathway}
          selectedPathwayTitle={selectedPathwayTitle}
        />
      ) : null}
      {showActions ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button key={`${action.type}-${action.target ?? ""}`} type="button" onClick={() => onAction(action)} className="rounded-full bg-[#102c3d] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5">
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {showQuickReplies ? (
        <div className="flex flex-wrap gap-2">
          {response.quickReplies?.map((reply) => (
            <button key={reply} type="button" onClick={() => onQuickReply(reply)} disabled={loading} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.16] transition hover:bg-[#edf7f3] disabled:opacity-50">
              {reply}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CopilotStructuredResultView({ result }: { result: NonNullable<LevyTateAiResponse["structuredResult"]> }) {
  const hasRows = result.rows.length > 0;
  const evaluated = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(result.evaluatedAt));
  return (
    <section className="overflow-hidden rounded-xl bg-[#f8fbfa] ring-1 ring-[#102c3d]/[0.07]" aria-label={result.title}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#102c3d]/[0.06] px-3 py-3">
        <div>
          <p className="text-xs font-semibold text-[#102c3d]">{result.title}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#102c3d]/48">{result.totalCount} result{result.totalCount === 1 ? "" : "s"}{result.truncated ? `, showing ${result.rows.length}` : ""}</p>
        </div>
        <div className="text-right">
          <span className="inline-flex rounded-full bg-[#e8f6f1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0b6f63]">{result.dataLabel}</span>
          <p className="mt-1 text-[10px] text-[#102c3d]/38">As of {evaluated}</p>
        </div>
      </div>
      {hasRows ? (
        <>
          <div className="hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-white text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/42">
                <tr>{result.columns.map((column) => <th key={column.key} className={`px-3 py-2.5 ${column.align === "right" ? "text-right" : "text-left"}`}>{column.label}</th>)}<th className="px-3 py-2.5 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[#102c3d]/[0.055]">
                {result.rows.map((row) => (
                  <tr key={row.key} className="bg-[#f8fbfa] align-top">
                    {result.columns.map((column) => <td key={column.key} className={`max-w-[240px] px-3 py-3 leading-5 text-[#102c3d]/66 ${column.align === "right" ? "text-right font-semibold text-[#102c3d]" : "text-left"}`}>{row.cells[column.key] ?? "Not recorded"}</td>)}
                    <td className="px-3 py-3 text-right"><ResultActions actions={row.actions} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {result.rows.map((row) => (
              <article key={row.key} className="rounded-xl bg-white p-3 ring-1 ring-[#102c3d]/[0.06]">
                <dl className="grid gap-2">
                  {result.columns.map((column) => (
                    <div key={column.key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-xs leading-5">
                      <dt className="font-semibold text-[#102c3d]/42">{column.label}</dt>
                      <dd className="min-w-0 break-words text-[#102c3d]/68">{row.cells[column.key] ?? "Not recorded"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3"><ResultActions actions={row.actions} /></div>
              </article>
            ))}
          </div>
        </>
      ) : <p className="px-3 py-4 text-xs leading-5 text-[#102c3d]/58">{result.emptyMessage}</p>}
      {result.interpretation || result.viewAllUrl ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#102c3d]/[0.06] bg-white px-3 py-3">
          {result.interpretation ? <p className="max-w-2xl text-[11px] leading-5 text-[#102c3d]/50">{result.interpretation}</p> : <span />}
          {result.viewAllUrl ? <a href={result.viewAllUrl} className="text-xs font-semibold text-[#0b6f63] hover:underline">View all results</a> : null}
        </div>
      ) : null}
    </section>
  );
}

function ResultActions({ actions }: { actions: Array<{ label: string; url: string }> | undefined }) {
  if (!actions?.length) return <span className="text-[11px] text-[#102c3d]/36">No action</span>;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.slice(0, 2).map((action) => <a key={`${action.label}-${action.url}`} href={action.url} className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.16] transition hover:bg-[#edf7f3]">{action.label}</a>)}
    </div>
  );
}

function WorkflowDraft({ response, action, status }: { response: LevyTateAiResponse | null; action: LevyTateAiAction | null; status: string }) {
  if (!response || !action) return null;
  const applicationDraft = response.applicationDraft ?? response.applicationPrefill;
  const showApplication = action.type === "start_application" || action.type === "draft_application_reason";
  const showManager = action.type === "prepare_manager_message";
  const showProvider = action.type === "request_provider_matching";
  const showRationale = action.type === "prepare_approval_rationale";
  const showAdminTask = action.type === "create_admin_follow_up_task";

  return (
    <div className="mt-5 border-t border-[#102c3d]/[0.07] pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Prepared next step</p>
      <div className="mt-3 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
        {showApplication && applicationDraft ? (
          <div className="grid gap-2 text-xs leading-5 text-[#102c3d]/60">
            <p className="font-semibold text-[#102c3d]">{applicationDraft.selectedApprenticeship}</p>
            <p>{applicationDraft.reasonForInterest}</p>
          </div>
        ) : null}
        {showManager && response.managerMessageDraft ? <p className="text-xs leading-5 text-[#102c3d]/62">{response.managerMessageDraft}</p> : null}
        {showProvider && response.providerMatchDraft ? (
          <div className="grid gap-2 text-xs leading-5 text-[#102c3d]/60">
            <p className="font-semibold text-[#102c3d]">{response.providerMatchDraft.roleFamily}</p>
            <p>{response.providerMatchDraft.providerName} | {response.providerMatchDraft.recommendedProgramme}</p>
            <p>{response.providerMatchDraft.matchScore}% match | {response.providerMatchDraft.linkedStandard}</p>
            <p>{response.providerMatchDraft.notes}</p>
          </div>
        ) : null}
        {showRationale ? <p className="text-xs leading-5 text-[#102c3d]/62">{response.assistantMessage}</p> : null}
        {showAdminTask && response.providerMatchDraft ? <p className="text-xs leading-5 text-[#102c3d]/62">Follow up on {response.providerMatchDraft.roleFamily}: {response.providerMatchDraft.notes}</p> : null}
        {!showApplication && !showManager && !showProvider && !showRationale && !showAdminTask ? <p className="text-xs leading-5 text-[#102c3d]/60">{action.label} is ready to continue in the relevant LevyTate workspace.</p> : null}
        {status ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#0b6f63] ring-1 ring-[#159b8f]/[0.1]">{status}</p> : null}
      </div>
    </div>
  );
}
