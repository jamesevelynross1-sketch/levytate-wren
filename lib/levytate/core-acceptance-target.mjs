// Credential-free, metadata-only preflight for a separately approved LevyTate acceptance backend.
// A passing result does NOT attest connector truth, migrations, authentication, RBAC, or hosted acceptance.
export const sharedSupabaseRef = "lzwcahdgchrkeulmlfqv";
export const levyTateVercelProjectId = "prj_NO1rAvQ8mrAeeeabgZGPVVUJTsB5";
const required = [
  "schemaVersion",
  "environment",
  "syntheticOnly",
  "externalEmailEnabled",
  "realEmployerDataLoaded",
  "branchParentRef",
  "branchProjectRef",
  "branchListedProjectRef",
  "branchStatus",
  "branchName",
  "branchSupabaseApiOrigin",
  "observedPreviewSupabaseApiOrigin",
  "previewVercelProjectId",
  "previewDeploymentId",
  "previewDeploymentState",
  "previewDeploymentUrl",
  "previewCommitSha",
  "reviewedCommitSha",
  "previewProtectionEnabled",
  "restrictedMigration038Absent",
];

function blocked(message) { throw new Error(`BLOCKED core acceptance target: ${message}`); }
function originOnly(value, expectedProtocol, expectedSuffix, description) {
  if (typeof value !== "string" || !value) blocked(`${description} is missing`);
  let parsed;
  try { parsed = new URL(value); } catch { blocked(`${description} must be a URL`); }
  if (parsed.protocol !== expectedProtocol || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash
    || parsed.pathname !== "/" || !parsed.hostname.endsWith(expectedSuffix)
    || parsed.hostname === expectedSuffix.slice(1)) blocked(`${description} must be a clean approved origin`);
  return parsed.origin;
}

export function validateCoreAcceptanceTarget(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) blocked("metadata must be an object");
  const keys = Object.keys(input);
  if (keys.length !== required.length || required.some((key) => !Object.hasOwn(input, key))
    || keys.some((key) => !required.includes(key))) blocked("metadata fields are missing or unexpected");
  // Strict allowlisting also prevents accidental inclusion of credentials in the metadata file.
  if (input.schemaVersion !== 1 || input.environment !== "isolated-supabase-branch") blocked("isolated environment declaration is missing");
  if (input.syntheticOnly !== true || input.externalEmailEnabled !== false || input.realEmployerDataLoaded !== false)
    blocked("fictional-only / no-external-email boundary is not confirmed");
  if (input.branchParentRef !== sharedSupabaseRef) blocked("parent project must match the reviewed shared reference");
  if (typeof input.branchProjectRef !== "string" || !/^[a-z]{20}$/.test(input.branchProjectRef)
    || input.branchProjectRef === sharedSupabaseRef) blocked("separate Supabase branch project reference is required");
  if (input.branchListedProjectRef !== input.branchProjectRef || input.branchStatus !== "ACTIVE_HEALTHY")
    blocked("Supabase branch listing / healthy state must match the intended target");
  if (typeof input.branchName !== "string" || !/^levytate-core-acceptance-[a-z0-9-]{4,50}$/.test(input.branchName))
    blocked("explicit dedicated acceptance branch name is required");
  const branchOrigin=originOnly(input.branchSupabaseApiOrigin,"https:",".supabase.co","branch Supabase API");
  const observedOrigin=originOnly(input.observedPreviewSupabaseApiOrigin,"https:",".supabase.co","Preview-configured Supabase API");
  const expected=`https://${input.branchProjectRef}.supabase.co`;
  if (branchOrigin !== expected || observedOrigin !== expected)
    blocked("the Preview backend does not match the isolated Supabase branch");
  if (input.previewVercelProjectId !== levyTateVercelProjectId
    || typeof input.previewDeploymentId !== "string"
    || !/^dpl_[A-Za-z0-9]{10,}$/.test(input.previewDeploymentId)
    || input.previewDeploymentState !== "READY") blocked("immutable ready LevyTate Preview is required");
  originOnly(input.previewDeploymentUrl, "https:", ".vercel.app", "protected Vercel Preview");
  if (typeof input.previewCommitSha !== "string" || !/^[a-f0-9]{40}$/.test(input.previewCommitSha)
    || input.previewCommitSha !== input.reviewedCommitSha) blocked("Preview SHA must match the reviewed candidate SHA");
  if (input.previewProtectionEnabled !== true) blocked("Preview must remain access protected");
  if (input.restrictedMigration038Absent !== true) blocked("restricted migration 038 must remain unapplied");
  return {
    pass: true,
    boundary: "credential-free metadata only",
    next: "Independently verify connector evidence, reviewed migration hashes, Auth and actual two-tenant hosted acceptance before client access.",
  };
}
