import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyReadiness, ServiceHealthTimeoutError, withHealthTimeout } from "../lib/levytate/service-health-contract.ts";

let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); };
const at = "2026-08-04T12:00:00.000Z";

check("all dependencies operational", classifyReadiness({ checkedAt: at, criticalAvailable: true, nonCriticalAvailable: true }).status === "operational");
check("critical failure unavailable", classifyReadiness({ checkedAt: at, criticalAvailable: false, nonCriticalAvailable: true }).status === "unavailable");
check("delivery monitoring style failure is degraded only", classifyReadiness({ checkedAt: at, criticalAvailable: true, nonCriticalAvailable: false }).status === "degraded");
const service = fs.readFileSync("lib/server/levytate-service-health.ts", "utf8");
const criticalDefinition = service.slice(service.indexOf("const criticalChecks"), service.indexOf("const nonCriticalChecks"));
check("optional AI is absent from readiness classification", !criticalDefinition.match(/ai enabled|openai|production ai/i));
const started = Date.now();
await assert.rejects(() => withHealthTimeout(() => new Promise(() => {}), 35), ServiceHealthTimeoutError); passed += 1; console.log("PASS timeout rejects safely");
check("timeout is bounded", Date.now() - started < 250);
const publicRoute = fs.readFileSync("app/api/levytate-health/ready/route.ts", "utf8");
const rbac = fs.readFileSync("lib/levytate/mvp/rbac.ts", "utf8");
check("public readiness suppresses provider details", !publicRoute.match(/supabase|table|provider|error/i));
check("liveness has no database dependency", !fs.readFileSync("app/api/levytate-health/live/route.ts", "utf8").match(/supabase|database|adapter/i));
check("readiness performs no mutations", !service.match(/supabaseInsert|supabaseUpdate|supabaseDelete|method:\s*["']POST|method:\s*["']PATCH|method:\s*["']DELETE/));
check("readiness does not consume rate limit", !service.match(/consume.*rate.*limit|levytate_consume_auth_rate_limit/i));
check("public routes are noindex", publicRoute.includes('"X-Robots-Tag": "noindex, nofollow"'));
check("readiness cache is brief", service.includes("LEVYTATE_READINESS_CACHE_MS = 10_000"));
check("admin diagnostics are private no-store", fs.readFileSync("app/api/levytate-platform/diagnostics/route.ts", "utf8").includes('"Cache-Control": "private, no-store"'));
check("diagnostics permission is excluded from legacy Employer Admin", /"Employer Admin": allPermissions\.filter\(\(permission\) => !\["earlyAccess:manage", "diagnostics:read"\]\.includes\(permission\)\)/.test(rbac));
console.log(JSON.stringify({ ok: true, checksPassed: passed }));
