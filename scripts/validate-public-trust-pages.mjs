import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const slugs = ["privacy", "early-access-terms", "data-processing", "support", "account-help", "data-rights"];
const content = read("lib/levytate/public-trust-content.ts");
const governance = read("lib/server/levytate-public-trust-governance.ts");
const login = read("components/levytate-mvp/LevyTateLoginClient.tsx");
const app = read("components/levytate-mvp/LevyTateMvpApp.tsx");
const middleware = read("middleware.ts");

for (const slug of slugs) {
  const route = `app/levytate/${slug}/page.tsx`;
  assert.ok(fs.existsSync(path.join(root, route)), `${route} must exist`);
  assert.match(read(route), new RegExp(`https://www\\.levytate\\.co\\.uk/${slug}`), `${slug} must have canonical metadata`);
  assert.match(content, new RegExp(`slug: "${slug}"`), `${slug} must use the structured content source`);
  assert.match(middleware, new RegExp(`/${slug}`), `${slug} short path must be routed on the LevyTate domain`);
}

for (const required of ["/levytate/privacy", "/levytate/early-access-terms", "/levytate/account-help", "/levytate/support"]) assert.match(login, new RegExp(required), `login must link ${required}`);
for (const required of ["/levytate/privacy", "/levytate/early-access-terms", "/levytate/support", "/levytate/data-rights"]) assert.match(app, new RegExp(required), `app must link ${required}`);
assert.match(governance, /server-only/, "internal review status must remain server-only");
assert.doesNotMatch(content, /legal_approval_required|approved_for_early_access|internalOwner/, "public content must not expose internal review fields");
for (const unsupported of [/24\/7 support/i, /guaranteed uptime/i, /public self-service signup/i, /fully launched/i, /compliance certified/i]) assert.doesNotMatch(content, unsupported, `public content contains unsupported claim ${unsupported}`);
assert.match(read("app/levytate/app/page.tsx"), /index: false, follow: false/, "protected app must be noindex");
assert.match(read("docs/LEVYTATE_PUBLIC_TRUST_PAGES.md"), /versioned legal-document acceptance record/, "acceptance-model gap must be documented");
assert.match(read("docs/LEVYTATE_LEGAL_AND_SUPPORT_APPROVAL_CHECKLIST.md"), /Supabase[\s\S]*Vercel[\s\S]*Resend[\s\S]*OpenAI/, "service inventory must cover verified service categories");
console.log(`Public trust validation passed: ${slugs.length} routes, structured content, role-safe metadata, links, claims, SEO and governance documentation.`);
