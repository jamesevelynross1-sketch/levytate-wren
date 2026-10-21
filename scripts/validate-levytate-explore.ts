import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createExploreCatalogue, searchExploreCatalogue } from "../lib/levytate/explore/catalogue";
import { normaliseExploreSource } from "../lib/levytate/explore/source-evidence";
import type { ApprenticeshipStandard } from "../lib/levytate/domain/types";
import { exploreNarrativeSchema, EXPLORE_NARRATIVE_VERSION } from "../lib/levytate/explore/narrative";
import { apprenticeshipStandards } from "../lib/levytate/data/mvp/apprenticeship-standards";
import {
  SKILLS_ENGLAND_ROUTES, getExploreRouteByName, getExploreRouteBySlug,
  getExploreRouteGroups, getExploreRouteHref, standardsForExploreRoute,
  countUncategorisedStandards,
} from "../lib/levytate/explore/occupational-routes";

function record(code: string, status: string, type = "Apprenticeship standard"): ApprenticeshipStandard {
  return {
    id: code, referenceCode: code, title: code === "ST0118" ? "Data analyst" : "A test standard",
    level: 4, occupationalRoute: "Digital", fundingBand: 10000, typicalDuration: "24",
    status: status === "Approved for delivery" ? "Live" : "Defunded",
    sourceStatus: status, programmeType: type, version: "1.0",
    officialUrl: "https://skillsengland.education.gov.uk/apprenticeships/" + code.toLowerCase(),
    lastVerified: "2026-07-02", lastSyncedAt: "2026-07-02", jobTitles: [],
  };
}

const input = [
  record("ST0118", "Approved for delivery"),
  record("ST0118", "Approved for delivery"),
  record("ST0117", "Withdrawn"),
  record("ST0384", "Approved for delivery - paused"),
  record("AU0010", "Approved for delivery", "Apprenticeship unit"),
];
const catalogue = createExploreCatalogue(input);
assert.deepEqual(catalogue.map(x => x.code), ["ST1512", "ST0118"]);
assert.equal(catalogue.find(x => x.code === "ST0118")?.duration, "24 months");
assert.equal(catalogue.find(x => x.code === "ST0118")?.story?.outcomes.length, 3);
assert.equal(catalogue.find(x => x.code === "ST1512")?.version, "2.1");
assert.equal(searchExploreCatalogue(catalogue, "data analyst").length, 1);
assert.equal(searchExploreCatalogue(catalogue, "", "ai").some(x => x.code === "ST1512"), true);
assert.equal(searchExploreCatalogue(catalogue, "", undefined, 3).length, 0);
assert.equal(catalogue.some(x => x.code === "AU0010" || x.code === "ST0117"), false);
assert.equal(searchExploreCatalogue(catalogue, "data analyst", "people").length, 0);
assert.equal(catalogue.find(x => x.code === "ST0118")?.sourceVerified, "2026-07-02");
const officialRecord = {
  results: [
    {
      stdCode: "OCC0123",
      name: "An occupational title that need not match the apprenticeship title",
      statusName: "Approved for delivery",
      summary: "<p>Employees support meaningful workplace improvements by understanding processes and practical data needs across many departments and organisations.</p>",
      products: [{ productCode: "ST0999", versionNo: "1.0" }],
      duties: [
        { dutyDetail: "Understand the context of work" },
        { dutyDetail: "Work with stakeholders" },
        { dutyDetail: "Document relevant outcomes" },
      ],
    },
  ],
};
assert.equal(normaliseExploreSource("ST0118", officialRecord), null, "Must reject title-only and unrelated product matches");
officialRecord.results[0].products[0].productCode = "ST0118";
const evidence = normaliseExploreSource("ST0118", officialRecord);
assert.equal(evidence?.occupationCode, "OCC0123", "Must map ST apprenticeship to linked OCC record");
assert.equal(evidence?.duties.length, 3);
assert.ok(evidence?.summary.includes("workplace improvements"));
const installComponent = readFileSync("components/levytate-explore/ExploreInstallAction.tsx", "utf8");
const bootstrap = readFileSync("components/levytate-explore/ExplorePwaBootstrap.tsx", "utf8");
const manifestSource = readFileSync("app/levytate/explore/manifest.webmanifest/route.ts", "utf8");
assert.match(installComponent, /beforeinstallprompt/, "Android needs native installation prompt support");
assert.match(installComponent, /Add to Home Screen/, "iPhone needs manual installation guidance");
assert.match(installComponent, /appinstalled/, "Install success must come from browser confirmation");
assert.match(bootstrap, /explore-sw/, "Installable app should register its offline shell");
assert.match(manifestSource, /display: "standalone"/);
assert.match(manifestSource, /start_url: "\/explore"/);
for (const name of ["levytate-192.png", "levytate-512.png", "levytate-maskable-192.png", "levytate-maskable-512.png"]) {
  assert.ok(existsSync("public/brand/pwa/" + name), "Missing PWA installation icon: " + name);
}
const homeSource = readFileSync("components/levytate-explore/ExploreHome.tsx", "utf8");
const routeListSource = readFileSync("components/levytate-explore/ExploreRouteStandards.tsx", "utf8");
const routePageSource = readFileSync("app/levytate/explore/routes/[slug]/page.tsx", "utf8");
const detailSource = readFileSync("components/levytate-explore/ExploreDetail.tsx", "utf8");
const explainSource = readFileSync("components/levytate-explore/ExploreAiExplanation.tsx", "utf8");
const routeSource = readFileSync("app/api/levytate-explore/de-fluff/route.ts", "utf8");
const generationSource = readFileSync("lib/server/levytate-explore-explain.ts", "utf8");
const cacheSchema = readFileSync("docs/database/LEVYTATE_EXPLORE_AI_NARRATIVE_CACHE_PROPOSAL.sql", "utf8");

assert.equal(SKILLS_ENGLAND_ROUTES.length, 15, "Use exactly the 15 Skills England occupational routes");
assert.equal(new Set(SKILLS_ENGLAND_ROUTES.map(r => r.slug)).size, 15, "Routes have stable unique slugs");
assert.equal(new Set(SKILLS_ENGLAND_ROUTES.map(r => r.name)).size, 15, "Route names are unique");
for (const route of SKILLS_ENGLAND_ROUTES) {
  assert.equal(getExploreRouteByName(route.name)?.slug, route.slug, "Every official name must resolve");
  assert.equal(getExploreRouteBySlug(route.slug)?.name, route.name, "Each route link must resolve");
  assert.equal(getExploreRouteHref(route), "/explore/routes/" + route.slug);
}
assert.equal(getExploreRouteByName("Business  and administration")?.slug, "business-and-administration");
assert.equal(getExploreRouteByName("Nonexistent occupational route"), null, "Do not fabricate categorisation");
assert.equal(getExploreRouteBySlug("made-up"), null, "Do not accept fictional route URLs");

const realCatalogue = createExploreCatalogue(apprenticeshipStandards);
const officialGroups = getExploreRouteGroups(realCatalogue);
assert.equal(officialGroups.length, 15);
assert.equal(officialGroups.every(item => item.count > 0), true, "Each official route has options in the source catalogue");
const totalGrouped = officialGroups.reduce((total, group) => total + group.count, 0);
assert.equal(totalGrouped + countUncategorisedStandards(realCatalogue), realCatalogue.length, "No active standard is silently lost");
for (const item of officialGroups) {
  const standards = standardsForExploreRoute(realCatalogue, item.route.slug);
  assert.equal(standards.length, item.count, "Route counts equal filtered list length");
  assert.equal(standards.every(s => getExploreRouteByName(s.route)?.slug === item.route.slug), true);
  assert.deepEqual(standards.map(s => s.title), [...standards].map(s => s.title).sort((a,b)=>a.localeCompare(b)));
}
assert.equal(standardsForExploreRoute(realCatalogue,"unknown").length,0, "Unknown route has no accidental results");
assert.match(homeSource, /getExploreRouteGroups/, "Home must display government route tiles");
assert.match(homeSource, /route\.name/, "Tiles use official route names");
assert.doesNotMatch(homeSource, /visible\.map\(standard|EXPLORER_INTERESTS|interestScore/, "No long apprenticeship directory on the home screen");
assert.match(routePageSource, /standardsForExploreRoute/, "Route pages must strictly filter the standard catalogue");
assert.match(routeListSource, /standard\.title/, "Within a route, display the original standard names");
assert.match(routeListSource, /setSearch|input/, "Route-specific list supports finding standards");
assert.match(homeSource, /15 official routes/, "Explain route provenance to employees");
assert.match(explainSource, /Unpacked/, "The public-facing transformation is called Unpacked");
assert.doesNotMatch(explainSource, />\s*De-fluff\s*</, "Old label must not appear in UI");
assert.match(detailSource, /ExploreAiExplanation standard=/, "A programme click must open the AI panel automatically");
assert.match(explainSource, /useEffect\(/, "AI loading must start on the programme detail page");
assert.match(routeSource, /LEVYTATE_EXPLORE_AI_ENABLED/, "Paid requests must have an explicit server-side release flag");
assert.match(routeSource, /enforcePublicRequestLimit/, "Protect the anonymous endpoint before retrieving government data");
assert.match(generationSource, /checkGenerationBudget/, "Limit uncached AI requests");
assert.match(cacheSchema, /for update/, "Prevent concurrent AI calls for the same source version");
assert.match(cacheSchema, /revoke all/, "Keep the model cache private");
assert.equal(EXPLORE_NARRATIVE_VERSION, "defluff-v1");
assert.equal(exploreNarrativeSchema.safeParse({
  headline: "A clear path to building real capabilities",
  introduction: "This training helps people explore and develop meaningful skills through their current role. It focuses on understanding work and putting new knowledge into practice with support.",
  whatYouWillLearn: Array(4).fill("Understand important duties and apply them at work."),
  whatThisCouldLookLikeAtWork: Array(3).fill("You could take on relevant activities in your team."),
  whoItMightSuit: "It could suit people whose day-to-day roles give them useful opportunities to practise these skills.",
  whatToKnowBeforeYouStart: "Your employer needs to support the learning, and eligibility depends on the work available and your existing skills.",
  aConversationStarter: "Could we discuss whether this programme fits our team's needs?",
}).success, true);
console.log("Explore occupational routes (15), catalogue filtering, Unpacked AI, official-source and PWA checks passed.");
