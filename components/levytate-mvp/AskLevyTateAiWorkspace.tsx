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
} from "@/lib/levytate/ai/types";
import { updateEmployeeDiscovery } from "@/lib/levytate/mvp/progressive-profiling";
import { activeApplicationStatuses, createEmployeeDevelopmentProfile, nowIso } from "@/lib/levytate/mvp/workspace";

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
    purpose: "Explore pathways, prepare application answers and plan a manager conversation.",
    welcome: "Create or select an employee, then I will guide the discovery one useful question at a time.",
    prompts: [
      "What could help this employee move into more reporting and automation work?",
      "Which pathway fits someone who wants to improve productivity with AI?",
      "Help me prepare a manager conversation.",
      "Compare the strongest pathway against one alternative.",
    ],
  },
  "Line Manager": {
    purpose: "Review development requests and understand role fit, commitment and business benefit.",
    welcome: "I can help you think through a direct report's application without making the decision for you. Share the role, pathway and business need you are weighing up.",
    prompts: [
      "What should I consider before approving a Data Technician application?",
      "Help me assess the business benefit for this request.",
      "What questions should I ask the employee?",
      "Prepare a balanced approval rationale.",
    ],
  },
  "Apprenticeship Lead": {
    purpose: "Map roles to specialist pathways and prepare controlled provider matching requests.",
    welcome: "Describe the role, capability gap and intended outcome. I will help distinguish the strongest specialist route from plausible alternatives before provider matching is considered.",
    prompts: [
      "What pathway suits a Procurement Lead?",
      "Which specialist route fits a Maintenance Manager?",
      "Compare Data Technician and Business Analyst for operations roles.",
      "Draft a provider matching request for a procurement cohort.",
    ],
  },
  "LevyTate Admin": {
    purpose: "Prepare provider matching notes, controlled shortlist criteria and internal next actions.",
    welcome: "Share the employer need and I will help structure the matching brief, identify what evidence is missing and prepare the next internal action. Catalogue entries remain candidates until reviewed.",
    prompts: [
      "Prepare matching criteria for a Procurement Lead pathway.",
      "What information is missing before we shortlist providers?",
      "Draft internal provider matching notes.",
      "Create a follow-up task for a data apprenticeship enquiry.",
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

export function AskLevyTateAiWorkspace({ initialEmployeeId = null }: { initialEmployeeId?: string | null }) {
  const { data, saveEmployeeDevelopmentProfile } = useMvpWorkspace();
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
    if (!selectedEmployee?.managerId) return "Line manager to confirm";
    return data.employees.find((employee) => employee.id === selectedEmployee.managerId)?.name ?? "Line manager to confirm";
  }, [data.employees, selectedEmployee?.managerId]);

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

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const activeRole = role;
    if (activeRole === "Employee" && !selectedEmployee) {
      setError("Select an employee before starting the guided recommendation conversation.");
      return;
    }

    const roleMessages = conversations[activeRole];
    const userMessage: ChatMessage = { id: messageId(), role: "user", content: trimmed };
    const nextMessages = [...roleMessages, userMessage];
    const conversationHistory: LevyTateConversationMessage[] = roleMessages
      .filter((item) => !item.id.startsWith("welcome-"))
      .map(({ role: messageRole, content }) => ({ role: messageRole, content }));

    const roleRecord = activeRole === "Employee" ? selectedRoleRecord : null;
    const developmentProfile = activeRole === "Employee" && selectedEmployee
      ? updateEmployeeDiscovery(selectedDevelopmentProfile ?? createEmployeeDevelopmentProfile(selectedEmployee.id), selectedEmployee.id, trimmed)
      : null;
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
      selectedEmployee: activeRole === "Employee" ? selectedEmployee?.name : undefined,
      selectedSite: activeRole === "Employee" ? selectedEmployee?.site || data.profile.defaultSite || "All sites" : data.profile.defaultSite || "All sites",
      currentSection: "Ask LevyTate AI",
      userMessage: trimmed,
      conversationHistory,
      conversationProfile: activeRole === "Employee" ? selectedDevelopmentProfile?.conversationProfile ?? undefined : profiles[activeRole] ?? undefined,
      previousRecommendationResult: activeRole === "Employee" ? selectedDevelopmentProfile?.recommendationResult ?? null : recommendationResults[activeRole],
      employerContext: data.profile.employerName || "LevyTate beta workspace",
      currentWorkspace: {
        employerName: data.profile.employerName || "LevyTate beta workspace",
        selectedSite: activeRole === "Employee" ? selectedEmployee?.site || data.profile.defaultSite || "All sites" : data.profile.defaultSite || "All sites",
        activeModule: "Ask LevyTate AI",
      },
      currentApplication: activeRole === "Employee" && selectedEmployee
        ? buildCurrentApplicationSummary(
            selectedApplication ?? undefined,
            selectedEmployee,
            selectedManagerName,
            selectedApplication ? getApprenticeshipStandard(selectedApplication.apprenticeshipStandardId)?.title ?? selectedApplication.apprenticeshipStandardId : "No active application",
            selectedApplicationIndex >= 0 ? selectedApplicationIndex : 0,
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
          deliveryModel: provider.deliveryModel,
          verificationStatus: provider.verificationStatus,
        })),
      employerPriorities: data.profile.priorities.map((priority) => ({ name: priority.name, importance: priority.importance })),
      employeeDiscovery: developmentProfile && selectedEmployee
        ? {
            roleTitle: selectedEmployee.jobTitle || roleRecord?.title || undefined,
            department: selectedEmployee.department,
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
      preferredStandardId: activeRole === "Employee" ? selectedDevelopmentProfile?.preferredStandardId || undefined : undefined,
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
      if (!response.ok) throw new Error(result.message || "Ask LevyTate AI could not respond.");

      const content = [result.assistantMessage, result.followUpQuestion].filter(Boolean).join("\n\n");
      const assistantMessage: ChatMessage = { id: messageId(), role: "assistant", content, response: result };
      setConversations((current) => ({ ...current, [activeRole]: [...current[activeRole], assistantMessage] }));
      setProfiles((current) => ({ ...current, [activeRole]: result.conversationProfile ?? current[activeRole] ?? null }));
      setRecommendationResults((current) => ({ ...current, [activeRole]: result.recommendationResult ?? current[activeRole] ?? null }));

      if (activeRole === "Employee" && selectedEmployee && developmentProfile) {
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
      setError(requestError instanceof Error ? requestError.message : "Ask LevyTate AI could not respond.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function chooseAction(action: LevyTateAiAction) {
    setActionStatus("");
    if (action.requiresConfirmation) {
      setPendingAction(action);
      setRevealedAction(null);
      return;
    }
    setPendingAction(null);
    setRevealedAction(action);
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

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_18px_46px_rgba(16,44,61,0.045)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Role-aware guidance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Choose the conversation mode</h2>
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
          <div className="grid gap-1 rounded-2xl bg-[#f5f8f6] p-1 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ask LevyTate AI role">
            {assistantRoles.map((item) => (
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
              <p className="font-semibold">Ask LevyTate AI</p>
              <p className="mt-1 text-xs text-[#102c3d]/48">
                {role === "Employee" && selectedEmployee ? `${selectedEmployee.name} - ${selectedEmployee.department}` : `${role} mode`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {role === "Employee" && selectedPreferredStandard ? (
                <span className="hidden rounded-full bg-[#edf7f3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63] sm:inline-flex">
                  Preferred pathway: {selectedPreferredStandard.title}
                </span>
              ) : null}
              <span className="rounded-full bg-[#edf7f3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">
                {latestResponse?.source === "openai" ? "Live GenAI" : "Guided mode"}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8fbfa] px-4 py-5 sm:px-5" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_8px_20px_rgba(16,44,61,0.04)] sm:max-w-[82%] ${message.role === "user" ? "bg-[#102c3d] text-white" : "bg-white text-[#102c3d]/72 ring-1 ring-[#102c3d]/[0.06]"}`}>
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
            <label htmlFor="levytate-ai-message" className="sr-only">Message Ask LevyTate AI</label>
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
                placeholder={role === "Employee" ? "Answer the current discovery question or ask for guidance" : "Describe the role, goal or decision you are working through"}
                className="min-h-[54px] flex-1 resize-none rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3 text-sm font-medium leading-6 text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/34 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
              />
              <button disabled={!input.trim() || loading} className="min-h-[48px] rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">
                Send
              </button>
            </div>
          </form>
        </div>

        <aside className="border-t border-[#102c3d]/[0.07] bg-white p-5 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Current purpose</p>
          <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{roleContent[role].purpose}</p>
          {role === "Employee" && selectedEmployee ? (
            <div className="mt-5 rounded-2xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Employee context</p>
              <p className="mt-2 text-sm font-semibold text-[#102c3d]">{selectedEmployee.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{selectedEmployee.jobTitle || selectedRoleRecord?.title || "Role to confirm"} - {selectedEmployee.department} - {selectedEmployee.site || "Site to confirm"}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">Manager: {selectedManagerName}</p>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">Discovery stage: {selectedDevelopmentProfile?.stage === "future_capability" ? "Future capability" : selectedDevelopmentProfile?.stage === "recommendation_ready" ? "Recommendation ready" : "Role context"}</p>
              {selectedApplication ? <p className="mt-2 text-xs font-semibold leading-5 text-[#0b6f63]">Current application: {getApprenticeshipStandard(selectedApplication.apprenticeshipStandardId)?.title ?? selectedApplication.apprenticeshipStandardId}</p> : null}
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
              {roleContent[role].prompts.map((prompt) => (
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

  if (!showPathways && !showActions && !showQuickReplies && !showWarning) return null;

  return (
    <div className="mt-4 grid gap-3 border-t border-[#102c3d]/[0.07] pt-4">
      {showWarning ? <p className="rounded-xl bg-[#fff9dc] px-3 py-2 text-xs leading-5 text-[#765f00]">{response.applicationWarning}</p> : null}
      {showPathways ? (
        <div className="grid gap-2">
          {response.recommendedPathways.slice(0, 3).map((pathway) => {
            const selected = selectedPathwayTitle === pathway.title;
            return (
              <div key={pathway.title} className="rounded-xl bg-[#f8fbfa] px-3 py-2.5 ring-1 ring-[#102c3d]/[0.055] transition-all duration-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#102c3d]">{pathway.title}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {typeof pathway.scoreDelta === "number" && pathway.scoreDelta !== 0 ? (
                      <span className="rounded-full bg-[#edf7f3] px-1.5 py-0.5 text-[10px] font-semibold text-[#0b6f63]">
                        {pathway.scoreDelta > 0 ? "+" : ""}{pathway.scoreDelta}%
                      </span>
                    ) : null}
                    {pathway.fit ? <span className="text-xs font-semibold text-[#0b6f63]">{pathway.fit}% fit</span> : null}
                  </div>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{pathway.reason}</p>
                {pathway.evidence?.length ? (
                  <details className="mt-2 text-xs text-[#102c3d]/58">
                    <summary className="cursor-pointer font-semibold text-[#0b6f63]">Why this score?</summary>
                    <ul className="mt-2 grid gap-1">
                      {pathway.evidence.slice(0, 4).map((item) => <li key={item}>+ {item}</li>)}
                    </ul>
                  </details>
                ) : null}
                {onSelectPathway ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">
                      {selected ? "Preferred route selected" : "Set preferred route"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectPathway(pathway.title)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${selected ? "bg-[#edf7f3] text-[#0b6f63]" : "bg-[#102c3d] text-white hover:-translate-y-0.5"}`}
                    >
                      {selected ? "Selected" : "Use this pathway"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
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
            <p>{response.providerMatchDraft.recommendedStandard}</p>
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
