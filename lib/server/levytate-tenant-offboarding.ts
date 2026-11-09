import { createHash, createHmac, createPublicKey, hkdfSync } from "node:crypto";
import { z } from "zod";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, readRuntimeEnv, supabaseFetchJson } from "@/lib/server/levytate-supabase";
import { parseTenantRetentionPolicy, retentionExceptions, type TenantRetentionPolicy } from "@/lib/server/levytate-tenant-data-policy";
import { buildTenantExport, canonicalExportJson, encryptTenantExport, type EncryptedTenantExport, type TenantExportObject, type TenantExportSnapshot } from "@/lib/server/levytate-tenant-export-envelope";

const identifier = z.uuid();
const reference = z.string().trim().min(5).max(500);
const versioned = { caseId: identifier, requestId: identifier, expectedRevision: z.number().int().positive().max(2147483647) };
const command = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("request"), caseId: identifier, requestId: identifier, organisationId: identifier,
    purpose: z.enum(["export", "delete"]), policy: z.unknown(), recipientPublicKey: z.string().min(100).max(16000), exportExpiresAt: z.iso.datetime({ offset: true }) }),
  z.strictObject({ action: z.literal("approve"), ...versioned, approvalReference: reference }),
  z.strictObject({ action: z.literal("hold"), ...versioned, active: z.boolean(), reference }),
  z.strictObject({ action: z.literal("cancel"), ...versioned }),
  z.strictObject({ action: z.literal("export"), ...versioned }),
  z.strictObject({ action: z.literal("record_delivery"), ...versioned, reference }),
  z.strictObject({ action: z.literal("execute_delete"), ...versioned }),
  z.strictObject({ action: z.literal("erase_expired_export"), ...versioned }),
  z.strictObject({ action: z.literal("download"), caseId: identifier }),
  z.strictObject({ action: z.literal("erase_evidence"), caseId: identifier, reference }),
  z.strictObject({ action: z.literal("request_reactivation"), reactivationId: identifier, requestId: identifier, organisationId: identifier,
    approvalReference: reference, clientNoticeReference: reference, supportHandoverReference: reference, recoveryBoundaryReference: reference }),
  z.strictObject({ action: z.literal("approve_reactivation"), reactivationId: identifier, requestId: identifier, approvalReference: reference }),
  z.strictObject({ action: z.literal("cancel_reactivation"), reactivationId: identifier, requestId: identifier }),
]);
type Config = NonNullable<ReturnType<typeof getLevyTateSupabaseConfig>>;
type CaseResult = { id: string; status: string; revision: number };
type Snapshot = TenantExportSnapshot & { recipientPublicKey: string; snapshotHash: string; expiresAt: string; revision: number };
type DisposalPlan = { caseId: string; organisationId: string; revision: number;
  storageOutstanding: number;
  storage: Array<{ bucket: string; path: string; size: number; version: string }>;
  identities: Array<{ id: string; delete: boolean }>;
  manifest: { storage: Array<{ bucket: string; path: string; size: number; version: string; sha256: string }> };
};
export type OffboardingCase = {
  id: string; tenant_id: string; purpose: "export" | "delete"; status: "requested" | "approved" | "exported" | "deleting" | "completed" | "cancelled";
  requester_id: string; approver_id: string | null; revision: number; legal_hold: boolean; policy: TenantRetentionPolicy;
  export_expires_at: string; evidence_retain_until: string; issued_at: string | null; client_delivery_reference: string | null;
  created_at: string; completed_at: string | null;
  retention: ReturnType<typeof retentionExceptions>;
};
export type TenantReactivationRequest = { id: string; organisation_id: string; requester_id: string; approver_id: string | null;
  status: "requested" | "approved" | "cancelled"; requested_at: string; completed_at: string | null;
  request_evidence: { approvalReference: string; clientNoticeReference: string; supportHandoverReference: string; recoveryBoundaryReference: string };
  approval_reference: string | null };
const errorMessage = "The offboarding step could not be confirmed. The employer stays suspended. Retry the same request or inspect its recorded state.";

async function authorised(session: LevyTateBetaSession) {
  const actor = await getLearnerLifecycleServerContext(session);
  if (actor.user.role !== "Platform Admin") throw new ClientRequestError("Only Platform Admin can manage employer offboarding.", 403);
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ClientRequestError("Employer offboarding is unavailable.", 503);
  return { actorId: actor.user.id, config };
}
async function rpc<T>(config: Config, name: string, body: Record<string, unknown>): Promise<T> {
  try { return await supabaseFetchJson<T>(config, `rpc/${name}`, { method: "POST", body: JSON.stringify(body) }); }
  catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 5) : "";
    const status = code === "PT403" ? 403 : code === "PT404" ? 404 : code === "PT409" || code === "23505" ? 409 : code === "PT422" ? 422 : 503;
    throw new ClientRequestError(status === 409 ? "The case, approval, retention schedule or data changed. Inspect the case before continuing." : errorMessage, status);
  }
}
export async function listTenantOffboarding(session: LevyTateBetaSession, caseId?: string): Promise<OffboardingCase[]> {
  if (caseId && !identifier.safeParse(caseId).success) throw new ClientRequestError("Select a valid lifecycle case.", 400);
  const { actorId, config } = await authorised(session);
  const rows = await rpc<OffboardingCase[]>(config, "levytate_offboarding_status", { p_actor: actorId, p_case: caseId ?? null });
  if (!Array.isArray(rows)) throw new ClientRequestError(errorMessage, 503);
  return rows.map((row) => ({ ...row, policy: parseTenantRetentionPolicy(row.policy), retention: retentionExceptions(parseTenantRetentionPolicy(row.policy), row.legal_hold, new Date()) }));
}
export async function tenantLifecycleControls(session: LevyTateBetaSession) {
  const { actorId, config } = await authorised(session);
  const [reactivations, organisations, members] = await Promise.all([
    rpc<TenantReactivationRequest[]>(config, "levytate_reactivation_status", { p_actor: actorId }),
    supabaseFetchJson<Array<{ id: string }>>(config, "levytate_organisations?select=id&status=eq.Active"),
    supabaseFetchJson<Array<{ id: string; display_name: string; email: string; organisation_id: string }>>(config,
      "levytate_users?select=id,display_name,email,organisation_id&role=eq.Platform%20Admin&active=eq.true&auth_binding_status=eq.bound&auth_subject=not.is.null"),
  ]);
  const active = new Set(organisations.map((item) => item.id));
  return { reactivations, owners: members.filter((item) => active.has(item.organisation_id)).map((item) => ({ id: item.id, label: item.display_name || item.email })) };
}
function result(value: CaseResult, caseId: string) {
  if (value?.id !== caseId || !Number.isSafeInteger(value.revision) || !["requested", "approved", "exported", "deleting", "completed", "cancelled"].includes(value.status)) throw new ClientRequestError(errorMessage, 503);
  return value;
}
function validPublicKey(pem: string) {
  try {
    if (!/^-----BEGIN (RSA )?PUBLIC KEY-----/.test(pem.trim()) || pem.includes("PRIVATE KEY")) throw new Error("Public key required");
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType === "rsa" && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 3072) return;
  } catch { /* Public validation response deliberately excludes parser detail. */ }
  throw new ClientRequestError("Provide the approved recipient's RSA public key with at least 3072 bits. Never submit a private key.", 422);
}
function storageUrl(config: Config, bucket: string, path?: string) {
  if (!/^[a-z0-9_-]+$/.test(bucket) || path?.split("/").some((part) => !part || part === "." || part === "..") || path?.includes("\\")) throw new ClientRequestError("The approved Storage inventory is invalid.", 409);
  return `${config.url}/storage/v1/object/${path === undefined ? "" : "authenticated/"}${encodeURIComponent(bucket)}${path === undefined ? "" : `/${path.split("/").map(encodeURIComponent).join("/")}`}`;
}
function headers(config: Config) { return { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` }; }
async function downloadObject(config: Config, item: { bucket: string; path: string; size: number; version: string }, allowMissing = false): Promise<Uint8Array | null> {
  if (!identifier.safeParse(item.version).success) throw new ClientRequestError("Storage requires an immutable object version. Disposal remains paused.", 409);
  if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size > 16 * 1024 * 1024) throw new ClientRequestError("Object exceeds the bounded export. An approved offline export is required.", 413);
  const response = await fetch(`${storageUrl(config, item.bucket, item.path)}?versionId=${encodeURIComponent(item.version)}`, { headers: headers(config), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (response.status === 404 && allowMissing) return null;
  if (response.status === 400 && allowMissing) {
    const failure = await response.clone().json().catch(() => null) as { statusCode?: string; error?: string; code?: string } | null;
    if (failure?.statusCode === "404" && failure.error === "not_found" && failure.code === "NoSuchKey") return null;
  }
  if (!response.ok || !response.body) throw new ClientRequestError(errorMessage, 503);
  const reader = response.body.getReader(), parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > item.size) throw new ClientRequestError("Object bytes changed during export. Nothing was declared complete.", 409);
      parts.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (size !== item.size) throw new ClientRequestError("Object bytes do not match the approved inventory.", 409);
  return Buffer.concat(parts);
}
function signedEvidence(evidence: unknown) {
  const secret = readRuntimeEnv("LEVYTATE_BETA_SESSION_SECRET");
  if (secret.length < 32) throw new ClientRequestError("The protected evidence-signing configuration is unavailable.", 503);
  // Key separation: session tokens and offboarding evidence never share a MAC key.
  const key = Buffer.from(hkdfSync("sha256", secret, "levytate-offboarding-v1", "evidence-hmac", 32));
  try { return { evidence, signature: { algorithm: "HMAC-SHA256", version: "levytate-offboarding-evidence-v1", value: createHmac("sha256", key).update(canonicalExportJson(evidence)).digest("hex") } }; }
  finally { key.fill(0); }
}

/** Closed workflow. Browsers cannot supply provider plans, snapshots or receipts. */
export async function runTenantOffboarding(session: LevyTateBetaSession, input: unknown) {
  const parsed = command.safeParse(input);
  if (!parsed.success) throw new ClientRequestError("Use a supported lifecycle action with its original request and current revision.", 400);
  const data = parsed.data;
  if (data.action === "request") {
    data.policy = parseTenantRetentionPolicy(data.policy); validPublicKey(data.recipientPublicKey);
    const ttl = Date.parse(data.exportExpiresAt) - Date.now();
    if (ttl <= 0 || ttl > 7 * 86_400_000) throw new ClientRequestError("Export availability must expire within seven days.", 422);
  }
  const { actorId, config } = await authorised(session);
  if (data.action === "request_reactivation" || data.action === "approve_reactivation" || data.action === "cancel_reactivation") {
    const value = await rpc<{ id: string; status: string }>(config, "levytate_reactivation_command", { p_actor: actorId, p_command: data });
    if (value.id !== data.reactivationId || !["requested", "approved", "cancelled"].includes(value.status)) throw new ClientRequestError(errorMessage, 503);
    return { reactivation: signedEvidence(value) };
  }
  if (data.action === "download") return { download: await rpc<EncryptedTenantExport>(config, "levytate_offboarding_download", { p_actor: actorId, p_case: data.caseId }) };
  if (data.action === "erase_evidence") return { erasure: await rpc(config, "levytate_offboarding_erase_evidence", { p_actor: actorId, p_case: data.caseId, p_reference: data.reference }) };
  if (data.action === "export") {
    const prior = await rpc<{ result: CaseResult | null }>(config, "levytate_offboarding_receipt", { p_actor: actorId, p_request: data.requestId, p_command: data });
    if (prior.result) return { case: result(prior.result, data.caseId) };
    const snapshot = await rpc<Snapshot>(config, "levytate_offboarding_snapshot", { p_actor: actorId, p_case: data.caseId });
    if (snapshot.snapshotId !== data.caseId || snapshot.revision !== data.expectedRevision || !Array.isArray(snapshot.storageObjects) || snapshot.storageObjects.length > 1000 || snapshot.storageObjects.reduce((size, item) => size + item.size, 0) > 12 * 1024 * 1024) throw new ClientRequestError("The snapshot changed or exceeds the bounded online export. An approved offline export may be needed.", 409);
    const objects: TenantExportObject[] = [];
    for (const item of snapshot.storageObjects) objects.push({ bucket: item.bucket, path: item.path, bytes: (await downloadObject(config, item))! });
    const built = buildTenantExport(snapshot, objects);
    const envelope = encryptTenantExport(built.payload, built.manifestSha256, snapshot.recipientPublicKey, snapshot.expiresAt);
    const value = await rpc<CaseResult>(config, "levytate_offboarding_command", { p_actor: actorId, p_command: { ...data, action: "record_export", clientCommand: data, envelope, manifest: built.manifest, snapshotHash: snapshot.snapshotHash, storageInventory: snapshot.storageObjects } });
    return { case: result(value, data.caseId) };
  }
  if (data.action === "execute_delete") {
    // Validate signing before crossing the irreversible boundary.
    signedEvidence({ preflight: true });
    const cases = await rpc<OffboardingCase[]>(config, "levytate_offboarding_status", { p_actor: actorId, p_case: data.caseId });
    if (cases.length !== 1) throw new ClientRequestError("Lifecycle case not found.", 404);
    const current = cases[0];
    if (current.status === "completed") return { completion: signedEvidence(await rpc(config, "levytate_offboarding_finish_delete", { p_actor: actorId, p_case: data.caseId })) };
    if (current.status !== "deleting") await rpc(config, "levytate_offboarding_command", { p_actor: actorId, p_command: { ...data, action: "begin_delete", clientCommand: data } });
    const plan = await rpc<DisposalPlan>(config, "levytate_offboarding_disposal_plan", { p_actor: actorId, p_case: data.caseId });
    if (plan.caseId !== data.caseId || !Array.isArray(plan.storage) || !Array.isArray(plan.identities) || !Array.isArray(plan.manifest?.storage)) throw new ClientRequestError(errorMessage, 503);
    for (const item of plan.storage) {
      // A newly raised hold pauses remaining work, even after a previous object
      // was removed. Already removed bytes are not promised recoverable.
      await rpc(config, "levytate_offboarding_disposal_plan", { p_actor: actorId, p_case: data.caseId });
      const expected = plan.manifest.storage.find((entry) => entry.bucket === item.bucket && entry.path === item.path);
      if (!expected || expected.version !== item.version || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw new ClientRequestError("Storage disposal is missing approved versions or byte checksums.", 409);
      const bytes = await downloadObject(config, item, true);
      if (bytes === null) continue;
      if (createHash("sha256").update(bytes).digest("hex") !== expected.sha256) throw new ClientRequestError("Storage bytes changed after export. Disposal is paused for review.", 409);
      // Provider locks and deletes this exact immutable version. Never fall back
      // to a path-only delete: that could erase bytes replaced after the check.
      const response = await fetch(storageUrl(config, item.bucket), { method: "DELETE", headers: { ...headers(config), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [{ path: item.path, versionId: item.version }] }), redirect: "error", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new ClientRequestError("Exact-version Storage removal is unavailable or failed. Disposal remains paused; no path-only fallback is permitted.", 503);
    }
    const storageCheck = await rpc<DisposalPlan>(config, "levytate_offboarding_disposal_plan", { p_actor: actorId, p_case: data.caseId });
    if (storageCheck.storageOutstanding !== 0) throw new ClientRequestError("Storage objects remain or were replaced. Auth and database disposal are paused for review.", 409);
    for (const identity of plan.identities) {
      if (!identity.delete) continue;
      if (!identifier.safeParse(identity.id).success) throw new ClientRequestError(errorMessage, 503);
      await rpc(config, "levytate_offboarding_disposal_plan", { p_actor: actorId, p_case: data.caseId });
      const response = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(identity.id)}`, { method: "DELETE", headers: { ...headers(config), "Content-Type": "application/json" }, body: JSON.stringify({ should_soft_delete: false }), redirect: "error", signal: AbortSignal.timeout(15_000) });
      if (!response.ok && response.status !== 404) throw new ClientRequestError(errorMessage, 503);
    }
    return { completion: signedEvidence(await rpc(config, "levytate_offboarding_finish_delete", { p_actor: actorId, p_case: data.caseId })) };
  }
  const value = await rpc<CaseResult>(config, "levytate_offboarding_command", { p_actor: actorId, p_command: data });
  return { case: result(value, data.caseId) };
}
