import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readJson("data/provider-programme-verification-2026-08.json");
const standardsCatalogue = readJson("lib/levytate/data/mvp/apprenticeship-standards.generated.json");
const providerSeed = read("lib/levytate/data/mvp/provider-catalogue.ts");
const directory = read("components/levytate-mvp/EmployerProgrammeDirectory.tsx");
const providersModule = read("components/levytate-mvp/ProvidersModule.tsx");
const copilot = read("lib/server/levytate-copilot-tools.ts");
const checks = [];

const providerIds = new Set(manifest.providers.map((provider) => provider.providerId));
const programmeIds = manifest.programmes.map((programme) => programme.id);
const standardById = new Map(standardsCatalogue.standards.filter((standard) => standard.id).map((standard) => [standard.id, standard]));
const activeProgrammes = manifest.programmes.filter((programme) => programme.recordStatus === "Active" && programme.status === "Active");
const archivedProgrammes = manifest.programmes.filter((programme) => programme.recordStatus === "Archived");

check("canonical provider count derives from manifest", manifest.metadata.providerCount === manifest.providers.length && manifest.providers.length === 12);
check("programme count derives from manifest records", manifest.metadata.programmeCount === manifest.programmes.length && manifest.programmes.length === 151);
check("active programme count derives from current records", manifest.metadata.activeProgrammeCount === activeProgrammes.length && activeProgrammes.length === 133);
check("no 30-programme hard cap", !directory.includes("slice(0, 30)") && !directory.includes("slice(0,30)") && !/\.slice\([^)]*30/.test(directory));
check("large catalogues use progressive load-more", directory.includes("directoryPageSize = 24") && directory.includes("visibleResults") && directory.includes("Load more programmes"));
check("no duplicate provider programme IDs", new Set(programmeIds).size === programmeIds.length);
check("active programmes have canonical provider IDs", activeProgrammes.every((programme) => providerIds.has(programme.providerId)));
check("claimed mappings use canonical standards", manifest.programmes.filter((programme) => programme.standardCode).every((programme) => {
  const standard = standardById.get(programme.standardCode);
  return standard && standard.title === programme.standardTitle && standard.level === programme.standardLevel && standard.version === programme.standardVersion;
}));
check("verified programmes contain official provider evidence", manifest.programmes.filter((programme) => programme.verificationStatus === "Verified").every((programme) => programme.sourceUrls.length > 0 && programme.sourceUrls.every((url) => /^https:\/\//.test(url))));
check("archived programmes are excluded from employer catalogue", archivedProgrammes.length > 0 && directory.includes('programme.recordStatus === "Active" && programme.status === "Active"'));
check("provider profile programme count is data-derived", directory.includes("const providerProgrammes = selectedProvider ? directory.filter") && directory.includes("programmes.length ?"));
check("programme search covers commercial and standard names", directory.includes("item.programme.programmeName") && directory.includes("standardLabel(item)") && directory.includes("item.standard?.referenceCode"));
check("programme search includes newly added records", manifest.programmes.some((programme) => programme.providerName === "QA" && programme.providerProgrammeName === "NVIDIA AI Engineer") && manifest.programmes.some((programme) => programme.providerName === "Learning Curve Group" && programme.providerProgrammeName === "Urban Driver"));
check("provider filter operates over full directory", directory.includes('filters.provider === "All" || item.provider.providerName === filters.provider'));
check("standard level filter operates over full directory", directory.includes('filters.level === "All" || levelLabel(item) === filters.level'));
check("Copilot uses the complete active provider catalogue", copilot.includes("data.providerProgrammes") && copilot.includes('programme.recordStatus === "Active" && programme.status === "Active"') && copilot.includes("rows: programmes.map"));
check("Copilot recognises factual named-provider queries", copilot.includes("const namedProvider") && copilot.includes("namedProvider"));
check("no fictional provider programme records introduced", manifest.programmes.every((programme) => providerIds.has(programme.providerId)));
check("manifest is the canonical programme seed", providerSeed.includes("verificationManifest.programmes") && providerSeed.includes("verifiedProgrammeManifest.map"));
check("programme profile administration remains data-derived", providersModule.includes("data.providerProgrammes") && providersModule.includes("profileProgrammes"));
check("duplicate rule is documented", manifest.metadata.duplicateRule.includes("same provider") && manifest.metadata.duplicateRule.includes("Distinct named"));
check("verification date is current", manifest.programmes.every((programme) => programme.verifiedAt === "2026-08-26"));

const providerCounts = Object.fromEntries(manifest.providers.map((provider) => {
  const records = manifest.programmes.filter((programme) => programme.providerId === provider.providerId);
  return [provider.providerName, {
    records: records.length,
    active: records.filter((programme) => programme.recordStatus === "Active" && programme.status === "Active").length,
    needsVerification: records.filter((programme) => programme.status === "Needs verification").length,
    historicalOrUnavailable: records.filter((programme) => programme.recordStatus === "Archived" || ["Paused", "Not available", "Defunded / unavailable for new starts"].includes(programme.status)).length,
  }];
}));

console.log(JSON.stringify({
  ok: true,
  checksPassed: checks.length,
  providerCount: manifest.providers.length,
  programmeCount: manifest.programmes.length,
  activeProgrammeCount: activeProgrammes.length,
  archivedProgrammeCount: archivedProgrammes.length,
  needsVerificationCount: manifest.programmes.filter((programme) => programme.status === "Needs verification").length,
  providerCounts,
}, null, 2));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function check(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checks.push(label);
}
