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

  await upsert(config, "levytate_early_access_requests", users.map((user) => earlyAccessRow(user)), "email");
  await upsert(config, "levytate_early_access_requests", isolationUsers.map((user) => earlyAccessRow(user, isolationOrganisation.name)), "email");
  await upsert(config, "levytate_users", users.map((user) => userRow(user, organisation.id)), "email");
  await upsert(config, "levytate_users", isolationUsers.map((user) => userRow(user, isolation.id)), "email");
  await upsert(config, "levytate_roles", roles.map((role) => withOrg(role, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_role_pathway_mappings", roleMappings.map((mapping) => withOrg(mapping, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_employees", employees.map((employee) => withTimestamps(withOrg(employee, organisation.id))), "organisation_id,id");
  await upsert(config, "levytate_employee_development_profiles", profiles.map((item) => withOrg(item, organisation.id)), "organisation_id,employee_id");
  await upsert(config, "levytate_applications", applications.map((application) => withOrg(application, organisation.id)), "organisation_id,id");
  await upsert(config, "levytate_application_history", applicationHistoryRows(applications, organisation.id), "organisation_id,id");
  await upsert(config, "levytate_enrolments", enrolments.map((enrolment) => withOrg(enrolment, organisation.id)), "organisation_id,id");

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
