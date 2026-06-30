import {
  createEmployeeDevelopmentProfile,
  nowIso,
  type MvpEmployeeDevelopmentProfile,
  type MvpEmployerPriority,
} from "@/lib/levytate/mvp/workspace";

type Signal = {
  label: string;
  pattern: RegExp;
};

const skillSignals: Signal[] = [
  { label: "Reporting", pattern: /\b(report|reporting|dashboard|management information)\b/i },
  { label: "Spreadsheets", pattern: /\b(excel|spreadsheet|pivot|formula)\b/i },
  { label: "Customer service", pattern: /\b(customer|client|complaint|service)\b/i },
  { label: "Planning", pattern: /\b(plan|planning|schedule|coordinate)\b/i },
  { label: "Problem solving", pattern: /\b(problem|resolve|troubleshoot|investigate)\b/i },
  { label: "Stakeholder communication", pattern: /\b(stakeholder|supplier|colleague|communicat)\b/i },
  { label: "Engineering", pattern: /\b(engineer|maintenance|technical|machine)\b/i },
  { label: "Procurement", pattern: /\b(procurement|buying|buyer|supplier|sourcing)\b/i },
];

const functionSignals: Signal[] = [
  { label: "Administration", pattern: /\b(admin|records|documents|data entry)\b/i },
  { label: "Data and reporting", pattern: /\b(data|report|spreadsheet|dashboard|insight)\b/i },
  { label: "Operations", pattern: /\b(operation|production|delivery|workflow|process)\b/i },
  { label: "Customer experience", pattern: /\b(customer|client|service|complaint)\b/i },
  { label: "Engineering and maintenance", pattern: /\b(engineer|maintenance|technical|machine)\b/i },
  { label: "Commercial and procurement", pattern: /\b(procurement|buyer|supplier|commercial|sourcing)\b/i },
  { label: "Projects and change", pattern: /\b(project|change|improvement|implementation)\b/i },
];

const capabilitySignals: Signal[] = [
  { label: "Uses digital systems", pattern: /\b(crm|system|software|digital|platform)\b/i },
  { label: "Produces business information", pattern: /\b(report|dashboard|analysis|insight)\b/i },
  { label: "Coordinates work", pattern: /\b(coordinate|schedule|plan|organise)\b/i },
  { label: "Supports operational decisions", pattern: /\b(decision|performance|target|kpi)\b/i },
  { label: "Improves processes", pattern: /\b(improve|streamline|optimise|reduce waste)\b/i },
];

const futureSignals: Signal[] = [
  { label: "Lead improvement projects", pattern: /\b(lead|own|manage).{0,30}\b(project|improvement|change)\b/i },
  { label: "Use AI in the role", pattern: /\b(ai|artificial intelligence|copilot|chatgpt)\b/i },
  { label: "Automate workflows", pattern: /\b(automat|workflow|manual process)\b/i },
  { label: "Build stronger data capability", pattern: /\b(data|analysis|analytics|reporting|dashboard)\b/i },
  { label: "Progress into technical responsibility", pattern: /\b(technical|engineer|maintenance|specialist)\b/i },
  { label: "Take greater ownership", pattern: /\b(responsibility|ownership|confident|independent)\b/i },
  { label: "Improve customer outcomes", pattern: /\b(customer|service|experience|complaint)\b/i },
];

function unique(values: string[], limit = 12) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function detected(text: string, signals: Signal[]) {
  return signals.filter((signal) => signal.pattern.test(text)).map((signal) => signal.label);
}

function meaningfulSentences(text: string) {
  return unique(
    text
      .split(/[.!?\n]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 12),
    8,
  );
}

export function updateEmployeeDiscovery(
  existing: MvpEmployeeDevelopmentProfile | undefined,
  employeeId: string,
  message: string,
): MvpEmployeeDevelopmentProfile {
  const current = existing ?? createEmployeeDevelopmentProfile(employeeId);
  const isRoleAnswer = current.stage === "role_context";
  const isFutureAnswer = current.stage === "future_capability";
  const sentences = meaningfulSentences(message);
  const hasLearningIntent = /\b(learn|develop|improve|progress|confidence|responsibility|capability)\b/i.test(message);

  return {
    ...current,
    stage: isRoleAnswer ? "future_capability" : "recommendation_ready",
    responsibilities: isRoleAnswer ? unique([...current.responsibilities, ...sentences]) : current.responsibilities,
    currentSkills: unique([...current.currentSkills, ...detected(message, skillSignals)]),
    businessFunctions: unique([...current.businessFunctions, ...detected(message, functionSignals)]),
    currentCapabilities: unique([...current.currentCapabilities, ...detected(message, capabilitySignals)]),
    apprenticeshipIndicators: unique([
      ...current.apprenticeshipIndicators,
      ...(hasLearningIntent ? ["Work-based capability development identified"] : []),
      ...(/\b(project|improvement|change|new responsibility)\b/i.test(message) ? ["Opportunity for applied workplace evidence"] : []),
    ]),
    aiOpportunities: unique([
      ...current.aiOpportunities,
      ...(/\b(ai|artificial intelligence|copilot|chatgpt)\b/i.test(message) ? ["Practical AI adoption"] : []),
    ]),
    dataOpportunities: unique([
      ...current.dataOpportunities,
      ...(/\b(data|report|spreadsheet|dashboard|analysis)\b/i.test(message) ? ["Data quality, reporting and insight"] : []),
    ]),
    automationOpportunities: unique([
      ...current.automationOpportunities,
      ...(/\b(automat|manual|repetitive|workflow|process)\b/i.test(message) ? ["Workflow and process automation"] : []),
    ]),
    futureCapabilities: isFutureAnswer
      ? unique([...current.futureCapabilities, ...detected(message, futureSignals), ...sentences])
      : current.futureCapabilities,
    updatedAt: nowIso(),
  };
}

export function employerPriorityContext(priorities: MvpEmployerPriority[]) {
  return priorities
    .map((priority) => `${priority.name} (${priority.importance})${priority.detail ? `: ${priority.detail}` : ""}`)
    .join("; ");
}

export function discoveryEvidence(profile: MvpEmployeeDevelopmentProfile | undefined) {
  if (!profile) return [];
  return unique([
    ...profile.responsibilities,
    ...profile.currentSkills,
    ...profile.businessFunctions,
    ...profile.currentCapabilities,
    ...profile.apprenticeshipIndicators,
    ...profile.aiOpportunities,
    ...profile.dataOpportunities,
    ...profile.automationOpportunities,
    ...profile.futureCapabilities,
  ], 30);
}
