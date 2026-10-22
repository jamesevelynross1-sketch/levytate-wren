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
import {
  historicalExplorePathwayMap, mapPathwayGroups, standardsForPathway,
  unavailableExplorePathwayMap, unmappedStandardsForPathways,
} from "../lib/levytate/explore/official-pathways";

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
const pathwayTilesSource = readFileSync("components/levytate-explore/ExploreRoutePathways.tsx", "utf8");
const pathwayPageSource = readFileSync("app/levytate/explore/routes/[slug]/pathways/[pathway]/page.tsx", "utf8");
const officialLoaderSource = readFileSync("lib/server/levytate-explore-pathways.ts", "utf8");
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

// The official map hierarchy is Route → Pathway → ClusterGroup → Cluster
// → Occupation(OCC) → apprenticeship product(ST). Never classify by title.
const salesRoute = getExploreRouteBySlug("sales-marketing-and-procurement");
assert.ok(salesRoute);
const salesStandards = standardsForExploreRoute(realCatalogue, salesRoute.slug);
const archive = historicalExplorePathwayMap(salesRoute, salesStandards);
assert.ok(archive && archive.source === "historical-official-map");
assert.deepEqual(archive.groups.map(g => g.name), ["Customer Service", "Marketing", "Procurement", "Retail"]);
assert.equal(standardsForPathway(salesStandards, archive, "retail").some(s => s.code === "ST0078"), true, "Butcher belongs in verified historical Retail");
assert.equal(standardsForPathway(salesStandards, archive, "retail").some(s => s.code === "ST0194"), true, "Fishmonger belongs in verified historical Retail");
assert.equal(standardsForPathway(salesStandards, archive, "customer-service").some(s => s.code === "ST0584"), true, "Funeral director belongs in verified historical Customer Service");
const historicalMapped = new Set(archive.groups.flatMap(g => g.standardCodes));
assert.equal(historicalMapped.size + archive.unmappedCodes.length, salesStandards.length, "Do not lose newly introduced/unverified standards");

const apiFixture = {
  name: "Sales, marketing and procurement",
  routeId: 15,
  pathways: [
    {
      id: 31, name: "Retail", sequence: 2,
      clusterGroups: [{ clusters: [{ occupations: [
        { stdCode: "OCC0078A", products: [{ productCode: "ST0078", typeName: "Apprenticeship standard" }] },
        { stdCode: "OCC0078B", products: [{ productCode: "ST0078", typeName: "Apprenticeship standard" }] },
        { stdCode: "OCC9999", products: [{ productCode: "ST0313" }] }, // retired should be omitted
        { stdCode: "ST0194", products: [{ productCode: "ST0194" }] }, // not an occupation code
      ] }] }],
    },
    {
      id: 32, name: "Customer Service", sequence: 1,
      clusterGroups: [{ clusters: [{ occupations: [
        { stdCode: "OCC0584", products: [{ productCode: "ST0584" }] },
      ] }] }],
    },
  ],
};
const fromApi = mapPathwayGroups(salesRoute, salesStandards, apiFixture, "2026-10-21T18:00:00Z");
assert.ok(fromApi && fromApi.source === "live-official-api");
assert.deepEqual(fromApi.groups.map(g => g.name), ["Customer Service", "Retail"], "Preserve government pathway sequencing");
assert.deepEqual(fromApi.groups.find(g => g.slug === "retail")?.standardCodes, ["ST0078"], "Multiple options for one ST are deduplicated");
assert.deepEqual(fromApi.groups.find(g => g.slug === "customer-service")?.standardCodes, ["ST0584"]);
assert.equal(fromApi.groups.flatMap(g => g.standardCodes).includes("ST0313"), false, "Exclude withdrawn standards");
assert.equal(fromApi.unmappedCodes.includes("ST0194"), true, "Do not infer a pathway from the name");
assert.equal(
  mapPathwayGroups(salesRoute, salesStandards, { ...apiFixture, name: "Engineering and manufacturing" }, "2026-10-21T18:00:00Z"),
  null,
  "Reject a mismatched official route payload",
);
assert.equal(
  mapPathwayGroups(salesRoute, salesStandards, { ...apiFixture, pathways: [{ id: 1, name: "Retail" }, { id: 2, name: "Retail" }] }, "2026-10-21T18:00:00Z"),
  null,
  "Reject duplicate slugs rather than create ambiguous URLs",
);
const unmappedEngineering = unavailableExplorePathwayMap(getExploreRouteBySlug("engineering-and-manufacturing")!, realCatalogue);
assert.equal(unmappedEngineering.groups.length, 0, "Do not invent unverified government pathways");
const engineeringStandards = standardsForExploreRoute(realCatalogue, "engineering-and-manufacturing");
assert.equal(unmappedStandardsForPathways(engineeringStandards, unmappedEngineering).length, engineeringStandards.length);

assert.match(homeSource, /getExploreRouteGroups/, "Home must display government route tiles");
assert.match(homeSource, /route\.name/, "Tiles use official route names");
assert.doesNotMatch(homeSource, /visible\.map\(standard|EXPLORER_INTERESTS|interestScore/, "No long apprenticeship directory on the home screen");
assert.match(routePageSource, /ExploreRoutePathways/, "Clicking a route must first display pathway tiles");
assert.match(pathwayTilesSource, /mapping\.groups\.map/, "Render pathways from the approved map, not name heuristics");
assert.match(pathwayTilesSource, /historical-official-map/, "Label older government maps honestly");
assert.match(pathwayPageSource, /standardsForPathway/, "A pathway displays only its mapped standards");
assert.match(pathwayPageSource, /unmappedStandardsForPathways/, "Unverified mapping never hides a standard");
assert.match(officialLoaderSource, /\/Routes\//, "Fetch official route structure by routeId");
assert.match(officialLoaderSource, /occupation\.products/, "Read explicit ST products in the official hierarchy");
assert.match(officialLoaderSource, /SKILLS_ENGLAND_API_KEY/, "Official API is authenticated server-side only");
assert.match(officialLoaderSource, /if \(key\) \{[\s\S]*return unavailableExplorePathwayMap\(route, approvedStandards\)/,
  "Never fall back to 2019 content when a live official API key is configured");
assert.match(officialLoaderSource, /VERCEL_ENV === "production"/,
  "Production must never silently use historic 2019 classifications");
assert.match(routeListSource, /standard\.title/, "Within a route, display the original standard names");
assert.match(routeListSource, /setSearch|input/, "Route-specific list supports finding standards");
assert.match(homeSource, /15 official occupational routes/, "Explain route provenance to employees");
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

const designSource = readFileSync("app/levytate/explore/explore-theme.css", "utf8");
const exploreLayout = readFileSync("app/levytate/explore/layout.tsx", "utf8");
assert.match(exploreLayout, /explore-theme\.css/, "Load the Explore-only theme within the public PWA layout");
assert.match(designSource, /\.levytate-explore/, "Scope style rules away from the employer workspace");
assert.match(designSource, /prefers-reduced-motion: reduce/, "Respect reduced motion preferences");
assert.match(designSource, /focus-visible/, "Preserve prominent keyboard focus indicators");
assert.match(designSource, /explore-route-card/, "Keep the government's route tiles");
assert.match(designSource, /explore-pathway-card/, "Keep official pathway tiles");
assert.match(designSource, /explore-directory-row/, "Keep accessible tappable programme rows");
assert.match(designSource, /explore-unpacked-hero/, "Style the existing Unpacked panel");
assert.match(homeSource, /getExploreRouteHref\(route\)/, "Route tile destinations must be unchanged");
assert.match(homeSource, /getExploreRouteGroups\(standards\)/, "Route names and counts must remain source-derived");
assert.match(pathwayTilesSource, /routeHref \+ "\/pathways\/" \+ group.slug/, "Pathway tile URLs remain unchanged");
assert.match(routeListSource, /setLevel\(Number\(event.target.value\)\)/, "Level filters are still functional");
assert.match(routeListSource, /setSearch\(event.target.value\)/, "Standards searches are still functional");
assert.match(routeListSource, /getExploreRouteHref\(route\) \+ "\/pathways\/" \+ pathwaySlug/, "Back navigation retains pathway context");
assert.match(detailSource, /setAction\("manager"\)/, "Keep employee-controlled manager email journey");
assert.match(detailSource, /setAction\("mpr"\)/, "Keep voluntary adviser contact");
assert.match(detailSource, /MprContact standard=\{standard\}/, "Retain the gated contact route");
assert.match(explainSource, /fetch\("\/api\/levytate-explore\/de-fluff"/, "No changes to the existing AI API/activation flow");
assert.match(homeSource, /levytate-logo-supplied\.png/, "Preserve the original supplied LevyTate artwork");


const previewSource = readFileSync("lib/server/levytate-explore-preview.ts", "utf8");
const providerSource = readFileSync("lib/server/levytate-explore-generate.ts", "utf8");
const sourceNormaliser = readFileSync("lib/levytate/explore/source-evidence.ts", "utf8");
const structuredSchemaSource = readFileSync("lib/levytate/explore/narrative.ts", "utf8");
assert.match(previewSource, /VERCEL_ENV === "preview"/, "AI Gateway preview must never run on Production");
assert.match(previewSource, /VERCEL_GIT_COMMIT_REF === "feature\/levytate-explore-public-pwa"/,
  "Only the isolated Explore branch can use Preview generation");
assert.match(previewSource, /LEVYTATE_EXPLORE_AI_ENABLED === "true"/,
  "AI billing must remain opt-in via a server-only flag");
assert.match(previewSource, /unstable_cache/, "Cache versioned model responses in Next/Vercel Data Cache");
assert.match(previewSource, /createHash/, "Cache fingerprint includes source content");
assert.match(previewSource, /MAX_NEW_GENERATIONS_PER_INSTANCE_DAY/, "Bound Preview model miss attempts");
assert.match(previewSource, /hasExploreGatewayAccess/, "Avoid an unconfigured model request");
assert.match(previewSource, /request\.headers\.get\("x-vercel-oidc-token"\)/,
  "Vercel OIDC must be read from the function Request at runtime");
assert.match(previewSource, /createCachedGenerator\(requestToken\)/,
  "OIDC must be captured outside the cached function arguments");
assert.doesNotMatch(previewSource, /cachedPreviewNarrative\(standard, evidence, requestToken\)/,
  "Never serialise OIDC in a cache key");
assert.match(routeSource, /generateUnpackedPreview\(standard\)/, "Use gateway-backed output on isolated Preview");
assert.match(routeSource, /if \(!previewGeneration\) try/, "Preview cannot silently consume employer rate-limit credentials");
assert.match(providerSource, /https:\/\/ai-gateway\.vercel\.sh\/v1\/chat\/completions/,
  "Model requests go through Vercel AI Gateway");
assert.match(providerSource, /VERCEL_OIDC_TOKEN/, "Use server-side OIDC rather than a public API key");
assert.match(providerSource, /response_format/, "AI responses must be strictly structured JSON");
assert.match(providerSource, /exploreNarrativeSchema\.safeParse/, "Reject invalid model fields before display");
assert.doesNotMatch(structuredSchemaSource, /\b(?:minItems|maxItems)\s*:/, "Strict gateway schema must avoid unsupported array size keywords");
assert.match(sourceNormaliser, /retired\|withdrawn/, "Do not claim a retired standard is currently suitable");
const retiredOccupationFixture = {
  results: [{
    stdCode: "OCC0118",
    name: "Data analyst",
    summary: "The data analyst works with varied data sources and people, discovers insights and explains evidence to business stakeholders and colleagues.",
    products: [{ productCode: "ST0118", statusName: "Retired" }],
    duties: [{ dutyDetail: "Explore data" }, { dutyDetail: "Analyse trends" }, { dutyDetail: "Report data" }],
  }],
};
assert.equal(normaliseExploreSource("ST0118", retiredOccupationFixture), null,
  "Do not generate an active career recommendation from a retired official product");

console.log("Explore route → official pathway → standards, source mapping, Unpacked AI and PWA checks passed.");
