import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

const auth = readFileSync("lib/server/levytate-auth.ts", "utf8");
const request = readFileSync("app/api/levytate-auth/request/route.ts", "utf8");
const callback = readFileSync("app/levytate/auth/callback/route.ts", "utf8");
const loginPage = readFileSync("app/levytate/login/page.tsx", "utf8");
const loginClient = readFileSync("components/levytate-mvp/LevyTateLoginClient.tsx", "utf8");
const runbook = readFileSync("docs/LEVYTATE_AUTH_EMAIL_DELIVERY.md", "utf8");

check("public sign-in response remains generic", request.includes("genericSignInRequestMessage") && !request.includes("membership"));
check("sign-in request cannot create an Auth user", /create_user: false/.test(auth) && !/create_user: true/.test(auth));
check("requested callback is passed to GoTrue as redirect_to", auth.includes('otp?redirect_to=${encodeURIComponent(redirectTo)}'));
check("provider acceptance is audited without payloads", auth.includes('"auth.email_delivery_accepted"') && auth.includes('"accepted_by_provider"'));
check("provider failure is audited without raw errors", auth.includes('"auth.email_delivery_failed"') && !/metadata:\s*\{[^}]*error/s.test(auth));
check("verified identity and successful sign-in are distinct", auth.includes('"auth.email_identity_verified"') && auth.includes('"auth.sign_in_successful"'));
check("callback consumes a token hash", callback.includes('searchParams.get("token_hash")'));
check("callback never accepts role or organisation", !/searchParams\.get\(["'](?:role|organisation)/.test(callback));
check("session cookies stay HTTP-only", /httpOnly: true/.test(callback));
check("invalid-link state is server-derived without hydration drift", loginPage.includes('auth === "invalid-link"') && !loginClient.includes('typeof window !== "undefined"'));
check("runbook names the exact Supabase project", runbook.includes("lzwcahdgchrkeulmlfqv"));
check("runbook preserves Microsoft 365 mail routing", runbook.includes("Do not remove or replace the root Microsoft 365 MX or SPF records"));
check("runbook prohibits wildcard Preview redirects", runbook.includes("Do not add wildcard Vercel redirects"));
check("runbook records the shared distributed limiter", runbook.includes("shared Supabase-backed security store") && runbook.includes("HMAC-derived actor keys"));
check("runbook contains no credential values", !/re_[A-Za-z0-9_-]{12,}|service_role|smtp_password/i.test(runbook));

console.log(`\nAuthentication email delivery: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
