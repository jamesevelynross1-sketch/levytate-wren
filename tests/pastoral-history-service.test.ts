import { beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ fetch: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({
  getLevyTateSupabaseConfig: () => ({ url: "http://127.0.0.1:1", serviceRoleKey: "unit-fixture-only" }),
  supabaseFetchJson: transport.fetch, supabaseSelect: transport.select,
  readRuntimeEnv: (key: string) => key === "LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_V1" ? "00".repeat(32) : key === "LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_VERSION" ? "synthetic-v1" : "",
}));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: vi.fn() }));
import { applyPastoralMutationForSession, findPersistedAssistantReply, persistPastoralExchange } from "@/lib/server/levytate-pastoral";
import { authenticatePastoralHistoryCommand, decryptPastoralJson, encryptPastoralJson } from "@/lib/server/levytate-pastoral-crypto";
import { runPastoralAssistant } from "@/lib/server/levytate-pastoral-assistant";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

type Input = Parameters<typeof persistPastoralExchange>[0];
const context = { organisation: { id: "ac000000-0000-4000-8000-000000000001" }, user: { id: "ac100000-0000-4000-8000-000000000001" }, employee: { id: "private-a" }, accessMode: "employee" } as Input["context"];
const response: NonNullable<Input["assistantResponse"]> = { reply: "Synthetic original reply", source: "openai", supportOffer: false, urgencyRoute: "standard", suggestedTopicCategory: "other", humanSupportAvailable: false, policyVersion: "pastoral-support-v1", supportRequestDraft: null };
const input = (): Input => ({ context, preference: { id: "preference", save_history: true, history_retention_days: 30, lock_version: 3 }, conversation: null, clientMessageId: "synthetic-message", employeeMessage: "Synthetic private employee text", assistantMessage: response.reply, assistantResponse: response, requestDetails: { draftSupportRequest: false, recentMessages: [] } });
function sentCommand() { return JSON.parse(transport.fetch.mock.calls.at(-1)![2].body).p_command; }
function resultFor(command: Record<string, unknown>, originalReply?: string) {
  const conversationId = String(command.conversation_id ?? command.new_conversation_id);
  const sequence = Number(command.expected_sequence) + 2;
  const id = `${command.client_message_id}:assistant`;
  const aad = `${context.organisation.id}:${context.employee!.id}:message:${conversationId}:${sequence}:${id}`;
  const envelope = originalReply ? encryptPastoralJson({ content: originalReply, assistantResponse: { ...response, reply: originalReply } }, aad) : (command.messages as ReturnType<typeof encryptPastoralJson>[])[1];
  return { conversationId, replayed: Boolean(originalReply), message: { id: "synthetic-assistant", conversation_id: conversationId, employee_id: context.employee!.id, owner_user_id: context.user.id, sequence_number: sequence, author_type: "assistant", ciphertext: envelope.ciphertext, nonce: envelope.nonce, authentication_tag: envelope.authenticationTag, encryption_key_version: envelope.keyVersion, client_message_id: id, created_at: "2026-11-09T00:00:00Z" } };
}
beforeEach(() => {
  vi.clearAllMocks();
  transport.fetch.mockImplementation(async (_config, _path, init) => resultFor(JSON.parse(init.body).p_command));
});
describe("private-history service contract (real crypto, mocked transport; not hosted/My Support activation)", () => {
  it("sends one actor-bound atomic call with ciphertext only", async () => {
    const submitted = input();
    const result = await persistPastoralExchange(submitted);
    expect(result?.response).toEqual(response);
    expect(transport.fetch).toHaveBeenCalledTimes(1);
    expect(transport.fetch.mock.calls[0][1]).toBe("rpc/levytate_pastoral_history_command");
    const wire = transport.fetch.mock.calls[0][2].body as string;
    expect(wire).not.toContain(submitted.employeeMessage);
    expect(wire).not.toContain(submitted.assistantMessage);
    expect(wire).not.toContain("recentMessages");
    const command = sentCommand();
    expect(command.expected_preference_version).toBe(3);
    expect(command.expected_sequence).toBe(0);
    expect(command.request_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(command.messages).toHaveLength(2);
    const aad = `${context.organisation.id}:${context.employee!.id}:message:${command.new_conversation_id}:1:${submitted.clientMessageId}`;
    expect(decryptPastoralJson<{ content: string }>(command.messages[0], aad).content).toBe(submitted.employeeMessage);
    expect(() => decryptPastoralJson(command.messages[0], aad.replace("private-a", "private-b"))).toThrow();
  });
  it("returns the committed winning reply rather than the losing concurrent model output", async () => {
    transport.fetch.mockImplementation(async (_config, _path, init) => resultFor(JSON.parse(init.body).p_command, "First durable response"));
    const result = await persistPastoralExchange({ ...input(), assistantMessage: "Uncommitted losing response" });
    expect(result?.response?.reply).toBe("First durable response");
    expect(result?.message.content).toBe("First durable response");
  });
  it("pins the sequence read before model execution", async () => {
    const submitted = input();
    submitted.conversation = { id: "ac200000-0000-4000-8000-000000000001", employee_id: "private-a", owner_user_id: context.user.id, status: "active", retention_expires_at: "2099-01-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", last_sequence_number: 8 };
    await persistPastoralExchange(submitted);
    expect(sentCommand().expected_sequence).toBe(8);
    expect(transport.select).not.toHaveBeenCalled();
  });
  it("does not persist when history saving was off", async () => {
    expect(await persistPastoralExchange({ ...input(), preference: null })).toBeNull();
    expect(transport.fetch).not.toHaveBeenCalled();
  });
  it("validates the owner again before any history command", async () => {
    await expect(persistPastoralExchange({ ...input(), context: { ...context, accessMode: "support_recipient" } })).rejects.toMatchObject({ status: 403 });
    expect(transport.fetch).not.toHaveBeenCalled();
  });
  it("binds a retry to original text and full request details without exposing either", async () => {
    transport.fetch.mockResolvedValue(null);
    await findPersistedAssistantReply(context, null, "synthetic-message", "Original", { draftSupportRequest: false });
    const first = sentCommand().request_hmac;
    await findPersistedAssistantReply(context, null, "synthetic-message", "Changed", { draftSupportRequest: false });
    expect(sentCommand().request_hmac).not.toBe(first);
    await findPersistedAssistantReply(context, null, "synthetic-message", "Original", { draftSupportRequest: true });
    expect(sentCommand().request_hmac).not.toBe(first);
    expect(transport.fetch.mock.calls.every((call) => !call[2].body.includes("Original") && !call[2].body.includes("draftSupportRequest"))).toBe(true);
  });
  it("uses a deterministic keyed domain-separated authenticator", () => {
    const first = authenticatePastoralHistoryCommand({ owner: "a", text: "Synthetic private text" });
    expect(authenticatePastoralHistoryCommand({ text: "Synthetic private text", owner: "a" })).toBe(first);
    expect(authenticatePastoralHistoryCommand({ owner: "b", text: "Synthetic private text" })).not.toBe(first);
  });
  it.each([["PT403: revoked", 403], ["PT404: expired or deleted", 404], ["PT409: stale consent", 409], ["23505: concurrency", 409], ["PT422: invalid", 422], ["synthetic unknown outage", 503]])("maps %s without exposing provider details", async (message, status) => {
    transport.fetch.mockRejectedValue(new Error(message));
    await expect(persistPastoralExchange(input())).rejects.toMatchObject({ status });
    await expect(persistPastoralExchange(input())).rejects.not.toHaveProperty("message", message);
  });
  it("does not call missing success evidence complete", async () => {
    transport.fetch.mockResolvedValue({ replayed: false });
    await expect(persistPastoralExchange(input())).rejects.toMatchObject({ status: 503 });
  });
  it("rejects cross-owner ciphertext before decryption", async () => {
    transport.fetch.mockImplementation(async (_config, _path, init) => {
      const result = resultFor(JSON.parse(init.body).p_command); result.message.owner_user_id = "another-owner"; return result;
    });
    await expect(persistPastoralExchange(input())).rejects.toMatchObject({ status: 404 });
  });
  it("requires a pinned integer privacy revision before authorisation or writes", async () => {
    await expect(applyPastoralMutationForSession({} as LevyTateBetaSession, { action: "set_history_preference", saveHistory: true })).rejects.toMatchObject({ status: 409 });
    await expect(applyPastoralMutationForSession({} as LevyTateBetaSession, { action: "set_history_preference", saveHistory: "false", expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(applyPastoralMutationForSession({} as LevyTateBetaSession, { action: "set_history_preference", saveHistory: true, expectedVersion: 0, retentionDays: 91 })).rejects.toMatchObject({ status: 422 });
    expect(transport.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { organisationId: "another-tenant" }, { message: { text: "not a string" } }, { message: "x".repeat(3001) },
    { draftSupportRequest: "true" }, { recentMessages: [{ author: ["employee"], content: "Synthetic" }] },
    { recentMessages: Array.from({ length: 9 }, () => ({ author: "employee", content: "Synthetic" })) },
  ])("rejects malformed or forged assistant input before context/model access", async (invalid) => {
    await expect(runPastoralAssistant({} as LevyTateBetaSession, { message: "Synthetic", clientMessageId: "synthetic-message", ...invalid })).rejects.toMatchObject({ status: 400 });
    expect(transport.fetch).not.toHaveBeenCalled(); expect(transport.select).not.toHaveBeenCalled();
  });
});
