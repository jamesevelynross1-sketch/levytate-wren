import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertIndependentLifecycleApproval, assertTenantDeletionDue, assertTenantInventoryComplete, parseTenantRetentionPolicy, retentionExceptions, tenantDataClasses } from "@/lib/server/levytate-tenant-data-policy";
import { buildTenantExport, encryptTenantExport, type TenantExportSnapshot } from "@/lib/server/levytate-tenant-export-envelope";
const now = new Date("2026-10-29T00:00:00Z");
const owner = "00000000-0000-4000-8000-000000000001", approver = "00000000-0000-4000-8000-000000000002";
function policy() { return { version: "levytate-offboarding-v1", approvalReference: "synthetic-approval", clientNoticeReference: "synthetic-notice", supportHandoverReference: "synthetic-support", recoveryBoundaryReference: "synthetic-recovery", dataOwnerUserId: owner, serviceOwnerUserId: approver, evidenceRetainUntil:"2027-01-01T00:00:00Z",
  schedules: tenantDataClasses.map((dataClass) => ({dataClass,retainUntil:"2026-10-28T00:00:00Z",action:"delete",approvalReference:"synthetic-class-approval"})) }; }
function snapshot(): TenantExportSnapshot { return { organisationId:"tenant-a",snapshotId:"synthetic-export",generatedAt:now.toISOString(),organisation:{id:"tenant-a",name:"Synthetic employer"},tables:{levytate_users:[{organisation_id:"tenant-a",id:"a",email:"fictional@example.test",auth_subject:"private-auth-id",token_hash:"private-token",metadata:{refresh_token:"nested-private"}}]},storageObjects:[{bucket:"levytate-uploads",path:"tenant-a/example.txt",size:5}] }; }

describe("explicit retention and independent approval", () => {
  it("has no retention defaults and requires every class exactly once", () => {
    expect(() => parseTenantRetentionPolicy({})).toThrow();
    const input=policy();input.schedules[1]=input.schedules[0];expect(() => parseTenantRetentionPolicy(input)).toThrow();
  });
  it("legal holds, retained evidence and future schedules block removal", () => {
    const input=parseTenantRetentionPolicy(policy());
    expect(() => assertTenantDeletionDue(input,true,now)).toThrow();
    expect(retentionExceptions(input,true,now).every((item)=>item.state==="held")).toBe(true);
    input.schedules[0].action="retain";expect(() => assertTenantDeletionDue(input,false,now)).toThrow();
    input.schedules[0].action="delete";input.schedules[0].retainUntil="2026-11-01T00:00:00Z";expect(() => assertTenantDeletionDue(input,false,now)).toThrow();
    input.schedules[0].retainUntil="2026-10-28T00:00:00Z";expect(() => assertTenantDeletionDue(input,false,now)).not.toThrow();
  });
  it("cannot self-approve or silently ignore a new tenant table", () => {
    expect(() => assertIndependentLifecycleApproval(owner,owner)).toThrow();
    expect(() => assertIndependentLifecycleApproval(owner,approver)).not.toThrow();
    expect(() => assertTenantInventoryComplete(["levytate_employees","levytate_new_personal_records"])).toThrow();
  });
});

describe("tenant export reconciliation and real authenticated encryption", () => {
  it("includes exact object bytes and checksums but never authentication credentials", () => {
    const result=buildTenantExport(snapshot(),[{bucket:"levytate-uploads",path:"tenant-a/example.txt",bytes:Buffer.from("hello")}]);
    expect(result.manifest.tables).toHaveLength(1);expect(result.manifest.storage[0].sha256).toHaveLength(64);
    expect(result.payload).not.toContain("private-auth-id");expect(result.payload).not.toContain("private-token");expect(result.payload).not.toContain("nested-private");
  });
  it("fails closed on foreign rows, missing/extra objects, wrong byte counts and unreviewed tables", () => {
    const input=snapshot();input.tables.levytate_users[0].organisation_id="tenant-b";expect(()=>buildTenantExport(input,[])).toThrow(/isolation/);
    expect(()=>buildTenantExport(snapshot(),[])).toThrow(/inventory/);
    expect(()=>buildTenantExport(snapshot(),[{bucket:"levytate-uploads",path:"tenant-b/file",bytes:Buffer.from("hello")}])).toThrow(/inventory/);
    expect(()=>buildTenantExport(snapshot(),[{bucket:"levytate-uploads",path:"tenant-a/example.txt",bytes:Buffer.from("shorter")}])).toThrow(/bytes/);
    const unknown=snapshot();unknown.tables.levytate_new_table=[];expect(()=>buildTenantExport(unknown,[])).toThrow(/unreviewed/);
  });
  it("decrypts only with the recipient private key and authenticates manifest and expiry", () => {
    const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:3072});
    const packed=buildTenantExport(snapshot(),[{bucket:"levytate-uploads",path:"tenant-a/example.txt",bytes:Buffer.from("hello")}]);
    const envelope=encryptTenantExport(packed.payload,packed.manifestSha256,publicKey.export({type:"spki",format:"pem"}).toString(),"2026-10-30T00:00:00Z",now);
    expect(JSON.stringify(envelope)).not.toContain("fictional@example.test");
    const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},Buffer.from(envelope.wrappedKey,"base64"));
    const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.nonce,"base64"));decipher.setAAD(Buffer.from(`${envelope.manifestSha256}\n${envelope.expiresAt}`));decipher.setAuthTag(Buffer.from(envelope.authenticationTag,"base64"));
    expect(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,"base64")),decipher.final()]).toString()).toBe(packed.payload);
    const changed=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.nonce,"base64"));changed.setAAD(Buffer.from(`${envelope.manifestSha256}\n2027-01-01T00:00:00Z`));changed.setAuthTag(Buffer.from(envelope.authenticationTag,"base64"));changed.update(Buffer.from(envelope.ciphertext,"base64"));expect(()=>changed.final()).toThrow();
  });
  it("rejects expired exports and weak recipient keys", () => {
    const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});const pem=publicKey.export({type:"spki",format:"pem"}).toString();
    expect(()=>encryptTenantExport("{}","hash",pem,"2026-10-28T00:00:00Z",now)).toThrow();
    expect(()=>encryptTenantExport("{}","hash",pem,"2026-10-30T00:00:00Z",now)).toThrow(/3072/);
  });
});
