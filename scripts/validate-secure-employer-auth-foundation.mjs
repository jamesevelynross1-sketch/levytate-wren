import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/020_create_secure_employer_authentication_foundation.sql");
const auth = read("lib/server/levytate-auth.ts");
const authorised = read("lib/server/levytate-authorised-session.ts");
const request = read("app/api/levytate-auth/request/route.ts");
const callback = read("app/levytate/auth/callback/route.ts");
const refresh = read("app/api/levytate-auth/session/route.ts");
const login = read("components/levytate-mvp/LevyTateLoginClient.tsx");
const beta = read("app/api/levytate-beta-login/route.ts");
const perspective = read("app/api/levytate-demo-perspective/route.ts");
const logout = read("app/api/levytate-beta-logout/route.ts");
const providerCallback = read("app/levytate/provider/auth/callback/route.ts");
const providerLogout = read("app/api/levytate-provider/logout/route.ts");
const cookiePolicy = read("lib/server/levytate-auth-cookies.ts");
const middleware = read("middleware.ts");
const app = read("components/levytate-mvp/LevyTateMvpApp.tsx");
const workspace = read("app/api/levytate-workspace/route.ts");
const {
  isLevyTateAuthCookieHost,
  levytateAuthCookieOptions,
  levytateLegacySessionCookieDomain,
} = await import(new URL("../lib/levytate/hosts.ts", import.meta.url));

const previousNodeEnv = process.env.NODE_ENV;
const previousVercelEnv = process.env.VERCEL_ENV;
const previousVercelUrl = process.env.VERCEL_URL;
process.env.NODE_ENV = "production";
const appCookie = levytateAuthCookieOptions(60, "app.levytate.co.uk");
const strictAppCookie = levytateAuthCookieOptions(60, "app.levytate.co.uk", "strict");
const marketingCookie = levytateAuthCookieOptions(60, "www.levytate.co.uk");
const siblingCookie = levytateAuthCookieOptions(60, "unintended.app.levytate.co.uk");
process.env.VERCEL_ENV = "preview";
process.env.VERCEL_URL = "secure-entry-preview.vercel.app";
const previewCookie = levytateAuthCookieOptions(60, "secure-entry-preview.vercel.app");
const previewAllowed = isLevyTateAuthCookieHost("secure-entry-preview.vercel.app");
if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;
if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
else process.env.VERCEL_ENV = previousVercelEnv;
if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
else process.env.VERCEL_URL = previousVercelUrl;

check("migration preserves existing users", /alter table if exists public\.levytate_users/.test(migration) && !/drop table|truncate/i.test(migration));
check("auth subject is unique when bound", /unique index if not exists levytate_users_auth_subject_unique_idx/.test(migration));
check("binding states are constrained", /not_prepared.*pending.*bound/s.test(migration));
check("email is normalised", /normaliseBetaEmail\(emailInput\)/.test(auth));
check("unknown and known public responses are generic", request.includes("genericSignInRequestMessage") && !request.includes("membership"));
check("sign-in requests cannot create users", /create_user: false/.test(auth));
check("verified Auth subject binds server-side", /auth_subject: auth\.user\.id/.test(auth));
check("browser cannot provide organisation or role", !/searchParams\.get\(["'](?:role|organisation)/.test(callback));
check("protected requests revalidate current membership", authorised.includes("revalidateEmployerSession"));
check("inactive membership is denied", /!membership\.active/.test(auth));
check("role is re-read from membership", /normaliseMvpUserRole\(membership\.role\)/.test(auth));
check("callback uses first central-policy module", callback.includes("getCoreEarlyAccessPolicy"));
check("shared cookie policy is HTTP-only, SameSite and bounded", appCookie.httpOnly === true && appCookie.sameSite === "lax" && appCookie.maxAge === 60 && appCookie.path === "/");
check("shared cookie policy honours the strict SameSite override", strictAppCookie.sameSite === "strict");
check("shared cookie policy is secure in production", appCookie.secure === true);
check("new authentication cookies always omit Domain", [appCookie, marketingCookie, siblingCookie, previewCookie].every((cookie) => !("domain" in cookie)));
check("authentication cookie issuance is limited to app and exact Preview hosts", isLevyTateAuthCookieHost("app.levytate.co.uk") && !isLevyTateAuthCookieHost("www.levytate.co.uk") && !isLevyTateAuthCookieHost("unintended.app.levytate.co.uk") && previewAllowed);
check("legacy cleanup is limited to the exact app host", levytateLegacySessionCookieDomain("app.levytate.co.uk") === "app.levytate.co.uk" && levytateLegacySessionCookieDomain("www.levytate.co.uk") === undefined && levytateLegacySessionCookieDomain("unintended.app.levytate.co.uk") === undefined);
check("cookie writer preserves host-only and legacy expiry headers", cookiePolicy.includes('response.headers.append("set-cookie", header)') && cookiePolicy.includes("levytateLegacySessionCookieDomain") && cookiePolicy.includes("expires: new Date(0)"));
check("magic-link callback uses the shared host-only writer", callback.includes("setLevyTateAuthCookies") && ["levytateBetaSessionCookie", "levytateSupabaseAccessCookie", "levytateSupabaseRefreshCookie"].every((name) => callback.includes(`name: ${name}`)));
check("session refresh rotates all cookies through the shared host-only writer", refresh.includes("setLevyTateAuthCookies") && ["levytateBetaSessionCookie", "levytateSupabaseAccessCookie", "levytateSupabaseRefreshCookie"].every((name) => refresh.includes(`name: ${name}`)));
check("internal login and role switch use the shared host-only writer", beta.includes("setLevyTateAuthCookies") && perspective.includes("setLevyTateAuthCookies") && beta.includes('sameSite: "strict"'));
check("provider callback uses the shared host-only writer", providerCallback.includes("setLevyTateAuthCookies"));
check("auth creation routes contain no direct ResponseCookies writes", !/\.cookies\.set\(/.test(callback + refresh + beta + perspective + providerCallback));
check("login has no role, organisation, or workspace fields", !/<input[^>]+(?:role|organisation|workspace)/i.test(login));
check("internal login is visibly separated", login.includes("Internal demonstration access"));
check("beta login is environment gated", beta.includes("isInternalBetaLoginEnabled"));
check("beta login accepts only fictional .test/internal identities", beta.includes("isInternalValidationEmail"));
check("logout clears LevyTate and Supabase cookies", logout.includes("levytateSupabaseAccessCookie") && logout.includes("levytateSupabaseRefreshCookie"));
check("logout is a server-owned full-document form submission", app.includes('action="/api/levytate-beta-logout"') && app.includes('method="post"') && !app.includes('fetch("/api/levytate-beta-logout"'));
check("logout expires every host-only and legacy-domain authentication cookie", logout.includes("expireLevyTateAuthCookies") && logout.includes("authenticationCookies") && providerLogout.includes("expireLevyTateAuthCookies"));
check("middleware invalid-session cleanup expires both cookie variants", middleware.includes("clearInvalidBetaSession") && middleware.includes("expireLevyTateAuthCookies"));
check("logout revokes only the current Supabase session", auth.includes('logout?scope=local') && !auth.includes('logout?scope=global'));
check("provider failure still enforces local logout", logout.includes("local_logout_enforced") && logout.includes('logout", "local-only"'));
check("protected workspace responses are private no-store", workspace.includes('Cache-Control') && workspace.includes('private, no-store'));
const publicSignInFlow = functionBody(login, "requestLink");
check("public employer authentication remains email magic-link only", auth.includes('authFetch(`otp?redirect_to=') && request.includes("requestEmployerSignIn(body.email") && !/password/i.test(request + publicSignInFlow));

console.log(`\nSecure employer auth foundation: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);

function functionBody(source, name) {
  const marker = source.indexOf(`function ${name}`);
  if (marker < 0) return "";
  const opening = source.indexOf("{", marker);
  if (opening < 0) return "";
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(opening + 1, index);
  }
  return "";
}
