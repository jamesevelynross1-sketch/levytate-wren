import test from "node:test";
import assert from "node:assert/strict";
import { validateLevyTateFreeStagingProvisioning as validate, levyTateFreeStaging as staging } from "../lib/levytate/free-staging-provisioning.mjs";

function clean() {
  return {
    schemaVersion:1,
    kind:"isolated-free-supabase-project",
    projectId:staging.projectId,
    organisationId:staging.organisationId,
    projectName:"levytate-staging",
    projectStatus:"ACTIVE_HEALTHY",
    region:"eu-west-2",
    apiUrl:`https://${staging.projectId}.supabase.co`,
    publicTableCount:0,
    migrationCount:0,
    fictionalDataOnly:true,
    externalEmailEnabled:false,
    productionAliasesUnchanged:true,
    previewProjectId:staging.vercelProjectId,
    previewBranch:staging.previewBranch,
    previewProtectionEnabled:true,
    previewSupabaseUrl:`https://${staging.projectId}.supabase.co`,
    previewScopedEnvKeys:[
      "NEXT_PUBLIC_SUPABASE_URL",
      "LEVYTATE_PROVIDER_DELIVERY_ENABLED",
      "LEVYTATE_REQUESTS_ENABLED",
      "LEVYTATE_BETA_LOGIN_ENABLED",
    ],
    serverCredentialConfigured:false,
  };
}
function reject(key,value) {
  const input=clean();input[key]=value;
  assert.throws(()=>validate(input),/BLOCKED LevyTate staging provisioning:/);
}
test("clean standalone staging setup is recognized as provisioning only, not hosted acceptance",()=>{
  const result=validate(clean());
  assert.equal(result.pass,true);
  assert.equal(result.hostedAcceptance,false);
  assert.equal(result.authenticationReady,false);
  assert.equal(result.schemaReady,false);
});
test("shared or unrelated Supabase project and wrong organisation must never qualify",()=>{
  reject("projectId",staging.sharedProjectId);
  reject("projectId","abcdefghijklmnopqrst");
  reject("organisationId","some-other-organisation");
  reject("region","eu-central-1");
  reject("projectStatus","INACTIVE");
});
test("an altered/unscoped preview or production alias cannot qualify",()=>{
  reject("previewProjectId","prj_other");
  reject("previewBranch","release/icon-pages-2026-10-20");
  reject("previewProtectionEnabled",false);
  reject("productionAliasesUnchanged",false);
  reject("previewScopedEnvKeys",["NEXT_PUBLIC_SUPABASE_URL"]);
  reject("previewScopedEnvKeys",[...clean().previewScopedEnvKeys,"SUPABASE_SERVICE_ROLE_KEY"]);
});
test("fresh schema data boundary and credential-free boundary are explicit",()=>{
  reject("publicTableCount",1);
  reject("migrationCount",2);
  reject("fictionalDataOnly",false);
  reject("externalEmailEnabled",true);
  reject("serverCredentialConfigured",true);
  const input=clean();input.serviceRoleKey="no-secret-in-evidence";
  assert.throws(()=>validate(input),/BLOCKED/);
});
test("does not silently accept a malformed or shared backend URL",()=>{
  reject("apiUrl",`https://${staging.sharedProjectId}.supabase.co`);
  reject("previewSupabaseUrl",`https://${staging.sharedProjectId}.supabase.co`);
  reject("previewSupabaseUrl",`https://${staging.projectId}.supabase.co.evil.test`);
  reject("previewSupabaseUrl",`https://user:pass@${staging.projectId}.supabase.co`);
  reject("apiUrl",`https://${staging.projectId}.supabase.co/extra`);
});
