/** Actual LOCAL Data API grants/contract checks; never substitutes for genuine Auth. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";
const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root ?? "")) throw Error("Dedicated local runtime required");
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
const origin = new URL(state.env.API_URL);
if (origin.hostname !== "127.0.0.1" || origin.protocol !== "http:") throw Error("Loopback Data API required");
const release = lockAcceptanceRuntime("read-only Intelligence API preflight");
const results = [];
const check = (name, pass) => { results.push({ name, status: pass ? "PASS" : "FAIL" }); console.log(`${pass ? "PASS" : "FAIL"} ${name}`); };
const request = async (path, body, anonymous = false) => {
  const key = anonymous ? state.env.ANON_KEY : state.env.SERVICE_ROLE_KEY;
  const response = await fetch(`${origin.origin}/rest/v1/${path}`, { redirect: "error", method: body === undefined ? "GET" : "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
};
try {
  const contract = await request("rpc/levytate_required_client_contracts", {});
  check("actual service API reports the exact available28 contract", contract.status === 200 && contract.body?.version === "20261110093655" && contract.body.available === true && Object.keys(contract.body).length === 2);
  const denied = await request("rpc/levytate_required_client_contracts", {}, true);
  check("anonymous API cannot execute the readiness catalogue RPC", [401, 403].includes(denied.status));
  for (const table of ["levytate_intelligence_workspaces", "levytate_intelligence_command_receipts"]) {
    const readable = await request(`${table}?select=organisation_id&limit=1`);
    check(`service can read ${table}`, readable.status === 200 && Array.isArray(readable.body));
    const blocked = await request(`${table}?select=organisation_id&limit=1`, undefined, true);
    check(`anonymous API cannot read ${table}`, [401, 403].includes(blocked.status));
  }
  const body = { p_organisation_id: randomUUID(), p_actor_user_id: randomUUID(), p_family: "progress-review-v1", p_command: { action: "analyse", idempotencyKey: randomUUID() }, p_prepare: true };
  const unknown = await request("rpc/levytate_apply_intelligence_command", body);
  check("service RPC rejects nonexistent tenant and actor before preparation", unknown.status === 403 && unknown.body?.code === "PT403");
  const anonymous = await request("rpc/levytate_apply_intelligence_command", body, true);
  check("anonymous API cannot invoke atomic Intelligence commands", [401, 403].includes(anonymous.status));
  const helper = await request("rpc/levytate_intelligence_source_hash", { p_org: body.p_organisation_id });
  check("service API cannot bypass the closed command using source helper", helper.status === 403 && helper.body?.code === "42501");
  const fixturePath = `${root}/fixture-manifest.json`;
  if (existsSync(fixturePath)) {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    if (!fixture.synthetic || fixture.environment !== "local" || fixture.tenants?.length !== 2) throw Error("Exact fictional fixture manifest required");
    const tenant = fixture.tenants.find(item => item.key === "a"), lead = tenant.users.find(item => item.key === "lead");
    const prepared = await request("rpc/levytate_apply_intelligence_command", { ...body, p_organisation_id: tenant.id, p_actor_user_id: lead.membershipId });
    check("real local server preparation reads the fictional current Lead scope", prepared.status === 200 && /^[a-f0-9]{64}$/.test(prepared.body?.sourceHash ?? "") && Number.isInteger(prepared.body?.revision) && Array.isArray(prepared.body?.eligibleLearnerIds) && Array.isArray(prepared.body?.signals));
  }
} finally {
  release();
  writeFileSync(`${root}/intelligence-api-preflight-${Date.now()}.json`, JSON.stringify({ environment: "local", actualDataApi: true, genuineAuthentication: false, results }, null, 2), { mode: 0o600, flag: "wx" });
}
if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
