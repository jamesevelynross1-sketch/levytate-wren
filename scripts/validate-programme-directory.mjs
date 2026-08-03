import fs from "node:fs/promises";

const directory = await fs.readFile(new URL("../components/levytate-mvp/EmployerProgrammeDirectory.tsx", import.meta.url), "utf8");
const providers = await fs.readFile(new URL("../components/levytate-mvp/ProvidersModule.tsx", import.meta.url), "utf8");
const shell = await fs.readFile(new URL("../components/levytate-mvp/LevyTateMvpApp.tsx", import.meta.url), "utf8");
const policy = await fs.readFile(new URL("../lib/levytate/core-early-access-policy.ts", import.meta.url), "utf8");
const rbac = await fs.readFile(new URL("../lib/levytate/mvp/rbac.ts", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../lib/server/levytate-workspace.ts", import.meta.url), "utf8");
const copilot = await fs.readFile(new URL("../lib/server/levytate-copilot-tools.ts", import.meta.url), "utf8");
const managerPermissions = rbac.match(/"Line Manager": \[([\s\S]*?)\n  \],/)?.[1] ?? "";
const employeePermissions = rbac.match(/Employee: \[([\s\S]*?)\n  \],/)?.[1] ?? "";
const checks = [];

function check(label, condition) {
  if (!condition) throw new Error(`${label} failed.`);
  checks.push(label);
}

check("canonical employer label", policy.includes('item("Providers", "Providers", "enabled", "primary", "core")'));
check("Platform Admin label remains distinct", policy.includes('item("Providers", "Provider Catalogue", "enabled", "primary", "core")'));
check("employee and manager directory is hidden in Core Early Access", (policy.match(/item\("Providers", "Programmes & Providers", "hidden"/g) ?? []).length === 2);
check("programme-first landing copy", directory.includes("Explore apprenticeship programmes available through LevyTate&apos;s provider directory."));
for (const filter of ["Level", "Provider", "Delivery", "Location", "Category"]) check(`factual filter: ${filter}`, directory.includes(`label="${filter}"`));
for (const field of ["Standard", "Duration", "Delivery", "Locations", "Typical learner activities", "Suitable roles or teams", "Employer considerations", "Learner support", "Assessment model"]) check(`programme detail: ${field}`, directory.includes(field));
for (const field of ["Delivery approach", "Geographic coverage", "Learner support", "Employer support", "Programmes available"]) check(`provider profile: ${field}`, directory.includes(field));
check("programme comparison is capped", directory.includes("[...current, id].slice(-3)"));
check("inactive records excluded", directory.includes('programme.recordStatus === "Active" && programme.status === "Active"') && directory.includes('provider.status === "Active"'));
check("empty states are safe", directory.includes("No programmes match the selected filters.") && directory.includes("No active programmes are currently listed for this provider.") && directory.includes("Further programme information is being reviewed."));
check("employer surface excludes scores and marketplace terminology", !/match percentage|match score|star rating|fit score|relevance score|ranking number|AI confidence|recommendation score|provider leaderboard|matching engine|provider marketplace|weighted relevance|algorithm score|recommendation percentage|internal fit/i.test(directory));
check("employer and admin surfaces are separated", providers.includes('meta?.userRole !== "Platform Admin"') && providers.includes("ProviderAdministration"));
check("Employee and Line Manager receive catalogue read only", managerPermissions.includes('"providers:read"') && employeePermissions.includes('"providers:read"') && !managerPermissions.includes('"providers:write"') && !employeePermissions.includes('"providers:write"'));
check("employer API fields are sanitised", workspace.includes("employerSafeProvider") && workspace.includes("employerSafeProgramme") && workspace.includes('confidenceLabel: ""') && workspace.includes('commercialNotes: ""'));
check("Copilot directory is deterministic and factual", copilot.includes('intent: "programme_directory"') && copilot.includes("getProgrammeDirectory") && copilot.includes("Programmes matching your selected filters"));
check("Copilot deep links open profiles", copilot.includes("module=Providers&programme=") && copilot.includes("module=Providers&provider="));

console.log(JSON.stringify({ ok: true, checksPassed: checks.length }, null, 2));
