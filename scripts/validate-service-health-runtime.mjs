import assert from "node:assert/strict";

const baseUrl = process.env.LEVYTATE_BASE_URL || "http://localhost:3000";
const betaCode = process.env.LEVYTATE_BETA_CODE || "LEVYTATE-BETA";
let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); };
async function login(email) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: betaCode }), redirect: "manual" });
  check(`${email.split("@")[0]} login`, response.ok);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}
async function get(path, cookie = "") { return fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" }); }

const live = await get("/api/levytate-health/live");
const liveBody = await live.json();
check("liveness 200", live.status === 200);
check("liveness contract", liveBody.status === "operational" && liveBody.service === "LevyTate" && typeof liveBody.checkedAt === "string" && Object.keys(liveBody).length === 3);
check("liveness noindex", live.headers.get("x-robots-tag") === "noindex, nofollow");
check("liveness HEAD", (await fetch(`${baseUrl}/api/levytate-health/live`, { method: "HEAD" })).status === 200);
check("liveness unsupported method denied", (await fetch(`${baseUrl}/api/levytate-health/live`, { method: "POST" })).status === 405);
const ready = await get("/api/levytate-health/ready");
const readyBody = await ready.json();
check("readiness safe status", [200, 503].includes(ready.status) && ["operational", "degraded", "unavailable"].includes(readyBody.status));
check("readiness public allowlist", Object.keys(readyBody).every((key) => ["status", "checkedAt", "message"].includes(key)));
check("readiness noindex", ready.headers.get("x-robots-tag") === "noindex, nofollow");
check("readiness unsupported method denied", (await fetch(`${baseUrl}/api/levytate-health/ready`, { method: "POST" })).status === 405);
check("status page public", (await get("/levytate/status")).status === 200);
check("unauthenticated diagnostics denied", (await get("/api/levytate-platform/diagnostics")).status === 401);
for (const [email, label] of [["employee.demo@levytate.test", "Employee"], ["manager.demo@levytate.test", "Line Manager"], ["apprenticeshiplead.demo@levytate.test", "Apprenticeship Lead"]]) {
  const cookie = await login(email); check(`${label} diagnostics denied`, (await get("/api/levytate-platform/diagnostics", cookie)).status === 403);
}
const adminCookie = await login("hello@levytate.co.uk");
const admin = await get("/api/levytate-platform/diagnostics", adminCookie); const adminBody = await admin.json();
check("unbound internal Platform Admin diagnostics denied", admin.status === 403);
check("diagnostics denial is generic", adminBody.message === "Forbidden.");
check("diagnostics denial contains no secret fields", !JSON.stringify(adminBody).match(/serviceRoleKey|connectionString|token|cookie|authSubject|email|hostname/i));
console.log(JSON.stringify({ ok: true, baseUrl, checksPassed: passed }));
