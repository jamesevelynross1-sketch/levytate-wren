import { constants, createDecipheriv, createHash, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: mocks.context }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", serviceRoleKey: "synthetic-server-only-key" }), readRuntimeEnv: () => "synthetic-independent-session-secret-for-unit-tests-only", supabaseFetchJson: mocks.rpc }));
import { runTenantOffboarding } from "@/lib/server/levytate-tenant-offboarding";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { tenantDataClasses } from "@/lib/server/levytate-tenant-data-policy";
const actor = "31000000-0000-4000-8000-000000000001", caseId = "31000000-0000-4000-8000-000000000002", tenant = "31000000-0000-4000-8000-000000000003", requestId = "31000000-0000-4000-8000-000000000004";
const session = { email: "synthetic-admin@example.test" } as LevyTateBetaSession;
const keys = generateKeyPairSync("rsa", { modulusLength: 3072 }), publicPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const expiry = () => new Date(Date.now() + 86_400_000).toISOString();
const snapshot = () => ({ organisationId: tenant, snapshotId: caseId, revision: 2, generatedAt: new Date().toISOString(), recipientPublicKey: publicPem, snapshotHash: "0".repeat(64), expiresAt: expiry(), organisation: { id: tenant, name: "Synthetic employer" }, tables: { levytate_users: [{ id: actor, organisation_id: tenant, email: "synthetic@example.test", auth_subject: "sensitive-auth-subject-unit-only", refreshToken: "private-token" }], levytate_pastoral_messages: [{ id: caseId, organisation_id: tenant, ciphertext: "sensitive-pastoral-ciphertext-unit-only" }] }, storageObjects: [{ bucket: "levytate-uploads", path: `${tenant}/file.txt`, size: 5, version: actor }] });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch);
  mocks.context.mockResolvedValue({ user: { id: actor, role: "Platform Admin", email: session.email }, organisation: { id: tenant } });
  mocks.fetch.mockResolvedValue(new Response("hello"));
  mocks.rpc.mockImplementation(async (_config, path, init) => {
    const body = JSON.parse(init.body);
    if (path.endsWith("_receipt")) return { result: null };
    if (path.endsWith("_snapshot")) return snapshot();
    if (path.endsWith("_command")) return { id: caseId, status: body.p_command.action === "record_export" ? "exported" : "requested", revision: 3 };
    throw new Error("Unexpected test RPC");
  });
});
const exportCommand = { action: "export", caseId, requestId, expectedRevision: 2 };
const confirmation = { action: "export", caseId, requestId, reactivationId: null, actorEmail: session.email, actorOrganisationId: tenant };
function policy() { return { version: "levytate-offboarding-v1", approvalReference: "synthetic-policy", clientNoticeReference: "synthetic-notice", supportHandoverReference: "synthetic-support", recoveryBoundaryReference: "synthetic-recovery", dataOwnerUserId: actor, serviceOwnerUserId: requestId, evidenceRetainUntil: expiry(), schedules: tenantDataClasses.map((dataClass) => ({ dataClass, retainUntil: new Date(Date.now() - 86_400_000).toISOString(), action: "delete", approvalReference: "synthetic-class" })) }; }

describe("offboarding closed service boundary (mock transport; real cryptography)", () => {
  it("denies employer roles before any privileged RPC", async () => {
    mocks.context.mockResolvedValue({ user: { id: actor, role: "Apprenticeship Lead" } });
    await expect(runTenantOffboarding(session, exportCommand)).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not accept browser-supplied snapshot, provider plan or internal actions", async () => {
    await expect(runTenantOffboarding(session, { ...exportCommand, snapshot: {} })).rejects.toMatchObject({ status: 400 });
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "record_export" })).rejects.toMatchObject({ status: 400 });
    await expect(runTenantOffboarding(session, { ...exportCommand, confirmation: { actorEmail: "other@example.test" } })).rejects.toMatchObject({ status: 400 });
    await expect(runTenantOffboarding(session, { ...exportCommand, actorOrganisationId: caseId })).rejects.toMatchObject({ status: 400 });
  });
  it("never stores a private key or assumes missing retention approvals", async () => {
    const request = { action: "request", caseId, requestId, organisationId: tenant, purpose: "delete", policy: policy(), recipientPublicKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), exportExpiresAt: expiry() };
    await expect(runTenantOffboarding(session, request)).rejects.toMatchObject({ status: 422 });
    await expect(runTenantOffboarding(session, { ...request, recipientPublicKey: publicPem, policy: {} })).rejects.toMatchObject({ status: 422 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("exports exact bytes using real authenticated encryption without private support or credentials", async () => {
    await expect(runTenantOffboarding(session, exportCommand)).resolves.toEqual({ case: { id: caseId, status: "exported", revision: 3 }, confirmation });
    const write = mocks.rpc.mock.calls.find((call) => call[1].endsWith("_command"));
    const saved = JSON.parse(write![2].body).p_command;
    expect(saved.clientCommand).toEqual(exportCommand);
    expect(JSON.stringify(saved.envelope)).not.toContain("synthetic@example.test");
    const envelope = saved.envelope;
    const key = privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
    decipher.setAAD(Buffer.from(`${envelope.manifestSha256}\n${envelope.expiresAt}`)); decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
    const payload = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString();
    expect(payload).toContain(Buffer.from("hello").toString("base64"));
    expect(payload).not.toContain("sensitive-auth-subject-unit-only"); expect(payload).not.toContain("sensitive-pastoral-ciphertext-unit-only"); expect(payload).not.toContain("private-token");
    expect(payload).toContain("redacted-subject-metadata");
  });
  it("a lost export reply is recovered from its durable receipt without another download or encryption", async () => {
    mocks.rpc.mockResolvedValue({ result: { id: caseId, status: "exported", revision: 3 } });
    await expect(runTenantOffboarding(session, exportCommand)).resolves.toEqual({ case: { id: caseId, status: "exported", revision: 3 }, confirmation });
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("derives confirmation from the canonical actor and explicitly omits absent request IDs", async () => {
    const envelope = { ciphertext: "unchanged-encrypted-bytes" };
    mocks.context.mockResolvedValue({ user: { id: actor, role: "Platform Admin", email: "canonical-admin@example.test" }, organisation: { id: requestId } });
    mocks.rpc.mockResolvedValue(envelope);
    const value = await runTenantOffboarding(session, { action: "download", caseId });
    expect(value).toEqual({ download: envelope, confirmation: { action: "download", caseId, reactivationId: null, requestId: null, actorEmail: "canonical-admin@example.test", actorOrganisationId: requestId } });
    expect(value.download).toBe(envelope);
  });
  it("byte mismatch aborts before a false exported result", async () => {
    mocks.fetch.mockResolvedValue(new Response("different bytes"));
    await expect(runTenantOffboarding(session, exportCommand)).rejects.toMatchObject({ status: 409 });
    expect(mocks.rpc.mock.calls.some((call) => call[1].endsWith("_command"))).toBe(false);
  });
  it("sanitises provider database failures", async () => {
    mocks.rpc.mockRejectedValue(new Error("private-provider-host-and-key"));
    const failure = await runTenantOffboarding(session, exportCommand).catch((error) => error);
    expect(failure.status).toBe(503); expect(failure.message).not.toContain("private-provider");
  });
  it("never finishes database disposal after an Auth API failure", async () => {
    mocks.rpc.mockImplementation(async (_config, path) => {
      if (path.endsWith("_status")) return [{ id: caseId, status: "deleting" }];
      if (path.endsWith("_disposal_plan")) return { caseId, organisationId: tenant, storageOutstanding: 0, storage: [], identities: [{ id: actor, delete: true }], manifest: { storage: [] } };
      throw new Error("Unexpected finalisation");
    });
    mocks.fetch.mockResolvedValue(new Response("not available", { status: 503 }));
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" })).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc.mock.calls.some((call) => call[1].endsWith("_finish_delete"))).toBe(false);
  });
  it("skips shared provider Auth identities and signs the confirmed result", async () => {
    mocks.rpc.mockImplementation(async (_config, path) => {
      if (path.endsWith("_status")) return [{ id: caseId, status: "deleting" }];
      if (path.endsWith("_disposal_plan")) return { caseId, organisationId: tenant, storageOutstanding: 0, storage: [], identities: [{ id: actor, delete: false }], manifest: { storage: [] } };
      if (path.endsWith("_finish_delete")) return { caseId, irreversible: true, sharedAuthRetained: 1 };
      throw new Error("Unexpected RPC");
    });
    const value = await runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" });
    expect(value.completion?.signature.value).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("only deletes the approved immutable version and stops before Auth if replacement bytes remain", async () => {
    const item = { bucket: "levytate-uploads", path: `${tenant}/file.txt`, version: actor, size: 5 };
    mocks.rpc.mockImplementation(async (_config, path) => {
      if (path.endsWith("_status")) return [{ id: caseId, status: "deleting" }];
      if (path.endsWith("_disposal_plan")) return { caseId, storageOutstanding: 1, storage: [item], identities: [{ id: actor, delete: true }], manifest: { storage: [{ ...item, sha256: createHash("sha256").update("hello").digest("hex") }] } };
      throw new Error("Unexpected finalisation");
    });
    mocks.fetch.mockImplementation(async (_url, init) => init.method === "DELETE" ? Response.json([]) : new Response("hello"));
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" })).rejects.toMatchObject({ status: 409 });
    const removal = mocks.fetch.mock.calls.find((call) => call[1].method === "DELETE");
    expect(JSON.parse(removal![1].body)).toEqual({ prefixes: [{ path: item.path, versionId: actor }] });
    expect(mocks.fetch.mock.calls.every((call) => !call[0].includes("/auth/"))).toBe(true);
    expect(mocks.rpc.mock.calls.some((call) => call[1].endsWith("_finish_delete"))).toBe(false);
  });
  it("unsupported exact-version deletion never retries an unversioned path", async () => {
    const item = { bucket: "levytate-uploads", path: `${tenant}/file.txt`, version: actor, size: 5 };
    mocks.rpc.mockImplementation(async (_config, path) => path.endsWith("_status") ? [{ id: caseId, status: "deleting" }] : { caseId, storageOutstanding: 1, storage: [item], identities: [], manifest: { storage: [{ ...item, sha256: createHash("sha256").update("hello").digest("hex") }] } });
    mocks.fetch.mockImplementation(async (_url, init) => init.method === "DELETE" ? new Response(null, { status: 400 }) : new Response("hello"));
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" })).rejects.toMatchObject({ status: 503 });
    expect(mocks.fetch.mock.calls.filter((call) => call[1].method === "DELETE")).toHaveLength(1);
  });
  it("resumes a confirmed NoSuchKey response but never treats an arbitrary 400 as deletion", async () => {
    const item = { bucket: "levytate-uploads", path: `${tenant}/file.txt`, version: actor, size: 5 };
    mocks.rpc.mockImplementation(async (_config, path) => {
      if (path.endsWith("_status")) return [{ id: caseId, status: "deleting" }];
      if (path.endsWith("_disposal_plan")) return { caseId, storageOutstanding: 0, storage: [item], identities: [], manifest: { storage: [{ ...item, sha256: "0".repeat(64) }] } };
      return { caseId, irreversible: true };
    });
    mocks.fetch.mockResolvedValue(Response.json({ statusCode: "404", error: "not_found", code: "NoSuchKey" }, { status: 400 }));
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" })).resolves.toHaveProperty("completion");
    mocks.fetch.mockResolvedValue(Response.json({ error: "Invalid version" }, { status: 400 }));
    await expect(runTenantOffboarding(session, { ...exportCommand, action: "execute_delete" })).rejects.toMatchObject({ status: 503 });
  });
});
