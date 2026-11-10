import fs from "node:fs/promises";

const read = async (path) => fs.readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [rbac, shell, page, workspace, lifecycle, actions, operations, learners, applications, ai] = await Promise.all([
  read("lib/levytate/mvp/rbac.ts"),
  read("components/levytate-mvp/LevyTateMvpApp.tsx"),
  read("app/levytate/app/page.tsx"),
  read("lib/server/levytate-workspace.ts"),
  read("lib/server/levytate-learner-lifecycle.ts"),
  read("lib/server/levytate-operational-actions.ts"),
  read("components/levytate-mvp/OperationsCentreModule.tsx"),
  read("components/levytate-mvp/LearnersModule.tsx"),
  read("components/levytate-mvp/ApplicationsModule.tsx"),
  read("app/api/levytate-ai/route.ts"),
]);
const {
  coreEarlyAccessPolicy,
  getCoreEarlyAccessPolicy,
  hasCoreEarlyAccessCapability,
  resolveCoreEarlyAccessRouteAccess,
} = await import(new URL("../lib/levytate/core-early-access-policy.ts", import.meta.url));

const checks = [];
const check = (label, condition) => { if (!condition) throw new Error(`FAILED: ${label}`); checks.push(label); };

check("one central policy contract exists", Object.keys(coreEarlyAccessPolicy).length === 5 && typeof getCoreEarlyAccessPolicy === "function" && typeof resolveCoreEarlyAccessRouteAccess === "function" && typeof hasCoreEarlyAccessCapability === "function");
const resolvedWorkspacePolicyCall = callArguments(workspace, "getCoreEarlyAccessPolicy", "userRole");
check("server returns the capability-resolved central policy", ["requestsEnabled", "offTheJobAssistantEnabled", "pastoralSupportEnabled", "pastoralInboxEnabled"].every((option) => resolvedWorkspacePolicyCall.includes(option)));
check("client consumes the server policy", shell.includes("meta?.coreEarlyAccess ?? getCoreEarlyAccessPolicy"));
check("server route uses the shared resolver", page.includes("resolveCoreEarlyAccessRouteAccess") && page.includes("redirect(access.safeRedirect)"));
check("client manipulated modules use the shared resolver", shell.includes("resolveCoreEarlyAccessRouteAccess(meta?.userRole"));
const defaultLead = getCoreEarlyAccessPolicy("Apprenticeship Lead");
const requestsLead = getCoreEarlyAccessPolicy("Apprenticeship Lead", { requestsEnabled: true });
check("Requests is enabled only by resolved server capability", moduleStatus(defaultLead, "Requests") === "hidden" && moduleStatus(requestsLead, "Requests") === "enabled" && requestsLead.permittedCapabilities.includes("service-requests"));
check("Learning Time is enabled only by resolved server capability", moduleStatus(getCoreEarlyAccessPolicy("Employee"), "Learning Time") === "hidden" && moduleStatus(getCoreEarlyAccessPolicy("Employee", { offTheJobAssistantEnabled: true }), "Learning Time") === "enabled" && moduleStatus(getCoreEarlyAccessPolicy("Platform Admin", { offTheJobAssistantEnabled: true }), "Learning Time") === "hidden");
check("pastoral navigation follows the resolved shared capability contract", moduleStatus(getCoreEarlyAccessPolicy("Employee"), "My Support") === "hidden" && moduleStatus(getCoreEarlyAccessPolicy("Employee", { pastoralSupportEnabled: true }), "My Support") === "enabled" && moduleStatus(getCoreEarlyAccessPolicy("Line Manager", { pastoralInboxEnabled: true }), "Learner Support") === "enabled");
check("application review deep links preserve the role-specific module", shell.includes('const applicationModule = meta?.userRole === "Line Manager" ? "Approvals" : "Applications";') && shell.includes('resolved === "Approvals" || resolved === "Applications"') && shell.includes('<ApplicationsModule initialApplicationId={managerReviewApplicationId} onApplicationSelectionChange={updateApplicationReviewSelection} />') && applications.includes('useState<string | null>(initialApplicationId ?? null)'));

const employee = getCoreEarlyAccessPolicy("Employee");
check("Employee exact primary navigation", orderedModules(employee, ["Home", "My Application", "My Programme"]));
check("Employee programme label is My Apprenticeship", moduleEntry(employee, "My Programme")?.label === "My Apprenticeship");
check("Employee provider directory is hidden", moduleStatus(employee, "Providers") === "hidden");

const manager = getCoreEarlyAccessPolicy("Line Manager");
check("Line Manager exact primary navigation", orderedModules(manager, ["Home", "Approvals", "My Team"]));
check("Team Reporting is deferred", moduleEntry(manager, "Reports")?.label === "Team Reporting" && moduleStatus(manager, "Reports") === "deferred");

const lead = getCoreEarlyAccessPolicy("Apprenticeship Lead");
check("Requests remains hidden in the accepted Client V1 policy", moduleStatus(lead, "Requests") === "hidden");
check("Lead exact Client V1 navigation", orderedModules(lead, ["Home", "Applications", "Learners", "Operations", "People", "My Providers", "My Programmes", "Finance", "Marketplace", "Intelligence", "Knowledge", "Settings"]));
check("Lead employer catalogue navigation is distinct", moduleEntry(lead, "My Providers")?.group === "manage" && moduleEntry(lead, "My Programmes")?.group === "manage" && moduleEntry(lead, "Marketplace")?.group === "discover");
check("Lead reports are deferred", moduleStatus(lead, "Reports") === "deferred");

const admin = getCoreEarlyAccessPolicy("Platform Admin");
check("Platform Admin exact primary navigation", orderedModules(admin, ["Home", "Providers", "Settings"]));
check("Platform Admin primary labels are safe", ["Employer Workspaces", "Provider Catalogue", "Access & Tenant Support"].every((label) => admin.modules.some((module) => module.label === label)));
check("Platform Admin secondary navigation is safe", ["Guidance Administration", "Support / Audit Context"].every((label) => admin.modules.some((module) => module.label === label && module.availability === "secondary")));
check("Platform Admin employer modules are hidden", ["Applications", "Learners", "Reports", "Copilot"].every((key) => moduleEntry(admin, key)?.availability === "hidden" && moduleEntry(admin, key)?.reasonCode === "role-denied"));

const platformPermissions = rbac.match(/"Platform Admin": \[([\s\S]*?)\n  \],/)?.[1] ?? "";
check("Platform Admin no longer inherits allPermissions", !rbac.includes('"Platform Admin": allPermissions'));
check("Platform Admin keeps catalogue, guidance, access and workspace permissions", ["workspace:read", "workspace:migrate", "settings:read", "settings:write", "providers:read", "providers:write", "providers:archive", "knowledge:read", "knowledge:manage", "earlyAccess:manage"].every((permission) => platformPermissions.includes(`"${permission}"`)));
check("Platform Admin has no employer operational permissions", ["applications:read", "applications:write", "applications:status", "enrolments:read", "enrolments:write", "enrolments:status", "learnerLifecycle:read", "learnerLifecycle:write", "learnerLifecycle:status", "operationalActions:read", "operationalActions:write", "providerRelationships:read", "providerRelationships:write", "serviceRequests:read", "serviceRequests:write", "serviceRequests:publish", "serviceRequests:decide", "reports:read", "copilot:use"].every((permission) => !platformPermissions.includes(`"${permission}"`)));

check("Platform Admin workspace payload excludes employer operations", ["employees: []", "applications: []", "learnerRecords: []", "operationalActions: []", "providerRelationships: []"].every((value) => workspace.includes(value)));
check("workspace mutations consult the central capability policy", workspace.includes("hasCoreEarlyAccessCapability") && workspace.includes("Platform Admin cannot perform employer operational mutations"));
check("learner lifecycle has no Platform Admin bypass", !lifecycle.includes('role === "Platform Admin"'));
check("operational actor selection has no Platform Admin bypass", !actions.includes('["Apprenticeship Lead", "Employer Admin", "Platform Admin"]'));
check("Operations Centre has no Platform Admin bypass", !operations.includes('"Platform Admin"'));
check("Learners UI has no Platform Admin bypass", !learners.includes('meta?.userRole === "Platform Admin"'));
check("Platform Admin operational Copilot is denied server-side", ai.includes('session.accessLevel === "beta_admin"') && ai.includes("status: 403"));
check("no S2B migration is active", !(await exists("supabase/migrations/019_create_employer_provider_relationships.sql")));

console.log(JSON.stringify({ ok: true, checksPassed: checks.length }, null, 2));

function callArguments(source, functionName, firstArgument) {
  const marker = `${functionName}(${firstArgument}`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const opening = source.indexOf("(", start);
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) return source.slice(opening + 1, index);
  }
  return "";
}

function moduleEntry(resolvedPolicy, moduleKey) {
  return resolvedPolicy.modules.find((module) => module.moduleKey === moduleKey);
}

function moduleStatus(resolvedPolicy, moduleKey) {
  return moduleEntry(resolvedPolicy, moduleKey)?.availability;
}

function orderedModules(resolvedPolicy, keys) {
  const order = resolvedPolicy.modules.map((module) => module.moduleKey);
  let cursor = -1;
  return keys.every((key) => {
    const next = order.indexOf(key, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
}

async function exists(path) {
  try { await fs.access(new URL(`../${path}`, import.meta.url)); return true; } catch { return false; }
}
