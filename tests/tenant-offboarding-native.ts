// LOCAL native end-to-end service drill: real Auth users/password verification,
// Data API RPCs, encryption, Storage bytes and provider deletion. Not browser or
// hosted release acceptance. Fixtures remain for independent verification.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes, generateKeyPairSync, privateDecrypt, constants, createDecipheriv, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
async function main() {
const statePath = process.argv[2];
if (!statePath?.startsWith("/private/tmp/levytate-release-runtime.")) throw Error("Explicit local fixture runtime required");
const runtime = statePath.slice(0, statePath.lastIndexOf("/")), state = JSON.parse(readFileSync(statePath, "utf8")).env;
const api = new URL(state.API_URL), db = new URL(state.DB_URL);
if (api.hostname !== "127.0.0.1" || db.hostname !== "127.0.0.1") throw Error("Loopback endpoints required");
process.env.NEXT_PUBLIC_SUPABASE_URL = api.origin; process.env.SUPABASE_SERVICE_ROLE_KEY = state.SERVICE_ROLE_KEY;
process.env.LEVYTATE_BETA_SESSION_SECRET = randomBytes(48).toString("base64url");
const { runTenantOffboarding } = await import("@/lib/server/levytate-tenant-offboarding");
const headers = { apikey: state.SERVICE_ROLE_KEY, Authorization: `Bearer ${state.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const tenant = randomUUID(), other = randomUUID(), operator = randomUUID(), caseId = randomUUID(), providerMember = randomUUID();
const users = ["admin-a", "admin-b", "exclusive", "shared-provider", "other-tenant"].map((name) => ({ name, id: randomUUID(), subject: "", email: `${name}-${caseId}@example.test`, password: randomBytes(32).toString("base64url") }));
const path = `${tenant}/offboard-native-${caseId}/evidence.txt`, otherPath = `${other}/offboard-native-${caseId}/unaffected.txt`, bucket = "levytate-uploads";
const checks: Array<{ label: string; passed: boolean }> = [];
const evidencePath = `${runtime}/offboard-native-${caseId}.json`;
let result: unknown = null;
function save() { writeFileSync(evidencePath, JSON.stringify({ tenant, other, operator, caseId, providerMember, users: users.map(({ id, subject, email, name }) => ({ id, subject, email, name })), path, otherPath, checks, completion: result, cleanup: "retained for independent fictional fixture verification" }, null, 2), { mode: 0o600 }); }
function check(ok: boolean, label: string) { checks.push({ label, passed: ok }); console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); if (!ok) throw Error(label); }
function sql(statement: string) {
  const r = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-h", db.hostname, "-p", db.port, "-U", db.username, "-d", db.pathname.slice(1), "-X", "-At", "-v", "ON_ERROR_STOP=1"], { input: statement, env: { ...process.env, PGPASSWORD: db.password }, encoding: "utf8" });
  if (r.status !== 0) throw Error("Local fictional fixture SQL failed"); return r.stdout.trim();
}
async function rpc(name: string, body: unknown) {
  const response = await fetch(`${api.origin}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw Error(`Local RPC failed (${response.status})`); return response.json();
}
async function signIn(user: typeof users[number]): Promise<LevyTateBetaSession> {
  const response = await fetch(`${api.origin}/auth/v1/token?grant_type=password`, { method: "POST", headers, body: JSON.stringify({ email: user.email, password: user.password }) });
  if (!response.ok) throw Error(`Fictional Auth verification failed (${response.status})`);
  const verified = await response.json() as { access_token: string; user: { id: string; email: string } };
  const confirm = await fetch(`${api.origin}/auth/v1/user`, { headers: { ...headers, Authorization: `Bearer ${verified.access_token}` } });
  const identity = await confirm.json() as { id: string; email: string };
  check(confirm.ok && identity.id === user.subject && identity.email === user.email, `${user.name} uses a genuine individually verified Auth identity`);
  const now = Math.floor(Date.now() / 1000);
  return { email: identity.email, authSubject: identity.id, authMode: "supabase_email", accessLevel: "beta_user", issuedAt: now, expiresAt: now + 3600 };
}
const command = (action: string, expectedRevision: number, extra: object = {}) => ({ action, caseId, requestId: randomUUID(), expectedRevision, ...extra });
save();
try {
  for (const user of users) {
    const response = await fetch(`${api.origin}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify({ email: user.email, password: user.password, email_confirm: true }) });
    if (!response.ok) throw Error(`Local fictional Auth provisioning failed (${response.status})`);
    const identity = await response.json() as { id: string };
    if (!/^[a-f0-9-]{36}$/.test(identity.id)) throw Error("Verified Auth subject required"); user.subject = identity.id; save();
  }
  sql(`insert into public.levytate_organisations(id,name,slug,workspace_template,status) values
   ('${operator}','Synthetic disposal operators','off-operator-${caseId}','levytate-client-v1','Active'),
   ('${tenant}','Synthetic disposal target','off-target-${caseId}','levytate-client-v1','Active'),
   ('${other}','Synthetic unaffected employer','off-other-${caseId}','levytate-client-v1','Active');
   insert into public.levytate_users(id,organisation_id,email,display_name,role,access_level,active,auth_subject,auth_binding_status,auth_bound_at,invitation_status)
   values ${users.map((user, index) => `('${user.id}','${index < 2 ? operator : index < 4 ? tenant : other}','${user.email}','Synthetic ${user.name}','${index < 2 ? "Platform Admin" : "Employee"}','beta_user',true,'${user.subject}','bound',now(),'consumed')`).join(",")};
   insert into public.levytate_provider_memberships(id,provider_id,email,role,active,auth_subject,auth_binding_status,auth_bound_at,created_by)
   values('${providerMember}','synthetic-${caseId}','${users[3].email}','Provider User',false,'${users[3].subject}','bound',now(),'${users[0].id}');
   insert into public.levytate_file_assets(organisation_id,entity_type,entity_id,bucket_name,object_path,original_name,mime_type,file_size_bytes,uploaded_by_email)
   values('${tenant}','synthetic','fixture','${bucket}','${path}','Fictional evidence','text/plain',24,'${users[2].email}'),
   ('${other}','synthetic','fixture','${bucket}','${otherPath}','Fictional unaffected','text/plain',26,'${users[4].email}');`);
  const original = "fictional disposal bytes", unaffected = "fictional unaffected bytes";
  check(Buffer.byteLength(original) === 24 && Buffer.byteLength(unaffected) === 26, "fixture byte counts are exact");
  for (const [name, bytes] of [[path, original], [otherPath, unaffected]]) {
    const response = await fetch(`${api.origin}/storage/v1/object/${bucket}/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "text/plain", "x-upsert": "false" }, body: bytes });
    check(response.ok, "fictional private object is stored through actual Storage API");
  }
  const sessionA = await signIn(users[0]), sessionB = await signIn(users[1]);
  await signIn(users[2]); await signIn(users[4]);
  await rpc("levytate_suspend_client_tenant", { p_organisation_id: tenant, p_actor_user_id: users[0].id, p_reason: "Fictional approved disposal drill", p_request_id: randomUUID() });
  check(sql(`select count(*) from public.levytate_retired_auth_bindings where organisation_id='${tenant}';`) === "2", "suspension retains both previous Auth subject bindings for disposal");
  const keys = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const policy = { version: "levytate-offboarding-v1", approvalReference: "fictional-policy", clientNoticeReference: "fictional-client-notice", supportHandoverReference: "fictional-support-handover", recoveryBoundaryReference: "fictional-no-automatic-restore", dataOwnerUserId: users[0].id, serviceOwnerUserId: users[1].id, evidenceRetainUntil: new Date(Date.now() + 86400_000).toISOString(), schedules: ["identity", "people", "applications", "learners", "finance", "catalogue", "files", "assessments", "lift", "support", "audit"].map((dataClass) => ({ dataClass, retainUntil: new Date(Date.now() - 86400_000).toISOString(), action: "delete", approvalReference: "fictional-class-approval" })) };
  const requested = await runTenantOffboarding(sessionA, { action: "request", caseId, requestId: randomUUID(), organisationId: tenant, purpose: "delete", policy, recipientPublicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), exportExpiresAt: new Date(Date.now() + 3600_000).toISOString() });
  check(requested.case?.status === "requested", "real database records scoped disposal request");
  await runTenantOffboarding(sessionB, command("approve", 1, { approvalReference: "fictional-independent-approval" }));
  const exported = await runTenantOffboarding(sessionA, command("export", 2));
  check(exported.case?.status === "exported", "actual database and Storage bytes form approved encrypted export");
  const issued = await runTenantOffboarding(sessionA, { action: "download", caseId });
  if (!issued.download) throw Error("Encrypted export unavailable");
  const envelope = issued.download, key = privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64")); decipher.setAAD(Buffer.from(`${envelope.manifestSha256}\n${envelope.expiresAt}`)); decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString(); key.fill(0);
  check(decrypted.includes(Buffer.from(original).toString("base64")) && !decrypted.includes(users[4].email) && !decrypted.includes(users[2].subject), "recipient decrypts exact tenant bytes without another tenant or Auth subjects");
  await runTenantOffboarding(sessionA, command("record_delivery", 3, { reference: "fictional-recipient-decryption-confirmed" }));
  const execute = command("execute_delete", 4);
  const completed = await runTenantOffboarding(sessionB, execute); result = completed.completion;
  check(Boolean(completed.completion?.signature.value), "server signs confirmed disposal evidence");
  check(sql(`select count(*) from public.levytate_organisations where id='${tenant}';`) === "0", "target tenant is durably removed");
  check(sql(`select count(*) from storage.objects where bucket_id='${bucket}' and name='${path}';`) === "0", "target Storage catalog is empty after API removal");
  check(sql(`select count(*) from auth.users where id='${users[2].subject}';`) === "0", "exclusive real Auth user is removed through Auth API");
  check(sql(`select count(*) from auth.users where id='${users[3].subject}';`) === "1" && sql(`select count(*) from public.levytate_provider_memberships where id='${providerMember}';`) === "1", "shared inactive provider Auth identity and membership remain intact");
  const response = await fetch(`${api.origin}/storage/v1/object/authenticated/${bucket}/${otherPath}`, { headers });
  check(response.ok && await response.text() === unaffected, "second tenant retains exact Storage bytes");
  await signIn(users[4]);
  const replay = await runTenantOffboarding(sessionB, execute);
  check(createHash("sha256").update(JSON.stringify(replay.completion)).digest("hex") === createHash("sha256").update(JSON.stringify(completed.completion)).digest("hex"), "uncertain completion retry returns identical signed evidence");
} finally { save(); console.log(`Restricted fictional drill evidence: ${evidencePath}`); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Local offboarding drill failed"); process.exitCode = 1; });
