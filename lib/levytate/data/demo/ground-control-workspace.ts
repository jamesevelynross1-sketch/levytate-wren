import type { LevyTateRecommendationResult, LevyTatePlatformRecommendation } from "@/lib/levytate/ai/types";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
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

const departments = [
  "Operations",
  "Arboriculture",
  "Landscape Maintenance",
  "Winter Services",
  "Commercial",
  "Fleet",
  "Health & Safety",
  "People",
  "Sustainability",
  "Technology",
  "Finance",
  "Customer Experience",
];

const roleSeeds: RoleSeed[] = [
  {
    id: "gc-role-contracts-manager",
    title: "Contracts Manager",
    department: "Operations",
    businessArea: "Regional Operations",
    careerLevel: "Manager",
    skillsTags: ["Contract delivery", "Commercial performance", "People coordination", "Client service"],
    progression: ["Regional Operations Manager", "Account Director"],
    mappings: [
      mapping("ST0192", "Primary", 1, "Develops process improvement, operational performance and cross-functional delivery leadership without relying on generic management standards."),
      mapping("ST0310", "Alternative", 2, "Supports structured delivery planning and project controls where contract mobilisation is a key part of the role."),
    ],
  },
  {
    id: "gc-role-field-team-leader",
    title: "Field Team Leader",
    department: "Landscape Maintenance",
    businessArea: "Field Operations",
    careerLevel: "Supervisor",
    skillsTags: ["Crew coordination", "Quality checks", "Customer standards", "Operational safety"],
    progression: ["Contracts Supervisor", "Contracts Manager"],
    mappings: [
      mapping("ST0192", "Primary", 1, "Builds continuous improvement, productivity and safer ways of working in live operational teams."),
      mapping("ST0071", "Alternative", 2, "Useful where customer experience and service ownership are the main development need."),
    ],
  },
  {
    id: "gc-role-arborist",
    title: "Lead Arborist",
    department: "Arboriculture",
    businessArea: "Arboriculture",
    careerLevel: "Experienced",
    skillsTags: ["Tree works", "Site safety", "Technical supervision", "Customer assurance"],
    progression: ["Arboriculture Supervisor", "Tree Works Manager"],
    mappings: [
      mapping("ST0550", "Primary", 1, "Supports safety, compliance and site risk capability for technical field environments."),
      mapping("ST0192", "Alternative", 2, "Supports productivity and process improvement across mobile crews."),
    ],
  },
  {
    id: "gc-role-sheq-advisor",
    title: "SHEQ Advisor",
    department: "Health & Safety",
    businessArea: "SHEQ",
    careerLevel: "Experienced",
    skillsTags: ["Safety assurance", "Audits", "Compliance", "Risk management"],
    progression: ["SHEQ Manager", "Head of Safety"],
    mappings: [
      mapping("ST0550", "Primary", 1, "Directly develops safety, health and environment capability for compliance and operational assurance."),
      mapping("ST0192", "Alternative", 2, "Useful where the role also owns improvement projects and prevention activity."),
    ],
  },
  {
    id: "gc-role-business-analyst",
    title: "Business Analyst",
    department: "Technology",
    businessArea: "Digital Transformation",
    careerLevel: "Experienced",
    skillsTags: ["Requirements", "Systems", "Stakeholder analysis", "Process mapping"],
    progression: ["Digital Product Owner", "Transformation Lead"],
    mappings: [
      mapping("ST0117", "Primary", 1, "Builds structured business analysis, requirements gathering and change design capability."),
      mapping("ST0118", "Alternative", 2, "Useful if the role is moving further into analytics and performance reporting."),
    ],
  },
  {
    id: "gc-role-data-analyst",
    title: "Data Analyst",
    department: "Technology",
    businessArea: "Data & Insight",
    careerLevel: "Experienced",
    skillsTags: ["Reporting", "Power BI", "Data quality", "Operational insight"],
    progression: ["Senior Data Analyst", "Insight Manager"],
    mappings: [
      mapping("ST0118", "Primary", 1, "Builds deeper analytics, insight and stakeholder reporting capability for operational decision making."),
      mapping("ST0117", "Alternative", 2, "Useful if the role is moving into requirements, process change and business systems."),
    ],
  },
  {
    id: "gc-role-it-support-technician",
    title: "IT Support Technician",
    department: "Technology",
    businessArea: "IT Service",
    careerLevel: "Entry",
    skillsTags: ["User support", "Microsoft 365", "Device management", "Service desk"],
    progression: ["Systems Technician", "Infrastructure Analyst"],
    mappings: [
      mapping("ST0120", "Primary", 1, "Develops digital support, user enablement and service confidence across operational teams."),
      mapping("ST0973", "Alternative", 2, "Useful where the role is more infrastructure and communications technology focused."),
    ],
  },
  {
    id: "gc-role-procurement-manager",
    title: "Procurement Manager",
    department: "Commercial",
    businessArea: "Procurement & Supply Chain",
    careerLevel: "Manager",
    skillsTags: ["Supplier management", "Sourcing", "Commercial governance", "Contract value"],
    progression: ["Head of Procurement", "Commercial Director"],
    mappings: [
      mapping("ST0810", "Primary", 1, "Develops procurement governance, sourcing discipline and supplier management foundations for commercial teams."),
      mapping("ST0117", "Alternative", 2, "Useful if the immediate priority is process mapping and systems change."),
    ],
  },
  {
    id: "gc-role-customer-success-advisor",
    title: "Customer Success Advisor",
    department: "Customer Experience",
    businessArea: "Customer Operations",
    careerLevel: "Entry",
    skillsTags: ["Customer service", "Issue resolution", "Account support", "CRM"],
    progression: ["Customer Success Lead", "Account Manager"],
    mappings: [
      mapping("ST0071", "Primary", 1, "Strengthens service ownership, customer conversations and complex issue resolution."),
      mapping("ST0120", "Alternative", 2, "Useful where the role is becoming more CRM, digital support or workflow focused."),
    ],
  },
  {
    id: "gc-role-fleet-coordinator",
    title: "Fleet Coordinator",
    department: "Fleet",
    businessArea: "Fleet Operations",
    careerLevel: "Experienced",
    skillsTags: ["Fleet scheduling", "Compliance", "Supplier coordination", "Operational reporting"],
    progression: ["Fleet Manager", "Operations Planning Manager"],
    mappings: [
      mapping("ST0192", "Primary", 1, "Builds process optimisation, waste reduction and measurable operational improvement capability."),
      mapping("ST0810", "Alternative", 2, "Useful where supplier coordination and commercial control are the main development needs."),
    ],
  },
];

const employeeSeeds: EmployeeSeed[] = [
  employee("gc-emp-001", "GC-0001", "Nadia Brooks", "gc-role-contracts-manager", "", "Operations", "Leeds Regional Hub", "Line Manager", ["Contract delivery", "Client reviews"], ["Operational improvement", "Commercial performance"], ["AI reporting summaries"], ["Regional KPI dashboards"], ["Mobilisation workflows"], ["Manages multi-site grounds maintenance contracts"], {
    standardId: "ST0192",
    title: "Level 4 Improvement Practitioner",
    fitScore: 91,
    provider: "Apprentify",
    rationale: "Strong fit because the role owns operational performance, client delivery and improvement opportunities across regional teams.",
    evidence: ["Contract delivery leadership", "Operational efficiency priority", "Regional KPI ownership"],
  }, "Awaiting Manager Review", "I want to improve contract mobilisation, reporting and team productivity across my region.", "Progress into Regional Operations Manager.", "Time to evidence improvement projects."),
  employee("gc-emp-002", "GC-0002", "Marcus Ellison", "gc-role-field-team-leader", "gc-emp-001", "Landscape Maintenance", "North West Field Region", "Employee", ["Crew planning", "Quality checks"], ["Improvement projects", "Customer standards"], ["Route planning support"], ["Job completion reporting"], ["Daily work allocation"], ["Leads mobile grounds maintenance crews"], {
    standardId: "ST0192",
    title: "Level 4 Improvement Practitioner",
    fitScore: 88,
    provider: "Apprentify",
    rationale: "Best fit because Marcus needs practical improvement tools for crew productivity, quality and safer operating routines.",
    evidence: ["Crew productivity", "Operational efficiency", "Quality checks"],
  }, "Approved by Line Manager", "I want to improve how our crews plan work, record quality and reduce repeat visits.", "Move into Contracts Supervisor.", "Protected time for evidence collection."),
  employee("gc-emp-003", "GC-0003", "Amira Patel", "gc-role-data-analyst", "gc-emp-011", "Technology", "Billericay Support Office", "Employee", ["Power BI", "Excel modelling", "Data quality"], ["Predictive analytics", "AI adoption"], ["Forecasting use cases"], ["Operational dashboards"], ["Automated data checks"], ["Builds contract and workforce reporting"], {
    standardId: "ST0118",
    title: "Level 4 Data Analyst",
    fitScore: 94,
    provider: "QA",
    rationale: "Highest fit because the role already centres on reporting, insight and data quality, with future movement toward predictive analytics.",
    evidence: ["Power BI reporting", "Data quality", "Predictive analytics ambition"],
  }, "Awaiting Manager Review", "I want to move from reporting into stronger insight and predictive analytics.", "Progress into Senior Data Analyst.", "Access to cross-region datasets."),
  employee("gc-emp-004", "GC-0004", "Theo Morgan", "gc-role-it-support-technician", "gc-emp-011", "Technology", "Billericay Support Office", "Employee", ["Microsoft 365", "Service desk", "Device support"], ["Cloud support", "Cyber awareness"], ["AI helpdesk knowledge"], ["Ticket trend analysis"], ["Self-service support"], ["Supports users across field and office teams"], {
    standardId: "ST0120",
    title: "Level 3 Digital Support Technician",
    fitScore: 89,
    provider: "HBTC",
    rationale: "Strong fit because the role combines user enablement, digital support and Microsoft 365 adoption across operational teams.",
    evidence: ["User support", "Microsoft 365", "Digital capability priority"],
  }, "Draft", "I want a clearer route into cloud and better digital support for field teams.", "Become Systems Technician.", "Mentor support from IT service lead."),
  employee("gc-emp-005", "GC-0005", "Elena Reeves", "gc-role-sheq-advisor", "gc-emp-012", "Health & Safety", "Birmingham Regional Hub", "Employee", ["Site audits", "Risk registers", "Incident learning"], ["Safety culture", "Digital inspections"], ["Inspection trend summaries"], ["Safety dashboards"], ["Audit workflow automation"], ["Supports field teams with SHEQ assurance"], {
    standardId: "ST0550",
    title: "Level 3 Safety, Health and Environment Technician",
    fitScore: 93,
    provider: "RHG Consult",
    rationale: "Direct fit because the role is centred on operational safety, audits, risk prevention and environment compliance.",
    evidence: ["SHEQ role", "Health and safety priority", "Audit evidence"],
  }, "Submitted to Apprenticeship Lead", "I want to build stronger technical safety evidence and improve how we share learning after incidents.", "Progress into SHEQ Manager.", "Access to audit and incident review evidence."),
  employee("gc-emp-006", "GC-0006", "Callum Price", "gc-role-arborist", "gc-emp-001", "Arboriculture", "South East Field Region", "Employee", ["Tree works", "Crew safety", "Customer assurance"], ["Technical supervision", "Safety leadership"], ["Photo evidence review"], ["Job progress reporting"], ["Risk assessment templates"], ["Leads arboriculture jobs and technical site checks"], {
    standardId: "ST0550",
    title: "Level 3 Safety, Health and Environment Technician",
    fitScore: 85,
    provider: "RHG Consult",
    rationale: "Useful fit because technical field supervision depends on safe systems of work, risk evidence and compliance behaviours.",
    evidence: ["Field safety", "Technical supervision", "Operational risk"],
  }),
  employee("gc-emp-007", "GC-0007", "Priya Shah", "gc-role-procurement-manager", "", "Commercial", "Billericay Support Office", "Line Manager", ["Supplier review", "Commercial governance"], ["Procurement analytics", "Sustainable sourcing"], ["Supplier summary drafting"], ["Spend dashboards"], ["Supplier review workflow"], ["Manages national supplier relationships"], {
    standardId: "ST0810",
    title: "Level 3 Procurement and Supply Assistant",
    fitScore: 82,
    provider: "SRSCC",
    rationale: "Recommended as a practical procurement route while the organisation confirms the most suitable higher-level commercial pathway.",
    evidence: ["Procurement role", "Commercial performance priority", "Supplier management"],
    missingEvidence: ["Confirm whether a higher level procurement standard is available for new starts."],
  }, "Approved for Enrolment", "I want to improve supplier governance and sustainability within procurement decisions.", "Move into Head of Procurement.", "Time with finance and sustainability stakeholders."),
  employee("gc-emp-008", "GC-0008", "Hannah Wilkes", "gc-role-customer-success-advisor", "gc-emp-007", "Customer Experience", "Manchester Regional Hub", "Employee", ["Customer calls", "CRM updates", "Issue tracking"], ["Customer insight", "Account confidence"], ["Call summary drafting"], ["CRM reporting"], ["Case routing"], ["Supports contract managers with customer queries"], {
    standardId: "ST0071",
    title: "Level 3 Customer Service Specialist",
    fitScore: 87,
    provider: "Learning Curve Group",
    rationale: "Strong fit because the role involves complex customer conversations, CRM ownership and service recovery.",
    evidence: ["Customer service role", "CRM work", "Customer experience priority"],
  }, "Declined by Line Manager", "I wanted to build confidence handling complex customer issues.", "Progress into Customer Success Lead.", "Needs clearer business case."),
  employee("gc-emp-009", "GC-0009", "Owen Clarke", "gc-role-fleet-coordinator", "gc-emp-012", "Fleet", "Bristol Regional Hub", "Employee", ["Fleet scheduling", "Compliance checks"], ["Operational efficiency", "Supplier coordination"], ["Maintenance forecast prompts"], ["Fleet utilisation reporting"], ["Service schedule automation"], ["Coordinates fleet availability and compliance"], {
    standardId: "ST0192",
    title: "Level 4 Improvement Practitioner",
    fitScore: 90,
    provider: "Apprentify",
    rationale: "Strong fit because the role has clear opportunities to improve scheduling, compliance routines and fleet utilisation.",
    evidence: ["Fleet efficiency", "Compliance checks", "Process improvement"],
  }, "Awaiting Final Approval", "I want to reduce downtime and improve fleet compliance planning.", "Move into Fleet Manager.", "Access to maintenance and supplier data."),
  employee("gc-emp-010", "GC-0010", "Sophie Lang", "gc-role-business-analyst", "gc-emp-011", "Technology", "Billericay Support Office", "Employee", ["Requirements", "Process mapping", "Stakeholder workshops"], ["Digital transformation", "AI adoption"], ["AI discovery notes"], ["Process metrics"], ["Workflow redesign"], ["Maps requirements for operational systems"], {
    standardId: "ST0117",
    title: "Level 4 Business Analyst",
    fitScore: 92,
    provider: "QA",
    rationale: "Best fit because Sophie works directly on requirements, process change and digital transformation activity.",
    evidence: ["Business analysis", "Digital transformation priority", "Process mapping"],
  }, "Submitted to Line Manager", "I want to formalise my business analysis skills as more transformation work comes into the team.", "Progress into Product Owner.", "Access to system implementation projects."),
  employee("gc-emp-011", "GC-0011", "Jacob Turner", "gc-role-business-analyst", "", "Technology", "Billericay Support Office", "Apprenticeship Lead", ["Transformation planning", "Systems change"], ["AI governance", "Workforce planning"], ["AI opportunity triage"], ["Portfolio reporting"], ["Workflow prioritisation"], ["Leads technology change and apprenticeship oversight"], {
    standardId: "ST0117",
    title: "Level 4 Business Analyst",
    fitScore: 86,
    provider: "QA",
    rationale: "Useful fit for formalising business analysis practice across transformation and apprenticeship planning.",
    evidence: ["Transformation leadership", "Systems change", "Workforce planning"],
  }),
  employee("gc-emp-012", "GC-0012", "Rachel Mason", "gc-role-sheq-advisor", "", "Operations", "Birmingham Regional Hub", "Department Head", ["Operational assurance", "Risk review"], ["Workforce readiness", "Safety culture"], ["Risk trend summaries"], ["Participation reporting"], ["Assurance workflow"], ["Oversees regional operational assurance"], {
    standardId: "ST0550",
    title: "Level 3 Safety, Health and Environment Technician",
    fitScore: 78,
    provider: "RHG Consult",
    rationale: "Supports stronger safety and assurance capability across regional teams.",
    evidence: ["Operational assurance", "Health and safety priority", "Regional reporting"],
  }),
  employee("gc-emp-013", "GC-0013", "Liam Foster", "gc-role-field-team-leader", "gc-emp-001", "Winter Services", "Scotland Operations Hub", "Employee", ["Route planning", "Seasonal mobilisation"], ["Operational efficiency", "Commercial performance"], ["Weather briefing summaries"], ["Route performance reporting"], ["Mobilisation checklists"], ["Coordinates winter service crews"], {
    standardId: "ST0192",
    title: "Level 4 Improvement Practitioner",
    fitScore: 86,
    provider: "Apprentify",
    rationale: "Useful fit for improving mobilisation planning, route productivity and operational consistency.",
    evidence: ["Winter mobilisation", "Route planning", "Efficiency priority"],
  }),
  employee("gc-emp-014", "GC-0014", "Maya Collins", "gc-role-customer-success-advisor", "gc-emp-007", "Commercial", "Billericay Support Office", "Employee", ["Bid coordination", "Customer detail", "CRM"], ["Commercial performance", "Data confidence"], ["Proposal drafting"], ["Pipeline reporting"], ["Bid workflow"], ["Supports bids and account growth activity"], {
    standardId: "ST0117",
    title: "Level 4 Business Analyst",
    fitScore: 84,
    provider: "QA",
    rationale: "Good fit because the role is moving from administration into process, requirements and commercial pipeline insight.",
    evidence: ["Commercial process", "CRM data", "Workflow improvement"],
  }),
  employee("gc-emp-015", "GC-0015", "Ben Harris", "gc-role-field-team-leader", "gc-emp-001", "Landscape Maintenance", "South East Field Region", "Employee", ["Grounds maintenance", "Team briefings"], ["Leadership routines", "Quality standards"], ["Briefing templates"], ["Quality trend reporting"], ["Job close workflow"], ["Supervises field delivery and customer standards"], {
    standardId: "ST0071",
    title: "Level 3 Customer Service Specialist",
    fitScore: 80,
    provider: "Learning Curve Group",
    rationale: "Recommended where customer standards and service ownership are the priority alongside field delivery.",
    evidence: ["Customer standards", "Team briefings", "Service recovery"],
  }),
  employee("gc-emp-016", "GC-0016", "Laura Bennett", "gc-role-data-analyst", "gc-emp-011", "Sustainability", "Billericay Support Office", "Employee", ["Carbon reporting", "Excel", "Supplier data"], ["Sustainability analytics", "Automation"], ["Carbon insight summaries"], ["Sustainability dashboards"], ["Data collection automation"], ["Builds sustainability and social value reporting"], {
    standardId: "ST0118",
    title: "Level 4 Data Analyst",
    fitScore: 89,
    provider: "QA",
    rationale: "Strong fit because sustainability reporting depends on data quality, dashboards and insight for decision makers.",
    evidence: ["Carbon reporting", "Sustainability priority", "Data dashboards"],
  }),
];

export const groundControlWorkspace: LevyTateWorkspaceBootstrap = {
  data: buildGroundControlWorkspace(),
  meta: {
    organisationId: "demo-ground-control",
    organisationName: "Ground Control Demonstration Workspace",
    userEmail: "demo@levytate.co.uk",
    userRole: "Employer Admin",
    storageMode: "local_fallback",
    warnings: ["Seeded demonstration workspace. Changes are not written to the internal LevyTate MVP workspace."],
  },
};

function buildGroundControlWorkspace(): MvpWorkspaceData {
  const empty = createEmptyMvpWorkspace();
  const roles = roleSeeds.map(toRole);
  const employees = employeeSeeds.map(toEmployee);
  const employeeDevelopmentProfiles = employeeSeeds.map(toDevelopmentProfile);
  const applications = employeeSeeds.flatMap(toApplication);

  return {
    ...empty,
    profile: {
      employerName: "Ground Control",
      workspaceName: "Ground Control demonstration workspace",
      primaryContact: "Jacob Turner",
      contactEmail: "demo@levytate.co.uk",
      defaultSite: "Billericay Support Office",
      sites,
      departments,
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
  };
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

function employee(
  id: string,
  employeeNumber: string,
  name: string,
  roleId: string,
  managerId: string,
  department: string,
  site: string,
  platformRole: MvpEmployee["platformRole"],
  currentSkills: string[],
  futureCapabilities: string[],
  aiOpportunities: string[],
  dataOpportunities: string[],
  automationOpportunities: string[],
  responsibilities: string[],
  recommendation: EmployeeSeed["recommendation"],
  applicationStatus?: MvpApplication["status"],
  applicationReason?: string,
  careerGoal?: string,
  supportRequired?: string,
): EmployeeSeed {
  return {
    id,
    employeeNumber,
    name,
    roleId,
    managerId,
    department,
    site,
    platformRole,
    currentSkills,
    futureCapabilities,
    aiOpportunities,
    dataOpportunities,
    automationOpportunities,
    responsibilities,
    recommendation,
    applicationStatus,
    applicationReason,
    careerGoal,
    supportRequired,
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
  const role = roleSeeds.find((item) => item.id === seed.roleId);
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
  return {
    employeeId: seed.id,
    stage: "recommendation_ready",
    responsibilities: seed.responsibilities,
    currentSkills: seed.currentSkills,
    businessFunctions: [seed.department, roleSeeds.find((role) => role.id === seed.roleId)?.businessArea ?? seed.department],
    currentCapabilities: seed.currentSkills,
    apprenticeshipIndicators: [seed.recommendation.title, "Role-led pathway", "Manager discussion ready"],
    aiOpportunities: seed.aiOpportunities,
    dataOpportunities: seed.dataOpportunities,
    automationOpportunities: seed.automationOpportunities,
    futureCapabilities: seed.futureCapabilities,
    conversationHistory: [
      { role: "assistant", content: `I already have ${seed.name}'s role, department, manager and organisation priorities. The current strongest route is ${seed.recommendation.title}.` },
    ],
    conversationProfile: {
      currentRole: roleSeeds.find((role) => role.id === seed.roleId)?.title ?? "",
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
      recommendedPathways: [{
        title: seed.recommendation.title,
        confidence: seed.recommendation.fitScore,
        stage: "recommended",
        firstDiscussedAt: 1760000000000,
        lastDiscussedAt: 1760000000000,
      }],
      confidence: {
        role: 90,
        careerGoal: seed.careerGoal ? 86 : 70,
        technicalConfidence: 82,
        managementAmbition: seed.futureCapabilities.some((item) => /manager|lead|supervisor/i.test(item)) ? 78 : 54,
        overall: Math.min(95, seed.recommendation.fitScore),
      },
      conversationSummary: `${seed.name} is a ${roleSeeds.find((role) => role.id === seed.roleId)?.title ?? "colleague"} in ${seed.department}. LevyTate should use Ground Control priorities around AI adoption, operational efficiency, safety, sustainability and digital capability when coaching this employee.`,
      questionsAlreadyAsked: ["What does the employee do today?", "What capability do they need next?"],
      questionsStillToAsk: ["Which project can evidence the pathway?", "What study time can the manager support?"],
      exchangeCount: 2,
      latestMessageClassification: "new_information",
    },
    recommendationResult: result,
    preferredStandardId: result.topRecommendation?.pathwayId ?? seed.recommendation.standardId,
    updatedAt,
  };
}

function recommendationResult(seed: EmployeeSeed): LevyTateRecommendationResult {
  const top = platformRecommendation(seed.recommendation, "current_best_fit");
  const alternative = platformRecommendation({
    ...seed.recommendation,
    standardId: seed.recommendation.standardId === "ST0192" ? "ST0117" : "ST0192",
    title: seed.recommendation.standardId === "ST0192" ? "Level 4 Business Analyst" : "Level 4 Improvement Practitioner",
    fitScore: Math.max(72, seed.recommendation.fitScore - 8),
    rationale: "Alternative route to review if the role focus shifts after manager discussion.",
    evidence: ["Alternative capability route", "Future skills discussion"],
    missingEvidence: ["Confirm role emphasis before progressing."],
  }, "alternative_route");

  return {
    recommendations: [top, alternative],
    topRecommendation: top,
    recommendationVersion: `gc-demo-${seed.id}-${seed.recommendation.standardId}`,
    confidence: Math.min(96, seed.recommendation.fitScore + 2),
    revealThreshold: 65,
    shouldRevealRecommendations: true,
    evidenceChanged: false,
    capabilityProfile: capabilityProfile(seed),
    currentCapabilityProfile: capabilityProfile(seed),
    futureCapabilityProfile: futureCapabilityProfile(seed),
    strategicRecommendation: {
      currentBestFit: top.title,
      futureDevelopmentOpportunity: alternative.title,
      strategicRecommendation: top.title,
      alternativeRoute: alternative.title,
      confidence: top.confidence,
      businessImpact: "Supports Ground Control's priorities around operational efficiency, digital capability and safer, more consistent field delivery.",
      organisationBenefit: "Creates a clearer workforce development route using role-specific evidence rather than generic management training.",
      employeeBenefit: "Gives the employee a pathway connected to their current role and future progression.",
      whyRecommended: top.rationale,
      whyOtherRoutesRankedLower: alternative.whyRankedLower,
      missingEvidence: top.missingEvidence,
      suggestedQuestions: top.suggestedQuestions,
      organisationPrioritiesInfluenced: ["Operational efficiency", "AI adoption", "Digital capability", "Health & Safety"],
      employeeCapabilitiesInfluenced: seed.futureCapabilities,
    },
  };
}

function platformRecommendation(seed: EmployeeSeed["recommendation"], strategicRole: LevyTatePlatformRecommendation["strategicRole"]): LevyTatePlatformRecommendation {
  return {
    pathwayId: seed.standardId,
    title: seed.title,
    fitScore: seed.fitScore,
    scoreDelta: 0,
    confidence: Math.min(96, seed.fitScore + 1),
    rationale: seed.rationale,
    evidence: seed.evidence.map((label, index) => ({
      id: `${seed.standardId}-evidence-${index + 1}`,
      label,
      source: index === 0 ? "profile" : index === 1 ? "platform_rule" : "role_mapping",
      weight: 18 - index * 2,
    })),
    missingEvidence: seed.missingEvidence ?? [],
    capabilityFit: [
      { domain: "Operational", score: Math.min(96, seed.fitScore), weighting: 22 },
      { domain: "Digital", score: seed.title.includes("Data") || seed.title.includes("Digital") || seed.title.includes("Business Analyst") ? seed.fitScore : 62, weighting: 16 },
      { domain: "Customer", score: seed.title.includes("Customer") ? seed.fitScore : 48, weighting: 8 },
    ],
    strategicRole,
    strategicSignals: [
      { category: "organisation_priority", label: "Ground Control strategic priority", score: 82, evidence: ["Operational efficiency", "Digital capability"] },
      { category: "current_capability", label: "Current role evidence", score: seed.fitScore, evidence: seed.evidence },
    ],
    businessImpact: "Improves role capability, operational consistency and workforce readiness.",
    organisationBenefit: "Creates a stronger internal pipeline aligned to Ground Control's operating model.",
    employeeBenefit: "Connects day-to-day work to a credible progression route.",
    providerRationale: `${seed.provider} is shown as the recommended delivery partner for this demo scenario.`,
    programmeRationale: "Programme selected from role evidence, organisation priorities and capability signals.",
    whyRankedLower: seed.missingEvidence ?? ["Other routes had weaker direct evidence for the role and business objective."],
    suggestedQuestions: ["Which projects could evidence this pathway?", "What time commitment can the manager support?", "Which capability matters most this quarter?"],
    availability: "approved",
    eligibility: "eligible",
    providerAvailability: "mapped",
  };
}

function capabilityProfile(seed: EmployeeSeed) {
  return [
    capability("Current role", 86, seed.currentSkills),
    capability("Data and reporting", seed.dataOpportunities.length ? 76 : 42, seed.dataOpportunities),
    capability("AI adoption", seed.aiOpportunities.length ? 70 : 38, seed.aiOpportunities),
    capability("Operational improvement", seed.automationOpportunities.length ? 78 : 48, seed.automationOpportunities),
  ];
}

function futureCapabilityProfile(seed: EmployeeSeed) {
  return [
    capability("Future capability", 84, seed.futureCapabilities),
    capability("Organisation priority fit", 82, ["AI adoption", "Operational efficiency", "Digital capability"]),
  ];
}

function capability(domain: string, score: number, evidence: string[]) {
  return {
    domain,
    score,
    evidence,
    missingEvidence: evidence.length ? [] : ["More employee evidence required."],
  };
}

function toApplication(seed: EmployeeSeed): MvpApplication[] {
  if (!seed.applicationStatus) return [];
  const submittedAt = seed.applicationStatus === "Draft" ? "2026-06-20T09:00:00.000Z" : "2026-06-18T09:00:00.000Z";
  const status = seed.applicationStatus;
  return [{
    id: `gc-app-${seed.id}`,
    employeeId: seed.id,
    apprenticeshipStandardId: seed.recommendation.standardId,
    status,
    currentOwner: applicationOwnerForStatus(status),
    reason: seed.applicationReason ?? `Application for ${seed.recommendation.title}.`,
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
    .map((application) => ({
      id: `gc-enrol-${application.employeeId}`,
      applicationId: application.id,
      employeeId: application.employeeId,
      providerId: employeeSeeds.find((employeeSeed) => employeeSeed.id === application.employeeId)?.recommendation.provider === "SRSCC" ? "provider-srscc" : "provider-qa",
      apprenticeshipStandardId: application.apprenticeshipStandardId,
      status: "Ready for provider",
      startDate: "2026-09-14",
      notes: "Ready for provider introduction once cohort dates are confirmed.",
      createdAt,
      updatedAt,
    }));
}
