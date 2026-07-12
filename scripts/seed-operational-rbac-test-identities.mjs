import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const now = new Date().toISOString();
const betaOrganisation = {
  id: "12000000-0000-4000-8000-000000000001",
  name: "Ground Control",
  slug: "ground-control",
  workspace_name: "Ground Control operational RBAC validation workspace",
  primary_contact: "Priya Shah",
  contact_email: "apprenticeshiplead.demo@levytate.test",
  default_site: "Billericay Support Office",
  sites: ["Billericay Support Office", "Leeds Regional Hub", "Manchester Regional Hub"],
  departments: ["Operations", "Learning and Development", "Commercial", "Finance"],
  priorities: [
    { id: "gc-rbac-ai", name: "Introduce AI into the business", importance: "High", detail: "Use AI to improve field reporting and operational workflows." },
    { id: "gc-rbac-productivity", name: "Increase productivity", importance: "Critical", detail: "Build capability that improves crew planning and service delivery." },
    { id: "gc-rbac-leadership", name: "Develop future managers", importance: "High", detail: "Support practical progression across operations teams." },
  ],
  status: "Active",
};

const isolationOrganisation = {
  id: "12000000-0000-4000-8000-000000000002",
  name: "RBAC Isolation Employer",
  slug: "rbac-isolation-employer",
  workspace_name: "RBAC isolation validation workspace",
  primary_contact: "Isolation Test",
  contact_email: "isolation.employee.demo@levytate.test",
  default_site: "Isolation Office",
  sites: ["Isolation Office"],
  departments: ["Operations"],
  priorities: [],
  status: "Active",
};

const users = [
  { id: "22000000-0000-4000-8000-000000000001", email: "employee.demo@levytate.test", role: "Employee", displayName: "Erin Vale", active: true },
  { id: "22000000-0000-4000-8000-000000000002", email: "manager.demo@levytate.test", role: "Line Manager", displayName: "Morgan Price", active: true },
  { id: "22000000-0000-4000-8000-000000000003", email: "apprenticeshiplead.demo@levytate.test", role: "Apprenticeship Lead", displayName: "Priya Shah", active: true },
  { id: "22000000-0000-4000-8000-000000000004", email: "inactive.demo@levytate.test", role: "Employee", displayName: "Inactive Demo User", active: false },
  { id: "22000000-0000-4000-8000-000000000005", email: "unmapped.employee.demo@levytate.test", role: "Employee", displayName: "Unmapped Demo User", active: true },
  { id: "22000000-0000-4000-8000-000000000007", email: "employee.new.demo@levytate.test", role: "Employee", displayName: "Maya Reed", active: true },
  { id: "22000000-0000-4000-8000-000000000008", email: "employee.draft.demo@levytate.test", role: "Employee", displayName: "Leo Turner", active: true },
];

const isolationUsers = [
  { id: "22000000-0000-4000-8000-000000000006", email: "isolation.employee.demo@levytate.test", role: "Employee", displayName: "Isla North", active: true },
];

const roles = [
  {
    id: "gc-rbac-role-field-coordinator",
    title: "Field Operations Coordinator",
    department: "Operations",
    business_area: "Field Operations",
    career_level: "Experienced",
    skills_tags: ["Operations coordination", "Reporting", "Customer service", "Digital confidence"],
    progression: ["Senior Coordinator", "Team Leader", "Operations Supervisor"],
    status: "Active",
  },
  {
    id: "gc-rbac-role-regional-manager",
    title: "Regional Operations Manager",
    department: "Operations",
    business_area: "Regional Operations",
    career_level: "Manager",
    skills_tags: ["People management", "Operational productivity", "Commercial performance"],
    progression: ["Senior Operations Manager", "Regional Director"],
    status: "Active",
  },
  {
    id: "gc-rbac-role-apprenticeship-lead",
    title: "Apprenticeship Lead",
    department: "Learning and Development",
    business_area: "People Capability",
    career_level: "Manager",
    skills_tags: ["Apprenticeship operations", "Provider relationships", "Workforce reporting"],
    progression: ["Head of Learning and Development", "People Director"],
    status: "Active",
  },
  {
    id: "gc-rbac-role-finance-analyst",
    title: "Finance Analyst",
    department: "Finance",
    business_area: "Finance",
    career_level: "Experienced",
    skills_tags: ["Reporting", "Analysis", "Process improvement"],
    progression: ["Senior Finance Analyst", "Finance Manager"],
    status: "Active",
  },
];

const roleMappings = [
  {
    id: "gc-rbac-map-field-coordinator-data",
    role_id: "gc-rbac-role-field-coordinator",
    apprenticeship_standard_id: "ST0118",
    recommendation_type: "Primary",
    priority: 1,
    business_rationale: "Builds reporting, data confidence and operational insight for field coordination roles.",
    funding_route: "Potentially funded through levy/co-investment",
    delivery_preference: "Blended",
  },
  {
    id: "gc-rbac-map-manager-improvement",
    role_id: "gc-rbac-role-regional-manager",
    apprenticeship_standard_id: "ST0192",
    recommendation_type: "Primary",
    priority: 1,
    business_rationale: "Supports operational productivity, process improvement and measurable service delivery change.",
    funding_route: "Potentially funded through levy/co-investment",
    delivery_preference: "Blended",
  },
  {
    id: "gc-rbac-map-lead-ld",
    role_id: "gc-rbac-role-apprenticeship-lead",
    apprenticeship_standard_id: "ST0562",
    recommendation_type: "Primary",
    priority: 1,
    business_rationale: "Supports internal development, programme governance and workforce capability planning.",
    funding_route: "Potentially funded through levy/co-investment",
    delivery_preference: "Hybrid",
  },
  {
    id: "gc-rbac-map-finance-data",
    role_id: "gc-rbac-role-finance-analyst",
    apprenticeship_standard_id: "ST0118",
    recommendation_type: "Primary",
    priority: 1,
    business_rationale: "Strengthens reporting, insight and data quality for finance decision support.",
    funding_route: "Potentially funded through levy/co-investment",
    delivery_preference: "Remote + workshops",
  },
];

const employees = [
  {
    id: "gc-rbac-employee-erin",
    employee_number: "GC-RBAC-001",
    name: "Erin Vale",
    email: "employee.demo@levytate.test",
    job_title: "Field Operations Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-morgan",
    department: "Operations",
    site: "Leeds Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2024-04-01",
  },
  {
    id: "gc-rbac-employee-morgan",
    employee_number: "GC-RBAC-002",
    name: "Morgan Price",
    email: "manager.demo@levytate.test",
    job_title: "Regional Operations Manager",
    role_id: "gc-rbac-role-regional-manager",
    manager_id: "gc-rbac-employee-priya",
    department: "Operations",
    site: "Manchester Regional Hub",
    platform_role: "Line Manager",
    status: "Active",
    start_date: "2022-03-14",
  },
  {
    id: "gc-rbac-employee-owen",
    employee_number: "GC-RBAC-003",
    name: "Owen Blake",
    email: "owen.blake.demo@levytate.test",
    job_title: "Field Operations Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-morgan",
    department: "Operations",
    site: "Leeds Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2025-01-20",
  },
  {
    id: "gc-rbac-employee-priya",
    employee_number: "GC-RBAC-004",
    name: "Priya Shah",
    email: "apprenticeshiplead.demo@levytate.test",
    job_title: "Apprenticeship Lead",
    role_id: "gc-rbac-role-apprenticeship-lead",
    manager_id: "",
    department: "Learning and Development",
    site: "Billericay Support Office",
    platform_role: "Apprenticeship Lead",
    status: "Active",
    start_date: "2021-09-06",
  },
  {
    id: "gc-rbac-employee-nadia",
    employee_number: "GC-RBAC-005",
    name: "Nadia Quinn",
    email: "nadia.quinn.demo@levytate.test",
    job_title: "Finance Analyst",
    role_id: "gc-rbac-role-finance-analyst",
    manager_id: "gc-rbac-employee-priya",
    department: "Finance",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2023-11-13",
  },
  {
    id: "gc-rbac-employee-maya",
    employee_number: "GC-RBAC-006",
    name: "Maya Reed",
    email: "employee.new.demo@levytate.test",
    job_title: "Field Operations Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-morgan",
    department: "Operations",
    site: "Leeds Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2025-09-08",
  },
  {
    id: "gc-rbac-employee-leo",
    employee_number: "GC-RBAC-007",
    name: "Leo Turner",
    email: "employee.draft.demo@levytate.test",
    job_title: "Field Operations Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-morgan",
    department: "Operations",
    site: "Manchester Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2024-10-21",
  },
];

const lifecycleLearnerEmployees = [
  {
    id: "gc-lifecycle-employee-avery",
    employee_number: "GC-LC-001",
    name: "Avery Collins",
    email: "avery.collins.lifecycle.demo@levytate.test",
    job_title: "Field Operations Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Operations",
    site: "Leeds Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2025-09-01",
  },
  {
    id: "gc-lifecycle-employee-ben",
    employee_number: "GC-LC-002",
    name: "Ben Marshall",
    email: "ben.marshall.lifecycle.demo@levytate.test",
    job_title: "Data and Reporting Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Operations",
    site: "Manchester Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2024-03-18",
  },
  {
    id: "gc-lifecycle-employee-cara",
    employee_number: "GC-LC-003",
    name: "Cara Hughes",
    email: "cara.hughes.lifecycle.demo@levytate.test",
    job_title: "Operations Planner",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Operations",
    site: "Leeds Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2023-08-07",
  },
  {
    id: "gc-lifecycle-employee-daniel",
    employee_number: "GC-LC-004",
    name: "Daniel Frost",
    email: "daniel.frost.lifecycle.demo@levytate.test",
    job_title: "Arborist Team Leader",
    role_id: "gc-rbac-role-regional-manager",
    manager_id: "gc-rbac-employee-priya",
    department: "Operations",
    site: "Manchester Regional Hub",
    platform_role: "Employee",
    status: "Active",
    start_date: "2021-11-22",
  },
  {
    id: "gc-lifecycle-employee-emma",
    employee_number: "GC-LC-005",
    name: "Emma Lawson",
    email: "emma.lawson.lifecycle.demo@levytate.test",
    job_title: "Customer Operations Advisor",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Commercial",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2025-01-13",
  },
  {
    id: "gc-lifecycle-employee-finley",
    employee_number: "GC-LC-006",
    name: "Finley Brooks",
    email: "finley.brooks.lifecycle.demo@levytate.test",
    job_title: "Apprentice Contracts Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Commercial",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2026-02-02",
  },
  {
    id: "gc-lifecycle-employee-grace",
    employee_number: "GC-LC-007",
    name: "Grace Bennett",
    email: "grace.bennett.lifecycle.demo@levytate.test",
    job_title: "Sustainability Coordinator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Commercial",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2024-06-03",
  },
  {
    id: "gc-lifecycle-employee-harry",
    employee_number: "GC-LC-008",
    name: "Harry Newton",
    email: "harry.newton.lifecycle.demo@levytate.test",
    job_title: "Finance Analyst",
    role_id: "gc-rbac-role-finance-analyst",
    manager_id: "gc-rbac-employee-priya",
    department: "Finance",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2022-10-10",
  },
  {
    id: "gc-lifecycle-employee-isobel",
    employee_number: "GC-LC-009",
    name: "Isobel Carter",
    email: "isobel.carter.lifecycle.demo@levytate.test",
    job_title: "Commercial Administrator",
    role_id: "gc-rbac-role-field-coordinator",
    manager_id: "gc-rbac-employee-priya",
    department: "Commercial",
    site: "Billericay Support Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2023-04-17",
  },
];

const isolationEmployees = [
  {
    id: "isolation-employee-isla",
    employee_number: "ISO-RBAC-001",
    name: "Isla North",
    email: "isolation.employee.demo@levytate.test",
    job_title: "Operations Coordinator",
    role_id: "isolation-role-operations",
    manager_id: "",
    department: "Operations",
    site: "Isolation Office",
    platform_role: "Employee",
    status: "Active",
    start_date: "2025-02-01",
  },
];

const profiles = [
  profile("gc-rbac-employee-erin", "Field Operations Coordinator", ["Coordinates field schedules", "Maintains operational reports"], ["Reporting", "Microsoft 365", "Customer updates"], ["Data confidence", "Workflow automation"], "ST0118"),
  profile("gc-rbac-employee-morgan", "Regional Operations Manager", ["Manages regional delivery", "Reviews team capability"], ["People management", "Operational planning"], ["Process improvement", "Succession planning"], "ST0192"),
  profile("gc-rbac-employee-owen", "Field Operations Coordinator", ["Supports daily work allocation", "Tracks job completion"], ["Operations admin", "Customer service"], ["Digital confidence"], "ST0118"),
  profile("gc-rbac-employee-priya", "Apprenticeship Lead", ["Manages apprenticeship demand", "Reviews provider relationships"], ["Apprenticeship governance", "Reporting"], ["Provider relationship management", "Workforce readiness"], "ST0562"),
  profile("gc-rbac-employee-nadia", "Finance Analyst", ["Prepares finance reports", "Supports monthly analysis"], ["Spreadsheets", "Reporting"], ["Data visualisation"], "ST0118"),
  profile("gc-rbac-employee-maya", "Field Operations Coordinator", ["Supports job scheduling", "Updates operational records"], ["Operations admin", "Customer updates"], ["Reporting confidence", "Digital workflows"], "ST0118"),
  profile("gc-rbac-employee-leo", "Field Operations Coordinator", ["Tracks field jobs", "Maintains weekly reports"], ["Spreadsheet updates", "Operations coordination"], ["Data confidence", "Workflow automation"], "ST0118"),
];

const lifecycleLearnerProfiles = [
  profile("gc-lifecycle-employee-avery", "Field Operations Coordinator", ["Preparing for apprenticeship onboarding", "Coordinates field schedules"], ["Operations coordination", "Microsoft 365"], ["Data confidence", "Workflow automation"], "ST0795"),
  profile("gc-lifecycle-employee-ben", "Data and Reporting Coordinator", ["Builds weekly reporting packs", "Tracks operations performance"], ["Reporting", "Spreadsheet modelling"], ["Power BI confidence", "Data storytelling"], "ST0118"),
  profile("gc-lifecycle-employee-cara", "Operations Planner", ["Plans field work", "Maintains utilisation reports"], ["Operations planning", "Reporting"], ["Data visualisation", "Workflow automation"], "ST0118"),
  profile("gc-lifecycle-employee-daniel", "Arborist Team Leader", ["Leads field crews", "Supports safe delivery"], ["Team coordination", "Health and safety"], ["Process improvement", "Coaching"], "ST0192"),
  profile("gc-lifecycle-employee-emma", "Customer Operations Advisor", ["Handles customer updates", "Coordinates service queries"], ["Customer service", "Case management"], ["Service improvement", "Digital confidence"], "ST0071"),
  profile("gc-lifecycle-employee-finley", "Apprentice Contracts Coordinator", ["Supports contract administration", "Tracks project documents"], ["Administration", "Document control"], ["Project delivery", "Commercial awareness"], "ST0310"),
  profile("gc-lifecycle-employee-grace", "Sustainability Coordinator", ["Maintains sustainability evidence", "Supports ESG reporting"], ["Sustainability reporting", "Stakeholder updates"], ["ESG delivery", "Data confidence"], "ST0934"),
  profile("gc-lifecycle-employee-harry", "Finance Analyst", ["Prepares finance reports", "Analyses operating costs"], ["Financial reporting", "Analysis"], ["Insight generation", "Dashboard reporting"], "ST0118"),
  profile("gc-lifecycle-employee-isobel", "Commercial Administrator", ["Supports bids and commercial administration", "Maintains opportunity records"], ["Administration", "Commercial support"], ["Bid coordination", "Process discipline"], "ST0056"),
];

const isolationProfiles = [
  profile("isolation-employee-isla", "Operations Coordinator", ["Coordinates site work"], ["Operations admin"], ["Reporting confidence"], "ST0118"),
];

const applications = [
  {
    id: "gc-rbac-app-erin",
    employee_id: "gc-rbac-employee-erin",
    apprenticeship_standard_id: "ST0118",
    status: "Awaiting Manager Review",
    current_owner: "Line Manager",
    reason: "Erin wants to turn operational reporting into clearer performance insight for field teams.",
    career_goal: "Progress into a senior coordination role with stronger reporting and digital confidence.",
    support_required: "Protected learning time and access to relevant reporting projects.",
    manager_note: "",
    submitted_at: "2026-06-18T09:00:00.000Z",
    updated_at: now,
  },
  {
    id: "gc-rbac-app-nadia",
    employee_id: "gc-rbac-employee-nadia",
    apprenticeship_standard_id: "ST0118",
    status: "Approved for Enrolment",
    current_owner: "Provider Partner",
    reason: "Nadia needs stronger data visualisation and dashboard capability for finance reporting.",
    career_goal: "Move into senior finance insight and reporting.",
    support_required: "Support with project evidence and dashboard delivery.",
    manager_note: "Approved by the manager because the pathway supports finance reporting capability.",
    submitted_at: "2026-05-25T09:00:00.000Z",
    updated_at: now,
  },
  {
    id: "gc-rbac-app-leo-draft",
    employee_id: "gc-rbac-employee-leo",
    apprenticeship_standard_id: "ST0118",
    status: "Draft",
    current_owner: "Employee",
    reason: "Leo wants to improve how operational reporting is prepared for regional field teams.",
    career_goal: "",
    support_required: "",
    manager_note: "Draft note to discuss protected learning time with Morgan.",
    submitted_at: "2026-07-01T09:00:00.000Z",
    updated_at: now,
  },
];

const lifecycleApplications = [
  lifecycleApplication("gc-lifecycle-app-avery", "gc-lifecycle-employee-avery", "ST0795", "Approved for Enrolment", "Avery is preparing to start a Data Technician route to improve field operations reporting."),
  lifecycleApplication("gc-lifecycle-app-ben", "gc-lifecycle-employee-ben", "ST0118", "Approved for Enrolment", "Ben is developing reporting and analytics capability for regional operations."),
  lifecycleApplication("gc-lifecycle-app-cara", "gc-lifecycle-employee-cara", "ST0118", "Approved for Enrolment", "Cara needs stronger data visualisation to support field planning decisions."),
  lifecycleApplication("gc-lifecycle-app-daniel", "gc-lifecycle-employee-daniel", "ST0192", "Approved for Enrolment", "Daniel is building process improvement capability for field crew performance."),
  lifecycleApplication("gc-lifecycle-app-emma", "gc-lifecycle-employee-emma", "ST0071", "Approved for Enrolment", "Emma was developing customer service capability before withdrawal."),
  lifecycleApplication("gc-lifecycle-app-finley", "gc-lifecycle-employee-finley", "ST0310", "Approved for Enrolment", "Finley is preparing evidence for project coordination assessment."),
  lifecycleApplication("gc-lifecycle-app-grace", "gc-lifecycle-employee-grace", "ST0934", "Approved for Enrolment", "Grace is in assessment for sustainability and responsibility capability."),
  lifecycleApplication("gc-lifecycle-app-harry", "gc-lifecycle-employee-harry", "ST0118", "Approved for Enrolment", "Harry has achieved the data analyst apprenticeship."),
  lifecycleApplication("gc-lifecycle-app-isobel", "gc-lifecycle-employee-isobel", "ST0056", "Approved for Enrolment", "Isobel completed learning activity but did not achieve the assessment outcome."),
];

const isolationApplications = [
  {
    id: "isolation-app-isla",
    employee_id: "isolation-employee-isla",
    apprenticeship_standard_id: "ST0118",
    status: "Submitted to Line Manager",
    current_owner: "Line Manager",
    reason: "Isolation control record for cross-organisation RBAC validation.",
    career_goal: "Improve reporting confidence.",
    support_required: "Manager review.",
    manager_note: "",
    submitted_at: "2026-06-20T09:00:00.000Z",
    updated_at: now,
  },
];

const enrolments = [
  {
    id: "gc-rbac-enrol-nadia",
    application_id: "gc-rbac-app-nadia",
    employee_id: "gc-rbac-employee-nadia",
    provider_id: "provider-qa",
    apprenticeship_standard_id: "ST0118",
    status: "Ready for provider",
    start_date: "2026-09-14",
    notes: "Ready for provider introduction once final onboarding evidence is confirmed.",
    created_at: now,
    updated_at: now,
  },
];

const lifecycleEnrolments = [
  lifecycleEnrolment("gc-lifecycle-enrol-ben", "gc-lifecycle-app-ben", "gc-lifecycle-employee-ben", "provider-qa", "ST0118", "Active", "2026-02-01"),
  lifecycleEnrolment("gc-lifecycle-enrol-cara", "gc-lifecycle-app-cara", "gc-lifecycle-employee-cara", "provider-qa", "ST0118", "Active", "2026-01-12"),
  lifecycleEnrolment("gc-lifecycle-enrol-daniel", "gc-lifecycle-app-daniel", "gc-lifecycle-employee-daniel", "provider-apprentify", "ST0192", "Break in learning", "2025-10-06"),
  lifecycleEnrolment("gc-lifecycle-enrol-emma", "gc-lifecycle-app-emma", "gc-lifecycle-employee-emma", "provider-learning-curve-group", "ST0071", "Withdrawn", "2025-11-03"),
  lifecycleEnrolment("gc-lifecycle-enrol-finley", "gc-lifecycle-app-finley", "gc-lifecycle-employee-finley", "provider-learning-curve-group", "ST0310", "Assessment preparation", "2025-03-10"),
  lifecycleEnrolment("gc-lifecycle-enrol-grace", "gc-lifecycle-app-grace", "gc-lifecycle-employee-grace", "provider-rhg-consult", "ST0934", "In assessment", "2025-02-17"),
  lifecycleEnrolment("gc-lifecycle-enrol-harry", "gc-lifecycle-app-harry", "gc-lifecycle-employee-harry", "provider-qa", "ST0118", "Achieved", "2024-09-09"),
  lifecycleEnrolment("gc-lifecycle-enrol-isobel", "gc-lifecycle-app-isobel", "gc-lifecycle-employee-isobel", "provider-rhg-consult", "ST0056", "Completed without achievement", "2024-10-14"),
];

function profile(employeeId, roleTitle, responsibilities, currentSkills, futureCapabilities, standardId) {
  return {
    employee_id: employeeId,
    stage: "recommendation_ready",
    responsibilities,
    current_skills: currentSkills,
    business_functions: ["Operations", roleTitle],
    current_capabilities: currentSkills,
    apprenticeship_indicators: ["Role-led pathway", "Manager discussion ready"],
    ai_opportunities: futureCapabilities.some((item) => /automation|ai/i.test(item)) ? ["Workflow automation"] : [],
    data_opportunities: futureCapabilities.some((item) => /data|report/i.test(item)) ? ["Reporting insight"] : [],
    automation_opportunities: futureCapabilities.some((item) => /automation/i.test(item)) ? ["Routine workflow automation"] : [],
    future_capabilities: futureCapabilities,
    conversation_history: [{ role: "assistant", content: `I already have this employee's role, manager, application and recommended programme context.` }],
    conversation_profile: {
      currentRole: roleTitle,
      currentDepartment: "Operations",
      currentEmployer: "Ground Control",
      careerGoal: futureCapabilities[0] ?? "Career progression",
      currentSkills,
      interestAreas: futureCapabilities,
      confidence: { role: 90, careerGoal: 82, technicalConfidence: 78, managementAmbition: 55, overall: 84 },
      exchangeCount: 2,
    },
    recommendation_result: {
      recommendations: [],
      topRecommendation: null,
      recommendationVersion: "operational-rbac-1.2",
      confidence: 84,
      revealThreshold: 70,
      shouldRevealRecommendations: true,
      evidenceChanged: false,
      capabilityProfile: [],
      currentCapabilityProfile: [],
      futureCapabilityProfile: [],
      careerStage: "Professional",
      roleFamily: "Operations",
      secondaryRoleFamilies: [],
      developmentObjective: "progression",
      apprenticeshipAppropriate: true,
      consultantReasoning: "Seeded validation profile for operational RBAC testing.",
      excludedPathways: [],
      recommendationEnvelope: { minLevel: 3, maxLevel: 5, notes: ["Role seniority supports a mid-level specialist route."] },
      qualificationAwareness: { highestQualification: null, previousApprenticeshipLevel: null, professionalMemberships: [], existingCertifications: [], needsCollection: true },
      strategicDiscussion: null,
      strategicRecommendation: null,
    },
    preferred_standard_id: standardId,
    updated_at: now,
  };
}

async function main() {
  await loadRuntimeEnv();
  const config = readSupabaseConfig();

  const organisation = await ensureOrganisation(config, betaOrganisation);
  const isolation = await ensureOrganisation(config, isolationOrganisation);
  const groundControlEmployees = [...employees, ...lifecycleLearnerEmployees];
  const groundControlApplications = [...applications, ...lifecycleApplications];
  const groundControlEnrolments = [...enrolments, ...lifecycleEnrolments];
  await resetValidationState(config, organisation.id, groundControlEmployees.map((employee) => employee.id));
  await resetValidationState(config, isolation.id, isolationEmployees.map((employee) => employee.id));

  await upsert(config, "levytate_early_access_requests", users.map((user) => earlyAccessRow(user)), "email");
  await upsert(config, "levytate_early_access_requests", isolationUsers.map((user) => earlyAccessRow(user, isolationOrganisation.name)), "email");
  await upsert(config, "levytate_users", users.map((user) => userRow(user, organisation.id)), "email");
  await upsert(config, "levytate_users", isolationUsers.map((user) => userRow(user, isolation.id)), "email");
  await upsert(config, "levytate_roles", roles.map((role) => withOrg(role, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_role_pathway_mappings", roleMappings.map((mapping) => withOrg(mapping, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_employees", groundControlEmployees.map((employee) => withTimestamps(withOrg(employee, organisation.id))), "organisation_id,id");
  await upsert(config, "levytate_employee_development_profiles", [...profiles, ...lifecycleLearnerProfiles].map((item) => withOrg(item, organisation.id)), "organisation_id,employee_id");
  await upsert(config, "levytate_applications", groundControlApplications.map((application) => withOrg(application, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_application_history", applicationHistoryRows(groundControlApplications, organisation.id), "organisation_id,id");
  await upsert(config, "levytate_enrolments", groundControlEnrolments.map((enrolment) => withOrg(enrolment, organisation.id)), "organisation_id,id");
  await seedLifecycleRecords(config, organisation.id);

  await upsert(config, "levytate_roles", [{
    organisation_id: isolation.id,
    id: "isolation-role-operations",
    title: "Operations Coordinator",
    department: "Operations",
    business_area: "Operations",
    career_level: "Experienced",
    skills_tags: ["Operations", "Reporting"],
    progression: ["Senior Coordinator"],
    status: "Active",
    created_at: now,
    updated_at: now,
  }], "organisation_id,id");
  await upsert(config, "levytate_employees", isolationEmployees.map((employee) => withTimestamps(withOrg(employee, isolation.id))), "organisation_id,id");
  await upsert(config, "levytate_employee_development_profiles", isolationProfiles.map((item) => withOrg(item, isolation.id)), "organisation_id,employee_id");
  await upsert(config, "levytate_applications", isolationApplications.map((application) => withOrg(application, isolation.id)), "organisation_id,id");
  await upsert(config, "levytate_application_history", applicationHistoryRows(isolationApplications, isolation.id), "organisation_id,id");

  console.log(JSON.stringify({
    ok: true,
    organisations: [
      { name: organisation.name, id: organisation.id, slug: organisation.slug },
      { name: isolation.name, id: isolation.id, slug: isolation.slug },
    ],
    testIdentities: [
      ...users.map((user) => ({
        email: user.email,
        displayName: user.displayName,
        employerRole: user.role,
        activeStatus: user.active ? "Approved" : "Declined",
        linkedEmployeeId: employees.find((employee) => employee.email === user.email)?.id ?? null,
        demoMarker: "operational-rbac-test",
      })),
      {
        email: "hello@levytate.co.uk",
        displayName: "LevyTate Platform Admin",
        employerRole: "Platform Admin",
        activeStatus: "Admin allowlist",
        linkedEmployeeId: null,
        demoMarker: "existing-platform-admin",
      },
    ],
  }, null, 2));
}

function earlyAccessRow(user, organisation = betaOrganisation.name) {
  return {
    id: user.id,
    organisation,
    contact_name: user.displayName,
    email: user.email,
    employee_count: "Demo validation workspace",
    biggest_challenge: "Operational RBAC validation test identity",
    consent: true,
    submitted_at: "2026-07-10T09:00:00.000Z",
    updated_at: now,
    status: user.active ? "Approved" : "Declined",
    source: "operational-rbac-test",
    admin_owner_email: "hello@levytate.co.uk",
    approved_at: user.active ? now : null,
    notes: [{ type: "demo_marker", value: "operational-rbac-test" }],
    history: [{ at: now, status: user.active ? "Approved" : "Declined", note: "Seeded for Operational Sprint 1.2 validation." }],
  };
}

function userRow(user, organisationId) {
  return {
    id: user.id,
    organisation_id: organisationId,
    email: user.email,
    role: user.role,
    access_level: "beta_user",
    auth_subject: null,
    last_login_at: null,
    created_at: now,
    updated_at: now,
  };
}

function lifecycleApplication(id, employeeId, standardId, status, reason) {
  return {
    id,
    employee_id: employeeId,
    apprenticeship_standard_id: standardId,
    status,
    current_owner: status === "Approved for Enrolment" ? "Apprenticeship Lead" : "Employee",
    reason,
    career_goal: "Build role-specific capability through a managed apprenticeship route.",
    support_required: "Protected learning time, manager support and provider progress updates.",
    manager_note: "Approved for operational lifecycle demonstration.",
    submitted_at: "2026-01-15T09:00:00.000Z",
    updated_at: now,
  };
}

function lifecycleEnrolment(id, applicationId, employeeId, providerId, standardId, status, startDate) {
  return {
    id,
    application_id: applicationId,
    employee_id: employeeId,
    provider_id: providerId,
    apprenticeship_standard_id: standardId,
    status,
    start_date: startDate,
    notes: "Seeded learner lifecycle example for Apprenticeship Lead operational validation.",
    created_at: now,
    updated_at: now,
  };
}

function applicationHistoryRows(items, organisationId) {
  return items.flatMap((application) => {
    if (application.status === "Draft") {
      return [{
        organisation_id: organisationId,
        id: `${application.id}-hist-draft`,
        application_id: application.id,
        status: "Draft",
        owner: "Employee",
        note: "Employee saved an application draft.",
        created_at: application.updated_at,
      }];
    }
    return [
      {
      organisation_id: organisationId,
      id: `${application.id}-hist-submitted`,
      application_id: application.id,
      status: "Submitted to Line Manager",
      owner: "Line Manager",
      note: "Employee submitted expression of interest.",
      created_at: application.submitted_at,
    },
    {
      organisation_id: organisationId,
      id: `${application.id}-hist-current`,
      application_id: application.id,
      status: application.status,
      owner: application.current_owner,
      note: `Current validation status: ${application.status}.`,
      created_at: application.updated_at,
    },
    ];
  });
}

function learnerRecordId(key) {
  return `gc-lifecycle-record-${key}`;
}

function lifecycleScenarios() {
  return [
    {
      key: "pre-enrolment",
      employeeId: "gc-lifecycle-employee-avery",
      applicationId: "gc-lifecycle-app-avery",
      programmeId: "programme-apprentify-data-technician",
      providerId: "provider-apprentify",
      enrolmentId: "",
      lifecycleStatus: "pre_enrolment",
      employmentRoute: "not_confirmed",
      expectedStartDate: "2026-09-07",
      actualStartDate: "",
      expectedEndDate: "2028-03-07",
      actualEndDate: "",
      progress: null,
      providerReview: null,
      lAndDCheckIn: null,
      eligibilityConfirmed: true,
      eligibilityStatus: "not_confirmed",
      workingHours: 90,
      probationStatus: "awaiting_confirmation",
      hrApprovalStatus: "awaiting_approval",
      guidesSent: false,
      assessment: null,
      achievement: null,
      actions: [],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created for pre-enrolment checks."]],
    },
    {
      key: "on-track",
      employeeId: "gc-lifecycle-employee-ben",
      applicationId: "gc-lifecycle-app-ben",
      programmeId: "programme-qa-data-analyst",
      providerId: "provider-qa",
      enrolmentId: "gc-lifecycle-enrol-ben",
      lifecycleStatus: "enrolled",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2026-02-01",
      actualStartDate: "2026-02-01",
      expectedEndDate: "2027-08-01",
      actualEndDate: "",
      progress: { target: 38, actual: 41, date: "2026-07-03", summary: "Learner is ahead of planned progress and has delivered a useful Power BI reporting prototype.", supportAction: "Maintain current project evidence rhythm." },
      providerReview: { date: "2026-07-05", next: "2026-08-05", summary: "Provider confirms Ben is progressing well with evidence collection.", actions: ["Agree next reporting project", "Share manager feedback before next review"], support: "No additional support required.", status: "completed" },
      lAndDCheckIn: { date: "2026-07-08", next: "2026-08-08", summary: "L&D check-in confirmed good engagement and protected learning time.", actions: ["Keep manager copied into portfolio milestones"], support: "Continue monthly check-ins.", status: "completed" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 92,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: null,
      achievement: null,
      actions: ["guides_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner moved into active learning."]],
    },
    {
      key: "behind-target",
      employeeId: "gc-lifecycle-employee-cara",
      applicationId: "gc-lifecycle-app-cara",
      programmeId: "programme-qa-data-analyst",
      providerId: "provider-qa",
      enrolmentId: "gc-lifecycle-enrol-cara",
      lifecycleStatus: "enrolled",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2026-01-12",
      actualStartDate: "2026-01-12",
      expectedEndDate: "2027-07-12",
      actualEndDate: "",
      progress: { target: 46, actual: 31, date: "2026-07-01", summary: "Progress is behind target due to limited project evidence from live reporting work.", supportAction: "Agree a recovery plan with the provider and line manager." },
      providerReview: { date: "2026-06-27", next: "2026-07-27", summary: "Provider flagged evidence gaps in data visualisation units.", actions: ["Allocate a field planning report project", "Schedule manager evidence review"], support: "Manager needs to create clearer project evidence opportunities.", status: "action_required" },
      lAndDCheckIn: { date: "2026-07-02", next: "2026-07-23", summary: "L&D asked for a short intervention with manager and provider.", actions: ["Book recovery call", "Review workload pressure"], support: "Short-term protected learning plan.", status: "action_required" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 88,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: null,
      achievement: null,
      actions: ["guides_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["progress_updated", "", "", "Progress updated and intervention required."]],
    },
    {
      key: "break",
      employeeId: "gc-lifecycle-employee-daniel",
      applicationId: "gc-lifecycle-app-daniel",
      programmeId: "programme-apprentify-business-analyst",
      providerId: "provider-apprentify",
      enrolmentId: "gc-lifecycle-enrol-daniel",
      lifecycleStatus: "break_in_learning",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2025-10-06",
      actualStartDate: "2025-10-06",
      expectedEndDate: "2027-04-06",
      actualEndDate: "",
      progress: { target: 58, actual: 58, date: "2026-06-20", summary: "Progress was on target before an agreed break in learning.", supportAction: "Confirm return plan before the expected return date." },
      providerReview: { date: "2026-06-15", next: "2026-08-15", summary: "Provider recorded an agreed break linked to operational rota pressures.", actions: ["Confirm return date", "Check evidence continuity"], support: "Return-to-learning plan required.", status: "scheduled" },
      lAndDCheckIn: { date: "2026-06-18", next: "2026-08-01", summary: "L&D approved a temporary pause and noted return date risk.", actions: ["Monitor expected return date"], support: "Manager to confirm rota capacity.", status: "scheduled" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 95,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      break: { startDate: "2026-06-24", expectedReturnDate: "2026-08-05", actualReturnDate: "", reasonCategory: "Operational pause", reasonNotes: "Temporary break while operational cover is stabilised.", status: "active" },
      assessment: null,
      achievement: null,
      actions: ["guides_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["break_started", "enrolled", "break_in_learning", "Break in learning started."]],
    },
    {
      key: "withdrawn",
      employeeId: "gc-lifecycle-employee-emma",
      applicationId: "gc-lifecycle-app-emma",
      programmeId: "programme-learning-curve-customer-service-specialist",
      providerId: "provider-learning-curve-group",
      enrolmentId: "gc-lifecycle-enrol-emma",
      lifecycleStatus: "withdrawn",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2025-11-03",
      actualStartDate: "2025-11-03",
      expectedEndDate: "2027-05-03",
      actualEndDate: "2026-04-18",
      progress: { target: 30, actual: 24, date: "2026-04-15", summary: "Learner withdrew after a role change made the pathway less relevant.", supportAction: "Review future route after new role objectives settle." },
      providerReview: { date: "2026-04-16", next: "", summary: "Provider confirmed withdrawal and closed learning plan.", actions: ["Confirm exit paperwork"], support: "No further provider support.", status: "completed" },
      lAndDCheckIn: { date: "2026-04-18", next: "", summary: "L&D documented withdrawal reason and future development review point.", actions: ["Review alternative development route in Q4"], support: "Keep employee in future pathway review.", status: "completed" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 90,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      withdrawal: { withdrawalDate: "2026-04-18", effectiveDate: "2026-04-18", reasonCategory: "Role change", reasonNotes: "Learner moved to a role where the original programme was no longer the best fit.", initiatedBy: "Employee", providerNotified: true, providerNotifiedDate: "2026-04-18", employeeNotified: true, employeeNotifiedDate: "2026-04-18" },
      assessment: null,
      achievement: null,
      actions: ["guides_sent", "provider_notified"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["withdrawn", "enrolled", "withdrawn", "Learner withdrawn after role change."]],
    },
    {
      key: "assessment-prep",
      employeeId: "gc-lifecycle-employee-finley",
      applicationId: "gc-lifecycle-app-finley",
      programmeId: "programme-learning-curve-project-manager",
      providerId: "provider-learning-curve-group",
      enrolmentId: "gc-lifecycle-enrol-finley",
      lifecycleStatus: "assessment_preparation",
      employmentRoute: "recruited_as_apprentice",
      expectedStartDate: "2025-03-10",
      actualStartDate: "2025-03-10",
      expectedEndDate: "2026-09-10",
      actualEndDate: "",
      progress: { target: 82, actual: 84, date: "2026-07-04", summary: "Learner has completed most learning activity and is preparing gateway evidence.", supportAction: "Confirm final evidence pack and gateway readiness." },
      providerReview: { date: "2026-07-05", next: "2026-08-05", summary: "Provider expects gateway readiness in September.", actions: ["Confirm portfolio evidence", "Schedule mock assessment"], support: "Project evidence sign-off required.", status: "completed" },
      lAndDCheckIn: { date: "2026-07-06", next: "2026-08-06", summary: "L&D confirmed manager is ready to support gateway evidence.", actions: ["Prepare HR and Manager assessment email"], support: "Keep assessment communications on track.", status: "completed" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 100,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: { expected: "2026-09-01", actual: "", gateway: "", status: "preparing", notes: "Preparing evidence and mock assessment plan." },
      achievement: null,
      actions: ["guides_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["assessment_readiness_updated", "enrolled", "assessment_preparation", "Learner moved into assessment preparation."]],
    },
    {
      key: "in-assessment",
      employeeId: "gc-lifecycle-employee-grace",
      applicationId: "gc-lifecycle-app-grace",
      programmeId: "programme-rhg-corporate-responsibility",
      providerId: "provider-rhg-consult",
      enrolmentId: "gc-lifecycle-enrol-grace",
      lifecycleStatus: "in_assessment",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2025-02-17",
      actualStartDate: "2025-02-17",
      expectedEndDate: "2026-08-17",
      actualEndDate: "",
      progress: { target: 94, actual: 96, date: "2026-07-02", summary: "Learner is in assessment with strong evidence from sustainability reporting activity.", supportAction: "Track assessment outcome and certificate once available." },
      providerReview: { date: "2026-06-28", next: "2026-07-28", summary: "Provider confirmed gateway complete and assessment activity underway.", actions: ["Monitor result window"], support: "No immediate intervention.", status: "completed" },
      lAndDCheckIn: { date: "2026-07-01", next: "2026-08-01", summary: "L&D confirmed assessment communications have been sent.", actions: ["Track result outcome"], support: "Keep manager informed.", status: "completed" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 93,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: { expected: "2026-06-25", actual: "2026-06-25", gateway: "2026-06-18", status: "in_assessment", notes: "Gateway complete and assessment underway." },
      achievement: null,
      actions: ["guides_sent", "hr_and_manager_assessment_email_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["assessment_readiness_confirmed", "assessment_preparation", "in_assessment", "Gateway complete and assessment started."]],
    },
    {
      key: "achieved",
      employeeId: "gc-lifecycle-employee-harry",
      applicationId: "gc-lifecycle-app-harry",
      programmeId: "programme-qa-data-analyst",
      providerId: "provider-qa",
      enrolmentId: "gc-lifecycle-enrol-harry",
      lifecycleStatus: "achieved",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2024-09-09",
      actualStartDate: "2024-09-09",
      expectedEndDate: "2026-03-09",
      actualEndDate: "2026-03-20",
      progress: { target: 100, actual: 100, date: "2026-03-20", summary: "Learner achieved the apprenticeship and is applying improved reporting capability in finance.", supportAction: "Send completion communication and plan progression discussion." },
      providerReview: { date: "2026-03-20", next: "", summary: "Provider confirmed achievement outcome and certificate process.", actions: ["Record grade", "Close programme review"], support: "No further provider action.", status: "completed" },
      lAndDCheckIn: { date: "2026-03-25", next: "", summary: "L&D confirmed benefit realisation with finance manager.", actions: ["Discuss progression route"], support: "Progression conversation recommended.", status: "completed" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 96,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: { expected: "2026-02-20", actual: "2026-02-20", gateway: "2026-02-10", status: "completed", notes: "Assessment completed successfully." },
      achievement: { expected: "2026-03-09", actual: "2026-03-20", grade: "Distinction", gradeType: "graded", certificateReceived: true, certificateDate: "2026-04-02", resultNotes: "Strong assessment result with clear workplace impact." },
      actions: ["guides_sent", "hr_and_manager_assessment_email_sent", "completion_email_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["achievement_recorded", "in_assessment", "achieved", "Achievement recorded."], ["operational_action_completed", "", "", "Completion email sent."]],
    },
    {
      key: "completed-without-achievement",
      employeeId: "gc-lifecycle-employee-isobel",
      applicationId: "gc-lifecycle-app-isobel",
      programmeId: "programme-rhg-bid-proposal",
      providerId: "provider-rhg-consult",
      enrolmentId: "gc-lifecycle-enrol-isobel",
      lifecycleStatus: "completed_without_achievement",
      employmentRoute: "existing_employee_upskill",
      expectedStartDate: "2024-10-14",
      actualStartDate: "2024-10-14",
      expectedEndDate: "2026-04-14",
      actualEndDate: "2026-04-30",
      progress: { target: 100, actual: 100, date: "2026-04-30", summary: "Learning activity completed but final assessment outcome was unsuccessful.", supportAction: "Confirm whether a resit or alternative route is appropriate." },
      providerReview: { date: "2026-04-30", next: "", summary: "Provider recorded unsuccessful assessment outcome.", actions: ["Review resit option", "Record learning closure"], support: "L&D to decide next route with manager.", status: "action_required" },
      lAndDCheckIn: { date: "2026-05-03", next: "2026-08-03", summary: "L&D opened a follow-up review for future development planning.", actions: ["Confirm progression decision"], support: "Manager and learner discussion required.", status: "action_required" },
      eligibilityConfirmed: true,
      eligibilityStatus: "employer_verified",
      workingHours: 92,
      probationStatus: "passed",
      hrApprovalStatus: "approved",
      guidesSent: true,
      assessment: { expected: "2026-03-22", actual: "2026-03-24", gateway: "2026-03-08", status: "unsuccessful", notes: "Assessment completed but outcome did not meet achievement threshold." },
      achievement: { expected: "2026-04-14", actual: "2026-04-30", grade: "Not achieved", gradeType: "outcome", certificateReceived: false, certificateDate: "", resultNotes: "Completed without achievement. Resit route under review." },
      actions: ["guides_sent", "hr_and_manager_assessment_email_sent"],
      events: [["learner_record_created", "", "pre_enrolment", "Learner record created."], ["enrolled", "pre_enrolment", "enrolled", "Learner enrolled with provider."], ["assessment_readiness_confirmed", "assessment_preparation", "in_assessment", "Assessment started."], ["achievement_recorded", "in_assessment", "completed_without_achievement", "Completed without achievement recorded."]],
    },
  ];
}

async function seedLifecycleRecords(config, organisationId) {
  const scenarios = lifecycleScenarios();
  const rows = buildLifecycleRows(organisationId, scenarios);
  await upsert(config, "levytate_learner_records", rows.records, "organisation_id,id");
  await upsert(config, "levytate_learner_eligibility_declarations", rows.eligibilityDeclarations, "organisation_id,id");
  await upsert(config, "levytate_learner_pre_enrolment_checks", rows.preEnrolmentChecks, "organisation_id,id");
  await upsert(config, "levytate_learner_breaks_in_learning", rows.breaks, "organisation_id,id");
  await upsert(config, "levytate_learner_withdrawals", rows.withdrawals, "organisation_id,id");
  await upsert(config, "levytate_learner_reviews", rows.reviews, "organisation_id,id");
  await upsert(config, "levytate_learner_progress_updates", rows.progressUpdates, "organisation_id,id");
  await upsert(config, "levytate_learner_assessment_readiness", rows.assessments, "organisation_id,id");
  await upsert(config, "levytate_learner_achievements", rows.achievements, "organisation_id,id");
  await upsert(config, "levytate_learner_operational_actions", rows.operationalActions, "organisation_id,id");
  await upsert(config, "levytate_learner_lifecycle_events", rows.events, "organisation_id,id");
}

function buildLifecycleRows(organisationId, scenarios) {
  const records = [];
  const eligibilityDeclarations = [];
  const preEnrolmentChecks = [];
  const breaks = [];
  const withdrawals = [];
  const reviews = [];
  const progressUpdates = [];
  const assessments = [];
  const achievements = [];
  const operationalActions = [];
  const events = [];

  for (const scenario of scenarios) {
    const recordId = learnerRecordId(scenario.key);
    records.push({
      organisation_id: organisationId,
      id: recordId,
      employee_id: scenario.employeeId,
      application_id: scenario.applicationId,
      programme_id: scenario.programmeId,
      provider_id: scenario.providerId,
      enrolment_id: scenario.enrolmentId,
      lifecycle_status: scenario.lifecycleStatus,
      employment_route: scenario.employmentRoute,
      expected_start_date: scenario.expectedStartDate || null,
      actual_start_date: scenario.actualStartDate || null,
      expected_end_date: scenario.expectedEndDate || null,
      actual_end_date: scenario.actualEndDate || null,
      created_at: now,
      updated_at: now,
      created_by: "operational-rbac-seed",
      updated_by: "operational-rbac-seed",
      record_status: "Active",
      demonstration_record: true,
    });

    eligibilityDeclarations.push({
      organisation_id: organisationId,
      id: `${recordId}-england-hours`,
      learner_record_id: recordId,
      declaration_type: "england_working_hours",
      declaration_wording: "I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship.",
      declaration_version: "2026-07-operational-4a",
      confirmed: scenario.eligibilityConfirmed,
      confirmed_by_employee: scenario.eligibilityConfirmed ? scenario.employeeId : "",
      confirmed_at: scenario.eligibilityConfirmed ? "2026-01-16T09:00:00.000Z" : null,
      expected_england_working_hours_percentage: scenario.workingHours,
      verified_by: scenario.eligibilityStatus === "employer_verified" ? "Priya Shah" : "",
      verified_at: scenario.eligibilityStatus === "employer_verified" ? "2026-01-17T09:00:00.000Z" : null,
      verification_status: scenario.eligibilityStatus,
      notes: scenario.eligibilityConfirmed ? "England working-hours declaration confirmed for demo lifecycle record." : "Awaiting employee confirmation.",
      created_at: now,
      updated_at: now,
    });

    preEnrolmentChecks.push({
      organisation_id: organisationId,
      id: `${recordId}-pre-enrolment`,
      learner_record_id: recordId,
      probation_status: scenario.probationStatus,
      probation_passed_date: scenario.probationStatus === "passed" ? "2026-01-18" : null,
      probation_confirmed_by: scenario.probationStatus === "passed" ? "Priya Shah" : "",
      probation_confirmed_at: scenario.probationStatus === "passed" ? "2026-01-18T09:00:00.000Z" : null,
      probation_notes: scenario.probationStatus === "passed" ? "Probation confirmed as passed." : "Probation status awaiting confirmation.",
      hr_approval_status: scenario.hrApprovalStatus,
      hr_approved_date: scenario.hrApprovalStatus === "approved" ? "2026-01-19" : null,
      hr_approved_by: scenario.hrApprovalStatus === "approved" ? "Priya Shah" : "",
      hr_approval_notes: scenario.hrApprovalStatus === "approved" ? "HR approval confirmed." : "Awaiting HR approval.",
      guides_sent: scenario.guidesSent,
      guides_sent_date: scenario.guidesSent ? "2026-01-20" : null,
      guides_sent_by: scenario.guidesSent ? "Priya Shah" : "",
      guides_version: scenario.guidesSent ? "2026 learner and manager guide pack" : "",
      guides_notes: scenario.guidesSent ? "Learner and manager guides sent." : "Guides not yet sent.",
      created_at: now,
      updated_at: now,
    });

    if (scenario.break) {
      breaks.push({
        organisation_id: organisationId,
        id: `${recordId}-break`,
        learner_record_id: recordId,
        start_date: scenario.break.startDate,
        expected_return_date: scenario.break.expectedReturnDate || null,
        actual_return_date: scenario.break.actualReturnDate || null,
        reason_category: scenario.break.reasonCategory,
        reason_notes: scenario.break.reasonNotes,
        status: scenario.break.status,
        recorded_by: "Priya Shah",
        recorded_at: "2026-06-24T09:00:00.000Z",
        updated_at: now,
      });
    }

    if (scenario.withdrawal) {
      withdrawals.push({
        organisation_id: organisationId,
        id: `${recordId}-withdrawal`,
        learner_record_id: recordId,
        withdrawal_date: scenario.withdrawal.withdrawalDate,
        effective_date: scenario.withdrawal.effectiveDate,
        reason_category: scenario.withdrawal.reasonCategory,
        reason_notes: scenario.withdrawal.reasonNotes,
        initiated_by: scenario.withdrawal.initiatedBy,
        provider_notified: scenario.withdrawal.providerNotified,
        provider_notified_date: scenario.withdrawal.providerNotifiedDate || null,
        employee_notified: scenario.withdrawal.employeeNotified,
        employee_notified_date: scenario.withdrawal.employeeNotifiedDate || null,
        recorded_by: "Priya Shah",
        recorded_at: "2026-04-18T09:00:00.000Z",
      });
    }

    if (scenario.providerReview) {
      reviews.push(reviewRow(organisationId, recordId, scenario.providerReview, "provider_review", scenario.providerId));
    }
    if (scenario.lAndDCheckIn) {
      reviews.push(reviewRow(organisationId, recordId, scenario.lAndDCheckIn, "l_and_d_check_in", ""));
    }
    if (scenario.progress) {
      progressUpdates.push({
        organisation_id: organisationId,
        id: `${recordId}-progress`,
        learner_record_id: recordId,
        update_date: scenario.progress.date,
        target_progress_percentage: scenario.progress.target,
        actual_progress_percentage: scenario.progress.actual,
        variance_percentage: scenario.progress.actual - scenario.progress.target,
        progress_source: "provider_report",
        source_reference: "Ground Control demo provider update",
        updated_by: "Priya Shah",
        summary: scenario.progress.summary,
        support_action: scenario.progress.supportAction,
        created_at: now,
      });
    }
    if (scenario.assessment) {
      assessments.push({
        organisation_id: organisationId,
        id: `${recordId}-assessment`,
        learner_record_id: recordId,
        assessment_model: "end_point_assessment",
        expected_assessment_readiness_date: scenario.assessment.expected || null,
        actual_assessment_readiness_date: scenario.assessment.actual || null,
        gateway_date: scenario.assessment.gateway || null,
        assessment_status: scenario.assessment.status,
        assessment_organisation: "Provider assessment partner",
        assessment_notes: scenario.assessment.notes,
        created_at: now,
        updated_at: now,
      });
    }
    if (scenario.achievement) {
      achievements.push({
        organisation_id: organisationId,
        id: `${recordId}-achievement`,
        learner_record_id: recordId,
        expected_achievement_date: scenario.achievement.expected || null,
        actual_achievement_date: scenario.achievement.actual || null,
        grade: scenario.achievement.grade,
        grade_type: scenario.achievement.gradeType,
        certificate_received: scenario.achievement.certificateReceived,
        certificate_received_date: scenario.achievement.certificateDate || null,
        result_notes: scenario.achievement.resultNotes,
        recorded_by: "Priya Shah",
        recorded_at: "2026-04-30T09:00:00.000Z",
      });
    }

    for (const actionType of scenario.actions) {
      operationalActions.push({
        organisation_id: organisationId,
        id: `${recordId}-${actionType}`,
        learner_record_id: recordId,
        action_type: actionType,
        status: "completed",
        completed: true,
        completed_at: "2026-01-20T09:00:00.000Z",
        completed_by: "Priya Shah",
        recipient_summary: "Learner, manager and provider stakeholders where applicable.",
        notes: `${actionType.replaceAll("_", " ")} completed for demo lifecycle record.`,
        created_at: now,
        updated_at: now,
      });
    }

    scenario.events.forEach(([eventType, previousStatus, newStatus, summary], index) => {
      events.push({
        organisation_id: organisationId,
        id: `${recordId}-event-${index + 1}`,
        learner_record_id: recordId,
        event_type: eventType,
        previous_status: previousStatus,
        new_status: newStatus,
        event_date: `2026-07-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`,
        actor_user_id: "operational-rbac-seed",
        actor_name: "Priya Shah",
        source: "seed",
        summary,
        metadata: { scenario: scenario.key },
        created_at: now,
      });
    });
  }

  return {
    records,
    eligibilityDeclarations,
    preEnrolmentChecks,
    breaks,
    withdrawals,
    reviews,
    progressUpdates,
    assessments,
    achievements,
    operationalActions,
    events,
  };
}

function reviewRow(organisationId, learnerRecordId, review, type, providerId) {
  return {
    organisation_id: organisationId,
    id: `${learnerRecordId}-${type}`,
    learner_record_id: learnerRecordId,
    review_type: type,
    review_date: review.date,
    next_review_date: review.next || null,
    reviewer_name: type === "provider_review" ? "Provider Skills Coach" : "Priya Shah",
    reviewer_user_id: type === "provider_review" ? "" : "gc-rbac-employee-priya",
    provider_id: providerId,
    summary: review.summary,
    actions: review.actions,
    support_required: review.support,
    status: review.status,
    created_at: now,
    updated_at: now,
  };
}

function withOrg(row, organisationId) {
  return { organisation_id: organisationId, ...row };
}

function withTimestamps(row) {
  return { ...row, created_at: row.created_at ?? now, updated_at: row.updated_at ?? now };
}

async function ensureOrganisation(config, organisationSeed) {
  const existing = await selectOne(config, "levytate_organisations", new URLSearchParams({
    select: "id,name,slug",
    slug: `eq.${organisationSeed.slug}`,
    limit: "1",
  }));

  const body = {
    ...organisationSeed,
    id: existing?.id ?? organisationSeed.id,
    created_at: now,
    updated_at: now,
  };

  if (existing) {
    await patch(config, "levytate_organisations", `id=eq.${existing.id}`, {
      name: organisationSeed.name,
      workspace_name: organisationSeed.workspace_name,
      primary_contact: organisationSeed.primary_contact,
      contact_email: organisationSeed.contact_email,
      default_site: organisationSeed.default_site,
      sites: organisationSeed.sites,
      departments: organisationSeed.departments,
      priorities: organisationSeed.priorities,
      status: organisationSeed.status,
      updated_at: now,
    });
    return { ...existing, ...body, id: existing.id };
  }

  const inserted = await upsert(config, "levytate_organisations", [body], "slug", "return=representation");
  return inserted[0] ?? body;
}

async function resetValidationState(config, organisationId, employeeIds) {
  if (!employeeIds.length) return;
  const learnerRecordsToRemove = await selectMany(config, "levytate_learner_records", new URLSearchParams({
    select: "id",
    organisation_id: `eq.${organisationId}`,
    employee_id: `in.(${employeeIds.join(",")})`,
  }));
  const learnerRecordIds = learnerRecordsToRemove.map((row) => row.id).filter(Boolean);
  if (learnerRecordIds.length) {
    const learnerRecordFilter = `organisation_id=eq.${organisationId}&learner_record_id=in.(${learnerRecordIds.join(",")})`;
    for (const table of [
      "levytate_learner_operational_actions",
      "levytate_learner_achievements",
      "levytate_learner_assessment_readiness",
      "levytate_learner_progress_updates",
      "levytate_learner_reviews",
      "levytate_learner_withdrawals",
      "levytate_learner_breaks_in_learning",
      "levytate_learner_pre_enrolment_checks",
      "levytate_learner_eligibility_declarations",
      "levytate_learner_lifecycle_events",
    ]) {
      await deleteRows(config, table, learnerRecordFilter);
    }
    await deleteRows(config, "levytate_learner_records", `organisation_id=eq.${organisationId}&id=in.(${learnerRecordIds.join(",")})`);
  }

  const applicationsToRemove = await selectMany(config, "levytate_applications", new URLSearchParams({
    select: "id",
    organisation_id: `eq.${organisationId}`,
    employee_id: `in.(${employeeIds.join(",")})`,
  }));
  const applicationIds = applicationsToRemove.map((row) => row.id).filter(Boolean);
  for (const applicationId of applicationIds) {
    await deleteRows(config, "levytate_application_history", `organisation_id=eq.${organisationId}&application_id=eq.${applicationId}`);
    await deleteRows(config, "levytate_enrolments", `organisation_id=eq.${organisationId}&application_id=eq.${applicationId}`);
    await deleteRows(config, "levytate_applications", `organisation_id=eq.${organisationId}&id=eq.${applicationId}`);
  }
}

async function upsert(config, table, rows, onConflict, prefer = "resolution=merge-duplicates,return=minimal") {
  if (!rows.length) return [];
  const response = await supabaseFetch(config, `${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: { Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`${table} upsert failed: ${await response.text()}`);
  }
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : [];
}

async function patch(config, table, query, body) {
  const response = await supabaseFetch(config, `${table}?${query}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table} patch failed: ${await response.text()}`);
  }
}

async function deleteRows(config, table, query) {
  const response = await supabaseFetch(config, `${table}?${query}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!response.ok) {
    throw new Error(`${table} delete failed: ${await response.text()}`);
  }
}

async function selectMany(config, table, query) {
  const response = await supabaseFetch(config, `${table}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`${table} select failed: ${await response.text()}`);
  }
  return response.json();
}

async function selectOne(config, table, query) {
  const response = await supabaseFetch(config, `${table}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`${table} select failed: ${await response.text()}`);
  }
  const rows = await response.json();
  return rows[0] ?? null;
}

async function supabaseFetch(config, pathName, init = {}) {
  return fetch(`${config.url}/rest/v1/${pathName}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function loadRuntimeEnv() {
  for (const fileName of [".env.vercel.local", ".env.production.vercel.local", ".env.local", ".env"]) {
    await loadEnvFile(path.join(cwd, fileName));
  }
}

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = normaliseEnv(line.slice(separatorIndex + 1));
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional local env files are ignored.
  }
}

function readSupabaseConfig() {
  const url = normaliseSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normaliseEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return { url, serviceRoleKey };
}

function normaliseSupabaseUrl(value) {
  return normaliseEnv(value).replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

function normaliseEnv(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
