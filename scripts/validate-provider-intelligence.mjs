import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { bootstrapProviderIntelligence as articles } from "../lib/levytate/provider-intelligence/bootstrap.ts";
import { buildFairProviderFeed } from "../lib/levytate/provider-intelligence/fair-distribution.ts";
import {
  failedSourceRefreshPatch,
  getProviderIntelligenceFreshness,
  isProviderIntelligenceRefreshAuthorised,
  planProviderIntelligenceRefresh,
  successfulSourceRefreshPatch,
} from "../lib/levytate/provider-intelligence/refresh-policy.ts";
import { providerIntelligenceSources as sources } from "../lib/levytate/provider-intelligence/sources.ts";

let passed = 0;
const check = (name, value) => {
  assert.ok(value, name);
  passed += 1;
  console.log(`PASS ${name}`);
};

const sourceIds = new Set(sources.map((source) => source.id));
const providerIds = new Set(sources.map((source) => source.providerId));
const feed = buildFairProviderFeed(articles);

check("canonical provider ids only", articles.every((article) => providerIds.has(article.providerId)));
check("all articles use registered sources", articles.every((article) => sourceIds.has(article.sourceId)));
check("official HTTPS sources", sources.every((source) => source.sourceUrl.startsWith("https://")));
check("source URLs match approved domains", sources.every((source) => new URL(source.sourceUrl).hostname.endsWith(source.providerDomain)));
check("active, review and disabled source states represented", ["active", "needs-review", "disabled"].every((value) => sources.some((source) => source.status === value)));
check("fair feed deterministic", feed.map((article) => article.id).join() === buildFairProviderFeed(articles).map((article) => article.id).join());
check("provider rotation before repetition", feed.every((article, index) => index === 0 || feed[index - 1].providerId !== article.providerId));
check("topic filter exact", buildFairProviderFeed(articles, { topic: "Procurement" }).every((article) => article.topics.includes("Procurement")));
check("missing publication dates preserved", articles.some((article) => article.publishedAt === null));
check("dates are credible ISO values", articles.filter((article) => article.publishedAt).every((article) => Number.isFinite(Date.parse(article.publishedAt))));
check("excerpt bounded", articles.every((article) => article.excerpt.length <= 220));
check("full article bodies not stored", articles.every((article) => !article.excerpt.includes("<article")));
check("dedupe fingerprints exist", articles.every((article) => article.fingerprint));
check("canonical links retained", articles.every((article) => article.canonicalUrl.startsWith("https://")));
check("no fictional legacy providers", !JSON.stringify(articles).match(/Northstar Skills|Forge Learning|Arc Digital/));
check("no ranking fields", articles.every((article) => !Object.keys(article).some((key) => /rating|rank|score|paid|sponsor/i.test(key))));

const ui = await fs.readFile("components/levytate-mvp/ProviderIntelligenceModule.tsx", "utf8");
const server = await fs.readFile("lib/server/levytate-provider-intelligence.ts", "utf8");
const security = await fs.readFile("lib/levytate/provider-intelligence/security.ts", "utf8");
const parser = await fs.readFile("lib/levytate/provider-intelligence/parsers.ts", "utf8");
const copilot = await fs.readFile("lib/levytate/provider-intelligence/copilot.ts", "utf8");
const migration = await fs.readFile("supabase/migrations/024_create_provider_intelligence.sql", "utf8");
const shell = await fs.readFile("components/levytate-mvp/LevyTateMvpApp.tsx", "utf8");
const refresh = await fs.readFile("app/api/internal/provider-intelligence/refresh/route.ts", "utf8");
const vercel = JSON.parse(await fs.readFile("vercel.json", "utf8"));

check("SSRF rules reject IPs and localhost", security.includes("isIP") && security.includes("localhost"));
check("link-local and metadata IP literals are rejected by the all-IP rule", security.includes("isIP(host)!==0") && security.includes("metadata.google.internal"));
check("parser supports feeds and HTML", parser.includes("rss|atom") && parser.includes("<article"));
check("parser restricts article and image URLs to approved domains", parser.includes("isApprovedProviderUrl(candidate,source)") && parser.includes("isLikelyProviderArticleUrl"));
check("UI reads canonical workspace providers", ui.includes("data.providers"));
check("UI links originals safely", ui.includes('rel="noopener noreferrer"'));
check("UI discloses genuine staleness without hiding history", ui.includes("payload.stale") && ui.includes("Provider intelligence may be out of date"));
check("UI does not persist client following or saved state locally", !ui.includes("localStorage") && !ui.includes("sessionStorage"));
check("Market Watch uses live eligible article counts", ui.includes('aria-label="Market Watch"') && ui.includes("eligible.filter"));
check("module links to Providers", shell.includes("onOpenProvider"));
check("ingestion bounded", server.includes("i+=4") && server.includes("i+=2"));
check("ingestion has timeout and size limits", server.includes("8000") && server.includes("2_000_000"));
check("ingestion isolates source failures", server.includes("outcomes") && server.includes("catch(error)"));
check("refresh endpoint requires a bearer secret", refresh.includes("authorization") && refresh.includes("Unauthorised"));
check("Copilot answers are grounded in stored article fields", copilot.includes("ProviderIntelligenceArticle") && copilot.includes("canonicalUrl") && !copilot.includes("programme-fit"));
check("storage is platform reference data", !migration.includes("organisation_id"));
check("direct tenant access revoked", migration.includes("revoke all") && migration.includes("service_role"));
check("publication date nullable", migration.includes("published_at timestamptz,"));

const now = Date.parse("2026-10-09T12:00:00.000Z");
check("no successful active refresh is stale", getProviderIntelligenceFreshness([{ status: "active", lastSuccessfulFetchAt: null }], now).stale);
check("refresh older than 48 hours is stale", getProviderIntelligenceFreshness([{ status: "active", lastSuccessfulFetchAt: "2026-10-07T11:59:59.000Z" }], now).stale);
const fresh = getProviderIntelligenceFreshness([{ status: "active", lastSuccessfulFetchAt: "2026-10-09T11:00:00.000Z" }], now);
check("recent successful refresh is fresh", fresh.stale === false && fresh.refreshedAt === "2026-10-09T11:00:00.000Z");
check("inactive source cannot make an active registry fresh", getProviderIntelligenceFreshness([{ status: "disabled", lastSuccessfulFetchAt: "2026-10-09T11:00:00.000Z" }], now).stale);

const source = sources.find((item) => item.id === "source-qa");
assert.ok(source);
const base = {
  id: "refresh-policy-fixture",
  fingerprint: "refresh-policy-fixture",
  providerId: source.providerId,
  sourceId: source.id,
  title: "Apprenticeship skills update",
  excerpt: "Apprenticeship workforce skills and training update.",
  canonicalUrl: "https://www.qa.com/about/news/apprenticeship-skills-update/",
  imageUrl: null,
  publishedAt: "2026-10-09T08:00:00.000Z",
  discoveredAt: "2026-10-09T09:00:00.000Z",
  contentType: "Insight",
  topics: ["People"],
  status: "published",
};
const duplicatePlan = planProviderIntelligenceRefresh(source, [base], [base]);
check("duplicate articles remain idempotent", duplicatePlan.duplicates === 1 && duplicatePlan.inserted.length === 0 && duplicatePlan.updated.length === 0);
const updatedPlan = planProviderIntelligenceRefresh(source, [base], [{ ...base, title: "Updated apprenticeship skills update" }]);
check("changed stored articles are updated", updatedPlan.updated.length === 1 && updatedPlan.inserted.length === 0);
const irrelevant = { ...base, fingerprint: "irrelevant-fixture", title: "Cookie settings", excerpt: "Privacy and navigation preferences." };
check("irrelevant persisted articles are hidden", planProviderIntelligenceRefresh(source, [irrelevant], []).hidden.length === 1);
const failedPatch = failedSourceRefreshPatch("2026-10-09T10:00:00.000Z", new Error("Source returned 404"));
check("source failure retains prior successful timestamp and articles", !("last_successful_fetch_at" in failedPatch) && failedPatch.last_error === "Source returned 404");
const successPatch = successfulSourceRefreshPatch("2026-10-09T10:00:00.000Z");
check("successful refresh updates attempt and success timestamps", successPatch.last_attempt_at === successPatch.last_successful_fetch_at && successPatch.last_error === null);
check("either configured refresh secret is accepted", isProviderIntelligenceRefreshAuthorised("Bearer cron-secret", ["provider-secret", "cron-secret"]));
check("missing refresh authentication is rejected", !isProviderIntelligenceRefreshAuthorised(null, ["provider-secret", "cron-secret"]));
const cron = vercel.crons.find((item) => item.path === "/api/internal/provider-intelligence/refresh");
check("cron config contains Provider Intelligence refresh route", Boolean(cron));
check("Provider Intelligence cron schedule is valid", cron?.schedule === "15 6 * * *");

console.log(`\nProvider Intelligence validation: ${passed}/${passed} checks passed`);
