import assert from "node:assert/strict";

const baseUrl = process.env.LEVYTATE_VALIDATION_BASE_URL || "http://localhost:3000";
const code = process.env.LEVYTATE_BETA_CODE;
if (!code) throw new Error("LEVYTATE_BETA_CODE is required for the fictional live validation.");

let assertions = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); assertions += 1; }

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/levytate-beta-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, code }),
    redirect: "manual",
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  check(response.ok && Boolean(cookie), `${email} fictional beta login succeeds`);
  return cookie;
}

async function get(cookie: string, suffix = "") {
  return fetch(`${baseUrl}/api/levytate-employer-insights${suffix}`, { headers: { Cookie: cookie }, redirect: "manual" });
}

async function main() {
  const leadCookie = await login("apprenticeshiplead.demo@levytate.test");
  const leadResponse = await get(leadCookie);
  const leadPayload = await leadResponse.json() as { intelligence?: Record<string, unknown> };
  check(leadResponse.status === 200 && Boolean(leadPayload.intelligence), "Apprenticeship Lead receives employer intelligence");
  check(!JSON.stringify(leadPayload).includes("Levy utilisation"), "Live payload does not contain the synthetic levy-utilisation KPI");
  check(!JSON.stringify(leadPayload).includes("answers"), "Live payload does not expose assessment answer maps");

  const escapedResponse = await get(leadCookie, "?organisationId=00000000-0000-4000-8000-000000000000");
  const escapedPayload = await escapedResponse.json() as { intelligence?: { organisation?: { id?: string } } };
  check(escapedResponse.status === 200 && escapedPayload.intelligence?.organisation?.id === (leadPayload.intelligence as { organisation?: { id?: string } }).organisation?.id, "Client organisation input cannot escape the signed organisation scope");

  for (const email of ["employee.demo@levytate.test", "manager.demo@levytate.test", "hello@levytate.co.uk"]) {
    const cookie = await login(email);
    const response = await get(cookie);
    check(response.status === 403, `${email} is denied organisation-wide employer intelligence`);
  }

  const postResponse = await fetch(`${baseUrl}/api/levytate-employer-insights`, { method: "POST", headers: { Cookie: leadCookie, Origin: baseUrl } });
  check(postResponse.status === 405, "Employer intelligence API exposes no mutation method");
  console.log(`Launch Release 3 live validation passed (${assertions} assertions).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
