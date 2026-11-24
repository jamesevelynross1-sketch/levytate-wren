// Provisioning-only preflight. Never converts a free staging project into a
// production release approval, and never accepts secrets as evidence.
export const levyTateFreeStaging = Object.freeze({
  projectId: "njyxfjkzbprowhnuwcud",
  sharedProjectId: "lzwcahdgchrkeulmlfqv",
  organisationId: "vmcdvnscpljcdmoxlilz",
  region: "eu-west-2",
  vercelProjectId: "prj_NO1rAvQ8mrAeeeabgZGPVVUJTsB5",
  previewBranch: "codex/levytate-free-staging-20261124",
});

const allowedFields = [
  "schemaVersion", "kind", "projectId", "organisationId", "projectName",
  "projectStatus", "region", "apiUrl", "publicTableCount", "migrationCount",
  "fictionalDataOnly", "externalEmailEnabled", "productionAliasesUnchanged",
  "previewProjectId", "previewBranch", "previewProtectionEnabled",
  "previewSupabaseUrl", "previewScopedEnvKeys", "serverCredentialConfigured",
];
const requiredEnvKeys = [
  "LEVYTATE_BETA_LOGIN_ENABLED",
  "LEVYTATE_PROVIDER_DELIVERY_ENABLED",
  "LEVYTATE_REQUESTS_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
];
function reject(why) { throw new Error(`BLOCKED LevyTate staging provisioning: ${why}`); }
function cleanOrigin(value) {
  if(typeof value!=="string")reject("Supabase origin is unavailable");
  let url;
  try {url=new URL(value);}catch {reject("Supabase origin is malformed");}
  if(url.protocol!=="https:" || url.username || url.password || url.search || url.hash ||
    url.port || url.pathname!=="/" || !url.hostname.endsWith(".supabase.co"))
    reject("Supabase origin must be an exact HTTPS project origin");
  return url.origin;
}
export function validateLevyTateFreeStagingProvisioning(evidence) {
  if(!evidence || typeof evidence!=="object" || Array.isArray(evidence))reject("metadata object required");
  const fields=Object.keys(evidence);
  if(fields.length!==allowedFields.length || allowedFields.some(k=>!Object.hasOwn(evidence,k)) ||
    fields.some(k=>!allowedFields.includes(k)))reject("metadata fields missing or unexpected");
  if(evidence.schemaVersion!==1 || evidence.kind!=="isolated-free-supabase-project")
    reject("standalone free project required, not a billable branch");
  if(evidence.projectId!==levyTateFreeStaging.projectId ||
    evidence.projectId===levyTateFreeStaging.sharedProjectId ||
    evidence.organisationId!==levyTateFreeStaging.organisationId ||
    evidence.projectName!=="levytate-staging" ||
    evidence.projectStatus!=="ACTIVE_HEALTHY" || evidence.region!==levyTateFreeStaging.region)
    reject("verified staging ownership and health mismatch");
  const expected=`https://${levyTateFreeStaging.projectId}.supabase.co`;
  if(cleanOrigin(evidence.apiUrl)!==expected || cleanOrigin(evidence.previewSupabaseUrl)!==expected)
    reject("preview endpoint must match the separate staging project, never the shared project");
  if(evidence.publicTableCount!==0 || evidence.migrationCount!==0)
    reject("fresh-project phase must have empty public schema and migration ledger");
  if(evidence.fictionalDataOnly!==true || evidence.externalEmailEnabled!==false ||
    evidence.productionAliasesUnchanged!==true)reject("no real data, external email or production changes");
  if(evidence.previewProjectId!==levyTateFreeStaging.vercelProjectId ||
    evidence.previewBranch!==levyTateFreeStaging.previewBranch ||
    evidence.previewProtectionEnabled!==true)
    reject("approved protected preview branch mismatch");
  if(!Array.isArray(evidence.previewScopedEnvKeys) ||
    evidence.previewScopedEnvKeys.length!==requiredEnvKeys.length ||
    requiredEnvKeys.some(key=>!evidence.previewScopedEnvKeys.includes(key)) ||
    evidence.previewScopedEnvKeys.some(key=>!requiredEnvKeys.includes(key)))
    reject("exactly four branch-scoped staging configuration keys required");
  // No service-role secret can be declared or smuggled into a code review.
  if(evidence.serverCredentialConfigured!==false)
    reject("credential-free provisioning only; full backend access is an independent gate");
  return Object.freeze({
    pass:true,
    phase:"separate-project-provisioning",
    hostedAcceptance:false,
    schemaReady:false,
    authenticationReady:false,
    next:"Review exact fresh-project migrations, securely configure separate server credentials, and test a protected immutable preview before client use.",
  });
}
