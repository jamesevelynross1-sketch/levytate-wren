import type { ClientIdentity } from "@/lib/levytate/client-session";
import type { OffboardingCase, TenantReactivationRequest } from "@/lib/server/levytate-tenant-offboarding";
import type { EncryptedTenantExport } from "@/lib/server/levytate-tenant-export-envelope";
import type { LifecycleOwnerOption } from "@/lib/levytate/mvp/tenant-retention-form";

type Row = Record<string, unknown>;
type SignedEvidence = { evidence: Row; signature: { algorithm: string; version: string; value: string } };
export type LifecycleConfirmation = { action: string; caseId: string | null; reactivationId: string | null; requestId: string | null; actorEmail: string; actorOrganisationId: string };
export type LifecycleResponse = { confirmation: LifecycleConfirmation; case?: { id: string; status: string; revision: number }; download?: EncryptedTenantExport; completion?: SignedEvidence; erasure?: Row; reactivation?: SignedEvidence };
const invalid = () => new Error("The lifecycle response could not be matched to your original request. The exact command and fields have been kept; retry it or inspect the recorded case.");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha = /^[a-f0-9]{64}$/;
const states = ["requested", "approved", "exported", "deleting", "completed", "cancelled"];
function row(value: unknown): Row { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(); return value as Row; }
function text(value: unknown) { if (typeof value !== "string" || !value.trim()) throw invalid(); return value; }
function identifier(value: unknown) { if (!uuid.test(text(value))) throw invalid(); return value as string; }
function stamp(value: unknown) { if (!Number.isFinite(Date.parse(text(value)))) throw invalid(); }
function positive(value: unknown) { if (!Number.isSafeInteger(value) || Number(value) < 1) throw invalid(); }
function identifiedRows(value: unknown) {
  if (!Array.isArray(value)) throw invalid(); const ids = new Set<string>();
  return value.map((item) => { const result = row(item), id = identifier(result.id); if (ids.has(id)) throw invalid(); ids.add(id); return result; });
}
function signed(value: unknown) {
  const outer = row(value), signature = row(outer.signature), evidence = row(outer.evidence);
  if (signature.algorithm !== "HMAC-SHA256" || signature.version !== "levytate-offboarding-evidence-v1" || !sha.test(text(signature.value))) throw invalid();
  return evidence;
}
function base64(value: unknown, minimum: number, maximum: number) {
  const encoded = text(value);
  if (encoded.length < minimum || encoded.length > maximum || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw invalid();
}

/** Correlates a successful response before clearing a retained command. This
 * validates structure and identity, not the cryptographic signature; encrypted
 * and signed download bytes are returned unchanged for recipient verification.
 */
export function decodeTenantLifecycleResponse(value: unknown, command: Row, identity: ClientIdentity): LifecycleResponse {
  const payload = row(value), confirmation = row(payload.confirmation), action = text(command.action);
  const reactivation = ["request_reactivation", "approve_reactivation", "cancel_reactivation"].includes(action);
  const noRequestId = ["download", "erase_evidence"].includes(action);
  const id = identifier(reactivation ? command.reactivationId : command.caseId);
  const requestId = noRequestId ? null : identifier(command.requestId);
  if (confirmation.action !== action || confirmation.caseId !== (reactivation ? null : id) || confirmation.reactivationId !== (reactivation ? id : null)
    || confirmation.requestId !== requestId || confirmation.actorEmail !== identity.email.trim().toLowerCase()
    || confirmation.actorOrganisationId !== identity.organisationId.toLowerCase()) throw invalid();
  const kind = reactivation ? "reactivation" : action === "download" ? "download" : action === "erase_evidence" ? "erasure" : action === "execute_delete" ? "completion" : "case";
  if (Object.keys(payload).some((key) => key !== "confirmation" && key !== kind) || !(kind in payload)) throw invalid();
  if (reactivation) {
    const evidence = signed(payload.reactivation), expected = { request_reactivation: "requested", approve_reactivation: "approved", cancel_reactivation: "cancelled" }[action];
    if (evidence.id !== id || evidence.status !== expected || evidence.newIndividualInvitationsRequired !== true || evidence.priorExternalBindingsRestored !== false || evidence.priorSessionsRestored !== false) throw invalid();
    identifier(evidence.organisationId);
    if (command.organisationId !== undefined && evidence.organisationId !== command.organisationId) throw invalid();
  } else if (action === "download") {
    const envelope = row(payload.download);
    if (envelope.version !== "levytate-encrypted-export-v1" || envelope.algorithm !== "RSA-OAEP-SHA256/AES-256-GCM") throw invalid();
    for (const field of ["recipientKeyFingerprint", "ciphertextSha256", "manifestSha256"]) if (!sha.test(text(envelope[field]))) throw invalid();
    stamp(envelope.expiresAt); base64(envelope.nonce, 16, 16); base64(envelope.authenticationTag, 24, 24); base64(envelope.wrappedKey, 512, 22000); base64(envelope.ciphertext, 4, 24 * 1024 * 1024);
  } else if (action === "execute_delete") {
    const evidence = signed(payload.completion);
    if (evidence.caseId !== id || evidence.version !== "levytate-offboarding-evidence-v1" || evidence.irreversible !== true) throw invalid();
    identifier(evidence.organisationId); stamp(evidence.completedAt);
  } else if (action === "erase_evidence") {
    const evidence = row(payload.erasure);
    if (evidence.caseId !== id || evidence.erased !== true || evidence.erasureReference !== command.reference) throw invalid(); stamp(evidence.erasedAt);
  } else {
    const current = row(payload.case), expectedStatus = { request: "requested", approve: "approved", export: "exported", cancel: "cancelled", record_delivery: "exported" }[action];
    if (!["request", "approve", "export", "cancel", "record_delivery", "hold", "erase_expired_export"].includes(action) || current.id !== id || !states.includes(String(current.status))) throw invalid();
    positive(current.revision);
    if (current.revision !== (action === "request" ? 1 : Number(command.expectedRevision) + 1) || (expectedStatus && current.status !== expectedStatus)) throw invalid();
  }
  return payload as LifecycleResponse;
}

/** An inspect/refresh may release a retained form only after renderable recorded
 * state is available. It never repairs malformed server data with empty arrays.
 */
export function decodeTenantLifecycleControls(value: unknown): { cases: OffboardingCase[]; owners: LifecycleOwnerOption[]; reactivations: TenantReactivationRequest[] } {
  const payload = row(value);
  for (const item of identifiedRows(payload.cases)) {
    identifier(item.tenant_id); identifier(item.requester_id); positive(item.revision); stamp(item.export_expires_at); stamp(item.evidence_retain_until);
    if (!states.includes(String(item.status)) || !["export", "delete"].includes(String(item.purpose)) || typeof item.legal_hold !== "boolean") throw invalid();
    const policy = row(item.policy); identifier(policy.dataOwnerUserId); identifier(policy.serviceOwnerUserId);
    for (const name of ["approvalReference", "clientNoticeReference", "supportHandoverReference", "recoveryBoundaryReference"]) text(policy[name]);
    if (!Array.isArray(item.retention)) throw invalid();
    for (const entry of item.retention) { const decision = row(entry); text(decision.dataClass); text(decision.state); stamp(decision.retainUntil); }
  }
  for (const owner of identifiedRows(payload.owners)) text(owner.label);
  for (const item of identifiedRows(payload.reactivations)) {
    identifier(item.organisation_id); identifier(item.requester_id);
    if (!["requested", "approved", "cancelled"].includes(String(item.status))) throw invalid();
    const references = row(item.request_evidence);
    for (const name of ["approvalReference", "clientNoticeReference", "supportHandoverReference", "recoveryBoundaryReference"]) text(references[name]);
  }
  return payload as { cases: OffboardingCase[]; owners: LifecycleOwnerOption[]; reactivations: TenantReactivationRequest[] };
}
