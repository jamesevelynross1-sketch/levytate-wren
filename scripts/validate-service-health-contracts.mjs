import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyReadiness, createReadinessCache, ServiceHealthTimeoutError, withHealthTimeout } from "../lib/levytate/service-health-contract.ts";

let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); };
const at = "2026-08-04T12:00:00.000Z";

check("all dependencies operational", classifyReadiness({ checkedAt: at, criticalAvailable: true, optionalAvailable: true }).status === "operational");
check("critical failure unavailable", classifyReadiness({ checkedAt: at, criticalAvailable: false, optionalAvailable: true }).status === "unavailable");
check("optional monitoring failure is degraded", classifyReadiness({ checkedAt: at, criticalAvailable: true, optionalAvailable: false }).status === "degraded");
const service = fs.readFileSync("lib/server/levytate-service-health.ts", "utf8");
const criticalDefinition = service.slice(service.indexOf("const criticalChecks"), service.indexOf("const optionalChecks"));
const optionalDefinition = service.slice(service.indexOf("const optionalChecks"), service.indexOf("const readinessCache"));
check("optional AI is absent from readiness classification", !criticalDefinition.match(/ai enabled|openai|production ai/i));
check("required rate-limit operation is critical", /key:\s*["']rate-limit-operation["'][\s\S]*kind:\s*["']auth-rate-limit["']/.test(criticalDefinition));
check("optional checks are explicitly separated", optionalDefinition.includes("Optional prospect access diagnostics") && optionalDefinition.includes("Optional authentication delivery diagnostics") && !optionalDefinition.includes("rate-limit-operation"));
const started = Date.now();
await assert.rejects(() => withHealthTimeout(() => new Promise(() => {}), 35), ServiceHealthTimeoutError); passed += 1; console.log("PASS timeout rejects safely");
check("timeout is bounded", Date.now() - started < 250);

let clock = 1_000;
let evaluations = 0;
const transitions = [];
const cachedReadiness = createReadinessCache({
  cacheMs: 10_000,
  now: () => clock,
  evaluate: async () => {
    evaluations += 1;
    return classifyReadiness({ checkedAt: new Date(clock).toISOString(), criticalAvailable: evaluations > 1, optionalAvailable: true });
  },
  onResult: (result, previous) => transitions.push([previous, result.status]),
});
await cachedReadiness.get();
await cachedReadiness.get();
check("readiness result is cached", evaluations === 1);
clock += 10_001;
await cachedReadiness.get();
check("readiness cache expires and rechecks", evaluations === 2);
check("readiness recovery is observable", transitions.some(([previous, current]) => previous === "unavailable" && current === "operational"));

const publicRoute = fs.readFileSync("app/api/levytate-health/ready/route.ts", "utf8");
const rbac = fs.readFileSync("lib/levytate/mvp/rbac.ts", "utf8");
check("public readiness suppresses provider details", !publicRoute.match(/supabase|table|provider|error/i));
check("liveness has no database dependency", !fs.readFileSync("app/api/levytate-health/live/route.ts", "utf8").match(/supabase|database|adapter/i));
check("readiness performs no unrelated data mutations", !service.match(/supabaseInsert|supabaseUpdate|supabaseDelete|method:\s*["']PATCH|method:\s*["']DELETE/));
check("rate-limit probe uses an isolated health bucket", service.includes('p_action: "health.readiness"') && service.includes('rateLimitKey("health_probe", "required-rate-limit-operation")'));
check("rate-limit probe is bounded", service.includes("p_window_seconds: 60") && service.includes("p_limit: 10_000") && service.includes("controller.abort()"));
check("public routes are noindex", publicRoute.includes('"X-Robots-Tag": "noindex, nofollow"'));
check("readiness cache is brief", service.includes("LEVYTATE_READINESS_CACHE_MS = 10_000"));
check("admin diagnostics are private no-store", fs.readFileSync("app/api/levytate-platform/diagnostics/route.ts", "utf8").includes('"Cache-Control": "private, no-store"'));
check("diagnostics permission is excluded from legacy Employer Admin", /"Employer Admin": allPermissions\.filter\(\(permission\) => !\["earlyAccess:manage", "diagnostics:read"\]\.includes\(permission\)\)/.test(rbac));
const statusPage = fs.readFileSync("app/levytate/status/page.tsx", "utf8");
check("degraded status is not labelled operational", statusPage.includes('readiness.status === "degraded" ? { title: "Degraded service"'));
console.log(JSON.stringify({ ok: true, checksPassed: passed }));
