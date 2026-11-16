import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { encryptTenantExport } from "@/lib/server/levytate-tenant-export-envelope";
import { decodeTenantLifecycleControls, decodeTenantLifecycleResponse } from "@/lib/levytate/mvp/tenant-lifecycle-response";
const id = "10000000-0000-4000-8000-000000000001", requestId = "10000000-0000-4000-8000-000000000002", organisationId = "10000000-0000-4000-8000-000000000003";
const identity = { email: "synthetic-admin@example.test", organisationId };
const command = { action: "approve", caseId: id, requestId, expectedRevision: 1 };
const confirmation = { action: "approve", caseId: id, requestId, reactivationId: null, actorEmail: identity.email, actorOrganisationId: organisationId };
const approved = () => ({ confirmation: { ...confirmation }, case: { id, status: "approved", revision: 2 } });
const signature = { algorithm: "HMAC-SHA256", version: "levytate-offboarding-evidence-v1", value: "a".repeat(64) };
describe("strict lifecycle response confirmation", () => {
  it("accepts the matching original command result unchanged", () => { const value = approved(); expect(decodeTenantLifecycleResponse(value, command, identity)).toBe(value); });
  it.each([undefined, null, {}, { ok: true }, { case: { id, status: "approved", revision: 2 } }])("retains a command after malformed HTTP200 %j", (value) => {
    const confirmed = vi.fn(); const retained = JSON.stringify(command);
    expect(() => { decodeTenantLifecycleResponse(value, command, identity); confirmed(); }).toThrow();
    expect(confirmed).not.toHaveBeenCalled(); expect(JSON.stringify(command)).toBe(retained);
  });
  it.each([
    { actorEmail: "other@example.test" }, { actorOrganisationId: requestId }, { action: "cancel" }, { caseId: requestId }, { reactivationId: id }, { requestId: id }, { requestId: null },
  ])("denies mismatched response identity or original command %j", (change) => { const value = approved(); Object.assign(value.confirmation, change); expect(() => decodeTenantLifecycleResponse(value, command, identity)).toThrow(); });
  it.each([{ id: requestId }, { status: "cancelled" }, { revision: 1 }, { revision: 3 }, { revision: "2" }])("rejects unconfirmed case results %j", (change) => { const value = approved(); Object.assign(value.case, change); expect(() => decodeTenantLifecycleResponse(value, command, identity)).toThrow(); });
  it("does not accept multiple conflicting success payloads", () => { expect(() => decodeTenantLifecycleResponse({ ...approved(), erasure: {} }, command, identity)).toThrow(); });
  it("matches reactivation evidence and keeps signed bytes unchanged", () => {
    const request = { action: "request_reactivation", reactivationId: id, requestId, organisationId };
    const value = { confirmation: { ...confirmation, action: request.action, caseId: null, reactivationId: id }, reactivation: { signature, evidence: { id, organisationId, status: "requested", newIndividualInvitationsRequired: true, priorExternalBindingsRestored: false, priorSessionsRestored: false } } };
    expect(decodeTenantLifecycleResponse(value, request, identity).reactivation).toBe(value.reactivation);
    value.reactivation.evidence.priorSessionsRestored = true; expect(() => decodeTenantLifecycleResponse(value, request, identity)).toThrow();
  });
  it("requires matching completion case and irreversible evidence", () => {
    const request = { ...command, action: "execute_delete" }, value = { confirmation: { ...confirmation, action: request.action }, completion: { signature, evidence: { version: "levytate-offboarding-evidence-v1", caseId: id, organisationId, completedAt: new Date().toISOString(), irreversible: true } } };
    expect(decodeTenantLifecycleResponse(value, request, identity).completion).toBe(value.completion);
    value.completion.evidence.caseId = requestId; expect(() => decodeTenantLifecycleResponse(value, request, identity)).toThrow();
  });
  it("accepts real encrypted bytes unchanged only for the matching download command", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const download = encryptTenantExport("Synthetic export", "a".repeat(64), publicKey.export({ type: "spki", format: "pem" }).toString(), new Date(Date.now() + 60000).toISOString());
    const request = { action: "download", caseId: id }, value = { confirmation: { ...confirmation, action: request.action, requestId: null }, download };
    expect(decodeTenantLifecycleResponse(value, request, identity).download).toBe(download);
    value.confirmation.caseId = requestId; expect(() => decodeTenantLifecycleResponse(value, request, identity)).toThrow();
    value.confirmation.caseId = id; value.download.ciphertext = "not base64"; expect(() => decodeTenantLifecycleResponse(value, request, identity)).toThrow();
  });
  it("confirms erasure only with the same case and recorded reference", () => {
    const request = { action: "erase_evidence", caseId: id, reference: "synthetic-approved-reference" }, value = { confirmation: { ...confirmation, action: request.action, requestId: null }, erasure: { caseId: id, erased: true, erasureReference: request.reference, erasedAt: new Date().toISOString() } };
    expect(decodeTenantLifecycleResponse(value, request, identity).erasure).toBe(value.erasure);
    value.erasure.erasureReference = "other"; expect(() => decodeTenantLifecycleResponse(value, request, identity)).toThrow();
  });
});
describe("inspect lifecycle state without erasing retained commands", () => {
  it("accepts truly empty recorded state", () => { const value = { cases: [], owners: [], reactivations: [] }; expect(decodeTenantLifecycleControls(value)).toBe(value); });
  it("accepts recorded cases, current owners and reactivation references without rewriting them", () => {
    const references = { approvalReference: "synthetic-policy", clientNoticeReference: "synthetic-notice", supportHandoverReference: "synthetic-handover", recoveryBoundaryReference: "synthetic-recovery" }, date = "2026-11-09T19:00:00+00:00";
    const value = { cases: [{ id, tenant_id: organisationId, requester_id: requestId, revision: 3, export_expires_at: date, evidence_retain_until: date, status: "exported", purpose: "delete", legal_hold: false, policy: { ...references, dataOwnerUserId: id, serviceOwnerUserId: requestId }, retention: [{ dataClass: "identity", state: "due", retainUntil: date }] }], owners: [{ id: requestId, label: "Synthetic current owner" }], reactivations: [{ id: requestId, organisation_id: organisationId, requester_id: id, status: "requested", request_evidence: references }] };
    expect(decodeTenantLifecycleControls(value)).toBe(value);
  });
  it.each([{ cases: [] }, { cases: [null], owners: [], reactivations: [] }, { cases: [{ id }], owners: [], reactivations: [] }, { cases: [], owners: [{ id, label: "" }], reactivations: [] }, { cases: [], owners: [], reactivations: [{ id }] }])("rejects unrenderable recorded state %j", (value) => { expect(() => decodeTenantLifecycleControls(value)).toThrow(); });
});
