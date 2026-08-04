import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(label, condition) { if (condition) { passed += 1; console.log(`PASS ${label}`); } else { failed += 1; console.error(`FAIL ${label}`); } }
const read = (path) => readFileSync(path, "utf8");

const migration = read("supabase/migrations/020_create_secure_employer_authentication_foundation.sql");
const auth = read("lib/server/levytate-auth.ts");
const authorised = read("lib/server/levytate-authorised-session.ts");
const request = read("app/api/levytate-auth/request/route.ts");
const callback = read("app/levytate/auth/callback/route.ts");
const login = read("components/levytate-mvp/LevyTateLoginClient.tsx");
const beta = read("app/api/levytate-beta-login/route.ts");
const logout = read("app/api/levytate-beta-logout/route.ts");
const app = read("components/levytate-mvp/LevyTateMvpApp.tsx");
const workspace = read("app/api/levytate-workspace/route.ts");

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
check("cookies are HTTP-only and bounded", /httpOnly: true/.test(callback) && /maxAge/.test(callback));
check("deployed cookies are secure", /process\.env\.NODE_ENV === ["']production["']/.test(callback));
check("login has no role, organisation, or workspace fields", !/<input[^>]+(?:role|organisation|workspace)/i.test(login));
check("internal login is visibly separated", login.includes("Internal demonstration access"));
check("beta login is environment gated", beta.includes("isInternalBetaLoginEnabled"));
check("beta login accepts only fictional .test/internal identities", beta.includes("isInternalValidationEmail"));
check("logout clears LevyTate and Supabase cookies", logout.includes("levytateSupabaseAccessCookie") && logout.includes("levytateSupabaseRefreshCookie"));
check("logout is a server-owned full-document form submission", app.includes('action="/api/levytate-beta-logout"') && app.includes('method="post"') && !app.includes('fetch("/api/levytate-beta-logout"'));
check("logout redirects only after server cookie expiry", logout.includes("NextResponse.redirect") && logout.includes("expires: new Date(0)") && logout.includes("maxAge: 0"));
check("logout revokes only the current Supabase session", auth.includes('logout?scope=local') && !auth.includes('logout?scope=global'));
check("provider failure still enforces local logout", logout.includes("local_logout_enforced") && logout.includes('logout", "local-only"'));
check("protected workspace responses are private no-store", workspace.includes('Cache-Control') && workspace.includes('private, no-store'));
check("no password authentication introduced", !/password/i.test(auth + login));

console.log(`\nSecure employer auth foundation: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
