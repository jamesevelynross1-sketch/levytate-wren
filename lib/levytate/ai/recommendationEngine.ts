import type {
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateCapabilityFit,
  LevyTateCapabilityScore,
  LevyTatePlatformRecommendation,
  LevyTateRecommendationEvidence,
  LevyTateRecommendationResult,
  LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";

type CapabilityDomain =
  | "data_analysis"
  | "sql"
  | "reporting_bi"
  | "data_visualisation"
  | "data_management"
  | "automation"
  | "ai_adoption"
  | "cyber"
  | "software_development"
  | "business_analysis"
  | "project_delivery"
  | "process_improvement"
  | "leadership"
  | "customer_service"
  | "digital_support"
  | "procurement"
  | "engineering"
  | "manufacturing"
  | "construction"
  | "hr"
  | "administration";

type CapabilitySignal = { id: string; label: string; weight: number; pattern: RegExp };
type CapabilityDefinition = { domain: CapabilityDomain; label: string; missingEvidence: string; signals: CapabilitySignal[] };
type CapabilityState = { score: number; evidence: string[]; missingEvidence: string[] };
type CapabilityMap = Map<CapabilityDomain, LevyTateCapabilityScore>;

type PathwayDefinition = {
  pathwayId: string;
  title: string;
  standard: string;
  baseScore: number;
  rationale: string;
  capabilityWeights: Partial<Record<CapabilityDomain, number>>;
};

const recommendationEngineVersion = "2-capability";
const revealThreshold = 74;

function capability(domain: CapabilityDomain, label: string, missingEvidence: string, signals: CapabilitySignal[]): CapabilityDefinition {
  return { domain, label, missingEvidence, signals };
}

function signal(id: string, label: string, weight: number, pattern: RegExp): CapabilitySignal {
  return { id, label, weight, pattern };
}

const capabilityDefinitions: CapabilityDefinition[] = [
  capability("data_analysis", "Data analysis", "Analytical responsibility or insight work not yet confirmed.", [
    signal("data-analyst-role", "Role is data or insight focused", 34, /\b(data analyst|reporting analyst|business intelligence|bi analyst|insight analyst)\b/i),
    signal("analysis-work", "Works with analysis or insight", 18, /\b(analysis|analytics|analytical|insight|trends?|patterns?)\b/i),
    signal("data-focus", "Mentions data-led work", 10, /\b(data-led|data focused|data role|data work|using data)\b/i),
  ]),
  capability("sql", "SQL", "SQL, database querying or structured data evidence not yet confirmed.", [
    signal("sql", "SQL or querying evidence", 34, /\b(sql|database quer(?:y|ies)|queries|querying|relational data)\b/i),
    signal("database", "Database work mentioned", 18, /\b(database|data warehouse|warehouse|tables?)\b/i),
  ]),
  capability("reporting_bi", "Reporting & BI", "Reporting, dashboards or BI ownership not yet confirmed.", [
    signal("power-bi", "Power BI or dashboard work", 32, /\b(power\s?bi|dashboard|dashboards|tableau|looker)\b/i),
    signal("reporting", "Reporting responsibility", 24, /\b(reporting|reports?|kpis?|management information|mi)\b/i),
    signal("spreadsheet-reporting", "Spreadsheet reporting evidence", 14, /\b(excel|spreadsheet|spreadsheets|pivot|vlookup)\b/i),
  ]),
  capability("data_visualisation", "Data visualisation", "Visualisation or data storytelling evidence not yet confirmed.", [
    signal("visualisation", "Visualises data for decisions", 26, /\b(visuali[sz]ation|data storytelling|charts?|graphs?|dashboards?)\b/i),
    signal("power-bi-visual", "Uses BI visual tools", 18, /\b(power\s?bi|tableau|looker)\b/i),
  ]),
  capability("data_management", "Data management", "Data quality, records or governance evidence not yet confirmed.", [
    signal("data-quality", "Data quality or governance work", 24, /\b(data quality|data governance|clean data|master data|data accuracy)\b/i),
    signal("crm-records", "CRM or records administration", 18, /\b(crm|records?|systems data|customer data|employee data)\b/i),
  ]),
  capability("automation", "Automation", "Workflow automation or manual process reduction evidence not yet confirmed.", [
    signal("automation", "Interested in automation", 28, /\b(automation|automate|automating|workflow automation|reduce manual|manual process)\b/i),
    signal("workflow", "Wants workflow improvement", 16, /\b(workflow|process admin|repeatable process|streamline)\b/i),
  ]),
  capability("ai_adoption", "AI adoption", "AI adoption, AI productivity or prompt use evidence not yet confirmed.", [
    signal("ai", "Interested in AI adoption", 28, /\b(ai|artificial intelligence|genai|generative ai|chatgpt|copilot|prompting)\b/i),
    signal("ai-productivity", "Wants AI for productivity", 18, /\b(ai productivity|use ai|ai tools|ai adoption)\b/i),
  ]),
  capability("cyber", "Cyber", "Cyber security or secure systems evidence not yet confirmed.", [
    signal("cyber", "Cyber security interest", 30, /\b(cyber|cybersecurity|security|secure systems|information security)\b/i),
    signal("network-security", "Network security context", 16, /\b(network security|firewall|access control|endpoint)\b/i),
  ]),
  capability("software_development", "Software development", "Coding, software or application development evidence not yet confirmed.", [
    signal("developer", "Software development role or goal", 32, /\b(software developer|developer|coding|programming|build apps?|application development)\b/i),
    signal("code-tools", "Uses development tools or languages", 18, /\b(javascript|typescript|python|api|github|code)\b/i),
  ]),
  capability("business_analysis", "Business analysis", "Requirements, process mapping or change analysis evidence not yet confirmed.", [
    signal("business-analysis", "Business analysis interest", 32, /\b(business analyst|business analysis|requirements|requirements gathering)\b/i),
    signal("process-mapping", "Process mapping or stakeholder analysis", 20, /\b(process mapping|stakeholder analysis|user stories|change impact)\b/i),
  ]),
  capability("project_delivery", "Project delivery", "Project planning, risk or delivery ownership evidence not yet confirmed.", [
    signal("project-management", "Project delivery responsibility", 30, /\b(project management|project manager|project delivery|manage projects|project coordinator)\b/i),
    signal("planning-risk", "Planning, coordination or risk work", 18, /\b(planning|coordination|work packages|risk management|milestones?)\b/i),
  ]),
  capability("process_improvement", "Process improvement", "Lean, continuous improvement or operational excellence evidence not yet confirmed.", [
    signal("continuous-improvement", "Continuous improvement focus", 32, /\b(continuous improvement|process improvement|lean|six sigma|kaizen)\b/i),
    signal("operational-performance", "Operational performance improvement", 22, /\b(operational performance|efficiency|productivity|waste|downtime|root cause)\b/i),
  ]),
  capability("leadership", "Leadership", "People leadership, coaching or team management evidence not yet confirmed.", [
    signal("people-leadership", "People leadership responsibility", 24, /\b(team leader|supervisor|manager|line manage|people management|coaching)\b/i),
    signal("leadership-goal", "Leadership development goal", 16, /\b(leadership|lead a team|progression into management|develop my team)\b/i),
  ]),
  capability("customer_service", "Customer service", "Customer handling, complaints or customer experience evidence not yet confirmed.", [
    signal("customer-role", "Customer-facing role", 32, /\b(customer service|customer support|customer advisor|customer experience|client service|customers?)\b/i),
    signal("service-improvement", "Service quality or complaints work", 18, /\b(complaints?|service improvement|customer outcomes|account handling)\b/i),
  ]),
  capability("digital_support", "Digital support", "IT support, user support or digital service evidence not yet confirmed.", [
    signal("it-support", "IT or digital support role", 34, /\b(it support|ict technician|digital support|helpdesk|service desk|user support)\b/i),
    signal("technical-support", "Technical support or infrastructure work", 22, /\b(network|infrastructure|devices?|hardware|software support|troubleshooting)\b/i),
  ]),
  capability("procurement", "Procurement", "Procurement, sourcing or supplier management evidence not yet confirmed.", [
    signal("procurement-role", "Procurement or buying role", 38, /\b(procurement|buyer|buying|sourcing|commercial procurement)\b/i),
    signal("supplier-contract", "Supplier or contract work", 22, /\b(supplier|contract management|tender|commercial|supply chain)\b/i),
  ]),
  capability("engineering", "Engineering", "Engineering, maintenance or technical fault-finding evidence not yet confirmed.", [
    signal("engineering", "Engineering or maintenance role", 34, /\b(engineer|engineering|maintenance|fault finding|technical maintenance)\b/i),
    signal("technical-equipment", "Technical equipment or systems work", 18, /\b(equipment|machinery|technical systems|plant)\b/i),
  ]),
  capability("manufacturing", "Manufacturing", "Manufacturing, production or quality evidence not yet confirmed.", [
    signal("manufacturing", "Manufacturing or production context", 32, /\b(manufacturing|production|factory|assembly|quality checks?)\b/i),
    signal("operations", "Operational team context", 14, /\b(operations|operational team|shop floor|line)\b/i),
  ]),
  capability("construction", "Construction", "Construction, site supervision or built environment evidence not yet confirmed.", [
    signal("construction", "Construction or site delivery work", 34, /\b(construction|site supervisor|site supervision|built environment|site delivery)\b/i),
    signal("handover-quality", "Handover, safety or site quality evidence", 18, /\b(handover|site safety|snagging|quality control)\b/i),
  ]),
  capability("hr", "HR", "HR advisory, employee relations or recruitment evidence not yet confirmed.", [
    signal("hr-role", "HR role or responsibility", 36, /\b(hr advisor|human resources|employee relations|recruitment|people policy|hr support)\b/i),
    signal("people-process", "People process or policy work", 18, /\b(onboarding|absence|performance process|policy)\b/i),
  ]),
  capability("administration", "Administration", "Business support or administration evidence not yet confirmed.", [
    signal("admin-role", "Business support or administration role", 34, /\b(admin assistant|administrator|administration|business support|office coordinator)\b/i),
    signal("admin-processes", "Process administration work", 18, /\b(scheduling|records|crm updates|document control|process admin)\b/i),
  ]),
];

function pathway(standardId: string, baseScore: number, rationale: string, capabilityWeights: Partial<Record<CapabilityDomain, number>>): PathwayDefinition {
  const standard = getApprenticeshipStandard(standardId);
  if (!standard) throw new Error("Unknown apprenticeship standard: " + standardId);
  return { pathwayId: standard.id, title: "Level " + standard.level + " " + standard.title, standard: standard.title, baseScore, rationale, capabilityWeights };
}

const pathwayCatalogue: PathwayDefinition[] = [
  pathway("ST0118", 20, "Best where the role combines analysis, SQL, BI reporting, visualisation and business insight ownership.", { data_analysis: 24, sql: 18, reporting_bi: 22, data_visualisation: 14, data_management: 10, business_analysis: 8 }),
  pathway("ST0795", 28, "Best where the role needs practical data handling, reporting, spreadsheets, CRM data quality and repeatable operational insight.", { data_analysis: 18, reporting_bi: 24, data_management: 22, data_visualisation: 4, administration: 16, automation: 10 }),
  pathway("ST0117", 20, "Best where the role needs requirements discovery, process analysis, stakeholder engagement and systems change capability.", { business_analysis: 28, project_delivery: 12, process_improvement: 12, data_analysis: 8, digital_support: 6 }),
  pathway("ST0310", 19, "Best where the role needs project planning, risk control, stakeholder coordination and accountable delivery.", { project_delivery: 32, business_analysis: 10, leadership: 8, process_improvement: 8 }),
  pathway("ST0313", 24, "Best where the role needs sourcing, supplier management, commercial judgement and procurement practice.", { procurement: 42, business_analysis: 8, project_delivery: 6, data_analysis: 5 }),
  pathway("ST0071", 23, "Best where the role needs complex customer handling, service quality and ownership of customer outcomes.", { customer_service: 40, data_management: 8, leadership: 6, process_improvement: 6 }),
  pathway("ST0120", 22, "Best where the role supports colleagues with digital systems, user needs, digital processes and practical workplace technology.", { digital_support: 34, customer_service: 10, data_management: 8, automation: 8, cyber: 6 }),
  pathway("ST0973", 22, "Best where the role is closer to ICT support, infrastructure, networking, devices and technical troubleshooting.", { digital_support: 32, cyber: 12, software_development: 6, customer_service: 6 }),
  pathway("ST0116", 20, "Best where the role is focused on coding, building software, APIs, testing and application development.", { software_development: 42, sql: 8, digital_support: 6, automation: 6 }),
  pathway("ST0070", 10, "Best where the role needs broad business administration, records, coordination and operational support capability.", { administration: 18, customer_service: 8, data_management: 4, reporting_bi: 3 }),
  pathway("ST0239", 22, "Best where the role needs HR administration, policy support, employee relations confidence and people process capability.", { hr: 40, administration: 8, customer_service: 6, data_management: 5 }),
  pathway("ST0192", 18, "Best where the role is explicitly focused on continuous improvement, lean practice, operational performance and measurable process change.", { process_improvement: 42, manufacturing: 10, engineering: 8, automation: 6, leadership: 5 }),
  pathway("ST0457", 23, "Best where the role needs applied engineering, maintenance, technical evidence and manufacturing workplace competence.", { engineering: 34, manufacturing: 16, process_improvement: 6, automation: 4 }),
  pathway("ST0048", 22, "Best where the role needs construction site supervision, safety, quality control and built environment delivery.", { construction: 40, project_delivery: 8, leadership: 6 }),
];

function clamp(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function uniqueText(parts: Array<string | null | undefined>) {
  return [...new Set(parts.filter((part): part is string => Boolean(part?.trim())).map((part) => part.trim()))].join("\n");
}

function conversationText(request: LevyTateAiRequest) {
  return uniqueText([
    ...request.conversationHistory.filter((message) => message.role === "user").map((message) => message.content),
    request.userMessage,
    request.conversationProfile?.currentRole,
    request.conversationProfile?.currentDepartment,
    request.conversationProfile?.careerGoal,
    request.conversationProfile?.reasonForDevelopment,
    ...(request.conversationProfile?.currentSkills ?? []),
    ...(request.conversationProfile?.interestAreas ?? []),
    request.contextData?.selectedPersona?.role,
    request.contextData?.selectedPersona?.department,
    request.contextData?.selectedPersona?.careerGoal,
    request.employeeDiscovery?.roleTitle,
    request.employeeDiscovery?.department,
    ...(request.employeeDiscovery?.responsibilities ?? []),
    ...(request.employeeDiscovery?.currentSkills ?? []),
    ...(request.employeeDiscovery?.businessFunctions ?? []),
    ...(request.employeeDiscovery?.currentCapabilities ?? []),
    ...(request.employeeDiscovery?.apprenticeshipIndicators ?? []),
    ...(request.employeeDiscovery?.aiOpportunities ?? []),
    ...(request.employeeDiscovery?.dataOpportunities ?? []),
    ...(request.employeeDiscovery?.automationOpportunities ?? []),
    ...(request.employeeDiscovery?.futureCapabilities ?? []),
    ...(request.employerPriorities?.map((priority) => priority.name) ?? []),
  ]);
}

function profileText(request: LevyTateAiRequest) {
  return uniqueText([
    request.conversationProfile?.currentRole,
    request.conversationProfile?.currentDepartment,
    request.conversationProfile?.careerGoal,
    request.contextData?.selectedPersona?.role,
    request.contextData?.selectedPersona?.department,
    request.contextData?.selectedPersona?.careerGoal,
    request.employeeDiscovery?.roleTitle,
    request.employeeDiscovery?.department,
    ...(request.employeeDiscovery?.responsibilities ?? []),
    ...(request.employeeDiscovery?.currentSkills ?? []),
    ...(request.employeeDiscovery?.businessFunctions ?? []),
    ...(request.employeeDiscovery?.currentCapabilities ?? []),
  ]);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addCapabilityScore(scores: Map<CapabilityDomain, CapabilityState>, domain: CapabilityDomain, amount: number, evidence: string) {
  const current = scores.get(domain) ?? { score: 0, evidence: [], missingEvidence: [] };
  current.score = Math.min(100, current.score + amount);
  if (!current.evidence.includes(evidence)) current.evidence.push(evidence);
  scores.set(domain, current);
}

function addRolePriors(request: LevyTateAiRequest, scores: Map<CapabilityDomain, CapabilityState>) {
  const role = uniqueText([request.conversationProfile?.currentRole, request.contextData?.selectedPersona?.role, request.employeeDiscovery?.roleTitle, request.conversationProfile?.careerGoal]).toLowerCase();
  const add = (domain: CapabilityDomain, amount: number, label: string) => addCapabilityScore(scores, domain, amount, label);
  if (/data analyst|reporting analyst|business intelligence|bi analyst|insight analyst/.test(role)) {
    add("data_analysis", 34, "Role context indicates data analysis responsibility");
    add("reporting_bi", 30, "Role context indicates reporting or BI responsibility");
    add("sql", 16, "Data analyst role usually needs structured data querying");
    add("data_visualisation", 18, "Data analyst role usually involves visual insight");
    add("data_management", 14, "Data analyst role usually requires data quality awareness");
  }
  if (/business support|admin assistant|administrator|office coordinator/.test(role)) {
    add("administration", 32, "Role context indicates business administration");
    add("data_management", 14, "Administration role often owns records or system data");
    add("reporting_bi", 12, "Administration role may include recurring reports or spreadsheets");
    if (/report|spreadsheet|crm|data|dashboard|manual admin/.test(role)) {
      add("data_analysis", 14, "Business support context includes data or reporting work");
      add("reporting_bi", 18, "Business support context includes reporting activity");
      add("data_management", 12, "Business support context includes CRM, records or data quality work");
    }
  }
  if (/procurement|buyer|buying|sourcing|commercial/.test(role)) {
    add("procurement", 42, "Role context indicates procurement or buying");
    add("business_analysis", 8, "Procurement work involves requirements and supplier analysis");
  }
  if (/customer service|customer advisor|customer support|customer experience/.test(role)) {
    add("customer_service", 42, "Role context indicates customer service work");
    add("data_management", 6, "Customer service work may involve CRM or customer records");
  }
  if (/it support|ict technician|digital support|helpdesk|service desk/.test(role)) {
    add("digital_support", 42, "Role context indicates IT or digital support");
    add("cyber", 10, "IT support role may touch secure systems");
    add("customer_service", 8, "IT support role supports internal users");
  }
  if (/hr advisor|hr support|human resources|people advisor|recruitment/.test(role)) {
    add("hr", 42, "Role context indicates HR or people operations");
    add("administration", 8, "HR work often includes people process administration");
    add("customer_service", 6, "HR advisory work supports internal colleagues");
  }
  if (/maintenance|engineer|engineering/.test(role)) {
    add("engineering", 36, "Role context indicates engineering or maintenance");
    add("process_improvement", 6, "Engineering roles may support reliability improvement");
  }
  if (/manufacturing|production|factory|assembly/.test(role)) {
    add("manufacturing", 34, "Role context indicates manufacturing or production");
    add("process_improvement", 6, "Manufacturing roles may support operational improvement");
  }
  if (/site supervisor|construction|built environment/.test(role)) {
    add("construction", 42, "Role context indicates construction or site delivery");
    add("project_delivery", 8, "Site work requires delivery coordination");
  }
}

function buildCapabilityProfile(request: LevyTateAiRequest): LevyTateCapabilityScore[] {
  const text = conversationText(request);
  const profile = profileText(request);
  const scores = new Map<CapabilityDomain, CapabilityState>();
  for (const definition of capabilityDefinitions) {
    const profileMatches = definition.signals.filter((item) => item.pattern.test(profile));
    const profileIds = new Set(profileMatches.map((item) => item.id));
    const conversationMatches = definition.signals.filter((item) => !profileIds.has(item.id) && item.pattern.test(text));
    for (const match of profileMatches) addCapabilityScore(scores, definition.domain, match.weight, match.label);
    for (const match of conversationMatches) addCapabilityScore(scores, definition.domain, Math.max(6, Math.round(match.weight * 0.78)), match.label);
  }
  addRolePriors(request, scores);
  return capabilityDefinitions.map((definition) => {
    const current = scores.get(definition.domain) ?? { score: 0, evidence: [], missingEvidence: [] };
    const score = clamp(current.score);
    return { domain: definition.label, score, evidence: current.evidence.slice(0, 8), missingEvidence: score >= 55 ? [] : [definition.missingEvidence] };
  });
}

function capabilityMap(profile: LevyTateCapabilityScore[]): CapabilityMap {
  const map = new Map<CapabilityDomain, LevyTateCapabilityScore>();
  for (const definition of capabilityDefinitions) {
    const score = profile.find((item) => item.domain === definition.label);
    if (score) map.set(definition.domain, score);
  }
  return map;
}

function suppliedPathwayDefinitions(request: LevyTateAiRequest) {
  return (request.availablePathways ?? []).flatMap((pathwayContext) => {
    if (pathwayContext.status && /not available|archived|withdrawn/i.test(pathwayContext.status)) return [];
    const existing = pathwayCatalogue.find((item) => item.title.toLowerCase() === pathwayContext.title.toLowerCase() || item.standard.toLowerCase() === pathwayContext.standard?.toLowerCase());
    if (existing) return [existing];
    const title = (pathwayContext.title + " " + (pathwayContext.standard ?? "")).toLowerCase();
    const capabilityWeights: Partial<Record<CapabilityDomain, number>> = {};
    if (/data|report|analytics|insight/.test(title)) Object.assign(capabilityWeights, { data_analysis: 18, reporting_bi: 16, data_management: 10 });
    if (/digital|ict|it support/.test(title)) Object.assign(capabilityWeights, { digital_support: 22, customer_service: 8 });
    if (/customer/.test(title)) Object.assign(capabilityWeights, { customer_service: 28 });
    if (/procurement|supply/.test(title)) Object.assign(capabilityWeights, { procurement: 32 });
    if (/business admin|administration/.test(title)) Object.assign(capabilityWeights, { administration: 28, data_management: 8 });
    return [{ pathwayId: slugify(pathwayContext.standard ?? pathwayContext.title), title: pathwayContext.title, standard: pathwayContext.standard ?? pathwayContext.title, baseScore: 18, rationale: "An employer-supplied pathway available for role-fit assessment. LevyTate still ranks it through capability evidence.", capabilityWeights: Object.keys(capabilityWeights).length ? capabilityWeights : { administration: 10, business_analysis: 8 } } satisfies PathwayDefinition];
  });
}

function availableDefinitions(request: LevyTateAiRequest) {
  const supplied = suppliedPathwayDefinitions(request);
  if (!supplied.length) return pathwayCatalogue;
  const byId = new Map([...pathwayCatalogue, ...supplied].map((item) => [item.pathwayId, item]));
  return [...byId.values()];
}

function roleMappingEvidence(request: LevyTateAiRequest, definition: PathwayDefinition): LevyTateRecommendationEvidence[] {
  const role = request.conversationProfile?.currentRole ?? request.employeeDiscovery?.roleTitle ?? request.contextData?.selectedPersona?.role ?? "";
  const mapping = request.roleMappings?.find((item) => item.roleTitle.toLowerCase() === role.toLowerCase());
  if (!mapping) return [];
  const primaryMatch = mapping.primaryPathway.toLowerCase().includes(definition.standard.toLowerCase()) || definition.title.toLowerCase().includes(mapping.primaryPathway.toLowerCase());
  const alternativeMatch = mapping.alternativePathways?.some((item) => item.toLowerCase().includes(definition.standard.toLowerCase()) || definition.title.toLowerCase().includes(item.toLowerCase()));
  if (!primaryMatch && !alternativeMatch) return [];
  return [{ id: primaryMatch ? "role-primary-" + slugify(role) : "role-alternative-" + slugify(role), label: primaryMatch ? "Role library maps " + role + " to this as a primary route" : "Role library maps " + role + " to this as an alternative route", source: "role_mapping", weight: primaryMatch ? 8 : 5 }];
}

function providerAvailabilityFor(request: LevyTateAiRequest, definition: PathwayDefinition): LevyTatePlatformRecommendation["providerAvailability"] {
  if (!request.providerCatalogue?.length) return "unconfirmed";
  const standard = definition.standard.toLowerCase();
  const title = definition.title.toLowerCase();
  const match = request.providerCatalogue.some((provider) => {
    const text = [provider.providerName, ...(provider.sectors ?? []), ...(provider.deliveryModels ?? []), provider.verificationStatus].join(" ").toLowerCase();
    return standard.split(/\s+/).some((word) => word.length > 5 && text.includes(word)) || title.split(/\s+/).some((word) => word.length > 5 && text.includes(word));
  });
  return match ? "mapped" : "matching_available";
}

function recommendationEvidence(definition: PathwayDefinition, profileMap: CapabilityMap, roleEvidence: LevyTateRecommendationEvidence[]) {
  const capabilityFit: LevyTateCapabilityFit[] = Object.entries(definition.capabilityWeights).flatMap(([domain, weighting]) => {
    const definitionForDomain = capabilityDefinitions.find((item) => item.domain === domain);
    if (!definitionForDomain || typeof weighting !== "number") return [];
    const score = profileMap.get(domain as CapabilityDomain)?.score ?? 0;
    return [{ domain: definitionForDomain.label, score, weighting }];
  }).sort((left, right) => right.weighting - left.weighting);
  const evidence: LevyTateRecommendationEvidence[] = [
    ...roleEvidence,
    ...capabilityFit.filter((item) => item.score >= 45).slice(0, 5).map((item) => ({ id: "capability-" + slugify(item.domain), label: item.domain + " scored " + item.score + " from profile and conversation evidence", source: "platform_rule" as const, weight: Math.min(18, Math.round((item.score * item.weighting) / 100)) })),
  ];
  const missingEvidence = capabilityFit.filter((item) => item.weighting >= 8 && item.score < 40).slice(0, 4).map((item) => item.domain + " evidence is still limited");
  return { capabilityFit, evidence, missingEvidence };
}

function previousScore(request: LevyTateAiRequest, pathwayId: string) {
  return request.previousRecommendationResult?.recommendations.find((item) => item.pathwayId === pathwayId)?.fitScore;
}

function fitForDefinition(definition: PathwayDefinition, capabilityFit: LevyTateCapabilityFit[], roleEvidence: LevyTateRecommendationEvidence[], missingEvidence: string[]) {
  const totalWeight = capabilityFit.reduce((total, item) => total + item.weighting, 0) || 1;
  const weightedAverage = capabilityFit.reduce((total, item) => total + item.score * item.weighting, 0) / totalWeight;
  const coverage = capabilityFit.reduce((total, item) => total + (item.score >= 50 ? item.weighting : 0), 0) / totalWeight;
  const strongCapabilityCount = capabilityFit.filter((item) => item.score >= 60 && item.weighting >= 8).length;
  const roleBonus = roleEvidence.reduce((total, item) => total + item.weight, 0);
  const missingPenalty = Math.min(10, missingEvidence.length * 2);
  return clamp(definition.baseScore + weightedAverage * 0.72 + coverage * 12 + strongCapabilityCount * 2 + roleBonus - missingPenalty);
}

function confidenceFor(capabilityFit: LevyTateCapabilityFit[], evidence: LevyTateRecommendationEvidence[], missingEvidence: string[]) {
  const totalWeight = capabilityFit.reduce((total, item) => total + item.weighting, 0) || 1;
  const coverage = capabilityFit.reduce((total, item) => total + (item.score >= 50 ? item.weighting : 0), 0) / totalWeight;
  const strongestCapability = Math.max(0, ...capabilityFit.map((item) => item.score));
  return clamp(36 + coverage * 30 + strongestCapability * 0.24 + Math.min(16, evidence.length * 3) - missingEvidence.length * 2);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildLevyTateRecommendations(request: LevyTateAiRequest): LevyTateRecommendationResult {
  const capabilityProfile = buildCapabilityProfile(request);
  const profileMap = capabilityMap(capabilityProfile);
  const recommendations = availableDefinitions(request).map((definition) => {
    const roleEvidence = roleMappingEvidence(request, definition);
    const { capabilityFit, evidence, missingEvidence } = recommendationEvidence(definition, profileMap, roleEvidence);
    const fitScore = fitForDefinition(definition, capabilityFit, roleEvidence, missingEvidence);
    const previous = previousScore(request, definition.pathwayId);
    const mapped = roleEvidence.some((item) => item.source === "role_mapping") || request.availablePathways?.some((item) => item.title.toLowerCase() === definition.title.toLowerCase() && /approved|live/i.test(item.status ?? ""));
    return {
      pathwayId: definition.pathwayId,
      title: definition.title,
      fitScore,
      scoreDelta: previous === undefined ? 0 : fitScore - previous,
      confidence: confidenceFor(capabilityFit, evidence, missingEvidence),
      rationale: missingEvidence.length ? definition.rationale + " Missing evidence to confirm: " + missingEvidence.join("; ") + "." : definition.rationale,
      evidence,
      missingEvidence,
      capabilityFit,
      availability: mapped ? "approved" : "role_fit_review",
      eligibility: mapped ? "eligible" : "requires_review",
      providerAvailability: providerAvailabilityFor(request, definition),
    } satisfies LevyTatePlatformRecommendation;
  }).filter((item) => item.evidence.length > 0 || item.fitScore >= 50).sort((left, right) => right.fitScore - left.fitScore || right.confidence - left.confidence || left.title.localeCompare(right.title)).slice(0, 4);

  const topRecommendation = recommendations[0] ?? null;
  const confidence = topRecommendation?.confidence ?? 0;
  const enoughEvidence = Boolean(topRecommendation && topRecommendation.evidence.length >= 2 && topRecommendation.capabilityFit.some((item) => item.score >= 55));
  const shouldRevealRecommendations = Boolean(topRecommendation && confidence >= revealThreshold && enoughEvidence);
  const capabilitySignature = capabilityProfile.filter((item) => item.score > 0).map((item) => item.domain + ":" + item.score + ":" + item.evidence.join(",")).join("|");
  const signature = recommendations.map((item) => item.pathwayId + ":" + item.fitScore + ":" + item.evidence.map((entry) => entry.id).sort().join(",") + ":" + item.missingEvidence.join(",")).join("|") + capabilitySignature;
  const recommendationVersion = "rec-" + recommendationEngineVersion + "-" + stableHash(signature);

  return { recommendations, topRecommendation, recommendationVersion, confidence, revealThreshold, shouldRevealRecommendations, evidenceChanged: request.previousRecommendationResult?.recommendationVersion !== recommendationVersion, capabilityProfile };
}

function toPathway(recommendation: LevyTatePlatformRecommendation): LevyTateRecommendedPathway {
  const missing = recommendation.missingEvidence.length ? " Missing evidence: " + recommendation.missingEvidence.slice(0, 2).join("; ") + "." : "";
  return {
    title: recommendation.title,
    reason: recommendation.rationale + missing,
    availability: recommendation.availability === "approved" ? "approved" : recommendation.availability === "not_available" ? "not_available" : "alternative",
    fit: recommendation.fitScore,
    scoreDelta: recommendation.scoreDelta,
    confidence: recommendation.confidence,
    evidence: [...recommendation.evidence.map((item) => item.label), ...recommendation.missingEvidence.map((item) => "Missing: " + item)],
    standard: recommendation.title.replace(/^Level \d+\s+/i, ""),
  };
}

export function applyPlatformRecommendations(request: LevyTateAiRequest, response: LevyTateAiResponse, result: LevyTateRecommendationResult): LevyTateAiResponse {
  const top = result.topRecommendation;
  const pathways = result.recommendations.map(toPathway);
  const groundedActions = response.recommendedActions.map((action) => {
    if (!top || !["open_pathway", "start_application", "draft_application_reason", "save_interest"].includes(action.type)) return action;
    return { ...action, target: top.title };
  });
  const actions = request.role === "Employee" && !result.shouldRevealRecommendations ? groundedActions.filter((action) => !["open_pathway", "start_application", "draft_application_reason", "compare_routes"].includes(action.type)) : groundedActions;
  const applicationDraft = response.applicationDraft ?? response.applicationPrefill;
  const groundedDraft = result.shouldRevealRecommendations && applicationDraft && top ? { ...applicationDraft, selectedApprenticeship: top.title } : null;
  const primary = top && response.employeeGuidance ? { ...response.employeeGuidance.primary, programme: top.title, pathway: top.title.replace(/^Level \d+\s+/i, ""), fit: top.fitScore, why: top.rationale } : response.employeeGuidance?.primary;
  const employeeGuidance = response.employeeGuidance && primary ? {
    ...response.employeeGuidance,
    primary,
    alternatives: result.recommendations.slice(1).map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
    availableNow: result.recommendations.filter((item) => item.availability === "approved").map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
    futureInterests: result.recommendations.filter((item) => item.availability !== "approved").map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
  } : response.employeeGuidance;
  const leadGuidance = response.leadGuidance ? {
    ...response.leadGuidance,
    recommendedStandards: result.recommendations.map((item) => ({ name: item.title.replace(/^Level \d+\s+/i, ""), level: item.title.match(/^Level \d+/i)?.[0] ?? "Pathway", suitability: item.fitScore, why: item.rationale, bestFor: item.evidence.slice(0, 2).map((entry) => entry.label).join(" and ") || "Role-fit review", delivery: "Delivery model confirmed through employer mapping and provider matching." })),
    alternativeStandards: result.recommendations.slice(1).map((item) => item.title),
  } : response.leadGuidance;

  return { ...response, shouldShowPathways: result.shouldRevealRecommendations, recommendedPathways: pathways, recommendedActions: actions, suggestedActions: actions, applicationPrefill: groundedDraft, applicationDraft: groundedDraft, employeeGuidance, leadGuidance, recommendationResult: result };
}

function sentenceMentionsRecommendation(sentence: string, recommendation: LevyTatePlatformRecommendation) {
  const shortTitle = recommendation.title.replace(/^Level \d+\s+/i, "");
  return sentence.toLowerCase().includes(recommendation.title.toLowerCase()) || sentence.toLowerCase().includes(shortTitle.toLowerCase());
}

export function recommendationNarrativeIsAligned(message: string, result: LevyTateRecommendationResult) {
  const top = result.topRecommendation;
  if (!top || !result.shouldRevealRecommendations) return true;
  const sentences = message.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const referenced = result.recommendations.filter((item) => sentenceMentionsRecommendation(sentence, item));
    if (!referenced.length) continue;
    if (/\b(strongest|best fit|top recommendation|best match|leading match)\b/i.test(sentence) && !sentenceMentionsRecommendation(sentence, top)) return false;
    const percentages = [...sentence.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]));
    if (percentages.length && referenced.some((item) => !percentages.includes(item.fitScore))) return false;
    if (referenced.some((item) => item.pathwayId !== top.pathwayId) && /\b(stronger|better fit|ranks? above|ahead of)\b/i.test(sentence)) return false;
  }
  return true;
}

export function buildPlatformRecommendationExplanation(result: LevyTateRecommendationResult) {
  const top = result.topRecommendation;
  if (!top) return "I need a little more information about the role and development goal before LevyTate can rank suitable pathways.";
  if (!result.shouldRevealRecommendations) {
    const strongestCapabilities = result.capabilityProfile.filter((item) => item.score >= 45).sort((left, right) => right.score - left.score).slice(0, 2).map((item) => item.domain + " at " + item.score + "%").join(" and ");
    return strongestCapabilities ? "I can see early capability evidence around " + strongestCapabilities + ". I need a little more evidence about the work outcome before LevyTate ranks pathways." : "I am still building enough evidence to make a reliable recommendation. I will keep exploring the role, the work outcome and the skills you want to develop before LevyTate ranks pathways.";
  }
  const alternative = result.recommendations[1];
  const evidence = top.evidence.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ");
  const missing = top.missingEvidence.length ? " The main evidence still to confirm is " + top.missingEvidence.slice(0, 2).join(" and ").toLowerCase() + "." : "";
  const alternativeDetail = alternative ? " " + alternative.title + " remains the next strongest option at " + alternative.fitScore + "% because its capability fit is slightly lower against the evidence captured so far." : "";
  return top.title + " is currently LevyTate's strongest match at " + top.fitScore + "%. " + (evidence ? "That is mainly because " + evidence + "." : top.rationale) + missing + alternativeDetail;
}
