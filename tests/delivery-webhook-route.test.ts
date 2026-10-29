import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ verify: vi.fn(), event: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/server/levytate-auth-email-delivery", () => ({
  AuthenticationEmailDeliveryError: class extends Error { constructor(readonly code: string) { super(code); } },
  processResendDeliveryWebhook: fake.verify, recordWebhookSecurityEvent: fake.event, resendWebhookMaxBytes: 100,
}));
vi.mock("@/lib/server/levytate-auth-rate-limit", () => ({ checkDeliveryWebhookLimit: fake.rate }));
import { POST } from "@/app/api/levytate-auth/delivery-events/resend/route";
import { AuthenticationEmailDeliveryError } from "@/lib/server/levytate-auth-email-delivery";
const request = (body: string, extra: Record<string, string> = {}) => new Request("https://candidate.vercel.app/api/levytate-auth/delivery-events/resend", { method: "POST", headers: { "content-type": "application/json", "svix-id": "synthetic-webhook", ...extra }, body });
beforeEach(() => { vi.resetAllMocks(); fake.rate.mockResolvedValue({ allowed: true }); fake.verify.mockResolvedValue({ inserted: true }); fake.event.mockResolvedValue(undefined); });
describe("signed delivery webhook boundary (mocked provider signature service)", () => {
  it("does not require browser Origin and forwards exact signed text", async () => {
    const body = ' { "type": "email.delivered" }\n';
    expect((await POST(request(body))).status).toBe(200);
    expect(fake.verify).toHaveBeenCalledWith(body, expect.any(Headers));
  });
  it("rejects actual oversized bytes before rate store or signature verification", async () => {
    expect((await POST(request("x".repeat(101), { "content-length": "1" }))).status).toBe(413);
    expect(fake.rate).not.toHaveBeenCalled(); expect(fake.verify).not.toHaveBeenCalled();
  });
  it("retains signature rejection even if security logging is unavailable", async () => {
    fake.verify.mockRejectedValueOnce(new AuthenticationEmailDeliveryError("invalid_signature", "invalid"));
    fake.event.mockRejectedValueOnce(new Error("private logging detail"));
    expect((await POST(request("{}"))).status).toBe(401);
  });
  it("bounds webhook abuse and fails closed on unavailable controls", async () => {
    fake.rate.mockResolvedValueOnce({ allowed: false });
    expect((await POST(request("{}"))).status).toBe(429);
    fake.rate.mockRejectedValueOnce(new Error("unavailable"));
    expect((await POST(request("{}"))).status).toBe(503);
    expect(fake.verify).not.toHaveBeenCalled();
  });
});
