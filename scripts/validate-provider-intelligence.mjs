import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildFairProviderFeed, providerExposure } from "../lib/levytate/provider-intelligence/fair-distribution.ts";
import { intelligenceProviders, providerIntelligenceUpdates } from "../lib/levytate/provider-intelligence/fixtures.ts";
import { assignFeedPresentation, prominentExposure } from "../lib/levytate/provider-intelligence/presentation.ts";

let passed = 0;
const check = (label, condition, details) => {
  assert.ok(condition, `${label}${details ? `: ${JSON.stringify(details)}` : ""}`);
  passed += 1;
  console.log(`PASS ${label}`);
};

const first = buildFairProviderFeed(providerIntelligenceUpdates);
const second = buildFairProviderFeed(providerIntelligenceUpdates);
const exposure = providerExposure(first);
const presented = assignFeedPresentation(first);
check("eight fictional premium providers", intelligenceProviders.length === 8 && intelligenceProviders.every((provider) => provider.premium));
check("editorial fixture contains 18 to 24 published updates", providerIntelligenceUpdates.filter((item) => item.editorialStatus === "published").length >= 18 && providerIntelligenceUpdates.length <= 24);
check("feed is deterministic", first.map((item) => item.id).join() === second.map((item) => item.id).join());
check("every eligible provider receives exposure", intelligenceProviders.every((provider) => exposure[provider.id] > 0), exposure);
check("no consecutive provider when alternatives exist", first.every((item, index) => index === 0 || first[index - 1].providerId !== item.providerId));
check("high-volume provider does not dominate opening window", Math.max(...Object.values(providerExposure(first.slice(0, 8)))) === 1);
check("topic filtering is exact", buildFairProviderFeed(providerIntelligenceUpdates, { topic: "Procurement" }).every((item) => item.topics.includes("Procurement")));
check("AI editorial contract is complete", providerIntelligenceUpdates.every((item) => item.rawTitle && item.displayHeadline && item.displaySummary && item.contentType && item.topics.length && item.programmes.length && item.regions.length && item.providerId && item.publishedAt && item.sourceType && item.editorialStatus));
check("visual metadata is complete", providerIntelligenceUpdates.every((item) => item.image && item.imageAlt && item.imageType));
check("no engagement, rating, score, ranking or paid weighting fields", providerIntelligenceUpdates.every((item) => !Object.keys(item).some((key) => /engagement|rating|score|rank|paid|sponsor/i.test(key))));
check("tile presentation is deterministic", presented.map((item) => item.presentation).join() === assignFeedPresentation(first).map((item) => item.presentation).join());
check("all six editorial tile formats are used", ["feature", "standard", "split", "compact", "event", "case-study"].every((format) => presented.some((item) => item.presentation === format)), presented.map((item) => item.presentation));
check("no provider repeats prominent placement", Math.max(...Object.values(prominentExposure(presented))) === 1, prominentExposure(presented));
check("presentation does not alter provider ordering", presented.map((item) => item.id).join() === first.map((item) => item.id).join());

const shell = await fs.readFile("components/levytate-mvp/LevyTateMvpApp.tsx", "utf8");
const policy = await fs.readFile("lib/levytate/core-early-access-policy.ts", "utf8");
const moduleUi = await fs.readFile("components/levytate-mvp/ProviderIntelligenceModule.tsx", "utf8");
const leadPolicy = policy.slice(policy.indexOf('"Apprenticeship Lead":'), policy.indexOf('"Platform Admin":'));
const employerPolicy = policy.slice(policy.indexOf('"Employer Admin":'));
const employeePolicy = policy.slice(policy.indexOf("Employee:"), policy.indexOf('"Line Manager":'));
const managerPolicy = policy.slice(policy.indexOf('"Line Manager":'), policy.indexOf('"Apprenticeship Lead":'));
check("Intelligence follows Operations Centre for Apprenticeship Lead", leadPolicy.indexOf('item("Intelligence"') > leadPolicy.indexOf('item("Home", "Operations Centre"'));
check("Intelligence follows Operations Centre for Employer Admin", employerPolicy.indexOf('item("Intelligence"') > employerPolicy.indexOf('item("Home", "Operations Centre"'));
check("Employee and Line Manager cannot see Intelligence", !employeePolicy.includes('item("Intelligence"') && !managerPolicy.includes('item("Intelligence"'));
check("Platform Admin is denied Intelligence", policy.includes('item("Intelligence", "Intelligence", "hidden", undefined, "role-denied")'));
check("module is wired into application shell", shell.includes('<ProviderIntelligenceModule />'));
check("Following remains local client state", moduleUi.includes("useState<Set<string>>") && !moduleUi.includes("fetch("));
check("mobile and desktop intelligence layouts are defined", moduleUi.includes("lg:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)]") && moduleUi.includes("lg:hidden"));
check("visual feed avoids vanity interactions", !moduleUi.includes("Like") && !moduleUi.includes("Comment") && !moduleUi.includes("Share count"));

console.log(`\nProvider Intelligence validation: ${passed}/${passed} checks passed`);
