import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { employerDeliveryActionSchema, providerDeliverySubmitSchema } from "@/lib/levytate/provider-delivery";

const id = "68fa3322-dfad-4a64-bb5b-8479c0f2e7c1";
const key = "7de79dd9-5909-47b7-817a-25bc5a5c4f8d";
const learner = {
  kind: "learner_progress", organisationId: id, targetId: "learner-123", idempotencyKey: key,
  payload: { reportDate: "2026-11-23", actualProgressPercentage: 45, summary: "Provider reviewed progress.", nextReviewDate: "2027-01-20" },
};
describe("provider delivery evidence boundaries", () => {
  it("accepts bounded factual learner progress proposals", () => {
    expect(providerDeliverySubmitSchema.parse(learner).kind).toBe("learner_progress");
  });
  it("cannot submit invalid percentages, dates or extra private fields", () => {
    for (const changes of [
      { payload: { ...learner.payload, actualProgressPercentage: 101 } },
      { payload: { ...learner.payload, reportDate: "2026-02-30" } },
      { payload: { ...learner.payload, nextReviewDate: "2025-01-01" } },
      { payload: { ...learner.payload, employeeName: "Should not be submitted" } },
      { kind: "wrong_kind" },
      { organisationId: "other-tenant" },
      { payload: { ...learner.payload, summary: "x".repeat(1201) } },
    ]) expect(providerDeliverySubmitSchema.safeParse({ ...learner, ...changes }).success).toBe(false);
  });
  it("validates provider programme reports without allowing standards/catalogue edits", () => {
    const proposal = { kind: "programme_note", organisationId: id, targetId: "programme-1", idempotencyKey: key,
      payload: { reportDate: "2026-11-23", deliveryNote: "Planned intake in January.", capacityStatus: "limited" } };
    expect(providerDeliverySubmitSchema.safeParse(proposal).success).toBe(true);
    expect(providerDeliverySubmitSchema.safeParse({ ...proposal, payload: { ...proposal.payload, fundingBand: 10000 } }).success).toBe(false);
  });
  it("requires a non-negative learner revision when the employer supplies one", () => {
    expect(employerDeliveryActionSchema.safeParse({action:"review",updateId:key,decision:"accepted",expectedLearnerRevision:3}).success).toBe(true);
    expect(employerDeliveryActionSchema.safeParse({action:"review",updateId:key,decision:"accepted",expectedLearnerRevision:-1}).success).toBe(false);
    expect(employerDeliveryActionSchema.safeParse({action:"review",updateId:key,decision:"accepted",expectedLearnerRevision:"3"}).success).toBe(false);
    expect(employerDeliveryActionSchema.safeParse({action:"review",updateId:key,decision:"rejected",expectedLearnerRevision:null}).success).toBe(true);
  });
  it("allows only explicit employer grant or accept/reject decisions", () => {
    expect(employerDeliveryActionSchema.parse({ action: "grant", providerId: "qa", enabled: true }).action).toBe("grant");
    expect(employerDeliveryActionSchema.parse({ action: "review", updateId: key, decision: "accepted" }).action).toBe("review");
    expect(employerDeliveryActionSchema.safeParse({ action: "review", updateId: key, decision: "approve-and-modify-learner" }).success).toBe(false);
    expect(employerDeliveryActionSchema.safeParse({ action: "grant", providerId: "qa", enabled: true, organisationId: id }).success).toBe(false);
  });
  it("provider Core session validation is not hard-wired to optional Requests", () => {
    const source = readFileSync(new URL("../lib/server/levytate-provider-auth.ts", import.meta.url), "utf8");
    const sessionBlock = source.split("export async function readAuthorisedLevyTateProviderSession")[1]
      ?.split("async function hasProviderWorkspaceAccess")[0];
    expect(sessionBlock).toContain("hasProviderWorkspaceAccess(membership)");
    expect(sessionBlock).not.toContain("hasCapabilityEnabledInvitation(membership)");
    expect(source).toContain("if (await providerHasDeliveryAccess(membership.provider_id)) return true;");
    expect(source).toContain("return hasCapabilityEnabledInvitation(membership);");
  });
});
