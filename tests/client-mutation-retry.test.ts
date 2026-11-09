import { describe, expect, it, vi } from "vitest";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";
import { createAuthenticatedClientFetch } from "@/lib/levytate/client-session";
import { decodeFinanceMutationResponse, decodeRequestsMutationResponse } from "@/lib/levytate/client-module-responses";

const identity = () => ({ email: "original@example.invalid", organisationId: "tenant-a" });
const finance = () => ({ ok: true, state: { version: 1, mode: "persistent", transactions: [], imports: [] } });
const requestWorkspace = () => ({ ok: true, workspace: { requestsEnabled: true, organisation: { id: "tenant-a", name: "Synthetic" }, metrics: {}, requests: [], providerOptions: [], programmeOptions: [] } });
const decode = (value: unknown) => decodeRequestsMutationResponse(value, "tenant-a");
const command = () => ({ action: "create_draft", content: { title: "Original fictional brief" }, idempotencyKey: "original-key" });

describe("mounted account and original client command boundary (injected HTTP, no live workflow claim)", () => {
  it("blocks a retained form after the cookie account changes, without sending it under the replacement identity", async () => {
    const original = identity(); let writes = 0;
    const transport = vi.fn(async (_path: string, init?: RequestInit) => {
      if (new Headers(init?.headers).get("X-LevyTate-Account") !== "replacement@example.invalid") return Response.json({ message: "A different account is signed in." }, { status: 409 });
      writes++; return Response.json(requestWorkspace());
    });
    const mutation = createPinnedClientMutation(original, "/api/levytate-requests", decode, createAuthenticatedClientFetch(transport));
    original.email = "replacement@example.invalid"; original.organisationId = "tenant-b";
    await expect(mutation.execute(command())).rejects.toThrow("different account");
    await expect(mutation.retry()).rejects.toThrow("different account");
    expect(writes).toBe(0); expect(mutation.pending).toBe(true);
    expect(transport.mock.calls.every(([, init]) => new Headers(init?.headers).get("X-LevyTate-Account") === "original@example.invalid")).toBe(true);
  });

  it("retains exact nested body and key after a lost committed response, then confirms one receipt", async () => {
    const rows = new Map<string, string>(); const bodies: string[] = [];
    const transport = vi.fn(async (_path: string, init?: RequestInit) => {
      const body = String(init?.body); bodies.push(body);
      const parsed = JSON.parse(body); rows.set(parsed.idempotencyKey, rows.get(parsed.idempotencyKey) ?? body);
      if (bodies.length === 1) throw new TypeError("Synthetic connection lost after commit");
      return Response.json(requestWorkspace());
    });
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, createAuthenticatedClientFetch(transport));
    const input = command(), confirmed = vi.fn();
    await expect(mutation.execute(input, confirmed)).rejects.toThrow();
    input.content.title = "Changed after loss"; input.idempotencyKey = "replacement-key";
    await expect(mutation.execute(input)).rejects.toThrow("original update");
    expect(transport).toHaveBeenCalledTimes(1); expect(confirmed).not.toHaveBeenCalled();
    await mutation.retry();
    expect(bodies).toEqual([JSON.stringify(command()), JSON.stringify(command())]);
    expect(rows.size).toBe(1); expect(confirmed).toHaveBeenCalledTimes(1); expect(mutation.pending).toBe(false);
  });

  it("allows one in-flight command and releases only after valid confirmation", async () => {
    let finish!: (response: Response) => void;
    const transport = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, transport);
    const first = mutation.execute(command());
    expect(mutation.busy).toBe(true); expect(mutation.pending).toBe(true);
    await expect(mutation.execute(command())).rejects.toThrow("original update");
    await expect(mutation.retry()).rejects.toThrow("already in progress");
    expect(transport).toHaveBeenCalledTimes(1);
    finish(Response.json(requestWorkspace())); await first;
    expect(mutation.pending).toBe(false); expect(mutation.busy).toBe(false);
  });

  it.each([400, 401, 403, 409, 422, 429, 503])("retains the original update on HTTP %s", async (status) => {
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, async () => Response.json({ message: "Synthetic rejection" }, { status }));
    await expect(mutation.execute(command())).rejects.toThrow();
    expect(mutation.pending).toBe(true); expect(mutation.busy).toBe(false);
  });

  it.each([null, {}, { ok: true }, { ...requestWorkspace(), workspace: { ...requestWorkspace().workspace, organisation: { id: "tenant-b" } } }])("does not confirm malformed or cross-tenant 200 response", async (value) => {
    const confirmed = vi.fn();
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, async () => Response.json(value));
    await expect(mutation.execute(command(), confirmed)).rejects.toThrow();
    expect(confirmed).not.toHaveBeenCalled(); expect(mutation.pending).toBe(true);
  });

  it("never replays the retained command after refresh resolves another genuine account", async () => {
    const transport = vi.fn(async (path: string) => path === "/api/levytate-auth/session"
      ? Response.json({ identity: { email: "replacement@example.invalid", organisationId: "tenant-b" } })
      : Response.json({}, { status: 401 }));
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, createAuthenticatedClientFetch(transport));
    await expect(mutation.execute(command())).rejects.toThrow("different account");
    expect(transport.mock.calls.map(([path]) => path)).toEqual(["/api/levytate-requests", "/api/levytate-auth/session"]);
    expect(mutation.pending).toBe(true);
  });

  it("refreshes the same account and retries only the explicit unauthorised request unchanged", async () => {
    const posted: string[] = [];
    const transport = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/levytate-auth/session") return Response.json({ identity: identity() });
      posted.push(String(init?.body));
      return posted.length === 1 ? Response.json({}, { status: 401 }) : Response.json(requestWorkspace());
    });
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, createAuthenticatedClientFetch(transport));
    await mutation.execute(command());
    expect(posted).toEqual([JSON.stringify(command()), JSON.stringify(command())]); expect(mutation.pending).toBe(false);
  });

  it("fails closed when the mounted account was unavailable", async () => {
    const transport = vi.fn(); const mutation = createPinnedClientMutation(null, "/api/levytate-requests", decode, transport);
    await expect(mutation.execute(command())).rejects.toThrow("confirm the signed-in account");
    expect(transport).not.toHaveBeenCalled(); expect(mutation.pending).toBe(true);
  });

  it("does not repeat a confirmed mutation when a post-confirmation UI callback fails", async () => {
    const mutation = createPinnedClientMutation(identity(), "/api/levytate-requests", decode, async () => Response.json(requestWorkspace()));
    await expect(mutation.execute(command(), () => { throw new Error("Synthetic UI callback failure"); })).rejects.toThrow();
    expect(mutation.pending).toBe(false); await expect(mutation.retry()).rejects.toThrow("no pending update");
  });

  it("accepts actual persistent Finance responses and rejects illustrative/session state", () => {
    expect(decodeFinanceMutationResponse(finance()).mode).toBe("persistent");
    for (const mode of ["fixture", "session_import", "local_import", "server_import"]) {
      expect(() => decodeFinanceMutationResponse({ ok: true, state: { ...finance().state, mode } })).toThrow();
    }
    expect(() => decodeFinanceMutationResponse({ ok: false, state: finance().state })).toThrow();
  });
});
