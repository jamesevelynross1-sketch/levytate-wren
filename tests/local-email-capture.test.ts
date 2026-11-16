import { describe, expect, it, vi } from "vitest";
// @ts-expect-error local-only JavaScript test harness, never application code
import { captureCredential, createLocalEmailCapture } from "../scripts/release-local-email-capture.mjs";

const email = "release.synthetic.a.provider@example.test";
const message = { from: "LevyTate <hello@levytate.co.uk>", to: email, subject: "Synthetic opportunity", text: "Local capture only", html: "<p>Local capture only</p>" };
const request = (body = message, key = "synthetic-send") => ({ method: "POST", headers: { Authorization: `Bearer ${captureCredential}`, "Idempotency-Key": key }, body: JSON.stringify(body) });
describe("local email capture boundary (injected SMTP, no external delivery)", () => {
  it("requires exact fictional recipients before installing interception", () => {
    expect(() => createLocalEmailCapture({ transport: vi.fn(), deliver: vi.fn(), recipients: ["unapproved@example.com"] })).toThrow();
  });
  it("captures actual payload once across concurrent retries and rejects a changed key payload", async () => {
    const transport = vi.fn(), deliver = vi.fn(async () => undefined);
    const capture = createLocalEmailCapture({ transport, deliver, recipients: [email] });
    const responses = await Promise.all([capture("https://api.resend.com/emails", request()), capture("https://api.resend.com/emails", request())]);
    expect((await responses[0].json()).id).toBe((await responses[1].json()).id);
    expect(deliver).toHaveBeenCalledExactlyOnceWith(message); expect(transport).not.toHaveBeenCalled();
    expect((await capture("https://api.resend.com/emails", request({ ...message, subject: "Changed" }))).status).toBe(409);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
  it.each(["https://api.resend.com/emails?extra=1", "https://api.openai.com/v1/responses", "https://example.com", "http://localhost.evil.test"])("blocks external destination %s without fallback", async (url) => {
    const transport = vi.fn(), deliver = vi.fn(); const capture = createLocalEmailCapture({ transport, deliver, recipients: [email] });
    await expect(capture(url, request())).rejects.toThrow(); expect(transport).not.toHaveBeenCalled(); expect(deliver).not.toHaveBeenCalled();
  });
  it.each([{ to: "different@example.test" }, { to: [email] }, { cc: "unapproved@example.com" }, { subject: "header\r\nBcc: unapproved@example.com" }, { text: "x".repeat(70000) }])("rejects unintended recipients, extra envelopes, injection and oversize", async (patch) => {
    const transport = vi.fn(), deliver = vi.fn(); const capture = createLocalEmailCapture({ transport, deliver, recipients: [email] });
    await expect(capture("https://api.resend.com/emails", request({ ...message, ...patch } as typeof message))).rejects.toThrow(); expect(deliver).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });
  it("fails closed on SMTP failure and never falls back to the real provider", async () => {
    const transport = vi.fn(), deliver = vi.fn(async () => { throw new Error("local failure"); }); const capture = createLocalEmailCapture({ transport, deliver, recipients: [email] });
    await expect(capture("https://api.resend.com/emails", request())).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it("preserves only loopback requests and prevents redirect escape", async () => {
    const transport = vi.fn(async () => Response.json({ ok: true })); const capture = createLocalEmailCapture({ transport, deliver: vi.fn(), recipients: [email] });
    await capture("http://127.0.0.1:54321/rest/v1/levytate_users", { method: "GET" });
    expect(transport).toHaveBeenCalledWith("http://127.0.0.1:54321/rest/v1/levytate_users", { method: "GET", redirect: "error" });
  });
});
