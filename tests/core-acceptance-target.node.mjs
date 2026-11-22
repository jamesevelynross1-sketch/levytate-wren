import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { validateCoreAcceptanceTarget, sharedSupabaseRef } from "../lib/levytate/core-acceptance-target.mjs";

const reviewed="a".repeat(40);
function safeMetadata(){
  return {
    schemaVersion:1,
    environment:"isolated-supabase-branch",
    syntheticOnly:true,
    externalEmailEnabled:false,
    realEmployerDataLoaded:false,
    branchParentRef:sharedSupabaseRef,
    branchProjectRef:"abcdefghijklmnopqrst",
    branchListedProjectRef:"abcdefghijklmnopqrst",
    branchStatus:"ACTIVE_HEALTHY",
    branchName:"levytate-core-acceptance-20261122",
    branchSupabaseApiOrigin:"https://abcdefghijklmnopqrst.supabase.co",
    observedPreviewSupabaseApiOrigin:"https://abcdefghijklmnopqrst.supabase.co",
    previewVercelProjectId:"prj_NO1rAvQ8mrAeeeabgZGPVVUJTsB5",
    previewDeploymentId:"dpl_AbC1234567890",
    previewDeploymentState:"READY",
    previewDeploymentUrl:"https://isolated-app-preview.vercel.app",
    previewCommitSha:reviewed,
    reviewedCommitSha:reviewed,
    previewProtectionEnabled:true,
    restrictedMigration038Absent:true,
  };
}
function rejectChange(key,value){
  const evidence=safeMetadata(); evidence[key]=value;
  assert.throws(()=>validateCoreAcceptanceTarget(evidence),/BLOCKED core acceptance target:/);
}
test("metadata preflight accepts only structurally consistent synthetic isolated targets",()=>{
  const result=validateCoreAcceptanceTarget(safeMetadata());
  assert.equal(result.pass,true);
  assert.match(result.boundary,/metadata only/);
});
test("shared or mismatched Supabase projects cannot be used",()=>{
  rejectChange("branchProjectRef",sharedSupabaseRef);
  rejectChange("branchListedProjectRef","zzzzzzzzzzzzzzzzzzzz");
  rejectChange("observedPreviewSupabaseApiOrigin",`https://${sharedSupabaseRef}.supabase.co`);
  rejectChange("branchSupabaseApiOrigin",`https://${sharedSupabaseRef}.supabase.co`);
});
test("cannot silently use an unready, unprotected or production domain deployment",()=>{
  rejectChange("previewDeploymentState","BUILDING");
  rejectChange("previewProtectionEnabled",false);
  rejectChange("previewDeploymentUrl","https://app.levytate.co.uk");
  rejectChange("previewDeploymentUrl","http://isolated-app-preview.vercel.app");
  rejectChange("previewDeploymentUrl","https://isolated-app-preview.vercel.app.evil.test");
  rejectChange("previewCommitSha","b".repeat(40));
});
test("no live employer data, email or restricted migration may be introduced",()=>{
  rejectChange("syntheticOnly",false);
  rejectChange("externalEmailEnabled",true);
  rejectChange("realEmployerDataLoaded",true);
  rejectChange("restrictedMigration038Absent",false);
});
test("metadata cannot contain credentials, extra fields or malformed URLs",()=>{
  const evidence=safeMetadata(); evidence.serviceRoleKey="never-a-real-key";
  assert.throws(()=>validateCoreAcceptanceTarget(evidence),/BLOCKED/);
  rejectChange("branchSupabaseApiOrigin","https://user:pass@abcdefghijklmnopqrst.supabase.co");
  rejectChange("observedPreviewSupabaseApiOrigin","https://abcdefghijklmnopqrst.supabase.co/other");
});
test("original native acceptance tooling and core acceptance case IDs remain present",()=>{
  for(const path of [
    "scripts/release-create-native-runtime.mjs",
    "scripts/release-stage-native-migrations.mjs",
    "scripts/release-local-fixtures.mjs",
    "scripts/release-browser-acceptance.mjs",
    "docs/LEVYTATE_CLIENT_ACCEPTANCE.md",
  ]) assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),`${path} must remain retained`);
  const matrix=readFileSync(new URL("../docs/LEVYTATE_CLIENT_ACCEPTANCE.md",import.meta.url),"utf8");
  for(const id of ["CLA-ENV-09","CLA-APP-01","CLA-APP-05","CLA-APP-06","CLA-LRN-01","CLA-OPS-01","CLA-OPS-02","CLA-CAT-01","CLA-TEN-01","CLA-RES-02"]){
    assert.ok(matrix.includes(id),`Existing acceptance requirement ${id} must remain tracked`);
  }
});
