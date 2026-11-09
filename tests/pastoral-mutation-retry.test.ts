import { describe, expect, it, vi } from "vitest";
import { createPastoralMutationRetry, postPastoralMutation } from "@/lib/levytate/pastoral/mutation-retry";

const command = () => ({ action: "create_support_action", requestId: "synthetic-request", idempotencyKey: "original-request-key", summary: "Fictional agreed action", expectedLockVersion: 4 });
const workspace = { accessMode: "employee", generatedAt: "2026-11-09T18:00:00.000Z", requests: [], conversations: [], recipients: [] };

describe("support update retries (real client logic, injected transport; no live human loop)", () => {
  it("reuses the entire original body after a lost response without running confirmation early", async () => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError("Synthetic lost response")).mockResolvedValueOnce(undefined);
    const confirmed = vi.fn();
    const retry = createPastoralMutationRetry(send);
    const submitted = command();
    expect((await retry.run(submitted, confirmed)).status).toBe("pending");
    expect(retry.pending).toBe(true); expect(retry.busy).toBe(false); expect(confirmed).not.toHaveBeenCalled();
    submitted.summary = "Changed form text"; submitted.expectedLockVersion = 5; submitted.idempotencyKey = "new-key";
    expect((await retry.run()).status).toBe("confirmed");
    expect(send.mock.calls[1][0]).toBe(send.mock.calls[0][0]);
    expect(JSON.parse(send.mock.calls[1][0])).toMatchObject({ summary: "Fictional agreed action", expectedLockVersion: 4, idempotencyKey: "original-request-key" });
    expect(confirmed).toHaveBeenCalledTimes(1); expect(retry.pending).toBe(false);
    expect((await retry.run()).status).toBe("idle");
  });
  it("refuses a replacement update or double-click while an earlier request is uncertain", async () => {
    let reject!: (reason: Error) => void;
    const send = vi.fn(() => new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; }));
    const retry = createPastoralMutationRetry(send);
    const first = retry.run(command());
    expect(retry.busy).toBe(true);
    expect((await retry.run(command())).status).toBe("busy");
    expect((await retry.run()).status).toBe("busy");
    reject(new Error("Synthetic timeout")); await first;
    expect((await retry.run({ ...command(), summary: "A different action" })).status).toBe("blocked");
    expect(send).toHaveBeenCalledTimes(1); expect(retry.pending).toBe(true);
  });
  it.each([401, 403, 409, 422, 429, 503])("keeps the original request after HTTP %s until confirmed or the page is reloaded", async (status) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ message: "Synthetic unavailable result" }, { status })).mockResolvedValueOnce(Response.json({ workspace }));
    const confirmed = vi.fn();
    const retry = createPastoralMutationRetry(async (body) => { await postPastoralMutation(body, transport); });
    expect((await retry.run(command(), confirmed)).status).toBe("pending");
    expect(confirmed).not.toHaveBeenCalled();
    expect((await retry.run()).status).toBe("confirmed");
    expect(transport.mock.calls[0][1]?.body).toBe(transport.mock.calls[1][1]?.body);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { workspace: {} }, { workspace: { ...workspace, requests: null } }, { workspace: { ...workspace, generatedAt: "invalid" } }])("does not accept malformed HTTP 200 confirmation %j", async (result) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(result));
    const retry = createPastoralMutationRetry(async (body) => { await postPastoralMutation(body, transport); });
    expect((await retry.run(command())).status).toBe("pending");
    expect(retry.pending).toBe(true);
  });
  it("keeps the pending update when a proxy returns non-JSON HTML", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>Unavailable</html>", { status: 200 }));
    const retry = createPastoralMutationRetry(async (body) => { await postPastoralMutation(body, transport); });
    expect((await retry.run(command())).status).toBe("pending");
  });
  it("releases the queue only after confirmation, allowing a deliberately new command", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const retry = createPastoralMutationRetry(send);
    await retry.run(command());
    await retry.run({ ...command(), idempotencyKey: "deliberately-new-key" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).not.toBe(send.mock.calls[1][0]);
  });
});
