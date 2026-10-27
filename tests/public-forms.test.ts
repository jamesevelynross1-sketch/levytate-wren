import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as submitEnquiry } from "@/app/api/levy-transfer-enquiry/route";
import { POST as submitReview } from "@/app/api/opportunity-review/submit/route";
import { sendEmail } from "@/lib/server/resend";

vi.mock("@/lib/server/resend", () => ({
  sendEmail: vi.fn(async () => "test-message"),
}));

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.stubEnv("LEVYTATE_AUTH_RATE_LIMIT_SECRET", "");
  vi.stubEnv("LEVYTATE_BETA_SESSION_SECRET", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

describe("public enquiry forms", () => {
  it("keeps the levy transfer enquiry available to an anonymous visitor", async () => {
    const response = await submitEnquiry(jsonRequest("/api/levy-transfer-enquiry", {
      organisationName: "Example Ltd",
      contactName: "Alex Example",
      email: "alex@example.com",
      telephone: "01234567890",
      employeeNumbers: "50-249",
      levyPayer: "Yes",
      supportInterest: "Levy transfer",
      consent: true,
      hp_field: "",
    }));

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("drops a levy transfer enquiry that trips the honeypot", async () => {
    const response = await submitEnquiry(jsonRequest("/api/levy-transfer-enquiry", {
      organisationName: "Example Ltd",
      contactName: "Alex Example",
      email: "alex@example.com",
      employeeNumbers: "50-249",
      levyPayer: "Yes",
      supportInterest: "Levy transfer",
      consent: true,
      hp_field: "https://spam.example",
    }));
    const body = await response.json() as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an incomplete levy transfer enquiry", async () => {
    const response = await submitEnquiry(jsonRequest("/api/levy-transfer-enquiry", {
      organisationName: "Example Ltd",
    }));

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an opportunity review without consent", async () => {
    const response = await submitReview(jsonRequest("/api/opportunity-review/submit", {
      contact: {
        name: "Alex Example",
        organisation: "Example Ltd",
        email: "alex@example.com",
        consent: false,
      },
    }));

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://mprconsulting.co.uk${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
