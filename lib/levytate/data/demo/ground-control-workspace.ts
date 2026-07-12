import type { LevyTateRecommendationResult } from "@/lib/levytate/ai/types";
import { buildLevyTateRecommendations } from "@/lib/levytate/ai/recommendationEngine";
import { groundControlImportSummary, groundControlOrganisationRows, groundControlPersonaImports, type GroundControlOrganisationRow, type GroundControlPersonaImport } from "@/lib/levytate/data/demo/ground-control-import";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import {
  calculateLearnerProgressVariance,
  createLearnerLifecycleEvent,
  englandWorkingHoursDeclarationVersion,
  englandWorkingHoursDeclarationWording,
  type LearnerLifecycleCollections,
  type LearnerLifecycleStatus,
  type LearnerOperationalActionType,
  type LearnerReviewType,
} from "@/lib/levytate/mvp/learner-lifecycle";
import {
  applicationOwnerForStatus,
  buildApplicationHistoryEntry,
  createEmptyMvpWorkspace,
  type MvpApplication,
  type MvpEmployee,
  type MvpEmployeeDevelopmentProfile,
  type MvpEnrolment,
  type MvpMatchingRequest,
  type MvpPathwayMapping,
  type MvpProviderRelationship,
  type MvpRole,
  type MvpWorkspaceData,
} from "@/lib/levytate/mvp/workspace";

const createdAt = "2026-07-07T09:00:00.000Z";
const updatedAt = "2026-07-07T09:00:00.000Z";
const demoSeparator = " - ";

type RoleSeed = {
  id: string;
  title: string;
  department: string;
  businessArea: string;
  careerLevel: MvpRole["careerLevel"];
  skillsTags: string[];
  progression: string[];
  mappings: Array<Omit<MvpPathwayMapping, "id">>;
};

type EmployeeSeed = {
  id: string;
  employeeNumber: string;
  name: string;
  roleId: string;
  managerId: string;
  department: string;
  subdivision?: string;
  team?: string;
  jobRole?: string;
  site: string;
  platformRole: MvpEmployee["platformRole"];
  currentSkills: string[];
  futureCapabilities: string[];
  aiOpportunities: string[];
  dataOpportunities: string[];
  automationOpportunities: string[];
  responsibilities: string[];
  recommendation: {
    standardId: string;
    title: string;
    fitScore: number;
    provider: string;
    rationale: string;
    evidence: string[];
    missingEvidence?: string[];
  };
  applicationStatus?: MvpApplication["status"];
  applicationReason?: string;
  careerGoal?: string;
  supportRequired?: string;
};

const sites = [
  "Billericay Support Office",
  "Leeds Regional Hub",
  "Manchester Regional Hub",
  "Birmingham Regional Hub",
  "Bristol Regional Hub",
  "Scotland Operations Hub",
  "South East Field Region",
  "North West Field Region",
];

const importedDivisions = unique(groundControlOrganisationRows.map((row) => row.division).filter(Boolean));
const importedSubdivisions = unique(groundControlOrganisationRows.map((row) => row.subdivision).filter(Boolean));
const employeeIdByNumber = new Map(
  groundControlPersonaImports.map((seed, index) => [seed.employeeNumber, `gc-emp-${String(index + 1).padStart(3, "0")}`]),
);
const spreadsheetRoleSeeds: RoleSeed[] = groundControlOrganisationRows.map(toSpreadsheetRoleSeed);
const spreadsheetRoleByTitle = new Map(spreadsheetRoleSeeds.map((role) => [normaliseLookup(role.title), role]));
const spreadsheetEmployeeSeeds: EmployeeSeed[] = groundControlPersonaImports.map(toSpreadsheetEmployeeSeed);

function toSpreadsheetRoleSeed(row: GroundControlOrganisationRow): RoleSeed {
  const recommendation = recommendationForRow(row);
  const alternative = alternativeForRow(row, recommendation.standardId);
  return {
    id: row.roleId,
    title: row.jobTitle,
    department: row.division,
    businessArea: compact([row.subdivision, row.team]).join(" / ") || row.division,
    careerLevel: careerLevelFor(row),
    skillsTags: skillsFor(row),
    progression: progressionFor(row),
    mappings: [
      mapping(recommendation.standardId, "Primary", 1, recommendation.rationale),
      mapping(alternative.standardId, "Alternative", 2, alternative.rationale),
    ],
  };
}

function toSpreadsheetEmployeeSeed(seed: GroundControlPersonaImport, index: number): EmployeeSeed {
  const role = spreadsheetRoleByTitle.get(normaliseLookup(seed.jobTitle));
  const row = groundControlOrganisationRows.find((item) => normaliseLookup(item.jobTitle) === normaliseLookup(seed.jobTitle));
  const recommendation = row ? recommendationForRow(row) : rec("ST0192", "Level 4 Improvement Practitioner", 78, "Apprentify", "Useful where the role can evidence operational improvement, productivity or service quality benefits.", ["Ground Control productivity priority", "Role-led development need"]);
  return {
    id: employeeIdByNumber.get(seed.employeeNumber) ?? `gc-emp-${String(index + 1).padStart(3, "0")}`,
    employeeNumber: seed.employeeNumber,
    name: seed.name,
    roleId: role?.id ?? row?.roleId ?? `gc-role-imported-${index + 1}`,
    managerId: seed.managerEmployeeNumber ? employeeIdByNumber.get(seed.managerEmployeeNumber) ?? "" : "",
    department: row?.division ?? "Ground Control",
    subdivision: row?.subdivision,
    team: row?.team,
    jobRole: row?.jobRole,
    site: seed.site,
    platformRole: seed.platformRole,
    currentSkills: row ? skillsFor(row).slice(0, 4) : ["Operational delivery", "Customer service"],
    futureCapabilities: row ? futureCapabilitiesFor(row) : ["Operational improvement", "Digital confidence"],
    aiOpportunities: row ? aiOpportunitiesFor(row) : ["Workflow summaries"],
    dataOpportunities: row ? dataOpportunitiesFor(row) : ["Performance reporting"],
    automationOpportunities: row ? automationOpportunitiesFor(row) : ["Process automation"],
    responsibilities: row ? responsibilitiesFor(row) : [`Performs the ${seed.jobTitle} role`, "Contributes to Ground Control priorities"],
    recommendation,
    applicationStatus: normaliseApplicationStatus(seed.applicationStatus),
    applicationReason: `I want to build capability in ${recommendation.evidence[0]?.toLowerCase() ?? "my current role"} and support Ground Control's priorities.`,
    careerGoal: row ? futureCapabilitiesFor(row)[0] : "Career progression",
    supportRequired: "Manager support to evidence workplace projects and protect study time.",
  };
}

function recommendationForRow(row: GroundControlOrganisationRow): EmployeeSeed["recommendation"] {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);

  if (matches(text, ["data", "insight", "reporting", "analyst", "power bi", "performance"])) {
    return rec("ST0118", "Level 4 Data Analyst", 91, "QA", "Strong fit where the role works with reporting, insight, data quality or performance decisions.", ["Reporting and insight evidence", "Ground Control data capability priority", "Business performance visibility"]);
  }

  if (matches(text, ["business analyst", "product owner", "transformation", "system", "application architect", "change"])) {
    return rec("ST0117", "Level 4 Business Analyst", 89, "QA", "Strong fit where the role translates operational needs into digital change, process design and system requirements.", ["Process mapping", "Digital transformation priority", "Stakeholder requirements"]);
  }

  if (matches(text, ["3rd line", "infrastructure", "network", "devops", "cyber", "support technician"])) {
    return rec("ST0973", "Level 3 Information Communications Technician", 88, "HBTC", "Relevant for infrastructure, network and technical support capability across a distributed workforce.", ["IT support evidence", "Digital capability priority", "Technology service delivery"]);
  }

  if (matches(text, ["it support", "digital support", "service desk", "desktop", "user support"])) {
    return rec("ST0120", "Level 3 Digital Support Technician", 87, "HBTC", "Strong fit where the role supports Microsoft 365, users, devices and digital adoption.", ["User support", "Microsoft 365 or systems support", "Digital confidence"]);
  }

  if (matches(text, ["procurement", "buyer", "supply chain", "supplier", "commercial"])) {
    if (matches(text, ["manager", "lead", "head", "director", "senior"])) {
      return rec("ST0811", "Level 4 Commercial Procurement and Supply", 89, "SRSCC", "Strong fit for strategic sourcing, supplier performance and commercial governance.", ["Supplier management", "Commercial performance priority", "Sustainable procurement opportunity"]);
    }
    return rec("ST0810", "Level 3 Procurement and Supply Assistant", 86, "SRSCC", "Practical fit for developing sourcing, supplier coordination and procurement administration capability.", ["Procurement role", "Supplier coordination", "Commercial control"]);
  }

  if (matches(text, ["finance", "accounts", "payroll", "credit", "purchase ledger"])) {
    return rec("ST0608", "Level 2 Accounts or Finance Assistant", 84, "HBTC", "Appropriate where the role needs stronger finance processing, controls and reporting confidence.", ["Finance operations", "Controls and accuracy", "Reporting opportunity"]);
  }

  if (matches(text, ["people", "hr", "talent", "recruit", "learning", "organisational development"])) {
    return rec("ST0238", "Level 5 People Professional", 86, "LevyTate provider matching", "Fits HR, talent and people roles where the priority is workforce capability, employee experience and organisational development.", ["People function role", "Workforce planning", "Capability development"]);
  }

  if (matches(text, ["hsqe", "safety", "health", "environment", "quality", "compliance", "risk", "audit"])) {
    return rec("ST0550", "Level 3 Safety, Health and Environment Technician", 90, "RHG Consult", "Direct fit for operational safety, health, environment, risk and compliance capability.", ["Safety and compliance evidence", "Ground Control health and safety priority", "Field assurance"]);
  }

  if (matches(text, ["sustainability", "biodiversity", "ecology", "environmental", "carbon", "nature"])) {
    return rec("ST0934", "Level 4 Corporate Responsibility and Sustainability Practitioner", 88, "RHG Consult", "Supports sustainability, biodiversity, carbon and responsible business outcomes.", ["Sustainability priority", "Environmental expertise", "Client impact"]);
  }

  if (matches(text, ["arbor", "tree", "forestry", "vegetation", "veg"])) {
    return rec("ST0921", "Level 4 Arboriculturist", 87, "LevyTate provider matching", "Best specialist route where the role is centred on arboriculture, vegetation management and technical tree work.", ["Arboriculture role", "Field safety", "Technical land-based capability"]);
  }

  if (matches(text, ["grounds", "landscape", "horticulture", "litter", "operative", "team leader"])) {
    return rec("ST0226", "Level 3 Horticulture or Landscape Supervisor", 85, "LevyTate provider matching", "Relevant for landscape maintenance, grounds operations, crew supervision and service quality.", ["Landscape maintenance", "Operational productivity", "Field team development"]);
  }

  if (matches(text, ["rail", "construction", "site", "project", "quantity surveyor", "estimator", "mobilisation"])) {
    if (matches(text, ["quantity surveyor", "commercial surveyor"])) {
      return rec("ST0049", "Level 4 Construction Quantity Surveying Technician", 87, "Learning Curve Group", "Relevant where the role needs cost, commercial and construction project controls capability.", ["Commercial construction role", "Project controls", "Cost management"]);
    }
    return rec("ST0310", "Level 4 Associate Project Manager", 86, "Learning Curve Group", "Strong fit where work involves delivery planning, mobilisation, risk, stakeholders and project controls.", ["Project delivery", "Operational planning", "Cross-functional coordination"]);
  }

  if (matches(text, ["marketing", "campaign", "brand", "communications", "digital marketing"])) {
    return rec("ST1031", "Level 3 Multi-channel Marketer", 85, "The Marketing Trainer", "Fits roles focused on campaigns, content, digital channels and customer engagement.", ["Marketing activity", "Digital communication", "Brand and customer engagement"]);
  }

  if (matches(text, ["bid", "proposal", "tender"])) {
    return rec("ST0056", "Level 3 Bid and Proposal Co-ordinator", 86, "RHG Consult", "Directly supports bid writing, tender coordination and commercial opportunity development.", ["Bid activity", "Tender process", "Commercial performance"]);
  }

  if (matches(text, ["customer", "client", "account", "service", "crm"])) {
    return rec("ST0071", "Level 3 Customer Service Specialist", 84, "Learning Curve Group", "Strong fit where the role owns customer conversations, service recovery, CRM updates or account support.", ["Customer contact", "Service quality", "Customer experience priority"]);
  }

  if (matches(text, ["admin", "administrator", "coordinator", "assistant", "scheduler", "planner"])) {
    return rec("ST0070", "Level 3 Business Administrator", 82, "Learning Curve Group", "Useful for building structured administration, coordination, process and stakeholder support skills.", ["Administrative coordination", "Process improvement", "Business support"]);
  }

  return rec("ST0192", "Level 4 Improvement Practitioner", 78, "Apprentify", "Useful where the role can evidence operational improvement, productivity, quality or service redesign benefits.", ["Operational productivity priority", "Continuous improvement opportunity", "Role-led workplace project"]);
}

function alternativeForRow(row: GroundControlOrganisationRow, primaryStandardId: string) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  const fallback = matches(text, ["data", "analyst", "reporting"])
    ? rec("ST0117", "Level 4 Business Analyst", 82, "QA", "Alternative if the role moves more toward process change and requirements.", ["Process change", "Stakeholder insight"])
    : matches(text, ["field", "grounds", "landscape", "arbor", "operations"])
      ? rec("ST0192", "Level 4 Improvement Practitioner", 82, "Apprentify", "Alternative where productivity, quality and safer operating routines become the main development focus.", ["Operational improvement", "Crew productivity"])
      : rec("ST0118", "Level 4 Data Analyst", 80, "QA", "Alternative if the role needs stronger reporting and insight capability.", ["Data visibility", "Performance reporting"]);
  return fallback.standardId === primaryStandardId
    ? rec("ST0070", "Level 3 Business Administrator", 76, "Learning Curve Group", "Alternative for structured business coordination and process administration.", ["Business coordination", "Process discipline"])
    : fallback;
}

function rec(
  standardId: string,
  title: string,
  fitScore: number,
  provider: string,
  rationale: string,
  evidence: string[],
  missingEvidence: string[] = [],
): EmployeeSeed["recommendation"] {
  return { standardId, title, fitScore, provider, rationale, evidence, missingEvidence };
}

function normaliseApplicationStatus(value: string): MvpApplication["status"] | undefined {
  const lookup: Record<string, MvpApplication["status"]> = {
    Draft: "Draft",
    "Submitted to Line Manager": "Submitted to Line Manager",
    "Awaiting Manager Review": "Awaiting Manager Review",
    "Approved by Line Manager": "Approved by Line Manager",
    "Submitted to Apprenticeship Lead": "Submitted to Apprenticeship Lead",
    "Awaiting Final Approval": "Awaiting Final Approval",
    "Approved for Enrolment": "Approved for Enrolment",
    "Declined by Line Manager": "Declined by Line Manager",
    "Declined by Apprenticeship Lead": "Declined by Apprenticeship Lead",
  };
  return lookup[value];
}

function careerLevelFor(row: GroundControlOrganisationRow): MvpRole["careerLevel"] {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole}`);
  if (matches(text, ["apprentice", "trainee", "assistant", "operative", "administrator"])) return "Entry";
  if (matches(text, ["team leader", "supervisor", "coordinator", "advisor", "specialist", "analyst", "technician", "engineer", "surveyor", "consultant"])) return "Experienced";
  if (matches(text, ["senior manager", "head of", "director", "chief", "cio"])) return "Senior Manager";
  if (matches(text, ["manager", "lead", "product owner"])) return "Manager";
  return "Experienced";
}

function skillsFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  if (matches(text, ["data", "reporting", "analyst", "insight"])) return ["Reporting", "Data quality", "Stakeholder insight", "Performance dashboards"];
  if (matches(text, ["it", "support", "digital", "network", "infrastructure"])) return ["Digital support", "Systems", "Microsoft 365", "Service delivery"];
  if (matches(text, ["procurement", "buyer", "supplier"])) return ["Supplier management", "Sourcing", "Commercial governance", "Contract value"];
  if (matches(text, ["finance", "accounts", "payroll"])) return ["Financial processing", "Controls", "Accuracy", "Reporting"];
  if (matches(text, ["safety", "hsqe", "quality", "compliance", "risk"])) return ["Safety assurance", "Compliance", "Risk management", "Audits"];
  if (matches(text, ["arbor", "tree", "grounds", "landscape", "horticulture", "field"])) return ["Field operations", "Site safety", "Quality checks", "Customer standards"];
  if (matches(text, ["customer", "client", "account"])) return ["Customer service", "CRM", "Issue resolution", "Account support"];
  return compact([row.jobRole, row.team, row.subdivision, "Operational delivery"]).slice(0, 4);
}

function futureCapabilitiesFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  if (matches(text, ["data", "analyst", "reporting"])) return ["Predictive insight", "AI-enabled reporting", "Business performance visibility"];
  if (matches(text, ["it", "digital", "support", "system"])) return ["Cloud confidence", "AI-enabled service support", "Digital adoption"];
  if (matches(text, ["procurement", "commercial", "buyer"])) return ["Sustainable sourcing", "Supplier performance", "Commercial analytics"];
  if (matches(text, ["safety", "hsqe", "compliance", "quality"])) return ["Digital inspections", "Safety culture", "Risk prevention"];
  if (matches(text, ["field", "grounds", "landscape", "arbor", "operations"])) return ["Operational productivity", "Crew coordination", "Safer ways of working"];
  return ["Process improvement", "Digital confidence", "Career progression"];
}

function dataOpportunitiesFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  if (matches(text, ["data", "finance", "commercial", "procurement", "operations", "field", "fleet"])) return ["Performance dashboards", "Trend reporting", "Data quality checks"];
  if (matches(text, ["safety", "compliance", "quality"])) return ["Incident trend reporting", "Audit dashboards"];
  return ["Progress reporting", "Team activity summaries"];
}

function aiOpportunitiesFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  if (matches(text, ["field", "operations", "grounds", "arbor", "rail", "utilities"])) return ["AI job summaries", "Route and task prioritisation prompts"];
  if (matches(text, ["customer", "client", "account"])) return ["Customer conversation summaries", "CRM prompt support"];
  if (matches(text, ["data", "it", "digital", "business analyst"])) return ["AI insight prompts", "Workflow discovery"];
  return ["AI-supported admin summaries"];
}

function automationOpportunitiesFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole} ${row.division} ${row.subdivision} ${row.team}`);
  if (matches(text, ["admin", "coordinator", "planner", "scheduler"])) return ["Workflow automation", "Approval reminders", "Document routing"];
  if (matches(text, ["fleet", "field", "operations"])) return ["Schedule reminders", "Evidence capture workflows"];
  if (matches(text, ["finance", "procurement"])) return ["Supplier and invoice workflow checks"];
  return ["Process prompts", "Routine task reminders"];
}

function responsibilitiesFor(row: GroundControlOrganisationRow) {
  return compact([
    row.jobRole ? `Performs the ${row.jobRole} role` : `Performs the ${row.jobTitle} role`,
    row.team ? `Works in ${row.team}` : row.subdivision ? `Works in ${row.subdivision}` : "Works in Ground Control operations",
    row.division ? `Part of ${row.division}` : "Part of Ground Control",
    "Contributes to operational productivity, safety, customer service and workforce readiness priorities",
  ]);
}

function progressionFor(row: GroundControlOrganisationRow) {
  const text = normaliseLookup(`${row.jobTitle} ${row.jobRole}`);
  if (matches(text, ["assistant", "administrator", "coordinator", "apprentice", "trainee", "junior", "operative", "technician"])) return ["Experienced specialist", "Team Leader", "Supervisor"];
  if (matches(text, ["team leader", "supervisor", "advisor", "analyst", "engineer", "surveyor", "consultant"])) return ["Senior Specialist", "Manager", "Capability Lead"];
  if (matches(text, ["manager", "lead", "product owner"])) return ["Senior Manager", "Head of Function", "Director"];
  if (matches(text, ["director", "chief", "head of", "cio"])) return ["Executive sponsor", "Strategic capability owner"];
  return ["Career progression", "Future specialist route"];
}

type LifecycleScenario = {
  key: string;
  title: string;
  employeeIndex: number;
  lifecycleStatus: LearnerLifecycleStatus;
  employmentRoute: "existing_employee_upskill" | "recruited_as_apprentice" | "not_confirmed";
  startOffsetDays: number;
  durationMonths: number;
  targetProgress: number;
  actualProgress: number;
  providerReviewDate: string;
  landdCheckInDate: string;
  notes: string;
};

const lifecycleScenarios: LifecycleScenario[] = [
  { key: "pre-enrolment", title: "Pre-enrolment", employeeIndex: 0, lifecycleStatus: "pre_enrolment", employmentRoute: "existing_employee_upskill", startOffsetDays: 45, durationMonths: 18, targetProgress: 0, actualProgress: 0, providerReviewDate: "2026-08-05", landdCheckInDate: "2026-07-18", notes: "Awaiting HR and probation confirmation before provider enrolment." },
  { key: "on-track", title: "Enrolled and on track", employeeIndex: 1, lifecycleStatus: "enrolled", employmentRoute: "existing_employee_upskill", startOffsetDays: -160, durationMonths: 18, targetProgress: 32, actualProgress: 36, providerReviewDate: "2026-06-24", landdCheckInDate: "2026-07-02", notes: "Learner is ahead of target and using workplace evidence from field reporting." },
  { key: "behind-target", title: "Enrolled and behind target", employeeIndex: 2, lifecycleStatus: "enrolled", employmentRoute: "existing_employee_upskill", startOffsetDays: -210, durationMonths: 18, targetProgress: 44, actualProgress: 31, providerReviewDate: "2026-06-27", landdCheckInDate: "2026-07-04", notes: "Learner needs manager support to recover delayed off-the-job evidence." },
  { key: "break", title: "Active break in learning", employeeIndex: 3, lifecycleStatus: "break_in_learning", employmentRoute: "existing_employee_upskill", startOffsetDays: -120, durationMonths: 18, targetProgress: 25, actualProgress: 22, providerReviewDate: "2026-05-29", landdCheckInDate: "2026-06-12", notes: "Temporary operational redeployment has paused learning activity." },
  { key: "withdrawn", title: "Withdrawn", employeeIndex: 4, lifecycleStatus: "withdrawn", employmentRoute: "existing_employee_upskill", startOffsetDays: -260, durationMonths: 18, targetProgress: 52, actualProgress: 18, providerReviewDate: "2026-04-30", landdCheckInDate: "2026-05-10", notes: "Withdrawal recorded after role change and learner/provider discussion." },
  { key: "assessment-prep", title: "Assessment preparation", employeeIndex: 5, lifecycleStatus: "assessment_preparation", employmentRoute: "recruited_as_apprentice", startOffsetDays: -430, durationMonths: 18, targetProgress: 88, actualProgress: 86, providerReviewDate: "2026-06-20", landdCheckInDate: "2026-06-26", notes: "Gateway evidence is being checked before readiness confirmation." },
  { key: "in-assessment", title: "In assessment", employeeIndex: 6, lifecycleStatus: "in_assessment", employmentRoute: "existing_employee_upskill", startOffsetDays: -470, durationMonths: 18, targetProgress: 96, actualProgress: 97, providerReviewDate: "2026-06-14", landdCheckInDate: "2026-06-21", notes: "Assessment window is active and HR/manager EPA communication has been sent." },
  { key: "achieved", title: "Achieved", employeeIndex: 7, lifecycleStatus: "achieved", employmentRoute: "existing_employee_upskill", startOffsetDays: -560, durationMonths: 18, targetProgress: 100, actualProgress: 100, providerReviewDate: "2026-05-15", landdCheckInDate: "2026-05-22", notes: "Achievement complete with certificate received and completion email sent." },
  { key: "completed-without-achievement", title: "Completed without achievement", employeeIndex: 8, lifecycleStatus: "completed_without_achievement", employmentRoute: "existing_employee_upskill", startOffsetDays: -580, durationMonths: 18, targetProgress: 100, actualProgress: 100, providerReviewDate: "2026-05-08", landdCheckInDate: "2026-05-16", notes: "Learning completed but assessment was not achieved, with follow-up advice recorded." },
];

export const groundControlWorkspace: LevyTateWorkspaceBootstrap = {
  data: buildGroundControlWorkspace(),
  meta: {
    organisationId: "demo-ground-control",
    organisationName: "Ground Control Demonstration Workspace",
    userEmail: "demo@levytate.co.uk",
    userRole: "Employer Admin",
    storageMode: "local_fallback",
    warnings: [
      "Seeded demonstration workspace. Changes are not written to the internal LevyTate MVP workspace.",
      `Imported ${groundControlImportSummary.uniqueJobTitlesImported} job titles, ${groundControlImportSummary.divisionsImported} divisions and ${importedSubdivisions.length} departments from the Ground Control spreadsheet.`,
    ],
  },
};

function buildGroundControlWorkspace(): MvpWorkspaceData {
  const empty = createEmptyMvpWorkspace();
  const roles = spreadsheetRoleSeeds.map(toRole);
  const employees = spreadsheetEmployeeSeeds.map(toEmployee);
  const employeeDevelopmentProfiles = spreadsheetEmployeeSeeds.map(toDevelopmentProfile);
  const applications = spreadsheetEmployeeSeeds.flatMap(toApplication);
  const lifecycle = learnerLifecycleData(applications);

  return sanitiseSeedValue({
    ...empty,
    profile: {
      employerName: "Ground Control",
      workspaceName: "Ground Control demonstration workspace",
      primaryContact: "Megan Rowe",
      contactEmail: "demo@levytate.co.uk",
      defaultSite: "Billericay Support Office",
      sites,
      departments: importedDivisions,
      priorities: [
        { id: "gc-priority-ai", name: "Introduce AI into the business", importance: "High", detail: "Use AI to improve field productivity, reporting summaries and customer workflows." },
        { id: "gc-priority-efficiency", name: "Increase productivity", importance: "Critical", detail: "Improve operational planning, reduce repeat visits and strengthen crew utilisation." },
        { id: "gc-priority-digital", name: "Digital transformation", importance: "High", detail: "Build digital capability across field, office and commercial teams." },
        { id: "gc-priority-engineering", name: "Compliance", importance: "High", detail: "Strengthen health, safety and environmental capability across operational teams." },
        { id: "gc-priority-data", name: "Improve data capability", importance: "Medium", detail: "Improve reporting confidence, sustainability insight and workforce visibility." },
      ],
    },
    roles,
    employees,
    employeeDevelopmentProfiles,
    applications,
    providerRelationships: providerRelationships(),
    matchingRequests: matchingRequests(),
    enrolments: enrolments(applications),
    ...lifecycle,
  });
}

function sanitiseDemoText(value: string) {
  return value
    .replace(/\u00c2\u00b7/g, "-")
    .replace(/\u00b7/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\ufffd/g, "-")
    .replace(/\s+-\s+/g, demoSeparator)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitiseSeedValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitiseDemoText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitiseSeedValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitiseSeedValue(item)]),
    ) as T;
  }

  return value;
}

function mapping(apprenticeshipStandardId: string, recommendationType: MvpPathwayMapping["recommendationType"], priority: number, businessRationale: string): Omit<MvpPathwayMapping, "id"> {
  return {
    apprenticeshipStandardId,
    recommendationType,
    priority,
    businessRationale,
    fundingRoute: "Potentially funded through levy/co-investment",
    deliveryPreference: "Blended",
  };
}

function toRole(seed: RoleSeed): MvpRole {
  return {
    id: seed.id,
    title: seed.title,
    department: seed.department,
    businessArea: seed.businessArea,
    careerLevel: seed.careerLevel,
    skillsTags: seed.skillsTags,
    progression: seed.progression,
    pathwayMappings: seed.mappings.map((item, index) => ({ ...item, id: `${seed.id}-pathway-${index + 1}` })),
    status: "Active",
    createdAt,
    updatedAt,
  };
}

function toEmployee(seed: EmployeeSeed): MvpEmployee {
  const role = spreadsheetRoleSeeds.find((item) => item.id === seed.roleId);
  return {
    id: seed.id,
    employeeNumber: seed.employeeNumber,
    name: seed.name,
    email: `${seed.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}@groundcontrol.example`,
    jobTitle: role?.title ?? "",
    roleId: seed.roleId,
    managerId: seed.managerId,
    department: seed.department,
    site: seed.site,
    platformRole: seed.platformRole,
    status: "Active",
    startDate: "2024-04-01",
    createdAt,
    updatedAt,
  };
}

function toDevelopmentProfile(seed: EmployeeSeed): MvpEmployeeDevelopmentProfile {
  const result = recommendationResult(seed);
  const role = spreadsheetRoleSeeds.find((item) => item.id === seed.roleId);
  const leadingRoute = result.topRecommendation?.title ?? "Strategic Discussion Required";
  return {
    employeeId: seed.id,
    stage: "recommendation_ready",
    responsibilities: seed.responsibilities,
    currentSkills: seed.currentSkills,
    businessFunctions: compact([seed.department, seed.subdivision, seed.team, seed.jobRole, role?.businessArea ?? seed.department]),
    currentCapabilities: seed.currentSkills,
    apprenticeshipIndicators: [seed.recommendation.title, "Role-led pathway", "Manager discussion ready"],
    aiOpportunities: seed.aiOpportunities,
    dataOpportunities: seed.dataOpportunities,
    automationOpportunities: seed.automationOpportunities,
    futureCapabilities: seed.futureCapabilities,
    conversationHistory: [
      { role: "assistant", content: `I already have ${seed.name}'s role, department, manager and organisation priorities. The current Career Intelligence outcome is ${leadingRoute}.` },
    ],
    conversationProfile: {
      currentRole: role?.title ?? "",
      currentDepartment: seed.department,
      currentEmployer: "Ground Control",
      careerGoal: seed.careerGoal ?? seed.futureCapabilities[0] ?? "Career progression",
      reasonForDevelopment: seed.applicationReason ?? seed.recommendation.rationale,
      currentSkills: seed.currentSkills,
      aiConfidence: seed.aiOpportunities.length ? 72 : 48,
      digitalConfidence: seed.dataOpportunities.length || seed.automationOpportunities.length ? 76 : 52,
      interestAreas: [...seed.futureCapabilities, ...seed.aiOpportunities].slice(0, 5),
      preferredLearningStyle: "Blended",
      managementAspirations: seed.futureCapabilities.some((item) => /manager|lead|supervisor/i.test(item)) ? "Progression into greater responsibility" : null,
      currentApplicationStatus: seed.applicationStatus ?? null,
      recommendedPathways: result.topRecommendation ? [{
        title: leadingRoute,
        confidence: result.confidence,
        stage: "recommended" as const,
        firstDiscussedAt: 1760000000000,
        lastDiscussedAt: 1760000000000,
      }] : [],
      confidence: {
        role: 90,
        careerGoal: seed.careerGoal ? 86 : 70,
        technicalConfidence: 82,
        managementAmbition: seed.futureCapabilities.some((item) => /manager|lead|supervisor/i.test(item)) ? 78 : 54,
        overall: Math.min(95, seed.recommendation.fitScore),
      },
      conversationSummary: `${seed.name} is a ${role?.title ?? "colleague"} in ${seed.department}${seed.team ? ` / ${seed.team}` : ""}. LevyTate should use Ground Control priorities around AI-enabled field operations, operational productivity, safety, sustainability, commercial performance and digital transformation when coaching this employee.`,
      questionsAlreadyAsked: ["What does the employee do today?", "What capability do they need next?"],
      questionsStillToAsk: ["Which project can evidence the pathway?", "What study time can the manager support?"],
      exchangeCount: 2,
      latestMessageClassification: "new_information",
    },
    recommendationResult: result,
    preferredStandardId: result.topRecommendation?.pathwayId ?? "",
    updatedAt,
  };
}

function recommendationResult(seed: EmployeeSeed): LevyTateRecommendationResult {
  const role = spreadsheetRoleSeeds.find((item) => item.id === seed.roleId);
  return buildLevyTateRecommendations({
    role: "Employee",
    selectedSite: seed.site,
    currentSection: "People",
    userMessage: `${role?.title ?? seed.jobRole}: ${seed.careerGoal ?? seed.futureCapabilities[0] ?? "Career progression"}`,
    conversationHistory: [{ role: "user", content: `${role?.title ?? seed.jobRole}: ${seed.responsibilities.join("; ")}. ${seed.futureCapabilities.join("; ")}` }],
    conversationProfile: {
      currentRole: role?.title ?? seed.jobRole ?? seed.department,
      currentDepartment: seed.department,
      currentEmployer: "Ground Control",
      careerGoal: seed.careerGoal ?? seed.futureCapabilities[0] ?? "Career progression",
      reasonForDevelopment: seed.applicationReason ?? seed.recommendation.rationale,
      currentSkills: seed.currentSkills,
      aiConfidence: seed.aiOpportunities.length ? 72 : 48,
      digitalConfidence: seed.dataOpportunities.length || seed.automationOpportunities.length ? 76 : 52,
      interestAreas: [...seed.futureCapabilities, ...seed.aiOpportunities].slice(0, 5),
      preferredLearningStyle: "Blended",
      managementAspirations: seed.futureCapabilities.some((item) => /manager|lead|supervisor|director|strategic/i.test(item)) ? "Progression into greater responsibility" : null,
      currentApplicationStatus: seed.applicationStatus ?? null,
      recommendedPathways: [],
      confidence: {
        role: 90,
        careerGoal: seed.careerGoal ? 86 : 70,
        technicalConfidence: 82,
        managementAmbition: seed.futureCapabilities.some((item) => /manager|lead|supervisor|director|strategic/i.test(item)) ? 78 : 54,
        overall: Math.min(95, seed.recommendation.fitScore),
      },
      conversationSummary: `${seed.name} is a ${role?.title ?? "colleague"} in ${seed.department}${seed.team ? ` / ${seed.team}` : ""}.`,
      questionsAlreadyAsked: ["What does the employee do today?", "What capability do they need next?"],
      questionsStillToAsk: ["Which project can evidence the pathway?", "What study time can the manager support?"],
      exchangeCount: 2,
      latestMessageClassification: "new_information",
    },
    employerContext: "Ground Control demonstration workspace",
    employerPriorities: [
      { name: "Operational productivity", importance: "Critical" },
      { name: "AI-enabled field operations", importance: "High" },
      { name: "Leadership capability", importance: "High" },
      { name: "Commercial performance", importance: "High" },
      { name: "Health & Safety", importance: "High" },
      { name: "Sustainability", importance: "High" },
      { name: "Digital transformation", importance: "High" },
      { name: "Customer service excellence", importance: "Medium" },
    ],
    employeeDiscovery: {
      roleTitle: role?.title ?? seed.jobRole ?? seed.department,
      department: seed.department,
      responsibilities: seed.responsibilities,
      currentSkills: seed.currentSkills,
      businessFunctions: compact([seed.department, seed.subdivision, seed.team, seed.jobRole, role?.businessArea ?? seed.department]),
      currentCapabilities: seed.currentSkills,
      apprenticeshipIndicators: ["Role-led pathway", "Manager discussion ready"],
      aiOpportunities: seed.aiOpportunities,
      dataOpportunities: seed.dataOpportunities,
      automationOpportunities: seed.automationOpportunities,
      futureCapabilities: seed.futureCapabilities,
      stage: "recommendation_ready",
    },
    workspaceEmployeeContext: {
      resolution: "selected_employee",
      missingData: [],
      employee: {
        id: seed.id,
        name: seed.name,
        employeeNumber: seed.employeeNumber,
        jobTitle: role?.title ?? seed.jobRole ?? seed.department,
        division: seed.department,
        department: seed.department,
        team: seed.team,
        manager: seed.managerId,
        location: seed.site,
        platformRole: seed.platformRole,
      },
      role: {
        title: role?.title ?? seed.jobRole ?? seed.department,
        businessArea: role?.businessArea ?? seed.department,
        careerLevel: role?.careerLevel,
        skillsTags: role?.skillsTags ?? [],
        progression: role?.progression ?? [],
        preferredPathway: seed.recommendation.title,
        businessRationale: seed.recommendation.rationale,
      },
      application: null,
      development: {
        roleTitle: role?.title ?? seed.jobRole,
        department: seed.department,
        responsibilities: seed.responsibilities,
        currentSkills: seed.currentSkills,
        businessFunctions: compact([seed.department, seed.subdivision, seed.team, seed.jobRole, role?.businessArea ?? seed.department]),
        currentCapabilities: seed.currentSkills,
        apprenticeshipIndicators: ["Role-led pathway", "Manager discussion ready"],
        aiOpportunities: seed.aiOpportunities,
        dataOpportunities: seed.dataOpportunities,
        automationOpportunities: seed.automationOpportunities,
        futureCapabilities: seed.futureCapabilities,
        stage: "recommendation_ready",
      },
    },
    preferredStandardId: seed.recommendation.standardId,
  });
}

function toApplication(seed: EmployeeSeed): MvpApplication[] {
  if (!seed.applicationStatus) return [];
  const result = recommendationResult(seed);
  const standardId = result.topRecommendation?.pathwayId;
  if (!standardId) return [];
  const submittedAt = seed.applicationStatus === "Draft" ? "2026-06-20T09:00:00.000Z" : "2026-06-18T09:00:00.000Z";
  const status = seed.applicationStatus;
  return [{
    id: `gc-app-${seed.id}`,
    employeeId: seed.id,
    apprenticeshipStandardId: standardId,
    status,
    currentOwner: applicationOwnerForStatus(status),
    reason: seed.applicationReason ?? `Application for ${result.topRecommendation?.title ?? "the selected apprenticeship route"}.`,
    careerGoal: seed.careerGoal ?? seed.futureCapabilities[0] ?? "Career progression.",
    supportRequired: seed.supportRequired ?? "Manager support with evidence and protected learning time.",
    managerNote: status === "Approved by Line Manager" || status === "Awaiting Final Approval" || status === "Approved for Enrolment"
      ? "Manager supports the application based on operational benefit."
      : status === "Declined by Line Manager"
        ? "Manager declined pending a stronger business case."
        : "",
    submittedAt,
    updatedAt,
    history: [
      buildApplicationHistoryEntry("Submitted to Line Manager", "Employee submitted expression of interest.", submittedAt),
      ...(status !== "Submitted to Line Manager" && status !== "Awaiting Manager Review" && status !== "Draft"
        ? [buildApplicationHistoryEntry(status, `Current demo status: ${status}.`, "2026-06-25T09:00:00.000Z")]
        : []),
    ],
  }];
}

function providerRelationships(): MvpProviderRelationship[] {
  return [
    {
      id: "gc-relationship-digital",
      category: "Digital",
      preferredProviderId: "provider-qa",
      backupProviderIds: ["provider-apprentify", "provider-baltic"],
      programmeIds: ["programme-qa-business-analyst", "programme-qa-data-analyst"],
      status: "Preferred",
      notes: "Preferred partner for business analysis and data capability pathways linked to digital transformation.",
      reviewDate: "2026-10-01",
      lastUsedDate: "2026-06-20",
    },
    {
      id: "gc-relationship-business-improvement",
      category: "Business Improvement",
      preferredProviderId: "provider-apprentify",
      backupProviderIds: ["provider-learning-curve-group"],
      programmeIds: ["programme-apprentify-business-analyst"],
      status: "Review due",
      notes: "Coverage supports operational improvement, automation and process redesign cohorts.",
      reviewDate: "2026-08-15",
      lastUsedDate: "2026-06-18",
    },
    {
      id: "gc-relationship-customer",
      category: "Customer",
      preferredProviderId: "provider-learning-curve-group",
      backupProviderIds: ["provider-hbtc"],
      programmeIds: ["programme-learning-curve-customer-service-specialist"],
      status: "Preferred",
      notes: "Preferred provider relationship for customer experience and service recovery pathways.",
      reviewDate: "2026-11-01",
      lastUsedDate: "2026-05-30",
    },
    {
      id: "gc-relationship-procurement",
      category: "Procurement",
      preferredProviderId: "provider-srscc",
      backupProviderIds: [],
      programmeIds: ["programme-srscc-procurement-supply-assistant"],
      status: "Alternative required",
      notes: "Specialist procurement coverage in place. Backup provider should be identified before the next commercial cohort.",
      reviewDate: "2026-09-10",
      lastUsedDate: "2026-06-12",
    },
  ];
}

function matchingRequests(): MvpMatchingRequest[] {
  return [
    {
      id: "gc-match-operations-ai",
      roleNeed: "Operational AI adoption for field planning",
      department: "Operations",
      futureCapability: "Help contracts and field teams use AI to improve briefing, reporting and follow-up workflows.",
      employerSize: "Large enterprise",
      programmeId: "programme-apprentify-ai-activator",
      linkedStandardId: "",
      learnerCount: 12,
      sites: ["Leeds Regional Hub", "Manchester Regional Hub", "Birmingham Regional Hub"],
      deliveryPreference: "Blended",
      fundingPosition: "Potentially funded through levy/co-investment",
      urgency: "Next cohort",
      notes: "Ground Control wants a practical AI adoption route connected to operational productivity.",
      businessProblems: ["Manual reporting", "Field productivity", "Workflow consistency"],
      targetRoles: ["Contracts Manager", "Field Team Leader", "Operations Coordinator"],
      technologies: ["AI", "Microsoft 365", "Reporting"],
      industries: ["Facilities services", "Grounds maintenance"],
      status: "Provider Shortlist Being Prepared",
      shortlistProviderIds: ["provider-apprentify", "provider-baltic", "provider-aicore"],
      createdAt,
      updatedAt,
    },
    {
      id: "gc-match-safety",
      roleNeed: "SHEQ capability across regional operations",
      department: "Health & Safety",
      futureCapability: "Build stronger audit, risk prevention and safety evidence capability.",
      employerSize: "Large enterprise",
      programmeId: "programme-rhg-she-tech",
      linkedStandardId: "ST0550",
      learnerCount: 6,
      sites: ["Birmingham Regional Hub", "South East Field Region", "Scotland Operations Hub"],
      deliveryPreference: "Hybrid",
      fundingPosition: "Potentially levy-funded",
      urgency: "This quarter",
      notes: "Safety capability is a strategic priority for operational consistency.",
      businessProblems: ["Audit consistency", "Incident learning", "Field risk"],
      targetRoles: ["SHEQ Advisor", "Lead Arborist", "Field Team Leader"],
      technologies: ["Digital inspections", "Risk reporting"],
      industries: ["Grounds maintenance", "Arboriculture"],
      status: "Shortlist Ready",
      shortlistProviderIds: ["provider-rhg-consult"],
      createdAt,
      updatedAt,
    },
  ];
}

function enrolments(applications: MvpApplication[]): MvpEnrolment[] {
  return applications
    .filter((application) => application.status === "Approved for Enrolment")
    .map((application) => {
      const seed = spreadsheetEmployeeSeeds.find((employeeSeed) => employeeSeed.id === application.employeeId);
      return {
        id: `gc-enrol-${application.employeeId}`,
        applicationId: application.id,
        employeeId: application.employeeId,
        providerId: providerIdFor(seed?.recommendation.provider ?? ""),
        apprenticeshipStandardId: application.apprenticeshipStandardId,
        status: "Ready for provider",
        startDate: "2026-09-14",
        notes: "Ready for provider introduction once cohort dates are confirmed.",
        createdAt,
        updatedAt,
      };
    });
}

function learnerLifecycleData(applications: MvpApplication[]): LearnerLifecycleCollections {
  const learnerRecords: LearnerLifecycleCollections["learnerRecords"] = [];
  const eligibilityDeclarations: LearnerLifecycleCollections["eligibilityDeclarations"] = [];
  const preEnrolmentChecks: LearnerLifecycleCollections["preEnrolmentChecks"] = [];
  const breaksInLearning: LearnerLifecycleCollections["breaksInLearning"] = [];
  const withdrawals: LearnerLifecycleCollections["withdrawals"] = [];
  const learnerReviews: LearnerLifecycleCollections["learnerReviews"] = [];
  const progressUpdates: LearnerLifecycleCollections["progressUpdates"] = [];
  const assessmentReadiness: LearnerLifecycleCollections["assessmentReadiness"] = [];
  const achievements: LearnerLifecycleCollections["achievements"] = [];
  const operationalActions: LearnerLifecycleCollections["operationalActions"] = [];
  const lifecycleEvents: LearnerLifecycleCollections["lifecycleEvents"] = [];

  lifecycleScenarios.forEach((scenario, index) => {
    const seed = spreadsheetEmployeeSeeds[scenario.employeeIndex] ?? spreadsheetEmployeeSeeds[index];
    if (!seed) return;

    const application = applications.find((item) => item.employeeId === seed.id);
    const startDate = addDays("2026-07-01", scenario.startOffsetDays);
    const expectedEndDate = addMonths(startDate, scenario.durationMonths);
    const learnerRecordId = `gc-learner-${scenario.key}`;
    const providerId = providerIdFor(seed.recommendation.provider);
    const programmeId = programmeIdFor(seed.recommendation.standardId, providerId);

    learnerRecords.push({
      id: learnerRecordId,
      organisationId: "demo-ground-control",
      employeeId: seed.id,
      applicationId: application?.id ?? `gc-app-lifecycle-${seed.id}`,
      programmeId,
      providerId,
      enrolmentId: scenario.lifecycleStatus === "pre_enrolment" ? "" : `gc-enrol-lifecycle-${seed.id}`,
      lifecycleStatus: scenario.lifecycleStatus,
      employmentRoute: scenario.employmentRoute,
      expectedStartDate: startDate,
      actualStartDate: scenario.lifecycleStatus === "pre_enrolment" ? "" : startDate,
      expectedEndDate,
      actualEndDate: scenario.lifecycleStatus === "achieved" ? "2026-06-03" : "",
      createdAt,
      updatedAt,
      createdBy: "LevyTate demo seed",
      updatedBy: "LevyTate demo seed",
      recordStatus: "Active",
      demonstrationRecord: true,
    });

    eligibilityDeclarations.push({
      id: `gc-eligibility-${scenario.key}`,
      organisationId: "demo-ground-control",
      learnerRecordId,
      declarationType: "england_working_hours",
      declarationWording: englandWorkingHoursDeclarationWording,
      declarationVersion: englandWorkingHoursDeclarationVersion,
      confirmed: scenario.lifecycleStatus !== "pre_enrolment",
      confirmedByEmployee: scenario.lifecycleStatus === "pre_enrolment" ? "" : seed.name,
      confirmedAt: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -8),
      expectedEnglandWorkingHoursPercentage: 95,
      verifiedBy: scenario.lifecycleStatus === "pre_enrolment" ? "" : "Ground Control L&D",
      verifiedAt: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -5),
      verificationStatus: scenario.lifecycleStatus === "pre_enrolment" ? "employee_confirmed" : "employer_verified",
      notes: "Demonstration declaration based on expected working hours in England, not home address.",
      createdAt,
      updatedAt,
    });

    preEnrolmentChecks.push({
      id: `gc-pre-enrolment-${scenario.key}`,
      organisationId: "demo-ground-control",
      learnerRecordId,
      probationStatus: scenario.lifecycleStatus === "pre_enrolment" ? "awaiting_confirmation" : "passed",
      probationPassedDate: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -20),
      probationConfirmedBy: scenario.lifecycleStatus === "pre_enrolment" ? "" : "People team",
      probationConfirmedAt: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -19),
      probationNotes: scenario.lifecycleStatus === "pre_enrolment" ? "Awaiting manager confirmation." : "Probation evidence confirmed before enrolment.",
      hrApprovalStatus: scenario.lifecycleStatus === "pre_enrolment" ? "awaiting_approval" : "approved",
      hrApprovedDate: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -15),
      hrApprovedBy: scenario.lifecycleStatus === "pre_enrolment" ? "" : "HR operations",
      hrApprovalNotes: scenario.lifecycleStatus === "pre_enrolment" ? "Pending HR approval." : "HR approved the apprenticeship start.",
      guidesSent: scenario.lifecycleStatus !== "pre_enrolment",
      guidesSentDate: scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -12),
      guidesSentBy: scenario.lifecycleStatus === "pre_enrolment" ? "" : "L&D coordinator",
      guidesVersion: "GC learner guide v1.0",
      guidesNotes: "Learner, manager and HR guidance pack tracked as an auditable operational action.",
      createdAt,
      updatedAt,
    });

    learnerReviews.push(review(learnerRecordId, scenario, "provider_review", scenario.providerReviewDate, providerId, "Provider coach", scenario.notes));
    learnerReviews.push(review(learnerRecordId, scenario, "l_and_d_check_in", scenario.landdCheckInDate, "", "Ground Control L&D", "L&D check-in confirmed support actions and next milestone."));
    learnerReviews.push(review(learnerRecordId, scenario, "manager_check_in", addDays(scenario.landdCheckInDate, -7), "", "Line manager", "Manager confirmed workplace evidence and operational support."));

    progressUpdates.push(progress(learnerRecordId, scenario, addDays(scenario.providerReviewDate, -28), Math.max(0, scenario.targetProgress - 8), Math.max(0, scenario.actualProgress - 7), "provider_report"));
    progressUpdates.push(progress(learnerRecordId, scenario, scenario.providerReviewDate, scenario.targetProgress, scenario.actualProgress, "provider_review"));

    if (scenario.lifecycleStatus === "break_in_learning") {
      breaksInLearning.push({
        id: "gc-break-active",
        organisationId: "demo-ground-control",
        learnerRecordId,
        startDate: "2026-06-10",
        expectedReturnDate: "2026-08-01",
        actualReturnDate: "",
        reasonCategory: "temporary_role_or_workload_change",
        reasonNotes: "Learner temporarily redeployed to support peak operational demand.",
        previousLifecycleStatus: "enrolled",
        expectedReturnUnknown: false,
        reviewDate: "2026-07-15",
        providerNotified: true,
        providerNotifiedDate: "2026-06-10",
        employeeNotified: true,
        employeeNotifiedDate: "2026-06-10",
        managerNotified: true,
        managerNotifiedDate: "2026-06-10",
        returnPlanNotes: "Review operational capacity before confirming the return.",
        effectiveLifecycleDate: "2026-06-10",
        returnConfirmationNote: "",
        programmeStillValidConfirmed: false,
        providerReturnConfirmed: false,
        managerReturnConfirmed: false,
        learnerReturnConfirmed: false,
        revisedExpectedEndDate: "",
        revisedReviewDate: "",
        immediateSupportAction: "",
        progressResetNote: "",
        firstCheckInDate: "",
        cancellationReason: "",
        cancelledBy: "",
        cancelledAt: "",
        startDateCorrectionReason: "",
        status: "active",
        recordedBy: "Ground Control L&D",
        recordedAt: "2026-06-10T09:00:00.000Z",
        updatedAt,
      });
    }

    if (scenario.lifecycleStatus === "withdrawn") {
      withdrawals.push({
        id: "gc-withdrawal-demo",
        organisationId: "demo-ground-control",
        learnerRecordId,
        withdrawalDate: "2026-05-20",
        effectiveDate: "2026-05-31",
        reasonCategory: "Role changed",
        reasonNotes: "Employee moved into a role that no longer aligned with the programme evidence plan.",
        initiatedBy: "Learner and manager",
        providerNotified: true,
        providerNotifiedDate: "2026-05-21",
        employeeNotified: true,
        employeeNotifiedDate: "2026-05-21",
        recordedBy: "Ground Control L&D",
        recordedAt: "2026-05-21T10:00:00.000Z",
      });
    }

    if (["assessment_preparation", "in_assessment", "achieved", "completed_without_achievement"].includes(scenario.lifecycleStatus)) {
      assessmentReadiness.push({
        id: `gc-assessment-${scenario.key}`,
        organisationId: "demo-ground-control",
        learnerRecordId,
        assessmentModel: "end_point_assessment",
        expectedAssessmentReadinessDate: "2026-06-30",
        actualAssessmentReadinessDate: scenario.lifecycleStatus === "assessment_preparation" ? "" : "2026-06-24",
        gatewayDate: scenario.lifecycleStatus === "assessment_preparation" ? "2026-07-18" : "2026-06-24",
        assessmentStatus: scenario.lifecycleStatus === "assessment_preparation"
          ? "preparing"
          : scenario.lifecycleStatus === "in_assessment"
            ? "in_assessment"
            : scenario.lifecycleStatus === "completed_without_achievement"
              ? "unsuccessful"
              : "completed",
        assessmentOrganisation: "Independent assessment organisation to confirm",
        assessmentNotes: scenario.lifecycleStatus === "assessment_preparation" ? "Gateway evidence being checked." : "Assessment readiness confirmed by provider and employer.",
        createdAt,
        updatedAt,
      });
    }

    if (scenario.lifecycleStatus === "achieved") {
      achievements.push({
        id: "gc-achievement-demo",
        organisationId: "demo-ground-control",
        learnerRecordId,
        expectedAchievementDate: "2026-06-30",
        actualAchievementDate: "2026-06-03",
        grade: "Distinction",
        gradeType: "EPA grade",
        certificateReceived: true,
        certificateReceivedDate: "2026-06-18",
        resultNotes: "Achievement recorded for demonstration reporting and completion workflow validation.",
        recordedBy: "Ground Control L&D",
        recordedAt: "2026-06-18T10:00:00.000Z",
      });
    }

    operationalActions.push(action(learnerRecordId, "guides_sent", scenario.lifecycleStatus !== "pre_enrolment", scenario.lifecycleStatus === "pre_enrolment" ? "" : addDays(startDate, -12), "Learner, manager and HR guide pack."));
    operationalActions.push(action(learnerRecordId, "hr_and_manager_assessment_email_sent", ["in_assessment", "achieved", "completed_without_achievement"].includes(scenario.lifecycleStatus), ["in_assessment", "achieved", "completed_without_achievement"].includes(scenario.lifecycleStatus) ? "2026-06-25" : "", "HR and manager assessment/EPA readiness email."));
    operationalActions.push(action(learnerRecordId, "completion_email_sent", ["achieved", "completed_without_achievement"].includes(scenario.lifecycleStatus), ["achieved", "completed_without_achievement"].includes(scenario.lifecycleStatus) ? "2026-06-19" : "", "Completion email to learner, manager and HR."));

    lifecycleEvents.push(createLearnerLifecycleEvent({
      id: `gc-event-created-${scenario.key}`,
      organisationId: "demo-ground-control",
      learnerRecordId,
      eventType: "learner_record_created",
      previousStatus: "",
      newStatus: scenario.lifecycleStatus,
      eventDate: createdAt,
      actorUserId: "demo-seed",
      actorName: "LevyTate demo seed",
      source: "ground_control_demo_seed",
      summary: `${scenario.title} demonstration learner record created.`,
      metadata: { scenario: scenario.key, demonstrationRecord: true },
      createdAt,
    }));
  });

  return {
    learnerRecords,
    eligibilityDeclarations,
    preEnrolmentChecks,
    breaksInLearning,
    withdrawals,
    learnerReviews,
    progressUpdates,
    assessmentReadiness,
    achievements,
    operationalActions,
    lifecycleEvents,
  };
}

function review(
  learnerRecordId: string,
  scenario: LifecycleScenario,
  reviewType: LearnerReviewType,
  reviewDate: string,
  providerId: string,
  reviewerName: string,
  summary: string,
) {
  return {
    id: `gc-review-${scenario.key}-${reviewType}`,
    organisationId: "demo-ground-control",
    learnerRecordId,
    reviewType,
    reviewDate,
    nextReviewDate: addDays(reviewDate, 42),
    reviewerName,
    reviewerUserId: "",
    providerId,
    summary,
    actions: scenario.actualProgress < scenario.targetProgress ? ["Agree catch-up evidence plan", "Manager to protect study time"] : ["Continue current evidence plan"],
    supportRequired: scenario.actualProgress < scenario.targetProgress ? "Manager and L&D support required to recover progress variance." : "No additional support required beyond planned check-ins.",
    status: scenario.actualProgress < scenario.targetProgress ? "action_required" : "completed",
    createdAt,
    updatedAt,
  } satisfies LearnerLifecycleCollections["learnerReviews"][number];
}

function progress(
  learnerRecordId: string,
  scenario: LifecycleScenario,
  updateDate: string,
  targetProgressPercentage: number,
  actualProgressPercentage: number,
  progressSource: "provider_report" | "provider_review",
) {
  return {
    id: `gc-progress-${scenario.key}-${updateDate}`,
    organisationId: "demo-ground-control",
    learnerRecordId,
    updateDate,
    targetProgressPercentage,
    actualProgressPercentage,
    variancePercentage: calculateLearnerProgressVariance(targetProgressPercentage, actualProgressPercentage),
    progressSource,
    sourceReference: `${scenario.title} demonstration ${progressSource.replace(/_/g, " ")}`,
    updatedBy: progressSource === "provider_review" ? "Provider coach" : "L&D coordinator",
    summary: scenario.notes,
    supportAction: actualProgressPercentage < targetProgressPercentage ? "Create progress recovery plan with manager." : "Maintain current plan.",
    createdAt,
  } satisfies LearnerLifecycleCollections["progressUpdates"][number];
}

function action(
  learnerRecordId: string,
  actionType: LearnerOperationalActionType,
  completed: boolean,
  completedAt: string,
  recipientSummary: string,
) {
  return {
    id: `gc-action-${learnerRecordId}-${actionType}`,
    organisationId: "demo-ground-control",
    learnerRecordId,
    actionType,
    status: completed ? "completed" : "not_started",
    completed,
    completedAt,
    completedBy: completed ? "Ground Control L&D" : "",
    recipientSummary,
    notes: completed ? "Completed in demonstration learner record." : "Pending future workflow.",
    createdAt,
    updatedAt,
  } satisfies LearnerLifecycleCollections["operationalActions"][number];
}

function programmeIdFor(standardId: string, providerId: string) {
  const lookup: Record<string, string> = {
    "provider-qa:ST0118": "programme-qa-data-analyst",
    "provider-qa:ST0117": "programme-qa-business-analyst",
    "provider-apprentify:ST0192": "programme-apprentify-business-analyst",
    "provider-learning-curve-group:ST0071": "programme-learning-curve-customer-service-specialist",
    "provider-srscc:ST0810": "programme-srscc-procurement-supply-assistant",
    "provider-rhg-consult:ST0550": "programme-rhg-she-tech",
  };
  return lookup[`${providerId}:${standardId}`] ?? `${providerId}-${standardId.toLowerCase()}`;
}

function providerIdFor(providerName: string) {
  const lookup: Record<string, string> = {
    Apprentify: "provider-apprentify",
    HBTC: "provider-hbtc",
    "Learning Curve Group": "provider-learning-curve-group",
    QA: "provider-qa",
    "RHG Consult": "provider-rhg-consult",
    SRSCC: "provider-srscc",
    "The Marketing Trainer": "provider-the-marketing-trainer",
  };
  return lookup[providerName] ?? "provider-qa";
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function compact(values: Array<string | undefined | null>) {
  return values.map((value) => value?.trim() ?? "").filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normaliseLookup(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normaliseLookup(term)));
}
