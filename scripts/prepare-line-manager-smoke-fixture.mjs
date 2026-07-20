import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Explicit pre-validation reset only. Normal application startup must never run this fixture.
const cwd = process.cwd();
const organisationSlug = "ground-control";
const managerEmail = "manager.demo@levytate.test";
const employeeEmail = "employee.demo@levytate.test";
const applicationId = "gc-rbac-app-erin";
const currentHistoryId = "gc-rbac-app-erin-hist-current";
const smokeHistoryId = "gc-rbac-app-erin-hist-smoke-ready";
const reviewableStatuses = ["Submitted to Line Manager", "Awaiting Manager Review"];
const activeApplicationStatuses = [
  "Draft",
  "Submitted to Line Manager",
  "Awaiting Manager Review",
  "Approved by Line Manager",
  "Submitted to Apprenticeship Lead",
  "Awaiting Final Approval",
  "Approved for Enrolment",
];

export async function prepareLineManagerSmokeFixture() {
  await loadRuntimeEnv();
  const config = readSupabaseConfig();
  const organisation = await selectOne(config, "levytate_organisations", new URLSearchParams({
    select: "id,name,slug",
    slug: `eq.${organisationSlug}`,
    limit: "1",
  }));
  if (!organisation) throw new Error("Ground Control validation organisation was not found.");

  const manager = await selectOne(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,status",
    organisation_id: `eq.${organisation.id}`,
    email: `eq.${managerEmail}`,
    limit: "1",
  }));
  const employee = await selectOne(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,manager_id,status",
    organisation_id: `eq.${organisation.id}`,
    email: `eq.${employeeEmail}`,
    limit: "1",
  }));
  if (!manager || !employee) {
    throw new Error("Canonical manager smoke-test identities are missing; run the explicit identity seed before preparing this fixture.");
  }

  const changed = [];
  if (employee.status !== "Active" || employee.manager_id !== manager.id) {
    await patch(config, "levytate_employees", `organisation_id=eq.${organisation.id}&id=eq.${employee.id}`, {
      status: "Active",
      manager_id: manager.id,
      updated_at: new Date().toISOString(),
    });
    changed.push("employee_reporting_link");
  }

  const employeeApplications = await selectMany(config, "levytate_applications", new URLSearchParams({
    select: "id,employee_id,status,current_owner,manager_note",
    organisation_id: `eq.${organisation.id}`,
    employee_id: `eq.${employee.id}`,
  }));
  const fixtureApplication = employeeApplications.find((item) => item.id === applicationId) ?? null;
  const competingActiveApplications = employeeApplications.filter((item) =>
    item.id !== applicationId && activeApplicationStatuses.includes(item.status)
  );
  if (competingActiveApplications.length) {
    throw new Error("The smoke-test employee has another active application; no fixture changes were made.");
  }

  const now = new Date().toISOString();
  if (!fixtureApplication) {
    await upsert(config, "levytate_applications", [{
      organisation_id: organisation.id,
      id: applicationId,
      employee_id: employee.id,
      apprenticeship_standard_id: "ST0118",
      status: "Awaiting Manager Review",
      current_owner: "Line Manager",
      reason: "Erin wants to turn operational reporting into clearer performance insight for field teams.",
      career_goal: "Progress into a senior coordination role with stronger reporting and digital confidence.",
      support_required: "Protected learning time and access to relevant reporting projects.",
      manager_note: "",
      submitted_at: "2026-06-18T09:00:00.000Z",
      updated_at: now,
    }], "organisation_id,id");
    changed.push("application_created");
  } else if (
    fixtureApplication.employee_id !== employee.id
    || fixtureApplication.status !== "Awaiting Manager Review"
    || fixtureApplication.current_owner !== "Line Manager"
    || fixtureApplication.manager_note !== ""
  ) {
    await patch(config, "levytate_applications", `organisation_id=eq.${organisation.id}&id=eq.${applicationId}`, {
      employee_id: employee.id,
      status: "Awaiting Manager Review",
      current_owner: "Line Manager",
      manager_note: "",
      updated_at: now,
    });
    changed.push("application_reset");
  }

  if (changed.includes("application_created") || changed.includes("application_reset")) {
    await upsert(config, "levytate_application_history", [{
      organisation_id: organisation.id,
      id: smokeHistoryId,
      application_id: applicationId,
      status: "Awaiting Manager Review",
      owner: "Line Manager",
      note: "Targeted manager smoke-test fixture prepared for validation.",
      created_at: now,
    }], "organisation_id,id");
  }

  const currentHistory = await selectOne(config, "levytate_application_history", new URLSearchParams({
    select: "id,status,owner,note",
    organisation_id: `eq.${organisation.id}`,
    id: `eq.${currentHistoryId}`,
    limit: "1",
  }));
  if (currentHistory && (currentHistory.status !== "Awaiting Manager Review" || currentHistory.owner !== "Line Manager")) {
    await patch(config, "levytate_application_history", `organisation_id=eq.${organisation.id}&id=eq.${currentHistoryId}`, {
      status: "Awaiting Manager Review",
      owner: "Line Manager",
      note: "Current validation status: Awaiting Manager Review.",
    });
    changed.push("current_history_reset");
  }

  const state = await readSmokeFixtureState(config, organisation.id, manager.id, employee.id);
  if (!state.directReportActive || state.fixtureApplicationCount !== 1 || state.reviewableApplicationIds.length !== 1 || state.reviewableApplicationIds[0] !== applicationId) {
    throw new Error("Targeted Line Manager smoke fixture did not reach the expected state.");
  }

  return {
    ok: true,
    organisation: organisation.name,
    manager: manager.name,
    employee: employee.name,
    applicationId,
    changes: changed,
    state,
    usage: "Run explicitly before validation or Preview smoke testing; this script is not part of normal application startup.",
  };
}

export async function inspectLineManagerSmokeFixture() {
  await loadRuntimeEnv();
  const config = readSupabaseConfig();
  const organisation = await selectOne(config, "levytate_organisations", new URLSearchParams({ select: "id", slug: `eq.${organisationSlug}`, limit: "1" }));
  if (!organisation) throw new Error("Ground Control validation organisation was not found.");
  const manager = await selectOne(config, "levytate_employees", new URLSearchParams({ select: "id", organisation_id: `eq.${organisation.id}`, email: `eq.${managerEmail}`, limit: "1" }));
  const employee = await selectOne(config, "levytate_employees", new URLSearchParams({ select: "id", organisation_id: `eq.${organisation.id}`, email: `eq.${employeeEmail}`, limit: "1" }));
  if (!manager || !employee) throw new Error("Canonical manager smoke-test identities are missing.");
  return readSmokeFixtureState(config, organisation.id, manager.id, employee.id);
}

async function readSmokeFixtureState(config, organisationId, managerId, employeeId) {
  const employee = await selectOne(config, "levytate_employees", new URLSearchParams({
    select: "id,manager_id,status",
    organisation_id: `eq.${organisationId}`,
    id: `eq.${employeeId}`,
    limit: "1",
  }));
  const applications = await selectMany(config, "levytate_applications", new URLSearchParams({
    select: "id,status,current_owner",
    organisation_id: `eq.${organisationId}`,
    employee_id: `eq.${employeeId}`,
  }));
  const smokeHistory = await selectMany(config, "levytate_application_history", new URLSearchParams({
    select: "id",
    organisation_id: `eq.${organisationId}`,
    id: `eq.${smokeHistoryId}`,
  }));
  return {
    directReportActive: employee?.status === "Active" && employee.manager_id === managerId,
    fixtureApplicationCount: applications.filter((item) => item.id === applicationId).length,
    activeApplicationCount: applications.filter((item) => activeApplicationStatuses.includes(item.status)).length,
    reviewableApplicationIds: applications.filter((item) => reviewableStatuses.includes(item.status)).map((item) => item.id).sort(),
    smokeHistoryCount: smokeHistory.length,
  };
}

async function selectMany(config, table, query) {
  const response = await supabaseFetch(config, `${table}?${query.toString()}`);
  if (!response.ok) throw new Error(`${table} select failed (${response.status}).`);
  return response.json();
}

async function selectOne(config, table, query) {
  const rows = await selectMany(config, table, query);
  return rows[0] ?? null;
}

async function upsert(config, table, rows, onConflict) {
  const response = await supabaseFetch(config, `${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} upsert failed (${response.status}).`);
}

async function patch(config, table, query, body) {
  const response = await supabaseFetch(config, `${table}?${query}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${table} patch failed (${response.status}).`);
}

function supabaseFetch(config, pathName, init = {}) {
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
    try {
      const text = await fs.readFile(path.join(cwd, fileName), "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        const value = normaliseEnv(line.slice(separator + 1));
        if (key && value && !process.env[key]) process.env[key] = value;
      }
    } catch {
      // Optional local environment files are ignored.
    }
  }
}

function readSupabaseConfig() {
  const url = normaliseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  const serviceRoleKey = normaliseEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) throw new Error("Supabase validation environment is unavailable.");
  return { url, serviceRoleKey };
}

function normaliseEnv(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareLineManagerSmokeFixture()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
