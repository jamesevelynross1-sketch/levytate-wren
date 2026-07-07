import type {
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateCapabilityFit,
  LevyTateCapabilityScore,
  LevyTatePlatformRecommendation,
  LevyTateRecommendationEvidence,
  LevyTateRecommendationResult,
  LevyTateRecommendedPathway,
  LevyTateStrategicRecommendation,
  LevyTateStrategicSignal,
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
  | "finance"
  | "marketing"
  | "education_administration"
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

type StrategicPriorityProfile = {
  capabilityProfile: LevyTateCapabilityScore[];
  priorities: string[];
  signals: LevyTateStrategicSignal[];
};

type ScoredRecommendation = LevyTatePlatformRecommendation & {
  futureFitScore: number;
  strategyFitScore: number;
  providerFitScore: number;
};

const recommendationEngineVersion = "3-strategic-workforce";
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
  capability("finance", "Finance", "Finance processing, accounting or financial reporting evidence not yet confirmed.", [
    signal("finance-role", "Finance or accounts role", 36, /\b(finance assistant|accounts assistant|accounting|finance|invoice|invoices|reconciliation|reconciliations)\b/i),
    signal("finance-reporting", "Finance reporting or month-end work", 20, /\b(monthly reports?|finance reporting|budget|forecast|ledger|payroll|purchase ledger|sales ledger)\b/i),
  ]),
  capability("marketing", "Marketing", "Marketing campaign, content or customer growth evidence not yet confirmed.", [
    signal("marketing-role", "Marketing role or responsibility", 38, /\b(marketing executive|marketing assistant|digital marketing|campaigns?|content marketing|email marketing|brand|social media)\b/i),
    signal("marketing-automation", "Marketing automation or CRM activity", 20, /\b(marketing automation|crm|campaign automation|email campaigns?|analytics|customer growth)\b/i),
  ]),
  capability("education_administration", "Education administration", "School, trust or MAT administration evidence not yet confirmed.", [
    signal("school-admin-role", "School or MAT administration role", 36, /\b(school administrator|school admin|\bmat\b|multi academy trust|academy trust|school business|attendance reporting|parent communications)\b/i),
    signal("school-records", "School records or attendance reporting", 18, /\b(attendance|school records|parent communications|sims|arbor|school reporting)\b/i),
  ]),
  capability("administration", "Administration", "Business support or administration evidence not yet confirmed.", [
    signal("admin-role", "Business support or administration role", 34, /\b(admin assistant|administrator|administration|business support|office coordinator|school administrator)\b/i),
    signal("admin-processes", "Process administration work", 18, /\b(scheduling|records|crm updates|document control|process admin|school records)\b/i),
  ]),
];

function pathway(standardId: string, baseScore: number, rationale: string, capabilityWeights: Partial<Record<CapabilityDomain, number>>): PathwayDefinition {
  const standard = getApprenticeshipStandard(standardId);
  if (!standard) throw new Error("Unknown apprenticeship standard: " + standardId);
  return { pathwayId: standard.id, title: "Level " + standard.level + " " + standard.title, standard: standard.title, baseScore, rationale, capabilityWeights };
}

const pathwayCatalogue: PathwayDefinition[] = [
  pathway("ST0118", 20, "Best where the role combines analysis, SQL, BI reporting, visualisation and business insight ownership.", { data_analysis: 24, sql: 18, reporting_bi: 22, data_visualisation: 14, data_management: 10, business_analysis: 8 }),
  pathway("ST0795", 33, "Best where the role needs practical data handling, reporting, spreadsheets, CRM data quality and repeatable operational insight.", { data_analysis: 20, reporting_bi: 30, data_management: 24, data_visualisation: 4, administration: 8, automation: 12, finance: 4 }),
  pathway("ST0117", 20, "Best where the role needs requirements discovery, process analysis, stakeholder engagement and systems change capability.", { business_analysis: 28, project_delivery: 12, process_improvement: 12, data_analysis: 8, digital_support: 6 }),
  pathway("ST0310", 19, "Best where the role needs project planning, risk control, stakeholder coordination and accountable delivery.", { project_delivery: 32, business_analysis: 10, leadership: 8, process_improvement: 8 }),
  pathway("ST0313", 24, "Best where the role needs sourcing, supplier management, commercial judgement and procurement practice.", { procurement: 42, business_analysis: 8, project_delivery: 6, data_analysis: 5 }),
  pathway("ST0071", 23, "Best where the role needs complex customer handling, service quality and ownership of customer outcomes.", { customer_service: 40, data_management: 8, leadership: 6, process_improvement: 6 }),
  pathway("ST0120", 22, "Best where the role supports colleagues with digital systems, user needs, digital processes and practical workplace technology.", { digital_support: 34, customer_service: 10, data_management: 8, automation: 8, cyber: 6 }),
  pathway("ST0973", 18, "Best where the role is closer to ICT support, infrastructure, networking, devices and technical troubleshooting.", { digital_support: 28, cyber: 8, software_development: 6, customer_service: 6 }),
  pathway("ST0116", 20, "Best where the role is focused on coding, building software, APIs, testing and application development.", { software_development: 42, sql: 8, digital_support: 6, automation: 6 }),
  pathway("ST0865", 31, "Best where the role needs cyber security practice, secure systems awareness, threat detection and user protection capability.", { cyber: 62, digital_support: 10, data_management: 6, software_development: 4 }),
  pathway("ST1512", 24, "Best where the role needs practical AI adoption, automation, productivity improvement and responsible use of AI-enabled tools.", { ai_adoption: 34, automation: 28, process_improvement: 8, digital_support: 6, data_analysis: 4, marketing: 10, education_administration: 6 }),
  pathway("ST0070", 8, "Best where the role needs broad business administration, records, coordination and operational support capability.", { administration: 14, customer_service: 8, data_management: 3, reporting_bi: 2 }),
  pathway("ST0238", 24, "Best where the role needs people advisory, employee relations, workforce policy and HR professional capability.", { hr: 42, leadership: 8, administration: 6, customer_service: 6, data_management: 4 }),
  pathway("ST0608", 18, "Best where the role needs accounts processing, finance administration, reconciliations and accurate financial records.", { finance: 48, administration: 8, data_management: 8, reporting_bi: 5 }),
  pathway("ST0575", 16, "Best where the role needs school business administration, trust operations, school reporting and education support processes.", { education_administration: 48, administration: 8, reporting_bi: 5, data_management: 5, project_delivery: 5 }),
  pathway("ST0596", 22, "Best where the role needs campaign delivery, marketing planning, customer growth, content performance and marketing analytics.", { marketing: 42, customer_service: 8, reporting_bi: 8, automation: 8, data_analysis: 5 }),
  pathway("ST0192", 24, "Best where the role is explicitly focused on continuous improvement, lean practice, operational performance and measurable process change.", { process_improvement: 42, manufacturing: 12, engineering: 8, automation: 6, leadership: 8 }),
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
    add("cyber", /cyber|security|cloud|network/.test(role) ? 24 : 14, "IT support role may touch secure systems, networks or cloud access");
    add("customer_service", 8, "IT support role supports internal users");
  }
  if (/hr advisor|hr support|human resources|people advisor|recruitment|employee relations|people professional/.test(role)) {
    add("hr", 48, "Role context indicates HR or people operations");
    add("administration", 8, "HR work often includes people process administration");
    add("customer_service", 6, "HR advisory work supports internal colleagues");
  }
  if (/finance assistant|accounts assistant|accounting|finance|payroll|ledger/.test(role)) {
    add("finance", 46, "Role context indicates finance or accounts work");
    add("administration", 10, "Finance work includes controlled process administration");
    add("reporting_bi", 14, "Finance roles often support recurring reports");
    add("data_management", 10, "Finance roles depend on accurate records and reconciliations");
  }
  if (/school administrator|school admin|\bmat\b|multi academy trust|academy trust|school business/.test(role)) {
    add("education_administration", 46, "Role context indicates school or MAT administration");
    add("administration", 24, "School administration needs controlled records and processes");
    add("reporting_bi", 12, "School administration often includes attendance or operational reporting");
    add("data_management", 12, "School administration depends on accurate pupil and business records");
  }
  if (/marketing executive|marketing assistant|digital marketing|campaign|content|brand|social media/.test(role)) {
    add("marketing", 46, "Role context indicates marketing or campaign delivery");
    add("customer_service", 10, "Marketing work supports customer engagement");
    add("reporting_bi", 10, "Marketing roles often use campaign reporting");
    add("automation", 8, "Marketing roles may use CRM or campaign automation");
  }
  if (/maintenance|engineer|engineering/.test(role)) {
    add("engineering", 36, "Role context indicates engineering or maintenance");
    add("process_improvement", 6, "Engineering roles may support reliability improvement");
  }
  if (/manufacturing|production|factory|assembly/.test(role)) {
    add("manufacturing", 34, "Role context indicates manufacturing or production");
    add("process_improvement", 6, "Manufacturing roles may support operational improvement");
  }
  if (/operations supervisor|operational supervisor|shift supervisor|production supervisor/.test(role)) {
    add("process_improvement", 32, "Operations supervisor role indicates operational improvement responsibility");
    add("manufacturing", 18, "Operations supervisor context is operational or production focused");
    add("leadership", 18, "Supervisor role indicates people coordination and succession coverage");
    add("project_delivery", 8, "Operations supervision includes coordination and delivery ownership");
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

function buildCapabilityProfileFromText(text: string, priors: Array<[CapabilityDomain, number, string]> = []): LevyTateCapabilityScore[] {
  const scores = new Map<CapabilityDomain, CapabilityState>();
  for (const definition of capabilityDefinitions) {
    const matches = definition.signals.filter((item) => item.pattern.test(text));
    for (const match of matches) addCapabilityScore(scores, definition.domain, Math.max(6, Math.round(match.weight * 0.86)), match.label);
  }
  for (const [domain, amount, evidence] of priors) addCapabilityScore(scores, domain, amount, evidence);
  return capabilityDefinitions.map((definition) => {
    const current = scores.get(definition.domain) ?? { score: 0, evidence: [], missingEvidence: [] };
    const score = clamp(current.score);
    return { domain: definition.label, score, evidence: current.evidence.slice(0, 8), missingEvidence: score >= 55 ? [] : [definition.missingEvidence] };
  });
}

function futureCapabilityText(request: LevyTateAiRequest) {
  return uniqueText([
    request.userMessage,
    request.conversationProfile?.careerGoal,
    request.conversationProfile?.reasonForDevelopment,
    request.conversationProfile?.managementAspirations,
    ...(request.conversationProfile?.interestAreas ?? []),
    ...(request.conversationHistory.filter((message) => message.role === "user").slice(-4).map((message) => message.content)),
    ...(request.employeeDiscovery?.aiOpportunities ?? []),
    ...(request.employeeDiscovery?.dataOpportunities ?? []),
    ...(request.employeeDiscovery?.automationOpportunities ?? []),
    ...(request.employeeDiscovery?.futureCapabilities ?? []),
  ]).toLowerCase();
}

function buildFutureCapabilityProfile(request: LevyTateAiRequest): LevyTateCapabilityScore[] {
  const text = futureCapabilityText(request);
  const priors: Array<[CapabilityDomain, number, string]> = [];
  if (/\b(reporting|reports?|dashboard|dashboards|insight|analytics|analysis|power\s?bi|spreadsheet|data confidence)\b/i.test(text)) {
    priors.push(["reporting_bi", 28, "Future goal mentions reporting or insight"], ["data_analysis", 24, "Future goal points towards data-led decision support"], ["data_visualisation", 14, "Future goal may involve clearer reporting outputs"]);
  }
  if (/\b(ai|artificial intelligence|copilot|microsoft 365|prompt|automation|automate|workflow|manual admin|productivity)\b/i.test(text)) {
    priors.push(["ai_adoption", 38, "Future goal mentions AI adoption or productivity"], ["automation", 30, "Future goal includes automation or reducing manual work"], ["digital_support", 10, "Future goal depends on workplace technology confidence"]);
  }
  if (/\b(predictive|forecast|forecasting|data science|machine learning|advanced analytics)\b/i.test(text)) {
    priors.push(["data_analysis", 26, "Future goal mentions predictive or advanced analytics"], ["reporting_bi", 18, "Future goal builds on analytics and reporting"], ["ai_adoption", 18, "Future goal connects to AI-enabled insight"]);
  }
  if (/\b(commercial transformation|supplier|sourcing|procurement|contract|tender|buying)\b/i.test(text)) {
    priors.push(["procurement", 34, "Future goal is commercially or procurement focused"], ["business_analysis", 12, "Future goal needs business and supplier analysis"]);
  }
  if (/\b(cyber|cybersecurity|cloud|network security|secure systems|security operations)\b/i.test(text)) {
    priors.push(["cyber", 38, "Future goal mentions cyber, cloud or secure systems"], ["digital_support", 16, "Cyber/cloud progression builds on digital support capability"]);
  }
  if (/\b(finance reporting|finance visibility|accounts|accounting|reconciliation|budget|forecast|month end|monthly reports?)\b/i.test(text)) {
    priors.push(["finance", 36, "Future goal is finance or accounts focused"], ["reporting_bi", 22, "Future goal includes finance reporting"], ["data_analysis", 16, "Finance reporting goal needs data analysis"], ["data_management", 12, "Finance reporting needs accurate records"]);
  }
  if (/\b(marketing|campaign|content|customer growth|crm|email marketing|marketing automation)\b/i.test(text)) {
    priors.push(["marketing", 38, "Future goal is marketing or customer growth focused"], ["automation", 18, "Marketing goal includes automation or CRM workflows"], ["reporting_bi", 12, "Marketing goal includes campaign reporting"]);
  }
  if (/\b(school|mat|multi academy trust|academy trust|attendance|school records|parent communications)\b/i.test(text)) {
    priors.push(["education_administration", 36, "Future goal is school or MAT administration focused"], ["administration", 14, "School business processes need structured administration"]);
  }
  if (/\b(customer|complaint|service quality|customer experience|team leadership|coaching)\b/i.test(text)) priors.push(["customer_service", 30, "Future goal improves customer experience"], ["leadership", 14, "Future goal includes coaching or team leadership"]);
  if (/\b(engineering|maintenance|production|manufacturing|quality|downtime)\b/i.test(text)) priors.push(["process_improvement", 20, "Future goal improves operational performance"], ["engineering", 16, "Future goal is technically rooted"]);
  return buildCapabilityProfileFromText(text, priors);
}

function buildOrganisationStrategyProfile(request: LevyTateAiRequest): StrategicPriorityProfile {
  const text = uniqueText([
    request.employerContext,
    request.currentWorkspace?.employerName,
    request.currentWorkspace?.activeModule,
    request.userMessage,
    ...(request.conversationHistory.filter((message) => message.role === "user").slice(-4).map((message) => message.content)),
    ...(request.employerPriorities?.map((priority) => priority.name + " " + priority.importance) ?? []),
  ]).toLowerCase();
  const priors: Array<[CapabilityDomain, number, string]> = [];
  const priorities: string[] = [];
  const signals: LevyTateStrategicSignal[] = [];
  const addPriority = (label: string, score: number, evidence: string[], capabilities: Array<[CapabilityDomain, number, string]>) => {
    if (!priorities.includes(label)) priorities.push(label);
    signals.push({ category: "organisation_priority", label, score, evidence });
    priors.push(...capabilities);
  };
  if (/\b(ai rollout|adopt ai|ai adoption|copilot|microsoft 365|automation|digital productivity)\b/i.test(text)) {
    addPriority("AI adoption and productivity", 88, ["Organisation context mentions AI rollout, Copilot, automation or digital productivity"], [["ai_adoption", 42, "Organisation priority is AI adoption"], ["automation", 30, "Organisation priority is automation"], ["digital_support", 14, "AI rollout needs digital confidence"]]);
  }
  if (/\b(data maturity|reporting|insight|analytics|business intelligence|kpi|forecast|visibility)\b/i.test(text)) {
    addPriority("Data maturity and reporting visibility", 84, ["Organisation context mentions reporting, insight, analytics or data maturity"], [["data_analysis", 34, "Organisation priority is data maturity"], ["reporting_bi", 32, "Organisation priority is reporting visibility"], ["data_management", 20, "Data maturity depends on data quality"]]);
  }
  if (/\b(commercial transformation|procurement|supplier|contract|sourcing|supply chain|buying)\b/i.test(text)) {
    addPriority("Commercial and procurement transformation", 88, ["Organisation context mentions commercial transformation, procurement or supplier performance"], [["procurement", 46, "Organisation priority is procurement capability"], ["business_analysis", 18, "Commercial transformation needs requirements and supplier analysis"], ["data_analysis", 8, "Commercial transformation benefits from spend and supplier insight"]]);
  }
  if (/\b(operational excellence|productivity|efficiency|process improvement|lean|waste|downtime|continuous improvement)\b/i.test(text)) {
    addPriority("Operational excellence", 80, ["Organisation context mentions productivity, efficiency or continuous improvement"], [["process_improvement", 40, "Organisation priority is operational improvement"], ["automation", 14, "Process improvement may include automation"]]);
  }
  if (/\b(cyber resilience|cyber|security|cloud|digital capability)\b/i.test(text)) {
    addPriority("Cyber resilience and digital capability", 84, ["Organisation context mentions cyber resilience, cloud or digital capability"], [["cyber", 38, "Organisation priority is cyber resilience"], ["digital_support", 22, "Digital capability depends on strong support skills"]]);
  }
  if (/\b(finance visibility|financial visibility|finance reporting|budget visibility)\b/i.test(text)) {
    addPriority("Finance visibility", 80, ["Organisation context mentions finance reporting or visibility"], [["finance", 34, "Organisation priority is finance capability"], ["reporting_bi", 24, "Finance visibility depends on better reporting"]]);
  }
  if (/\b(customer growth|marketing automation|campaign performance|growth)\b/i.test(text)) {
    addPriority("Customer growth and marketing performance", 78, ["Organisation context mentions customer growth, marketing automation or campaign performance"], [["marketing", 34, "Organisation priority is marketing capability"], ["automation", 20, "Marketing performance can be improved through automation"], ["reporting_bi", 12, "Campaign performance depends on reporting"]]);
  }
  if (/\b(workforce readiness|succession|future skills|leadership pipeline|capability growth)\b/i.test(text)) {
    addPriority("Workforce readiness", 76, ["Organisation context mentions readiness, succession or future skills"], [["leadership", 20, "Workforce readiness may require leadership capability"], ["project_delivery", 10, "Workforce readiness may need delivery ownership"]]);
  }
  return { capabilityProfile: buildCapabilityProfileFromText(text, priors), priorities, signals };
}

function fitAgainstProfile(definition: PathwayDefinition, profileMap: CapabilityMap) {
  const capabilityFit = Object.entries(definition.capabilityWeights).flatMap(([domain, weighting]) => {
    if (typeof weighting !== "number") return [];
    return [{ score: profileMap.get(domain as CapabilityDomain)?.score ?? 0, weighting }];
  });
  const totalWeight = capabilityFit.reduce((total, item) => total + item.weighting, 0) || 1;
  const weightedAverage = capabilityFit.reduce((total, item) => total + item.score * item.weighting, 0) / totalWeight;
  const coverage = capabilityFit.reduce((total, item) => total + (item.score >= 50 ? item.weighting : 0), 0) / totalWeight;
  return clamp(weightedAverage * 0.84 + coverage * 14);
}

function providerCapabilityScore(request: LevyTateAiRequest, definition: PathwayDefinition) {
  const availability = providerAvailabilityFor(request, definition);
  if (availability === "mapped") return 82;
  if (availability === "matching_available") return 58;
  return 36;
}

function highestCapability(profile: LevyTateCapabilityScore[], minimum = 45) {
  return profile.filter((item) => item.score >= minimum).sort((left, right) => right.score - left.score)[0] ?? null;
}

function alignedCapabilityLabels(definition: PathwayDefinition, profile: LevyTateCapabilityScore[], minimum = 45) {
  return Object.entries(definition.capabilityWeights).flatMap(([domain]) => {
    const definitionForDomain = capabilityDefinitions.find((item) => item.domain === domain);
    const score = definitionForDomain ? profile.find((item) => item.domain === definitionForDomain.label) : null;
    return score && score.score >= minimum ? [score.domain] : [];
  }).slice(0, 4);
}

function strategicSignalsFor(definition: PathwayDefinition, currentProfile: LevyTateCapabilityScore[], futureProfile: LevyTateCapabilityScore[], strategyProfile: StrategicPriorityProfile, futureFitScore: number, strategyFitScore: number, providerFitScore: number): LevyTateStrategicSignal[] {
  const signals: LevyTateStrategicSignal[] = [];
  const current = alignedCapabilityLabels(definition, currentProfile, 45);
  if (current.length) signals.push({ category: "current_capability", label: "Current capability fit", score: fitAgainstProfile(definition, capabilityMap(currentProfile)), evidence: current });
  const future = alignedCapabilityLabels(definition, futureProfile, 45);
  if (future.length) signals.push({ category: "future_capability", label: "Future capability fit", score: futureFitScore, evidence: future });
  const strategyEvidence = alignedCapabilityLabels(definition, strategyProfile.capabilityProfile, 45);
  if (strategyEvidence.length) signals.push({ category: "business_strategy", label: "Organisation strategy alignment", score: strategyFitScore, evidence: [...strategyProfile.priorities, ...strategyEvidence].slice(0, 5) });
  if (providerFitScore >= 58) signals.push({ category: "provider_capability", label: "Provider matching readiness", score: providerFitScore, evidence: [providerFitScore >= 80 ? "Mapped or directly matchable provider capability exists" : "Provider matching can be scoped through LevyTate"] });
  signals.push({ category: "programme_suitability", label: "Programme suitability", score: clamp((futureFitScore + strategyFitScore) / 2), evidence: [definition.rationale] });
  return signals.slice(0, 8);
}

function providerRationaleFor(providerFitScore: number) {
  if (providerFitScore >= 80) return "A provider mapping signal is available, so LevyTate can move from pathway fit into a controlled provider review.";
  if (providerFitScore >= 55) return "Provider matching is available through LevyTate once the employer confirms delivery preferences, geography and learner needs.";
  return "Provider suitability still needs to be confirmed before this route should move into delivery planning.";
}

function programmeRationaleFor(definition: PathwayDefinition, futureFitScore: number, strategyFitScore: number) {
  return definition.rationale + " Strategic fit is informed by future capability at " + futureFitScore + "% and organisation priority alignment at " + strategyFitScore + "%.";
}

function recommendationBusinessImpact(definition: PathwayDefinition) {
  const title = definition.title.toLowerCase();
  if (/data analyst|data technician/.test(title)) return "Improves reporting quality, data confidence and decision visibility.";
  if (/cyber security/.test(title)) return "Improves cyber resilience, secure working practices and first-line protection of business systems.";
  if (/artificial intelligence|automation practitioner/.test(title)) return "Accelerates responsible AI adoption, workflow automation and productivity improvement.";
  if (/procurement|supply chain/.test(title)) return "Strengthens supplier management, commercial control and procurement capability.";
  if (/people professional/.test(title)) return "Strengthens employee relations, people policy and workforce advisory capability.";
  if (/accounts or finance/.test(title)) return "Improves finance processing, reconciliations, reporting accuracy and financial control.";
  if (/school business/.test(title)) return "Improves school business operations, trust administration, reporting and education support processes.";
  if (/marketing executive/.test(title)) return "Improves campaign performance, marketing planning, customer growth and marketing analytics.";
  if (/digital support|information communications/.test(title)) return "Builds digital confidence and reduces technology friction across teams.";
  if (/improvement practitioner/.test(title)) return "Supports measurable process improvement, productivity and operational performance.";
  if (/customer service/.test(title)) return "Improves customer handling, service consistency and escalation confidence.";
  return "Builds role-specific capability that supports the employer's workforce plan.";
}

function recommendationEmployeeBenefit(definition: PathwayDefinition) {
  const title = definition.title.toLowerCase();
  if (/data analyst|data technician/.test(title)) return "Gives the employee a practical route from manual reporting into stronger data and insight work.";
  if (/cyber security/.test(title)) return "Builds a credible progression route from IT support into cyber security practice.";
  if (/artificial intelligence|automation practitioner/.test(title)) return "Develops confidence using AI and automation to improve real business workflows.";
  if (/procurement|supply chain/.test(title)) return "Develops commercial judgement, sourcing confidence and supplier management skills.";
  if (/people professional/.test(title)) return "Develops stronger advisory confidence across employee relations, policy and people practice.";
  if (/accounts or finance/.test(title)) return "Builds a stronger finance foundation while opening a route into reporting and data work.";
  if (/school business/.test(title)) return "Connects school administration experience to broader trust operations and progression.";
  if (/marketing executive/.test(title)) return "Strengthens campaign planning, marketing analytics and automation confidence.";
  if (/digital support|information communications/.test(title)) return "Builds confidence with digital systems, user support and practical workplace technology.";
  if (/improvement practitioner/.test(title)) return "Develops structured improvement, problem solving and performance optimisation skills.";
  return "Creates a clearer progression route linked to the employee's role and future goals.";
}

function suggestedQuestionsFor(definition: PathwayDefinition) {
  const title = definition.title.toLowerCase();
  if (/data analyst|data technician/.test(title)) return ["Which reports or decisions should improve first?", "Which tools does the employee use today, such as Excel, SQL, Power BI or CRM?"];
  if (/cyber security|information communications|digital support/.test(title)) return ["Which systems, devices or networks does the employee support today?", "Is the future goal cyber security, cloud infrastructure or broader digital support?"];
  if (/artificial intelligence|automation practitioner/.test(title)) return ["Which manual workflow should be automated first?", "Which AI tools are approved or planned inside the organisation?"];
  if (/procurement|supply chain/.test(title)) return ["Which supplier or contract outcomes need to improve?", "Does the role involve sourcing, tendering, contract management or supply chain operations?"];
  if (/customer service/.test(title)) return ["Which customer situations should the employee handle with more confidence?", "Is the progression goal coaching others, improving service quality or handling complex escalations?"];
  if (/people professional/.test(title)) return ["Which people advisory situations does the employee handle today?", "Is the goal employee relations, policy, recruitment or workforce planning?"];
  if (/accounts or finance/.test(title)) return ["Which finance process does the employee own today?", "Is the goal better reconciliations, month-end reporting or broader finance analysis?"];
  if (/school business/.test(title)) return ["Which school or MAT processes need to improve first?", "Which systems support attendance, records and parent communications today?"];
  if (/marketing executive/.test(title)) return ["Which campaigns or channels does the employee manage today?", "Is the goal campaign performance, CRM automation or AI-supported content workflows?"];
  if (/improvement practitioner/.test(title)) return ["Which operational process should improve first?", "What performance measure should change, such as quality, waste, downtime or productivity?"];
  return ["Which specific work outcome should the programme improve?", "Which delivery model would fit the role and site best?"];
}

function buildStrategicRecommendationSummary(request: LevyTateAiRequest, recommendations: LevyTatePlatformRecommendation[], currentCapabilityProfile: LevyTateCapabilityScore[], futureCapabilityProfile: LevyTateCapabilityScore[], strategyProfile: StrategicPriorityProfile): LevyTateStrategicRecommendation | null {
  const top = recommendations[0];
  if (!top) return null;
  const strategicText = uniqueText([
    request.userMessage,
    request.conversationProfile?.careerGoal,
    request.conversationProfile?.reasonForDevelopment,
    request.contextData?.selectedPersona?.role,
    request.employeeDiscovery?.roleTitle,
    ...(request.employeeDiscovery?.futureCapabilities ?? []),
    ...(request.employerPriorities?.map((priority) => priority.name) ?? []),
    ...strategyProfile.priorities,
  ]).toLowerCase();
  let strategicRecommendation = top.title;
  let futureDevelopmentOpportunity = recommendations[1]?.title ?? null;
  let businessImpact = top.businessImpact;
  let organisationBenefit = top.organisationBenefit;
  let employeeBenefit = top.employeeBenefit;
  let whyRecommended = top.rationale;
  if (/business support|admin assistant|administrator|administration/.test(strategicText) && /report|data|spreadsheet|crm|ai|automation|microsoft 365|copilot/.test(strategicText)) {
    strategicRecommendation = "Microsoft 365 AI Programme";
    futureDevelopmentOpportunity = "Level 4 Data Analyst";
    businessImpact = "Moves manual administration towards better reporting, workflow improvement and confident AI-enabled productivity.";
    organisationBenefit = "Supports AI rollout while creating a realistic data pathway from administration into insight work.";
    employeeBenefit = "Gives the employee a practical first step from admin-heavy work into reporting, automation and digital confidence.";
    whyRecommended = "The current apprenticeship fit is data technician, while the strategic programme layer points to Microsoft 365 AI because the evidence combines reporting, admin processes, CRM updates and AI adoption.";
  } else if (/data analyst|reporting analyst|business intelligence|predictive|forecast|data maturity|advanced analytics|ai/.test(strategicText) && top.title.toLowerCase().includes("data analyst")) {
    strategicRecommendation = "AI Practitioner";
    futureDevelopmentOpportunity = "Level 6 Data Scientist";
    businessImpact = "Builds stronger analytics maturity and creates a route towards predictive insight and AI-enabled reporting.";
    organisationBenefit = "Connects current data capability to the organisation's data maturity and AI adoption priorities.";
    employeeBenefit = "Gives the employee a credible progression route beyond reporting into advanced analytics and AI-enabled insight.";
    whyRecommended = "The current best fit remains Data Analyst because the role already shows strong analysis and BI evidence. The strategic layer adds AI Practitioner as the future development opportunity because the stated direction is predictive analytics and AI.";
  } else if (/procurement|commercial transformation|supplier|sourcing|contract|buying/.test(strategicText)) {
    strategicRecommendation = top.title.toLowerCase().includes("procurement") ? top.title : "Procurement and Supply Chain Practitioner";
    futureDevelopmentOpportunity = "Commercial transformation and supplier insight pathway";
    businessImpact = "Improves supplier control, commercial judgement and procurement decision quality.";
    organisationBenefit = "Aligns apprenticeship investment to commercial transformation rather than generic business development.";
    employeeBenefit = "Strengthens practical procurement capability and gives the employee a clearer commercial progression route.";
    whyRecommended = "The strongest evidence is procurement, supplier and commercial transformation. LevyTate therefore prioritises a procurement route rather than a generic business or management standard.";
  }
  const whyOtherRoutesRankedLower = recommendations.slice(1, 4).map((item) => item.title + " ranked lower because " + (item.missingEvidence[0]?.toLowerCase() ?? "its capability and strategy fit were weaker than the top route.")).slice(0, 3);
  const missingEvidence = [...new Set(recommendations.flatMap((item) => item.missingEvidence).slice(0, 5))];
  const currentCapability = highestCapability(currentCapabilityProfile);
  const futureCapability = highestCapability(futureCapabilityProfile);
  const suggestedQuestions = top.suggestedQuestions.length ? top.suggestedQuestions : [
    "Which work outcome should improve first?",
    "What tools or systems does the employee use most often?",
    "Which delivery model would fit the role and site best?",
  ];
  return {
    currentBestFit: top.title,
    futureDevelopmentOpportunity,
    strategicRecommendation,
    alternativeRoute: recommendations[1]?.title ?? null,
    confidence: top.confidence,
    businessImpact,
    organisationBenefit,
    employeeBenefit,
    whyRecommended,
    whyOtherRoutesRankedLower,
    missingEvidence,
    suggestedQuestions,
    organisationPrioritiesInfluenced: strategyProfile.priorities.slice(0, 5),
    employeeCapabilitiesInfluenced: [currentCapability?.domain, futureCapability?.domain].filter((item): item is string => Boolean(item)),
  };
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
  const currentCapabilityProfile = buildCapabilityProfile(request);
  const futureCapabilityProfile = buildFutureCapabilityProfile(request);
  const strategyProfile = buildOrganisationStrategyProfile(request);
  const profileMap = capabilityMap(currentCapabilityProfile);
  const futureMap = capabilityMap(futureCapabilityProfile);
  const strategyMap = capabilityMap(strategyProfile.capabilityProfile);
  const scoredRecommendations: ScoredRecommendation[] = availableDefinitions(request).map((definition) => {
    const roleEvidence = roleMappingEvidence(request, definition);
    const { capabilityFit, evidence, missingEvidence } = recommendationEvidence(definition, profileMap, roleEvidence);
    const currentFitScore = fitForDefinition(definition, capabilityFit, roleEvidence, missingEvidence);
    const futureFitScore = fitAgainstProfile(definition, futureMap);
    const strategyFitScore = fitAgainstProfile(definition, strategyMap);
    const providerFitScore = providerCapabilityScore(request, definition);
    const strategicLift = Math.max(0, futureFitScore - 45) * 0.1 + Math.max(0, strategyFitScore - 45) * 0.12 + Math.max(0, providerFitScore - 60) * 0.04;
    const fitScore = clamp(currentFitScore + strategicLift);
    const previous = previousScore(request, definition.pathwayId);
    const mapped = roleEvidence.some((item) => item.source === "role_mapping") || request.availablePathways?.some((item) => item.title.toLowerCase() === definition.title.toLowerCase() && /approved|live/i.test(item.status ?? ""));
    const availability: LevyTatePlatformRecommendation["availability"] = mapped ? "approved" : "role_fit_review";
    const eligibility: LevyTatePlatformRecommendation["eligibility"] = mapped ? "eligible" : "requires_review";
    const strategicSignals = strategicSignalsFor(definition, currentCapabilityProfile, futureCapabilityProfile, strategyProfile, futureFitScore, strategyFitScore, providerFitScore);
    const businessImpact = recommendationBusinessImpact(definition);
    const employeeBenefit = recommendationEmployeeBenefit(definition);
    return {
      pathwayId: definition.pathwayId,
      title: definition.title,
      fitScore,
      scoreDelta: previous === undefined ? 0 : fitScore - previous,
      confidence: clamp(confidenceFor(capabilityFit, evidence, missingEvidence) + Math.max(0, futureFitScore - 55) * 0.08 + Math.max(0, strategyFitScore - 55) * 0.08),
      rationale: missingEvidence.length ? definition.rationale + " Missing evidence to confirm: " + missingEvidence.join("; ") + "." : definition.rationale,
      evidence,
      missingEvidence,
      capabilityFit,
      strategicRole: "supporting_option" as const,
      strategicSignals,
      businessImpact,
      organisationBenefit: businessImpact,
      employeeBenefit,
      providerRationale: providerRationaleFor(providerFitScore),
      programmeRationale: programmeRationaleFor(definition, futureFitScore, strategyFitScore),
      whyRankedLower: missingEvidence.length ? missingEvidence : ["This route needs more direct evidence before it should rank higher."],
      suggestedQuestions: suggestedQuestionsFor(definition),
      availability,
      eligibility,
      providerAvailability: providerAvailabilityFor(request, definition),
      futureFitScore,
      strategyFitScore,
      providerFitScore,
    };
  }).filter((item) => item.fitScore >= 45 || item.futureFitScore >= 58 || item.strategyFitScore >= 58).sort((left, right) => right.fitScore - left.fitScore || right.confidence - left.confidence || left.title.localeCompare(right.title)).slice(0, 4);

  const recommendations = scoredRecommendations.map((item, index) => {
    const { futureFitScore, strategyFitScore, providerFitScore, ...recommendation } = item;
    void providerFitScore;
    const strategicRole: LevyTatePlatformRecommendation["strategicRole"] = index === 0
      ? "current_best_fit"
      : futureFitScore >= 70 && strategyFitScore >= 55
        ? "future_development"
        : index === 1
          ? "alternative_route"
          : "supporting_option";
    return { ...recommendation, strategicRole };
  });

  const topRecommendation = recommendations[0] ?? null;
  const strategicEvidenceBonus = topRecommendation?.strategicSignals.some((item) => item.category === "future_capability" || item.category === "business_strategy" || item.category === "organisation_priority") ? 6 : 0;
  const confidence = clamp((topRecommendation?.confidence ?? 0) + strategicEvidenceBonus);
  const enoughEvidence = Boolean(topRecommendation && ((topRecommendation.evidence.length >= 2 && topRecommendation.capabilityFit.some((item) => item.score >= 55)) || topRecommendation.strategicSignals.length >= 2));
  const shouldRevealRecommendations = Boolean(topRecommendation && confidence >= revealThreshold && enoughEvidence);
  const strategicRecommendation = buildStrategicRecommendationSummary(request, recommendations, currentCapabilityProfile, futureCapabilityProfile, strategyProfile);
  const capabilitySignature = currentCapabilityProfile.filter((item) => item.score > 0).map((item) => item.domain + ":" + item.score + ":" + item.evidence.join(",")).join("|");
  const futureSignature = futureCapabilityProfile.filter((item) => item.score > 0).map((item) => item.domain + ":" + item.score + ":" + item.evidence.join(",")).join("|");
  const strategySignature = strategyProfile.priorities.join("|") + strategyProfile.capabilityProfile.filter((item) => item.score > 0).map((item) => item.domain + ":" + item.score).join("|");
  const signature = recommendations.map((item) => item.pathwayId + ":" + item.fitScore + ":" + item.evidence.map((entry) => entry.id).sort().join(",") + ":" + item.missingEvidence.join(",") + ":" + item.strategicRole).join("|") + capabilitySignature + futureSignature + strategySignature;
  const recommendationVersion = "rec-" + recommendationEngineVersion + "-" + stableHash(signature);

  return {
    recommendations,
    topRecommendation,
    recommendationVersion,
    confidence,
    revealThreshold,
    shouldRevealRecommendations,
    evidenceChanged: request.previousRecommendationResult?.recommendationVersion !== recommendationVersion,
    capabilityProfile: currentCapabilityProfile,
    currentCapabilityProfile,
    futureCapabilityProfile,
    strategicRecommendation,
  };
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
