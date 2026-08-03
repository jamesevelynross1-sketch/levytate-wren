import fs from "node:fs/promises";

const read = async (path) => fs.readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [policy, rbac, shell, page, workspace, lifecycle, actions, operations, learners, ai] = await Promise.all([
  read("lib/levytate/core-early-access-policy.ts"),
  read("lib/levytate/mvp/rbac.ts"),
  read("components/levytate-mvp/LevyTateMvpApp.tsx"),
  read("app/levytate/app/page.tsx"),
  read("lib/server/levytate-workspace.ts"),
  read("lib/server/levytate-learner-lifecycle.ts"),
  read("lib/server/levytate-operational-actions.ts"),
  read("components/levytate-mvp/OperationsCentreModule.tsx"),
  read("components/levytate-mvp/LearnersModule.tsx"),
  read("app/api/levytate-ai/route.ts"),
]);

const checks = [];
const check = (label, condition) => { if (!condition) throw new Error(`FAILED: ${label}`); checks.push(label); };
const roleBlock = (role) => {
  const marker = role === "Employee" ? "  Employee: {" : `  "${role}": {`;
  const start = policy.indexOf(marker);
  const end = policy.indexOf("\n  },", start);
  return start >= 0 && end > start ? policy.slice(start, end) : "";
};

check("one central policy contract exists", policy.includes("coreEarlyAccessPolicy") && policy.includes("resolveCoreEarlyAccessRouteAccess"));
check("server returns the central policy", workspace.includes("coreEarlyAccess: getCoreEarlyAccessPolicy(userRole)"));
check("client consumes the server policy", shell.includes("meta?.coreEarlyAccess ?? getCoreEarlyAccessPolicy"));
check("server route uses the shared resolver", page.includes("resolveCoreEarlyAccessRouteAccess") && page.includes("redirect(access.safeRedirect)"));
check("client manipulated modules use the shared resolver", shell.includes("resolveCoreEarlyAccessRouteAccess(meta?.userRole"));

const employee = roleBlock("Employee");
check("Employee exact primary navigation", ordered(employee, ["Home", "My Application", "My Programme"]));
check("Employee programme label is My Apprenticeship", employee.includes('item("My Programme", "My Apprenticeship"'));
check("Employee provider directory is hidden", employee.includes('item("Providers", "Programmes & Providers", "hidden"'));

const manager = roleBlock("Line Manager");
check("Line Manager exact primary navigation", ordered(manager, ["Home", "Approvals", "My Team"]));
check("Team Reporting is deferred", manager.includes('item("Reports", "Team Reporting", "deferred"'));

const lead = roleBlock("Apprenticeship Lead");
check("Lead exact primary navigation", ordered(lead, ["Home", "Applications", "Learners", "Providers"]));
check("Lead administration navigation exists", ["People", "Programmes", "Settings"].every((key) => lead.includes(`item("${key}"`) && lead.includes('"administration"')));
check("Lead reports are deferred", lead.includes('item("Reports", "Reports", "deferred"'));

const admin = roleBlock("Platform Admin");
check("Platform Admin exact primary navigation", ordered(admin, ["Home", "Providers", "Settings"]));
check("Platform Admin primary labels are safe", ["Employer Workspaces", "Provider Catalogue", "Access & Tenant Support"].every((label) => admin.includes(`"${label}"`)));
check("Platform Admin secondary navigation is safe", ["Guidance Administration", "Support / Audit Context"].every((label) => admin.includes(`"${label}"`)));
check("Platform Admin employer modules are hidden", ["Applications", "Learners", "Reports", "Copilot"].every((key) => admin.includes(`item("${key}"`) && admin.includes('"role-denied"')));

const platformPermissions = rbac.match(/"Platform Admin": \[([\s\S]*?)\n  \],/)?.[1] ?? "";
check("Platform Admin no longer inherits allPermissions", !rbac.includes('"Platform Admin": allPermissions'));
check("Platform Admin keeps catalogue, guidance, access and workspace permissions", ["workspace:read", "workspace:migrate", "settings:read", "settings:write", "providers:read", "providers:write", "providers:archive", "knowledge:read", "knowledge:manage", "earlyAccess:manage"].every((permission) => platformPermissions.includes(`"${permission}"`)));
check("Platform Admin has no employer operational permissions", ["applications:read", "applications:write", "applications:status", "enrolments:read", "enrolments:write", "enrolments:status", "learnerLifecycle:read", "learnerLifecycle:write", "learnerLifecycle:status", "operationalActions:read", "operationalActions:write", "providerRelationships:read", "providerRelationships:write", "reports:read", "copilot:use"].every((permission) => !platformPermissions.includes(`"${permission}"`)));

check("Platform Admin workspace payload excludes employer operations", ["employees: []", "applications: []", "learnerRecords: []", "operationalActions: []", "providerRelationships: []"].every((value) => workspace.includes(value)));
check("workspace mutations consult the central capability policy", workspace.includes("hasCoreEarlyAccessCapability") && workspace.includes("Platform Admin cannot perform employer operational mutations"));
check("learner lifecycle has no Platform Admin bypass", !lifecycle.includes('role === "Platform Admin"'));
check("operational actor selection has no Platform Admin bypass", !actions.includes('["Apprenticeship Lead", "Employer Admin", "Platform Admin"]'));
check("Operations Centre has no Platform Admin bypass", !operations.includes('"Platform Admin"'));
check("Learners UI has no Platform Admin bypass", !learners.includes('meta?.userRole === "Platform Admin"'));
check("Platform Admin operational Copilot is denied server-side", ai.includes('session.accessLevel === "beta_admin"') && ai.includes("status: 403"));
check("no S2B migration is active", !(await exists("supabase/migrations/019_create_employer_provider_relationships.sql")));

console.log(JSON.stringify({ ok: true, checksPassed: checks.length }, null, 2));

function ordered(source, keys) {
  let cursor = -1;
  return keys.every((key) => {
    const next = source.indexOf(`item("${key}"`, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
}

async function exists(path) {
  try { await fs.access(new URL(`../${path}`, import.meta.url)); return true; } catch { return false; }
}
