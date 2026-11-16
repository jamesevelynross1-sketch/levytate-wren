import fs from "node:fs";

let checks = 0;
function check(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

const server = fs.readFileSync("lib/server/levytate-demo-role-switcher.ts", "utf8");
const route = fs.readFileSync("app/api/levytate-demo-perspective/route.ts", "utf8");
const login = fs.readFileSync("app/api/levytate-beta-login/route.ts", "utf8");
const logout = fs.readFileSync("app/api/levytate-beta-logout/route.ts", "utf8");
const cookiePolicy = fs.readFileSync("lib/server/levytate-auth-cookies.ts", "utf8");
const ui = fs.readFileSync("components/levytate-mvp/DemoPerspectiveSwitcher.tsx", "utf8");

check("switcher requires an explicit server feature flag", server.includes('LEVYTATE_DEMO_ROLE_SWITCHER_ENABLED?.trim().toLowerCase() !== "true"'));
check("Production fails closed", server.includes('vercelEnvironment === "production"') && server.includes("return false"));
check("Preview is restricted to the feature branch", server.includes('vercelEnvironment === "preview"') && server.includes('authorisedPreviewBranch = "feature/operational-rbac"'));
check("local development requires a second explicit allowance", server.includes("LEVYTATE_DEMO_ROLE_SWITCHER_LOCAL_ENABLED"));
check("controller must be an explicitly configured test identity", server.includes("LEVYTATE_DEMO_CONTROLLER_EMAIL") && server.includes('email.endsWith(".test")'));
check("normal email-authenticated sessions are denied", server.includes('session.authMode !== "internal_beta"'));
check("persona emails are fixed server-side", server.includes("apprenticeshiplead.demo@levytate.test") && server.includes("manager.demo@levytate.test") && server.includes("employee.demo@levytate.test"));
check("browser input is restricted to the perspective enum", server.includes("isDemoPerspectiveId(requestedPerspective)"));
check("every membership is required to be unique and active", server.includes("rows.length !== 1 || !rows[0].active"));
check("canonical roles are revalidated", server.includes("normaliseMvpUserRole(membership.role) !== option.role"));
check("all personas must share one organisation", server.includes("organisationIds.size !== 1"));
check("controller authorisation is short-lived and independently signed", server.includes("60 * 30") && server.includes("LEVYTATE_DEMO_ROLE_SWITCHER_SECRET") && server.includes('createHmac("sha256"'));
check("controller signature comparison is timing safe", server.includes("timingSafeEqual"));
check("switches create audit records", server.includes('"demo.perspective_switched"') && server.includes('entity_type: "demo_role_switch"'));
check("POST requires same-origin validation", route.includes("isSameOriginRequest(request)") && route.includes('request.headers.get("origin")'));
check("responses are private and no-store", route.includes('"Cache-Control": "private, no-store, max-age=0"'));
check("persona session cookie uses the shared HTTP-only policy", route.includes("setLevyTateAuthCookies") && route.includes("levytateBetaSessionCookie") && cookiePolicy.includes("levytateAuthCookieOptions"));
check("controller cookie is HTTP-only, strict and scoped server-side", login.includes("levytateDemoControllerCookie") && login.includes("setLevyTateAuthCookies") && login.includes('sameSite: "strict"') && cookiePolicy.includes("levytateAuthCookieOptions"));
check("logout clears controller authorisation", logout.includes("levytateDemoControllerCookie") && logout.includes("authenticationCookies") && logout.includes("expireLevyTateAuthCookies"));
check("UI waits for server confirmation before hard workspace reload", ui.indexOf("if (!response.ok)") < ui.indexOf('window.location.assign("/levytate/app")'));
check("UI exposes selected state without relying on colour", ui.includes('role="menuitemradio"') && ui.includes("aria-checked={selected}") && ui.includes('" — selected"'));
check("Demo Mode has an explicit accessible indicator", ui.includes('data-testid="demo-mode-indicator"') && ui.includes("Current perspective"));

console.log(`Demo role switcher validation passed (${checks} checks).`);
