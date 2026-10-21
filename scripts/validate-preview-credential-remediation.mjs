import fs from "node:fs";

let checks = 0;
function check(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

const config = fs.readFileSync("lib/levytate/config/beta-access.ts", "utf8");
const route = fs.readFileSync("app/api/levytate-beta-login/route.ts", "utf8");
const client = fs.readFileSync("components/levytate-mvp/LevyTateLoginClient.tsx", "utf8");

check("deployed beta access has no built-in code fallback", !config.includes('process.env.LEVYTATE_BETA_CODE ?? "LEVYTATE-BETA"'));
check("missing beta code fails closed before request processing", route.indexOf("if (!configuredAccessCode)") < route.indexOf("parseLoginRequestBody(request)"));
check("submitted access code field is masked", client.includes('aria-label="Internal access code" type="password"'));
check("submitted access code is cleared before the network request", client.indexOf('setCode("")') < client.indexOf('fetch("/api/levytate-beta-login"'));
check("login failure logging does not include request bodies", !route.includes("console.error(\"LevyTate beta login failed\", body"));

console.log(`Preview credential remediation validation passed (${checks} checks).`);
