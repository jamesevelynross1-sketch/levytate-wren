import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const PROSPECT_SANDBOX_TEMPLATE = "LevyTate Prospect Sandbox";
const templateKey = "levytate-prospect-sandbox";
const cwd = process.cwd();
const fixedTime = "2026-07-21T09:00:00.000Z";

const managedTables = [
  "levytate_operational_action_events", "levytate_operational_actions",
  "levytate_learner_operational_actions", "levytate_learner_achievements",
  "levytate_learner_assessment_readiness", "levytate_learner_progress_updates",
  "levytate_learner_reviews", "levytate_learner_withdrawals",
  "levytate_learner_breaks_in_learning", "levytate_learner_pre_enrolment_checks",
  "levytate_learner_eligibility_declarations", "levytate_learner_lifecycle_events",
  "levytate_learner_records", "levytate_application_history", "levytate_enrolments",
  "levytate_applications", "levytate_employee_development_profiles",
  "levytate_role_pathway_mappings", "levytate_roles", "levytate_provider_relationships",
  "levytate_provider_programmes", "levytate_providers", "levytate_employees",
];

export async function createProspectSandbox(input) {
  const request = validateInput(input);
  const config = await runtimeConfig();
  const existing = await one(config, "levytate_organisations", {
    select: "id,name,slug,workspace_name,primary_contact,contact_email,logo_reference,workspace_template,status",
    slug: `eq.${request.workspaceSlug}`,
  });
  if (!existing) await removeOrphanedSandboxRows(config, request.workspaceSlug);

  if (existing && existing.workspace_template !== templateKey) {
    throw new Error("The requested workspace slug is already owned by a non-prospect workspace.");
  }
  const membership = await one(config, "levytate_users", {
    select: "id,organisation_id,email,role,display_name,active",
    email: `eq.${request.prospectEmail}`,
  });
  if (membership && existing?.id !== membership.organisation_id) {
    throw new Error("The requested prospect email is already linked to another workspace.");
  }
  if (existing) {
    const existingMemberships = await many(config, "levytate_users", { select: "id,email", organisation_id: `eq.${existing.id}` });
    if (existingMemberships.some((item) => item.id !== membership?.id)) {
      throw new Error("The managed workspace has additional memberships. Use an explicitly confirmed reset before provisioning again.");
    }
  }

  if (existing && membership && await isCanonical(config, existing, membership, request)) {
    await prepareAccess(config, existing.id, membership, request);
    return safeReport("create", existing, membership, await counts(config, existing.id), 0);
  }

  const organisationId = existing?.id ?? randomUUID();
  const organisation = {
    id: organisationId,
    name: request.organisationName,
    slug: request.workspaceSlug,
    workspace_name: request.organisationName,
    primary_contact: request.prospectDisplayName,
    contact_email: request.primaryContactEmail || request.prospectEmail,
    default_site: "Bristol Operations Centre",
    sites: ["Bristol Operations Centre", "Sheffield Engineering Hub"],
    departments: ["Operations", "Engineering", "Customer Solutions"],
    priorities: [
      { id: `${request.workspaceSlug}-priority-capability`, name: "Build workforce capability", importance: "High", detail: "Create visible development routes for priority roles." },
      { id: `${request.workspaceSlug}-priority-delivery`, name: "Improve operational delivery", importance: "Critical", detail: "Use learning to strengthen consistent service delivery." },
    ],
    logo_reference: request.logoReference,
    workspace_template: templateKey,
    status: "Active",
    created_at: fixedTime,
    updated_at: fixedTime,
  };
  await upsert(config, "levytate_organisations", [organisation], "slug");

  const user = {
    id: membership?.id ?? stableUuid(`${request.workspaceSlug}:lead`),
    organisation_id: organisationId,
    email: request.prospectEmail,
    role: "Apprenticeship Lead",
    access_level: "beta_user",
    display_name: request.prospectDisplayName,
    active: false,
    auth_subject: null,
    last_login_at: membership?.last_login_at ?? null,
    created_at: fixedTime,
    updated_at: fixedTime,
  };
  await upsert(config, "levytate_users", [user], "email");
  await prepareAccess(config, organisationId, user, request);
  await grantAccess(config, request, "prepared");
  await replaceSandboxData(config, organisationId, request);
  await audit(config, organisationId, request.prospectEmail, "prospect_sandbox_created", "Prospect workspace provisioned from the controlled sandbox template.");
  return safeReport("create", organisation, user, await counts(config, organisationId), 1);
}

export async function inspectProspectSandbox(input) {
  const request = validateLookup(input);
  const config = await runtimeConfig();
  const organisation = await findOrganisation(config, request);
  if (!organisation || organisation.workspace_template !== templateKey) {
    throw new Error("Prospect sandbox workspace was not found.");
  }
  const users = await many(config, "levytate_users", {
    select: "id,organisation_id,email,role,display_name,active",
    organisation_id: `eq.${organisation.id}`,
  });
  const membership = users.find((item) => item.email === request.prospectEmail) ?? users[0];
  const access = membership ? await one(config, "levytate_prospect_access", {
    select: "id,access_status,access_start_at,access_expires_at,first_login_at,guidance_completed_at,internal_owner_name,last_status_changed_at,version",
    organisation_id: `eq.${organisation.id}`,
    user_id: `eq.${membership.id}`,
  }) : null;
  return {
    ...safeReport("inspect", organisation, membership, await counts(config, organisation.id), 0),
    activeMemberships: users.filter((item) => item.active).length,
    prospectAccess: access ? {
      id: access.id,
      status: access.access_status,
      accessStartAt: access.access_start_at,
      accessExpiresAt: access.access_expires_at,
      firstLoginAt: access.first_login_at,
      guidanceCompletedAt: access.guidance_completed_at,
      internalOwnerName: access.internal_owner_name,
      lastStatusChangedAt: access.last_status_changed_at,
      version: access.version,
    } : null,
    canonical: Boolean(membership && await isCanonical(config, organisation, membership, {
      organisationName: organisation.name,
      workspaceSlug: organisation.slug,
      prospectEmail: membership.email,
      prospectDisplayName: membership.display_name,
      primaryContactEmail: organisation.contact_email,
      logoReference: organisation.logo_reference,
    })),
  };
}

export async function resetProspectSandbox(input) {
  requireConfirmation(input, "RESET");
  const request = validateLookup(input);
  const config = await runtimeConfig();
  const organisation = await findOrganisation(config, request);
  assertSandbox(organisation);
  const membership = await prospectMembership(config, organisation.id, request.prospectEmail);
  if (!membership) throw new Error("Prospect membership was not found.");
  const preserved = {
    organisationName: organisation.name,
    workspaceSlug: organisation.slug,
    prospectEmail: membership.email,
    prospectDisplayName: membership.display_name || organisation.primary_contact,
    primaryContactEmail: organisation.contact_email,
    logoReference: organisation.logo_reference,
  };
  const additionalMemberships = await many(config, "levytate_users", {
    select: "id",
    organisation_id: `eq.${organisation.id}`,
    id: `neq.${membership.id}`,
  });
  for (const item of additionalMemberships) await remove(config, "levytate_users", { id: `eq.${item.id}` });
  await replaceSandboxData(config, organisation.id, preserved);
  await audit(config, organisation.id, membership.email, "prospect_sandbox_reset", "Prospect workspace restored to its original prepared state.");
  return safeReport("reset", organisation, membership, await counts(config, organisation.id), 1);
}

export async function deactivateProspectAccess(input) {
  requireConfirmation(input, "DEACTIVATE");
  return setProspectAccess(input, false);
}

export async function reactivateProspectAccess(input) {
  requireConfirmation(input, "REACTIVATE");
  return setProspectAccess(input, true);
}

async function setProspectAccess(input, active) {
  const request = validateLookup(input);
  const config = await runtimeConfig();
  const organisation = await findOrganisation(config, request);
  assertSandbox(organisation);
  const membership = await prospectMembership(config, organisation.id, request.prospectEmail);
  if (!membership) throw new Error("Prospect membership was not found.");
  const access = await one(config, "levytate_prospect_access", { select: "*", organisation_id: `eq.${organisation.id}`, user_id: `eq.${membership.id}` });
  if (!access) throw new Error("Prospect access record was not found.");
  const now = new Date().toISOString();
  const expiry = active ? new Date(input.accessExpiresAt ?? Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : access.access_expires_at;
  if (active && Date.parse(expiry) <= Date.now()) throw new Error("A future expiry date is required to reactivate access.");
  await patch(config, "levytate_prospect_access", { id: `eq.${access.id}`, version: `eq.${access.version}` }, active ? {
    access_status: "active", access_start_at: access.access_start_at ?? now, access_expires_at: expiry,
    reactivated_at: now, reactivated_by: "Prospect sandbox command", revoked_at: null, revoked_by: "", revocation_reason: "",
    last_status_changed_at: now, updated_at: now, version: access.version + 1,
  } : {
    access_status: "revoked", revoked_at: now, revoked_by: "Prospect sandbox command",
    revocation_reason: String(input.reason ?? "Controlled validation deactivation"), last_status_changed_at: now,
    updated_at: now, version: access.version + 1,
  });
  await patch(config, "levytate_users", { id: `eq.${membership.id}` }, {
    active,
    role: "Apprenticeship Lead",
    organisation_id: organisation.id,
    updated_at: now,
  });
  await grantAccess(config, {
    organisationName: organisation.name,
    prospectEmail: membership.email,
    prospectDisplayName: membership.display_name || organisation.primary_contact,
  }, active ? "active" : "inactive");
  await audit(config, organisation.id, membership.email, active ? "prospect_access_reactivated" : "prospect_access_deactivated", active ? "Prospect access reactivated." : "Prospect access deactivated; workspace records retained.");
  return { operation: active ? "reactivate" : "deactivate", organisationId: organisation.id, membershipId: membership.id, role: "Apprenticeship Lead", active };
}

async function replaceSandboxData(config, organisationId, request) {
  for (const table of managedTables) await remove(config, table, { organisation_id: `eq.${organisationId}` });
  const data = buildProspectSandboxTemplate(organisationId, request);
  for (const [table, rows, conflict] of data) await upsert(config, table, rows, conflict);
}

async function removeOrphanedSandboxRows(config, workspaceSlug) {
  const prefix = `prospect-${shortHash(workspaceSlug)}`;
  const orphan = await one(config, "levytate_roles", { select: "organisation_id", id: `eq.${prefix}-role-lead` });
  if (!orphan?.organisation_id) return;
  const owner = await one(config, "levytate_organisations", { select: "id,workspace_template", id: `eq.${orphan.organisation_id}` });
  if (owner) throw new Error("The prospect fixture identifier is already owned by an existing workspace.");
  for (const table of managedTables) await remove(config, table, { organisation_id: `eq.${orphan.organisation_id}` });
}

export function buildProspectSandboxTemplate(organisationId, request) {
  const prefix = `prospect-${shortHash(request.workspaceSlug)}`;
  const workspaceEmail = (localPart) => `${localPart}@${request.workspaceSlug}.example`;
  const leadId = `${prefix}-employee-lead`;
  const managers = [
    employee(`${prefix}-manager-1`, "PS-002", "Helen Ward", workspaceEmail("helen.ward"), "Operations Manager", `${prefix}-role-manager`, leadId, "Operations", "Bristol Operations Centre", "Line Manager", "2022-04-04"),
    employee(`${prefix}-manager-2`, "PS-003", "Marcus Bell", workspaceEmail("marcus.bell"), "Engineering Manager", `${prefix}-role-manager`, leadId, "Engineering", "Sheffield Engineering Hub", "Line Manager", "2021-09-13"),
    employee(`${prefix}-manager-3`, "PS-004", "Sophie Kent", workspaceEmail("sophie.kent"), "Customer Solutions Manager", `${prefix}-role-manager`, leadId, "Customer Solutions", "Bristol Operations Centre", "Line Manager", "2023-02-20"),
  ];
  const people = [
    ["Aisha Cole", "aisha.cole", 0, "Operations Coordinator"],
    ["Tom Weaver", "tom.weaver", 0, "Service Planner"],
    ["Leah Grant", "leah.grant", 1, "Junior Data Analyst"],
    ["Noah Ellis", "noah.ellis", 1, "Systems Technician"],
    ["Maya Sutton", "maya.sutton", 2, "Customer Adviser"],
    ["Callum Reed", "callum.reed", 0, "Process Coordinator"],
    ["Nina Clarke", "nina.clarke", 1, "Engineering Planner"],
    ["Joel Finch", "joel.finch", 2, "Customer Insight Analyst"],
    ["Freya Moss", "freya.moss", 0, "Operations Analyst"],
    ["Omar Lane", "omar.lane", 1, "Technical Coordinator"],
    ["Ivy Hart", "ivy.hart", 2, "Customer Operations Assistant"],
  ].map(([name, emailLocal, managerIndex, title], index) => employee(
    `${prefix}-employee-${index + 1}`, `PS-${String(index + 5).padStart(3, "0")}`, name, workspaceEmail(emailLocal), title,
    `${prefix}-role-${managerIndex === 1 ? "technical" : managerIndex === 2 ? "customer" : "operations"}`,
    managers[managerIndex].id, managerIndex === 1 ? "Engineering" : managerIndex === 2 ? "Customer Solutions" : "Operations",
    managerIndex === 1 ? "Sheffield Engineering Hub" : "Bristol Operations Centre", "Employee", "2024-01-08",
  ));
  const employees = [
    employee(leadId, "PS-001", request.prospectDisplayName, request.prospectEmail, "Apprenticeship Lead", `${prefix}-role-lead`, "", "Operations", "Bristol Operations Centre", "Apprenticeship Lead", "2021-01-11"),
    ...managers, ...people,
  ];
  const roles = [
    role(`${prefix}-role-lead`, "Apprenticeship Lead", "Operations", "Manager"),
    role(`${prefix}-role-manager`, "People Manager", "Operations", "Manager"),
    role(`${prefix}-role-operations`, "Operations Coordinator", "Operations", "Experienced"),
    role(`${prefix}-role-technical`, "Technical Specialist", "Engineering", "Experienced"),
    role(`${prefix}-role-customer`, "Customer Specialist", "Customer Solutions", "Entry"),
  ];
  const programmes = [
    programme(`${prefix}-programme-data`, `${prefix}-provider-northstar`, "Data Technician", "ST0795", 3),
    programme(`${prefix}-programme-analyst`, `${prefix}-provider-northstar`, "Data Analyst", "ST0118", 4),
    programme(`${prefix}-programme-leader`, `${prefix}-provider-elmbridge`, "Team Leader", "ST0384", 3),
    programme(`${prefix}-programme-customer`, `${prefix}-provider-elmbridge`, "Customer Service Specialist", "ST0071", 3),
    programme(`${prefix}-programme-improvement`, `${prefix}-provider-harbour`, "Improvement Practitioner", "ST0193", 4),
  ];
  const providers = [
    provider(`${prefix}-provider-northstar`, "Northstar Learning Partners", "contact@northstar-learning.example"),
    provider(`${prefix}-provider-elmbridge`, "Elmbridge Skills Collective", "contact@elmbridge-skills.example"),
    provider(`${prefix}-provider-harbour`, "Harbour Development Institute", "contact@harbour-development.example"),
  ];
  const applicationSpecs = [
    [0, "ST0384", "Awaiting Manager Review", "Line Manager"],
    [1, "ST0795", "More information requested", "Employee"],
    [2, "ST0795", "Approved for Enrolment", "Apprenticeship Lead"],
    [3, "ST0118", "Approved for Enrolment", "Apprenticeship Lead"],
    [4, "ST0071", "Approved for Enrolment", "Apprenticeship Lead"],
    [5, "ST0193", "Approved for Enrolment", "Apprenticeship Lead"],
    [6, "ST0118", "Approved for Enrolment", "Apprenticeship Lead"],
    [7, "ST0795", "Approved for Enrolment", "Apprenticeship Lead"],
    [8, "ST0384", "Approved for Enrolment", "Apprenticeship Lead"],
    [9, "ST0193", "Approved for Enrolment", "Apprenticeship Lead"],
  ];
  const applications = applicationSpecs.map(([personIndex, standard, status, owner], index) => ({
    organisation_id: organisationId, id: `${prefix}-application-${index + 1}`, employee_id: people[personIndex].id,
    apprenticeship_standard_id: standard, status, current_owner: owner,
    reason: "Build practical capability for current role priorities.", career_goal: "Progress through a structured work-based development route.",
    support_required: "Protected learning time and regular manager support.", manager_note: status === "More information requested" ? "Add a clearer workplace project example." : "",
    submitted_at: "2026-06-16T09:00:00.000Z", updated_at: fixedTime,
  }));
  const learnerSpecs = [
    { key: "hr-outstanding", person: 2, programme: 0, status: "pre_enrolment", hr: "awaiting_approval", guides: true, route: "existing_employee_upskill" },
    { key: "ready-to-enrol", person: 3, programme: 1, status: "pre_enrolment", hr: "approved", guides: true, route: "existing_employee_upskill", actualStart: "2026-09-07" },
    { key: "on-target", person: 4, programme: 3, status: "enrolled", progress: [55, 57], providerReview: ["2026-05-15", "2026-06-15", "action_required"], hr: "approved", guides: true, route: "existing_employee_upskill" },
    { key: "behind-target", person: 5, programme: 4, status: "enrolled", progress: [64, 42], providerReview: ["2026-07-02", "2026-08-02", "completed"], hr: "approved", guides: true, route: "existing_employee_upskill" },
    { key: "break", person: 6, programme: 1, status: "break_in_learning", progress: [48, 48], break: true, hr: "approved", guides: true, route: "existing_employee_upskill" },
    { key: "assessment-prep", person: 7, programme: 0, status: "assessment_preparation", progress: [90, 88], assessment: "preparing", hr: "approved", guides: true, route: "existing_employee_upskill" },
    { key: "in-assessment", person: 8, programme: 2, status: "in_assessment", progress: [100, 100], assessment: "in_assessment", hr: "approved", guides: true, route: "existing_employee_upskill" },
    { key: "achieved", person: 9, programme: 4, status: "achieved", progress: [100, 100], assessment: "completed", achievement: true, hr: "approved", guides: true, route: "existing_employee_upskill" },
  ];
  const lifecycle = lifecycleRows(organisationId, prefix, request, people, applications, programmes, learnerSpecs);
  const enrolments = learnerSpecs.filter((item) => !["hr-outstanding", "ready-to-enrol"].includes(item.key)).map((item) => {
    const index = learnerSpecs.indexOf(item);
    return { organisation_id: organisationId, id: `${prefix}-enrolment-${item.key}`, application_id: applications[index + 2].id, employee_id: people[item.person].id, provider_id: programmes[item.programme].provider_id, apprenticeship_standard_id: programmes[item.programme].apprenticeship_standard_id, status: item.status === "achieved" ? "Completed" : "Active", start_date: "2025-09-08", notes: "Current apprenticeship programme record.", created_at: fixedTime, updated_at: fixedTime };
  });
  return [
    ["levytate_roles", roles.map((x) => ({ organisation_id: organisationId, ...x, created_at: fixedTime, updated_at: fixedTime })), "organisation_id,id"],
    ["levytate_role_pathway_mappings", roles.slice(2).map((item, index) => ({ organisation_id: organisationId, id: `${prefix}-mapping-${index + 1}`, role_id: item.id, apprenticeship_standard_id: programmes[index].apprenticeship_standard_id, recommendation_type: "Primary", priority: 1, business_rationale: "Supports a priority capability need.", funding_route: "Potentially funded through levy/co-investment", delivery_preference: "Blended" })), "organisation_id,id"],
    ["levytate_employees", employees.map((x) => ({ organisation_id: organisationId, ...x, created_at: fixedTime, updated_at: fixedTime })), "organisation_id,id"],
    ["levytate_employee_development_profiles", people.map((item, index) => profile(organisationId, item, programmes[index % programmes.length].apprenticeship_standard_id)), "organisation_id,employee_id"],
    ["levytate_applications", applications, "organisation_id,id"],
    ["levytate_application_history", applications.map((item) => ({ organisation_id: organisationId, id: `${item.id}-history`, application_id: item.id, status: item.status, owner: item.current_owner, note: "Current application journey state.", created_at: item.updated_at })), "organisation_id,id"],
    ["levytate_providers", providers.map((x) => ({ organisation_id: organisationId, ...x })), "organisation_id,provider_id"],
    ["levytate_provider_programmes", programmes.map((x) => ({ organisation_id: organisationId, ...x, created_at: fixedTime, updated_at: fixedTime })), "organisation_id,id"],
    ["levytate_provider_relationships", providers.map((item, index) => ({ organisation_id: organisationId, id: `${prefix}-relationship-${index + 1}`, category: ["Digital", "Leadership", "Operations"][index], preferred_provider_id: item.provider_id, backup_provider_ids: [], apprenticeship_standard_ids: programmes.filter((p) => p.provider_id === item.provider_id).map((p) => p.apprenticeship_standard_id), programme_ids: programmes.filter((p) => p.provider_id === item.provider_id).map((p) => p.id), status: "Preferred", notes: "Preferred provider relationship for the current programme portfolio.", review_date: "2026-10-01", last_used_date: "2026-07-01" })), "organisation_id,id"],
    ["levytate_enrolments", enrolments, "organisation_id,id"],
    ...lifecycle,
  ];
}

function lifecycleRows(org, prefix, request, people, applications, programmes, specs) {
  const records = [], eligibility = [], checks = [], breaks = [], reviews = [], progress = [], assessment = [], achievements = [], completedActions = [], events = [], persistent = [], persistentEvents = [];
  specs.forEach((item, index) => {
    const id = `${prefix}-learner-${item.key}`;
    const person = people[item.person], programme = programmes[item.programme], application = applications[index + 2];
    records.push({ organisation_id: org, id, employee_id: person.id, application_id: application.id, programme_id: programme.id, provider_id: programme.provider_id, enrolment_id: ["hr-outstanding", "ready-to-enrol"].includes(item.key) ? "" : `${prefix}-enrolment-${item.key}`, lifecycle_status: item.status, employment_route: item.route, expected_start_date: "2026-09-07", actual_start_date: item.status === "pre_enrolment" ? item.actualStart || null : "2025-09-08", expected_end_date: "2027-03-08", actual_end_date: item.status === "achieved" ? "2026-06-30" : null, created_at: fixedTime, updated_at: fixedTime, created_by: request.prospectEmail, updated_by: request.prospectEmail, record_status: "Active", demonstration_record: true });
    eligibility.push({ organisation_id: org, id: `${id}-eligibility`, learner_record_id: id, declaration_type: "england_working_hours", declaration_wording: "I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship.", declaration_version: "prospect-readiness-p1", confirmed: true, confirmed_by_employee: person.id, confirmed_at: fixedTime, expected_england_working_hours_percentage: 90, verified_by: request.prospectDisplayName, verified_at: fixedTime, verification_status: "employer_verified", notes: "Confirmed for the prepared prospect journey.", created_at: fixedTime, updated_at: fixedTime });
    checks.push({ organisation_id: org, id: `${id}-pre-enrolment`, learner_record_id: id, probation_status: "passed", probation_passed_date: "2026-01-15", probation_confirmed_by: request.prospectDisplayName, probation_confirmed_at: fixedTime, probation_notes: "Confirmed.", hr_approval_status: item.hr, hr_approved_date: item.hr === "approved" ? "2026-01-16" : null, hr_approved_by: item.hr === "approved" ? request.prospectDisplayName : "", hr_approval_notes: item.hr === "approved" ? "Approved." : "Approval outstanding.", guides_sent: item.guides, guides_sent_date: item.guides ? "2026-01-16" : null, guides_sent_by: item.guides ? request.prospectDisplayName : "", guides_version: item.guides ? "Prospect guide pack" : "", guides_notes: "", created_at: fixedTime, updated_at: fixedTime });
    if (item.progress) progress.push({ organisation_id: org, id: `${id}-progress`, learner_record_id: id, update_date: "2026-07-01", target_progress_percentage: item.progress[0], actual_progress_percentage: item.progress[1], variance_percentage: item.progress[1] - item.progress[0], progress_source: "provider_report", source_reference: "Monthly provider report", updated_by: request.prospectDisplayName, summary: item.key === "behind-target" ? "Progress is significantly behind target and needs intervention." : "Progress is in line with the current plan.", support_action: item.key === "behind-target" ? "Agree a recovery plan with manager and provider." : "Maintain planned support.", created_at: fixedTime });
    if (item.providerReview) reviews.push({ organisation_id: org, id: `${id}-provider-review`, learner_record_id: id, review_type: "provider_review", review_date: item.providerReview[0], next_review_date: item.providerReview[1], reviewer_name: "Skills Coach", reviewer_user_id: "", provider_id: programme.provider_id, summary: item.providerReview[2] === "action_required" ? "Provider review is overdue and requires follow-up." : "Provider review completed.", actions: item.providerReview[2] === "action_required" ? ["Arrange provider review"] : [], support_required: "", status: item.providerReview[2], created_at: fixedTime, updated_at: fixedTime });
    if (item.break) breaks.push({ organisation_id: org, id: `${id}-break`, learner_record_id: id, start_date: "2026-05-01", expected_return_date: "2026-07-01", actual_return_date: null, reason_category: "temporary_role_or_workload_change", reason_notes: "Temporary workload change while operational cover is stabilised.", status: "active", recorded_by: request.prospectDisplayName, recorded_at: fixedTime, updated_at: fixedTime });
    if (item.assessment) assessment.push({ organisation_id: org, id: `${id}-assessment`, learner_record_id: id, assessment_model: "end_point_assessment", assessment_model_explanation: "", expected_assessment_readiness_date: "2026-08-15", actual_assessment_readiness_date: item.assessment === "preparing" ? null : "2026-07-01", gateway_date: item.assessment === "preparing" ? null : "2026-07-05", expected_assessment_start_date: "2026-08-20", assessment_start_date: item.assessment === "in_assessment" || item.assessment === "completed" ? "2026-07-10" : null, assessment_status: item.assessment, assessment_organisation: "Independent Assessment Partnership", assessment_contact: "Assessment Team", assessment_reference: `${prefix}-${item.key}`, assessment_notes: "Current assessment journey and readiness position.", confirmations: {}, readiness_confirmed_by: item.assessment === "preparing" ? "" : request.prospectEmail, readiness_confirmed_at: item.assessment === "preparing" ? null : fixedTime, updated_by: request.prospectEmail, version: 1, created_at: fixedTime, updated_at: fixedTime });
    if (item.achievement) achievements.push({ organisation_id: org, id: `${id}-achievement`, learner_record_id: id, expected_achievement_date: "2026-06-30", actual_achievement_date: "2026-06-30", grade: "Pass", grade_type: "graded", certificate_received: true, certificate_received_date: "2026-07-10", result_notes: "Achievement recorded following successful assessment.", recorded_by: request.prospectDisplayName, recorded_at: fixedTime });
    if (item.guides) completedActions.push({ organisation_id: org, id: `${id}-guides`, learner_record_id: id, action_type: "guides_sent", status: "completed", completed: true, completed_at: fixedTime, completed_by: request.prospectDisplayName, recipient_summary: "Learner and manager", notes: "Guide pack sent.", created_at: fixedTime, updated_at: fixedTime });
    events.push({ organisation_id: org, id: `${id}-event-created`, learner_record_id: id, event_type: "learner_record_created", previous_status: "", new_status: "pre_enrolment", event_date: fixedTime, actor_user_id: request.prospectEmail, actor_name: request.prospectDisplayName, source: "levytate", summary: "Learner journey created.", metadata: { journey: item.key }, created_at: fixedTime });
    const action = actionFor(item, id, person, programme, request);
    if (action) {
      persistent.push({ organisation_id: org, ...action, detected_at: fixedTime, created_at: fixedTime, updated_at: fixedTime, version: 1 });
      persistentEvents.push({ organisation_id: org, id: `${action.id}-detected`, operational_action_id: action.id, event_type: "detected", previous_status: "", new_status: "open", actor_user_id: request.prospectEmail, actor_name: request.prospectDisplayName, event_date: fixedTime, summary: "Operational condition detected.", metadata: {}, created_at: fixedTime });
    }
  });
  return [
    ["levytate_learner_records", records, "organisation_id,id"], ["levytate_learner_eligibility_declarations", eligibility, "organisation_id,id"],
    ["levytate_learner_pre_enrolment_checks", checks, "organisation_id,id"], ["levytate_learner_breaks_in_learning", breaks, "organisation_id,id"],
    ["levytate_learner_reviews", reviews, "organisation_id,id"], ["levytate_learner_progress_updates", progress, "organisation_id,id"],
    ["levytate_learner_assessment_readiness", assessment, "organisation_id,id"], ["levytate_learner_achievements", achievements, "organisation_id,id"],
    ["levytate_learner_operational_actions", completedActions, "organisation_id,id"], ["levytate_learner_lifecycle_events", events, "organisation_id,id"],
    ["levytate_operational_actions", persistent, "organisation_id,id"], ["levytate_operational_action_events", persistentEvents, "organisation_id,id"],
  ];
}

function actionFor(item, learnerId, person, programme, request) {
  const map = {
    "hr-outstanding": ["pre_enrolment:hr-approval-complete", "pre_enrolment_readiness", "obtain_hr_approval", "Confirm HR approval", "High", 2, "HR"],
    "ready-to-enrol": ["ready_to_enrol", "pre_enrolment_readiness", "complete_enrolment", "Complete enrolment", "High", 2, "Apprenticeship Lead"],
    "on-target": ["review_due:provider_review", "review_due", "record_provider_review", "Record overdue provider review", "High", 2, "Provider"],
    "behind-target": ["progress_behind_target", "progress_exception", "address_progress_exception", "Address progress exception", "Critical", 1, "Shared"],
    break: ["return_date_overdue", "break_in_learning", "return_learner", "Confirm return from break", "High", 2, "Shared"],
    "assessment-prep": ["assessment:provider-confirmation", "assessment_readiness", "obtain_provider_readiness_confirmation", "Confirm assessment readiness", "Medium", 3, "Provider"],
  }[item.key];
  if (!map) return null;
  return { id: `${learnerId}-action`, learner_record_id: learnerId, application_id: "", employee_id: person.id, source_type: map[1], source_key: `${learnerId}:${map[0]}`, action_type: map[2], title: map[3], description: `Action for ${person.name} on ${programme.programme_name}.`, priority: map[4], priority_rank: map[5], status: "open", owner_type: map[6], owner_user_id: "", owner_display_name: "", due_date: "2026-07-15", acknowledged_at: null, acknowledged_by: "", started_at: null, started_by: "", completed_at: null, completed_by: "", completion_method: "", completion_note: "", dismissed_at: null, dismissed_by: "", dismissal_reason: "", source_url: `/levytate/app?module=Learners&learner=${encodeURIComponent(learnerId)}`, metadata: { provisionedBy: request.prospectEmail } };
}

function employee(id, employee_number, name, email, job_title, role_id, manager_id, department, site, platform_role, start_date) { return { id, employee_number, name, email, job_title, role_id, manager_id, department, site, platform_role, status: "Active", start_date }; }
function role(id, title, department, career_level) { return { id, title, department, business_area: department, career_level, skills_tags: ["Communication", "Digital confidence", "Continuous improvement"], progression: [], status: "Active" }; }
function provider(provider_id, provider_name, contact_email) { return { provider_id, provider_name, website: "", provider_type: "Independent training provider", sectors: ["Business services"], delivery_model: ["Blended"], delivery_models: ["Blended"], industries: ["Business services"], technologies: [], regions: ["England"], employer_types: ["Mid-market"], specialisms: ["Work-based learning"], contact_name: "Provider Relationship Team", contact_email, ofsted_rating: "", status: "Active", source_urls: [], notes: "Provider record for the current apprenticeship portfolio.", last_verified: "2026-07-01", verification_status: "verified" }; }
function programme(id, provider_id, name, standard, level) { return { id, provider_id, apprenticeship_standard_id: standard, delivery_mode: "Blended", programme_name: name, short_description: `${name} work-based learning programme.`, full_description: `Work-based ${name} development aligned to current workforce capability priorities.`, status: "Active", verification_status: "Provider confirmed", target_organisations: ["Mid-market"], target_industries: ["Business services"], target_job_roles: [], seniority: "Mixed", employer_size: "Mid-market", business_problems_solved: ["Capability development"], skills_developed: ["Practical role capability"], technologies_covered: [], expected_outcomes: ["Improved workplace performance"], delivery_models: ["Blended"], regions: ["England"], duration: "15 months", cohort_options: ["Quarterly"], commercial_notes: "", linked_standard_id: standard, linked_standard_ids: [standard], linked_standard_name: name, level, route: "Business and administration", funding_band: null, official_url: "", source_url: "", notes: "Programme aligned to a current workforce capability need.", funding_route: "Potentially funded through levy/co-investment", record_status: "Active" }; }
function profile(org, person, standard) { return { organisation_id: org, employee_id: person.id, stage: "recommendation_ready", responsibilities: [person.job_title], current_skills: ["Communication", "Organisation"], business_functions: [person.department], current_capabilities: ["Role delivery"], apprenticeship_indicators: ["Role-led pathway"], ai_opportunities: [], data_opportunities: [], automation_opportunities: [], future_capabilities: ["Continuous improvement"], conversation_history: [], conversation_profile: null, recommendation_result: null, preferred_standard_id: standard, updated_at: fixedTime }; }

function validateInput(input = {}) {
  const organisationName = textValue(input.organisationName, "organisation name");
  const workspaceSlug = slugValue(input.workspaceSlug);
  const prospectEmail = emailValue(input.prospectEmail);
  const prospectDisplayName = textValue(input.prospectDisplayName, "prospect display name");
  rejectContamination([organisationName, workspaceSlug, prospectEmail, prospectDisplayName, input.logoReference, input.primaryContactEmail]);
  return { organisationName, workspaceSlug, prospectEmail, prospectDisplayName, logoReference: String(input.logoReference ?? "").trim(), primaryContactEmail: String(input.primaryContactEmail ?? prospectEmail).trim().toLowerCase() };
}
function validateLookup(input = {}) { return { workspaceSlug: slugValue(input.workspaceSlug), prospectEmail: input.prospectEmail ? emailValue(input.prospectEmail) : "" }; }
function textValue(value, label) { const result = String(value ?? "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }
function emailValue(value) { const email = String(value ?? "").trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid prospect email is required."); return email; }
function slugValue(value) { const slug = String(value ?? "").trim().toLowerCase(); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("A lowercase workspace slug is required."); return slug; }
function rejectContamination(values) { const blocked = /ground control|portakabin|wren|innocent|rbac|levytate\.test|hello@levytate|demo|fixture|seed/i; if (values.some((value) => blocked.test(String(value ?? "")))) throw new Error("Prospect input contains a reserved demonstration or internal identifier."); }
function requireConfirmation(input, expected) { if (input?.confirmation !== expected) throw new Error(`Explicit ${expected} confirmation is required.`); }
function assertSandbox(org) { if (!org || org.workspace_template !== templateKey) throw new Error("The requested workspace is not a managed prospect sandbox."); }
function stableUuid(value) { const hex = createHash("sha256").update(value).digest("hex"); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`; }
function shortHash(value) { return createHash("sha256").update(value).digest("hex").slice(0, 10); }

async function findOrganisation(config, request) { return one(config, "levytate_organisations", { select: "id,name,slug,workspace_name,primary_contact,contact_email,logo_reference,workspace_template,status", slug: `eq.${request.workspaceSlug}` }); }
async function prospectMembership(config, org, email) { return one(config, "levytate_users", { select: "id,organisation_id,email,role,display_name,active", organisation_id: `eq.${org}`, ...(email ? { email: `eq.${email}` } : {}), limit: "1" }); }
async function isCanonical(config, org, membership, request) { const c = await counts(config, org.id); return org.name === request.organisationName && org.workspace_name === request.organisationName && org.primary_contact === request.prospectDisplayName && org.contact_email === request.primaryContactEmail && (org.logo_reference || "") === (request.logoReference || "") && org.workspace_template === templateKey && membership.role === "Apprenticeship Lead" && membership.email === request.prospectEmail && membership.display_name === request.prospectDisplayName && c.users === 1 && c.employees === 15 && c.applications === 10 && c.learners === 8 && c.providers === 3 && c.programmes === 5; }
async function counts(config, org) { const map = { users: "levytate_users", employees: "levytate_employees", applications: "levytate_applications", learners: "levytate_learner_records", providers: "levytate_providers", programmes: "levytate_provider_programmes", actions: "levytate_operational_actions" }; return Object.fromEntries(await Promise.all(Object.entries(map).map(async ([key, table]) => [key, (await many(config, table, { select: "*", organisation_id: `eq.${org}` })).length]))); }
function safeReport(operation, org, user, itemCounts, changes) { return { operation, template: PROSPECT_SANDBOX_TEMPLATE, organisationId: org.id, membershipId: user?.id ?? null, workspaceSlug: org.slug, organisationName: org.name, role: user?.role ?? null, active: user?.active ?? null, counts: itemCounts, changes }; }

async function prepareAccess(config, organisationId, user, request) {
  const existing = await one(config, "levytate_prospect_access", { select: "id", organisation_id: `eq.${organisationId}`, user_id: `eq.${user.id}` });
  if (existing) return existing;
  const now = new Date().toISOString();
  const created = (await upsert(config, "levytate_prospect_access", [{ organisation_id: organisationId, user_id: user.id, access_status: "prepared", internal_owner_name: request.internalOwnerName ?? "", internal_notes: request.internalNotes ?? "", last_status_changed_at: now, created_at: now, updated_at: now, version: 1 }], "organisation_id,user_id"))[0];
  await audit(config, organisationId, request.prospectEmail, "prospect_access.prepared", "Access prepared.");
  return created;
}

async function grantAccess(config, request, state) {
  const segments = [state === "active" ? "levytate_beta_access" : state === "prepared" ? "levytate_early_access_pending" : "levytate_early_access_declined"];
  const status = state === "active" ? "Approved" : state === "prepared" ? "New" : "Declined";
  await upsert(config, "subscribers", [{ email: request.prospectEmail, status: "active", source_page: "/levytate/early-access", unsubscribe_token: stableUuid(`${request.prospectEmail}:unsubscribe`), segments, updated_at: new Date().toISOString() }], "email");
  await upsert(config, "levytate_early_access_requests", [{ id: stableUuid(`${request.prospectEmail}:access`), organisation: request.organisationName, contact_name: request.prospectDisplayName, email: request.prospectEmail, employee_count: "Controlled prospect workspace", biggest_challenge: "Evaluate apprenticeship operations in a prepared workspace", consent: true, submitted_at: fixedTime, updated_at: new Date().toISOString(), status, source: "prospect-readiness", admin_owner_email: null, approved_at: state === "active" ? new Date().toISOString() : null, notes: [{ type: "prospect_workspace", template: templateKey }], history: [{ at: new Date().toISOString(), status, note: state === "active" ? "Prospect access active." : state === "prepared" ? "Prospect access prepared." : "Prospect access inactive." }] }], "email");
}
async function audit(config, org, email, action, summary) { await upsert(config, "levytate_audit_events", [{ id: randomUUID(), organisation_id: org, actor_email: email, actor_role: "Apprenticeship Lead", entity_type: action.startsWith("prospect_access.") ? "prospect_access" : "prospect_workspace", entity_id: org, action, summary, metadata: { template: templateKey }, created_at: new Date().toISOString() }], "id"); }

async function runtimeConfig() { await loadEnv(); const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, ""); const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(); if (!url || !key) throw new Error("Supabase service configuration is required."); return { url, key }; }
async function loadEnv() { for (const name of [".env.local", ".env"]) { try { const raw = await fs.readFile(path.join(cwd, name), "utf8"); for (const line of raw.split(/\r?\n/)) { if (!line || line.trimStart().startsWith("#")) continue; const at = line.indexOf("="); if (at < 1) continue; const key = line.slice(0, at).trim(), value = line.slice(at + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[key] && value) process.env[key] = value; } } catch {} } }
async function request(config, table, { method = "GET", query = {}, body, prefer = "return=representation" } = {}) { const params = new URLSearchParams(query); const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, { method, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: prefer }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); if (!response.ok) throw new Error(`Prospect workspace storage operation failed for ${table} (${response.status}).`); const value = await response.text(); return value ? JSON.parse(value) : []; }
async function many(config, table, query) { return request(config, table, { query }); }
async function one(config, table, query) { return (await many(config, table, { ...query, limit: query.limit ?? "1" }))[0] ?? null; }
async function upsert(config, table, rows, conflict) { if (!rows.length) return []; return request(config, table, { method: "POST", query: { on_conflict: conflict }, body: rows, prefer: "resolution=merge-duplicates,return=representation" }); }
async function patch(config, table, query, body) { return request(config, table, { method: "PATCH", query, body }); }
async function remove(config, table, query) { return request(config, table, { method: "DELETE", query, prefer: "return=minimal" }); }

function cliInput(args) { const values = {}; for (let i = 0; i < args.length; i += 1) if (args[i].startsWith("--")) { const key = args[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); values[key] = args[i + 1]?.startsWith("--") ? true : args[++i] ?? true; } return values; }
async function main() {
  const [operation, ...args] = process.argv.slice(2); const input = cliInput(args);
  const functions = { create: createProspectSandbox, inspect: inspectProspectSandbox, reset: resetProspectSandbox, deactivate: deactivateProspectAccess, reactivate: reactivateProspectAccess };
  if (!functions[operation]) throw new Error("Use create, inspect, reset, deactivate or reactivate.");
  console.log(JSON.stringify(await functions[operation](input), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
