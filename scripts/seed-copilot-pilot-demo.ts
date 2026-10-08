import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicrosoftCopilotActor } from "../lib/levytate/microsoft-copilot";

export const COPILOT_PILOT_ORGANISATION_ID = "52e0bfce-abe2-4442-919d-692eb4e2bcc9";
export const COPILOT_PILOT_ORGANISATION_NAME = "LevyTate Copilot Pilot";
export const COPILOT_PILOT_USER_ID = "ec7c0714-e37b-4866-ad4f-ea85bb6cc246";
const tenantId = "c56739d0-ca1f-445a-b403-29899fce6e5f";
const canonicalCatalogueSlug = "levytate-internal";
const prefix = "copilot-pilot-demo";
const selectedBy = "copilot-pilot-demo-seed";

type RuntimeConfig = { url: string; key: string };
type StorageRow = Record<string, string | number | boolean | null>;
type Programme = {
  key: string;
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  standardId: string;
  durationMonths: number;
};

export const COPILOT_PILOT_PROGRAMMES: readonly Programme[] = [
  { key: "ai", id: "programme-apprentify-ai-automation-practitioner", providerId: "provider-apprentify", providerName: "Apprentify", name: "AI & Automation Practitioner", standardId: "ST1512", durationMonths: 18 },
  { key: "data-analyst", id: "programme-qa-data-analyst", providerId: "provider-qa", providerName: "QA", name: "Data Analyst", standardId: "ST0118", durationMonths: 24 },
  { key: "data-technician", id: "programme-apprentify-data-technician", providerId: "provider-apprentify", providerName: "Apprentify", name: "Data Technician", standardId: "ST0795", durationMonths: 24 },
  { key: "business-analyst", id: "programme-qa-business-analyst", providerId: "provider-qa", providerName: "QA", name: "Business Analyst", standardId: "ST0117", durationMonths: 18 },
  { key: "team-leader", id: "programme-hbtc-team-leader", providerId: "provider-hbtc", providerName: "HBTC", name: "Team Leader", standardId: "ST0384", durationMonths: 15 },
] as const;

const managers = [
  { key: "operations", name: "Priya Shah", title: "Operations Development Manager", department: "Operations", site: "Birmingham Operations Hub" },
  { key: "data", name: "Oliver Bennett", title: "Data & Technology Manager", department: "Data & Technology", site: "Manchester Digital Centre" },
  { key: "commercial", name: "Hannah Clarke", title: "Commercial Capability Manager", department: "Commercial", site: "London Client Centre" },
] as const;

const learners = [
  ["aisha-morgan", "Aisha Morgan", "Operations Process Analyst", "Operations", "operations", "ai", 5],
  ["daniel-keane", "Daniel Keane", "Finance Automation Coordinator", "Finance", "data", "ai", 7],
  ["sophie-barrett", "Sophie Barrett", "Customer Experience Improvement Analyst", "Customer Experience", "commercial", "ai", 4],
  ["marcus-flynn", "Marcus Flynn", "People Systems Specialist", "People", "data", "ai", 9],
  ["elena-ward", "Elena Ward", "Procurement Automation Officer", "Procurement", "commercial", "ai", 6],
  ["noah-lambert", "Noah Lambert", "Commercial Operations Analyst", "Commercial", "commercial", "ai", 11],
  ["ruby-hughes", "Ruby Hughes", "Performance Analyst", "Operations", "operations", "data-analyst", 8],
  ["adam-rowe", "Adam Rowe", "Financial Data Analyst", "Finance", "data", "data-analyst", 12],
  ["leila-brooks", "Leila Brooks", "Customer Insight Analyst", "Customer Experience", "commercial", "data-analyst", 6],
  ["ethan-price", "Ethan Price", "Workforce Data Analyst", "People", "data", "data-analyst", 10],
  ["maya-foster", "Maya Foster", "Operations Data Coordinator", "Operations", "operations", "data-technician", 4],
  ["callum-reed", "Callum Reed", "Junior Reporting Technician", "Data & Technology", "data", "data-technician", 7],
  ["nina-cole", "Nina Cole", "Finance Data Technician", "Finance", "data", "data-technician", 13],
  ["joel-finch", "Joel Finch", "Business Change Analyst", "Operations", "operations", "business-analyst", 8],
  ["freya-moss", "Freya Moss", "Procurement Process Analyst", "Procurement", "commercial", "business-analyst", 5],
  ["omar-lane", "Omar Lane", "Customer Operations Team Leader", "Customer Experience", "commercial", "team-leader", 9],
  ["ivy-hart", "Ivy Hart", "Service Delivery Team Leader", "Operations", "operations", "team-leader", 6],
] as const;

const pipeline = [
  ["harriet-collins", "Harriet Collins", "Operations Improvement Coordinator", "Operations", "operations", "ai", "Awaiting Manager Review", "Line Manager", -6],
  ["caleb-morris", "Caleb Morris", "Finance Transformation Officer", "Finance", "data", "ai", "Awaiting Final Approval", "Apprenticeship Lead", -15],
  ["toby-reed", "Toby Reed", "Commercial Reporting Assistant", "Commercial", "commercial", "data-analyst", "Approved for Enrolment", "Provider Partner", -8],
  ["leila-dawson", "Leila Dawson", "Front-line Service Supervisor", "Customer Experience", "commercial", "team-leader", "Approved for Enrolment", "Provider Partner", -2],
] as const;

export async function seedCopilotPilotDemo(referenceDate = new Date().toISOString().slice(0, 10)) {
  const config = await runtimeConfig();
  const guard = await verifyGuard(config);
  const model = buildSeedModel(referenceDate);
  const existing = await inspectManagedState(config, model);
  if (existing.mode === "empty") await persistModel(config, model);
  else if (existing.mode !== "complete") throw new Error(`Pilot seed refused partial or unexpected state: ${existing.reason}`);

  process.env.LEVYTATE_AI_ENABLED = "false";
  const { refreshAutopilotWorkspaceForMicrosoftCopilotActor } = await import("../lib/server/levytate-autopilot");
  const actor: MicrosoftCopilotActor = {
    organisationId: COPILOT_PILOT_ORGANISATION_ID,
    organisationName: COPILOT_PILOT_ORGANISATION_NAME,
    userId: COPILOT_PILOT_USER_ID,
    email: String(guard.user.email),
    role: "Employer Admin",
    tenantId,
    objectId: String(guard.identity.external_object_id),
    identityId: String(guard.identity.id),
  };
  const autopilot = await refreshAutopilotWorkspaceForMicrosoftCopilotActor(actor);
  const report = await validatePersistedState(config, model, autopilot);
  return { operation: existing.mode === "empty" ? "seeded" : "already_seeded", referenceDate, ...report };
}

export function buildSeedModel(referenceDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("A valid ISO reference date is required.");
  const createdAt = `${referenceDate}T08:30:00.000Z`;
  const programmes = new Map(COPILOT_PILOT_PROGRAMMES.map((item) => [item.key, item]));
  const managerRows = managers.map((manager, index) => ({
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    id: `${prefix}-manager-${manager.key}`,
    employee_number: `CP-M${String(index + 1).padStart(2, "0")}`,
    name: manager.name,
    email: `${manager.key}.manager@copilot-pilot.invalid`,
    job_title: manager.title,
    role_id: `${prefix}-role-manager`,
    manager_id: "",
    department: manager.department,
    site: manager.site,
    platform_role: "Line Manager",
    status: "Active",
    start_date: addMonths(referenceDate, -36 - index * 4),
    created_at: createdAt,
    updated_at: createdAt,
  }));
  const personRows = [...learners, ...pipeline].map((person, index) => {
    const [key, name, title, department, managerKey] = person;
    const manager = managerRows.find((item) => item.id.endsWith(String(managerKey)));
    if (!manager) throw new Error(`Manager mapping is missing for ${key}.`);
    return {
      organisation_id: COPILOT_PILOT_ORGANISATION_ID,
      id: `${prefix}-employee-${key}`,
      employee_number: `CP-${String(index + 1).padStart(3, "0")}`,
      name,
      email: `${key}@copilot-pilot.invalid`,
      job_title: title,
      role_id: `${prefix}-role-${key}`,
      manager_id: manager.id,
      department,
      site: manager.site,
      platform_role: "Employee",
      status: "Active",
      start_date: addMonths(referenceDate, -18 - (index % 12)),
      created_at: createdAt,
      updated_at: createdAt,
    };
  });
  const learnerPeople = personRows.slice(0, learners.length);
  const pipelinePeople = personRows.slice(learners.length);
  const liveApplications = learners.map((spec, index) => {
    const [key, , , , , programmeKey, monthsAgo] = spec;
    const programme = requiredProgramme(programmes, programmeKey);
    const startDate = addMonths(referenceDate, -Number(monthsAgo));
    return applicationRow(key, learnerPeople[index].id, programme, "Completed", "Completed", addDays(startDate, -45), startDate);
  });
  const pipelineApplications = pipeline.map((spec, index) => {
    const [key, , , , , programmeKey, status, owner, updatedOffset] = spec;
    const programme = requiredProgramme(programmes, programmeKey);
    return applicationRow(key, pipelinePeople[index].id, programme, String(status), String(owner), addDays(referenceDate, Number(updatedOffset) - 14), addDays(referenceDate, Number(updatedOffset)));
  });
  const applications = [...liveApplications, ...pipelineApplications];
  const applicationHistory = applications.map((application) => ({
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    id: `${application.id}-history-current`,
    application_id: application.id,
    status: application.status,
    owner: application.current_owner,
    note: application.status === "Completed" ? "Application workflow completed when the learner entered active learning." : "Current pre-enrolment workflow state.",
    created_at: application.updated_at,
  }));
  const enrolments = learners.map((spec, index) => {
    const [key, , , , , programmeKey, monthsAgo] = spec;
    const programme = requiredProgramme(programmes, programmeKey);
    const startDate = addMonths(referenceDate, -Number(monthsAgo));
    return {
      organisation_id: COPILOT_PILOT_ORGANISATION_ID,
      id: `${prefix}-enrolment-${key}`,
      application_id: liveApplications[index].id,
      employee_id: learnerPeople[index].id,
      provider_id: programme.providerId,
      apprenticeship_standard_id: programme.standardId,
      status: "Live learner",
      start_date: startDate,
      notes: "Active apprenticeship delivery record for the internal Microsoft Copilot demonstration portfolio.",
      created_at: `${startDate}T09:00:00.000Z`,
      updated_at: `${startDate}T09:00:00.000Z`,
    };
  });
  const learnerRecords = learners.map((spec, index) => {
    const [key, , , , , programmeKey, monthsAgo] = spec;
    const programme = requiredProgramme(programmes, programmeKey);
    const startDate = addMonths(referenceDate, -Number(monthsAgo));
    return {
      organisation_id: COPILOT_PILOT_ORGANISATION_ID,
      id: `${prefix}-learner-${key}`,
      employee_id: learnerPeople[index].id,
      application_id: liveApplications[index].id,
      programme_id: programme.id,
      provider_id: programme.providerId,
      enrolment_id: enrolments[index].id,
      lifecycle_status: "enrolled",
      employment_route: "existing_employee_upskill",
      expected_start_date: startDate,
      actual_start_date: startDate,
      expected_end_date: addMonths(startDate, programme.durationMonths),
      actual_end_date: null,
      created_at: `${startDate}T09:00:00.000Z`,
      updated_at: createdAt,
      created_by: selectedBy,
      updated_by: selectedBy,
      record_status: "Active",
      demonstration_record: true,
    };
  });
  const progress = learnerRecords.map((record, index) => {
    const target = Math.min(82, 22 + (index % 7) * 7 + Math.floor(index / 7) * 3);
    const actual = target + [2, 0, -1, 3, 1, -2][index % 6];
    return {
      organisation_id: COPILOT_PILOT_ORGANISATION_ID,
      id: `${record.id}-progress-current`,
      learner_record_id: record.id,
      update_date: addDays(referenceDate, -(index % 10)),
      target_progress_percentage: target,
      actual_progress_percentage: actual,
      variance_percentage: actual - target,
      progress_source: "provider_report",
      source_reference: "Latest monthly provider progress return",
      updated_by: selectedBy,
      summary: "Progress remains broadly aligned with the agreed apprenticeship plan.",
      support_action: "Maintain scheduled workplace learning and manager support.",
      created_at: createdAt,
    };
  });
  const dueOffsets = [3, 8, 11, 13];
  const reviews = learnerRecords.map((record, index) => {
    const programme = requiredProgramme(programmes, learners[index][5]);
    const nextReviewDate = addDays(referenceDate, index < dueOffsets.length ? dueOffsets[index] : 24 + index);
    return {
      organisation_id: COPILOT_PILOT_ORGANISATION_ID,
      id: `${record.id}-provider-review-current`,
      learner_record_id: record.id,
      review_type: "provider_review",
      review_date: addDays(nextReviewDate, -56),
      next_review_date: nextReviewDate,
      reviewer_name: `${programme.providerName} Skills Coach`,
      reviewer_user_id: "",
      provider_id: programme.providerId,
      summary: "The latest provider review confirmed progress remains broadly aligned with the delivery plan.",
      actions: [],
      support_required: "",
      status: "completed",
      created_at: createdAt,
      updated_at: createdAt,
    };
  });
  const actions = [
    operationalAction({
      key: "review-manager-dependency", learner: learnerRecords[0], employee: learnerPeople[0], dueDate: addDays(referenceDate, 1),
      ownerType: "Line Manager", actionType: "record_manager_check_in", sourceType: "review_due",
      title: "Confirm workplace evidence before provider review", description: "The manager needs to confirm the current workplace evidence before the scheduled provider review.", priority: "Medium", rank: 2, detectedAt: addDays(referenceDate, -2),
    }),
    operationalAction({
      key: "provider-dependency-overdue", learner: learnerRecords[4], employee: learnerPeople[4], dueDate: addDays(referenceDate, -6),
      ownerType: "Provider", actionType: "confirm_provider", sourceType: "operational_communication",
      title: "Provider to confirm workshop schedule", description: "The provider confirmation for the next cohort workshop schedule remains outstanding.", priority: "High", rank: 1, detectedAt: addDays(referenceDate, -10),
    }),
    operationalAction({
      key: "manager-action-due-soon", learner: learnerRecords[8], employee: learnerPeople[8], dueDate: addDays(referenceDate, 2),
      ownerType: "Line Manager", actionType: "record_manager_check_in", sourceType: "operational_communication",
      title: "Complete scheduled manager support check-in", description: "The next manager support conversation is due within two days.", priority: "Medium", rank: 2, detectedAt: addDays(referenceDate, -3),
    }),
  ];
  const actionEvents = actions.map((action) => ({
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    id: `${action.id}-event-detected`,
    operational_action_id: action.id,
    event_type: "detected",
    previous_status: "",
    new_status: "open",
    actor_user_id: COPILOT_PILOT_USER_ID,
    actor_name: selectedBy,
    event_date: action.detected_at,
    summary: "Fictional demonstration condition recorded for operational follow-up.",
    metadata: { seed: prefix },
    created_at: action.detected_at,
  }));
  const providerSelections = unique(COPILOT_PILOT_PROGRAMMES.map((item) => item.providerId)).map((providerId) => ({
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    provider_id: providerId,
    status: "Active",
    selected_by: selectedBy,
    selected_at: createdAt,
    updated_at: createdAt,
  }));
  const programmeSelections = COPILOT_PILOT_PROGRAMMES.map((programme) => ({
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    programme_id: programme.id,
    provider_id: programme.providerId,
    status: "Active",
    selected_by: selectedBy,
    selected_at: createdAt,
    updated_at: createdAt,
  }));
  return {
    employees: [...managerRows, ...personRows], applications, applicationHistory, enrolments, learnerRecords,
    progress, reviews, actions, actionEvents, providerSelections, programmeSelections,
  };
}

async function verifyGuard(config: RuntimeConfig) {
  const [organisations, users, connections, identities, canonicalOrganisations] = await Promise.all([
    many(config, "levytate_organisations", { select: "id,name,status", id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
    many(config, "levytate_users", { select: "id,organisation_id,email,role,active", id: `eq.${COPILOT_PILOT_USER_ID}` }),
    many(config, "levytate_external_tenant_connections", { select: "organisation_id,status", provider: "eq.microsoft_entra", external_tenant_id: `eq.${tenantId}` }),
    many(config, "levytate_external_identities", { select: "id,organisation_id,levytate_user_id,external_object_id,status", provider: "eq.microsoft_entra", external_tenant_id: `eq.${tenantId}` }),
    many(config, "levytate_organisations", { select: "id", slug: `eq.${canonicalCatalogueSlug}` }),
  ]);
  const organisation = organisations[0];
  const user = users[0];
  if (organisations.length !== 1 || organisation?.name !== COPILOT_PILOT_ORGANISATION_NAME || organisation.status !== "Active") throw new Error("Seed guard failed: the exact fictional pilot organisation is unavailable.");
  if (users.length !== 1 || user?.organisation_id !== COPILOT_PILOT_ORGANISATION_ID || user.role !== "Employer Admin" || user.active !== true) throw new Error("Seed guard failed: the exact pilot Employer Admin is unavailable.");
  if (connections.length !== 1 || connections[0].organisation_id !== COPILOT_PILOT_ORGANISATION_ID || connections[0].status !== "active") throw new Error("Seed guard failed: the Microsoft tenant connection is not active for the pilot.");
  if (identities.length !== 1 || identities[0].organisation_id !== COPILOT_PILOT_ORGANISATION_ID || identities[0].levytate_user_id !== COPILOT_PILOT_USER_ID || identities[0].status !== "active") throw new Error("Seed guard failed: the pilot JIT identity is not active.");
  const canonicalId = canonicalOrganisations[0]?.id;
  if (!canonicalId) throw new Error("Seed guard failed: the canonical catalogue is unavailable.");
  const [programmes, providers] = await Promise.all([
    many(config, "levytate_provider_programmes", { select: "id,provider_id,programme_name,apprenticeship_standard_id,status,record_status", organisation_id: `eq.${canonicalId}`, id: `in.(${COPILOT_PILOT_PROGRAMMES.map((item) => item.id).join(",")})` }),
    many(config, "levytate_providers", { select: "provider_id,status", organisation_id: `eq.${canonicalId}`, provider_id: `in.(${unique(COPILOT_PILOT_PROGRAMMES.map((item) => item.providerId)).join(",")})` }),
  ]);
  for (const expected of COPILOT_PILOT_PROGRAMMES) {
    const programme = programmes.find((item) => item.id === expected.id);
    if (!programme || programme.provider_id !== expected.providerId || programme.programme_name !== expected.name || programme.apprenticeship_standard_id !== expected.standardId || programme.status !== "Active" || programme.record_status !== "Active") {
      throw new Error(`Seed guard failed: canonical programme ${expected.id} changed or is inactive.`);
    }
  }
  if (providers.length !== 3 || providers.some((provider) => provider.status !== "Active")) throw new Error("Seed guard failed: a selected canonical provider is unavailable.");
  if (!identities[0].id || !identities[0].external_object_id) throw new Error("Seed guard failed: the pilot JIT identity binding is incomplete.");
  return { organisation, user, identity: identities[0] };
}

async function inspectManagedState(config: RuntimeConfig, model: ReturnType<typeof buildSeedModel>) {
  const specifications = [
    ["levytate_employees", "id", model.employees.map((row) => row.id)],
    ["levytate_applications", "id", model.applications.map((row) => row.id)],
    ["levytate_application_history", "id", model.applicationHistory.map((row) => row.id)],
    ["levytate_enrolments", "id", model.enrolments.map((row) => row.id)],
    ["levytate_learner_records", "id", model.learnerRecords.map((row) => row.id)],
    ["levytate_learner_progress_updates", "id", model.progress.map((row) => row.id)],
    ["levytate_learner_reviews", "id", model.reviews.map((row) => row.id)],
    ["levytate_operational_actions", "id", model.actions.map((row) => row.id)],
    ["levytate_operational_action_events", "id", model.actionEvents.map((row) => row.id)],
  ] as const;
  let total = 0;
  for (const [table, key, expectedIds] of specifications) {
    const rows = await many(config, table, { select: key, organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}`, limit: "10000" });
    total += rows.length;
    const actual = rows.map((row) => String(row[key])).sort();
    if (rows.length && JSON.stringify(actual) !== JSON.stringify([...expectedIds].sort())) return { mode: "unexpected" as const, reason: `${table} does not match the controlled seed identifiers` };
  }
  const [providerSelections, programmeSelections] = await Promise.all([
    many(config, "levytate_organisation_providers", { select: "provider_id", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
    many(config, "levytate_organisation_programmes", { select: "programme_id", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
  ]);
  total += providerSelections.length + programmeSelections.length;
  if (providerSelections.length && JSON.stringify(providerSelections.map((row) => row.provider_id).sort()) !== JSON.stringify(model.providerSelections.map((row) => row.provider_id).sort())) return { mode: "unexpected" as const, reason: "provider selections differ from the controlled portfolio" };
  if (programmeSelections.length && JSON.stringify(programmeSelections.map((row) => row.programme_id).sort()) !== JSON.stringify(model.programmeSelections.map((row) => row.programme_id).sort())) return { mode: "unexpected" as const, reason: "programme selections differ from the controlled portfolio" };
  if (!total) return { mode: "empty" as const, reason: "" };
  const complete = total === specifications.reduce((sum, [, , ids]) => sum + ids.length, 0) + model.providerSelections.length + model.programmeSelections.length;
  return complete ? { mode: "complete" as const, reason: "" } : { mode: "partial" as const, reason: "controlled rows are only partially present" };
}

async function persistModel(config: RuntimeConfig, model: ReturnType<typeof buildSeedModel>) {
  const operations: Array<[string, unknown[], string]> = [
    ["levytate_employees", model.employees, "organisation_id,id"],
    ["levytate_applications", model.applications, "organisation_id,id"],
    ["levytate_application_history", model.applicationHistory, "organisation_id,id"],
    ["levytate_enrolments", model.enrolments, "organisation_id,id"],
    ["levytate_organisation_providers", model.providerSelections, "organisation_id,provider_id"],
    ["levytate_organisation_programmes", model.programmeSelections, "organisation_id,programme_id"],
    ["levytate_learner_records", model.learnerRecords, "organisation_id,id"],
    ["levytate_learner_progress_updates", model.progress, "organisation_id,id"],
    ["levytate_learner_reviews", model.reviews, "organisation_id,id"],
    ["levytate_operational_actions", model.actions, "organisation_id,id"],
    ["levytate_operational_action_events", model.actionEvents, "organisation_id,id"],
  ];
  for (const [table, rows, conflict] of operations) await upsert(config, table, rows, conflict);
}

async function validatePersistedState(config: RuntimeConfig, model: ReturnType<typeof buildSeedModel>, autopilot: Awaited<ReturnType<typeof import("../lib/server/levytate-autopilot")["refreshAutopilotWorkspaceForMicrosoftCopilotActor"]>>) {
  const [learnersPersisted, applicationsPersisted, reviewsPersisted, providersPersisted, programmesPersisted, signalsPersisted] = await Promise.all([
    many(config, "levytate_learner_records", { select: "id,lifecycle_status,record_status,programme_id", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
    many(config, "levytate_applications", { select: "id,status,current_owner", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
    many(config, "levytate_learner_reviews", { select: "learner_record_id,next_review_date,review_type,status", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}` }),
    many(config, "levytate_organisation_providers", { select: "provider_id,status", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}`, status: "eq.Active" }),
    many(config, "levytate_organisation_programmes", { select: "programme_id,status", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}`, status: "eq.Active" }),
    many(config, "levytate_intelligence_signals", { select: "signal_type,lane,autopilot_priority,status", organisation_id: `eq.${COPILOT_PILOT_ORGANISATION_ID}`, analyser_version: "eq.operations-autopilot-v1" }),
  ]);
  const activeSignals = signalsPersisted.filter((signal) => !["dismissed", "resolved"].includes(String(signal.status)));
  const mix = COPILOT_PILOT_PROGRAMMES.map((programme) => ({
    programme: programme.name,
    count: learnersPersisted.filter((learner) => learner.programme_id === programme.id && learner.record_status === "Active" && learner.lifecycle_status === "enrolled").length,
  }));
  return {
    activeLearners: learnersPersisted.filter((learner) => learner.record_status === "Active" && learner.lifecycle_status === "enrolled").length,
    preEnrolmentApplications: applicationsPersisted.filter((application) => application.current_owner !== "Completed").length,
    providerReviewsDueNext14Days: reviewsPersisted.filter((review) => review.review_type === "provider_review" && review.status !== "cancelled" && String(review.next_review_date) >= model.reviews[0].updated_at.slice(0, 10) && String(review.next_review_date) <= addDays(model.reviews[0].updated_at.slice(0, 10), 14)).length,
    programmeMix: mix,
    selectedProviders: providersPersisted.map((row) => COPILOT_PILOT_PROGRAMMES.find((item) => item.providerId === row.provider_id)?.providerName).filter(Boolean).sort(),
    selectedProgrammes: programmesPersisted.length,
    upcomingProviderReviewDates: reviewsPersisted.map((review) => String(review.next_review_date)).filter((date) => date >= model.reviews[0].updated_at.slice(0, 10) && date <= addDays(model.reviews[0].updated_at.slice(0, 10), 14)).sort(),
    autopilot: autopilot.brief,
    openSignalTypes: activeSignals.map((signal) => String(signal.signal_type)).sort(),
  };
}

function applicationRow(key: string, employeeId: string, programme: Programme, status: string, owner: string, submittedDate: string, updatedDate: string) {
  return {
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    id: `${prefix}-application-${key}`,
    employee_id: employeeId,
    apprenticeship_standard_id: programme.standardId,
    status,
    current_owner: owner,
    reason: `Build practical ${programme.name.toLowerCase()} capability for current role priorities.`,
    career_goal: "Apply new capability in role and progress through structured work-based development.",
    support_required: "Protected learning time and a regular manager check-in.",
    manager_note: "",
    submitted_at: `${submittedDate}T09:00:00.000Z`,
    updated_at: `${updatedDate}T09:00:00.000Z`,
  };
}

function operationalAction(input: { key: string; learner: Record<string, string | boolean | null>; employee: Record<string, string>; dueDate: string; ownerType: string; actionType: string; sourceType: string; title: string; description: string; priority: string; rank: number; detectedAt: string }) {
  const id = `${prefix}-action-${input.key}`;
  return {
    organisation_id: COPILOT_PILOT_ORGANISATION_ID,
    id,
    learner_record_id: input.learner.id,
    application_id: input.learner.application_id,
    employee_id: input.employee.id,
    source_type: input.sourceType,
    source_key: `${prefix}:${input.key}`,
    action_type: input.actionType,
    title: input.title,
    description: input.description,
    priority: input.priority,
    priority_rank: input.rank,
    status: "open",
    owner_type: input.ownerType,
    owner_user_id: "",
    owner_display_name: input.ownerType,
    due_date: input.dueDate,
    detected_at: `${input.detectedAt}T09:00:00.000Z`,
    acknowledged_at: null,
    acknowledged_by: "",
    started_at: null,
    started_by: "",
    completed_at: null,
    completed_by: "",
    completion_method: "",
    completion_note: "",
    dismissed_at: null,
    dismissed_by: "",
    dismissal_reason: "",
    source_url: `/levytate/app?module=Learners&learner=${encodeURIComponent(String(input.learner.id))}`,
    metadata: { seed: prefix, fictional: true },
    version: 1,
    created_at: `${input.detectedAt}T09:00:00.000Z`,
    updated_at: `${input.detectedAt}T09:00:00.000Z`,
  };
}

function requiredProgramme(programmes: Map<string, Programme>, key: string) {
  const programme = programmes.get(key);
  if (!programme) throw new Error(`Unknown programme key ${key}.`);
  return programme;
}
function unique(values: string[]) { return [...new Set(values)]; }
function addDays(date: string, days: number) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function addMonths(date: string, months: number) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCMonth(value.getUTCMonth() + months); return value.toISOString().slice(0, 10); }

async function runtimeConfig(): Promise<RuntimeConfig> {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        if (!line || line.trimStart().startsWith("#")) continue;
        const at = line.indexOf("=");
        if (at < 1) continue;
        const key = line.slice(0, at).trim();
        const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key] && value) process.env[key] = value;
      }
    } catch {}
  }
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase service configuration is required.");
  if (new URL(url).hostname.split(".")[0] !== "lzwcahdgchrkeulmlfqv") throw new Error("Seed guard failed: unexpected Supabase project reference.");
  return { url, key };
}
async function request(config: RuntimeConfig, table: string, { method = "GET", query = {}, body, prefer = "return=representation" }: { method?: string; query?: Record<string, string>; body?: unknown; prefer?: string } = {}) {
  const params = new URLSearchParams(query);
  const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, { method, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: prefer }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`Pilot seed storage operation failed for ${table} (${response.status}): ${await response.text()}`);
  const value = await response.text();
  return value ? JSON.parse(value) as StorageRow[] : [];
}
async function many(config: RuntimeConfig, table: string, query: Record<string, string>) { return request(config, table, { query }); }
async function upsert(config: RuntimeConfig, table: string, rows: unknown[], conflict: string) { if (rows.length) await request(config, table, { method: "POST", query: { on_conflict: conflict }, body: rows, prefer: "resolution=merge-duplicates,return=minimal" }); }

async function main() {
  const referenceArgument = process.argv.find((value) => value.startsWith("--reference-date="));
  const referenceDate = referenceArgument?.split("=")[1] || new Date().toISOString().slice(0, 10);
  console.log(JSON.stringify(await seedCopilotPilotDemo(referenceDate), null, 2));
}
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) main().catch((error) => { console.error(error instanceof Error ? error.message : "Pilot seed failed."); process.exitCode = 1; });
