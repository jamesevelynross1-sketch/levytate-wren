import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { decodeAssessmentMutationResponse, decodeEvidenceDownload, decodeLearningTimeMutationResponse, decodeLiftMutationResponse } from "@/lib/levytate/client-module-responses";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";

const identity = { email: "synthetic@example.invalid", organisationId: "tenant-a" };
const lift = () => ({ ok: true, workspace: { enabled: true, mutationRevision: 3, generatedAt: "2026-11-09T18:00:00Z", role: "Employee", framework: {}, coverage: {}, availableEmployees: [], opportunities: [], decisions: [], proofs: [] } });
const assessment = () => ({ ok: true, workspace: { generatedAt: "2026-11-09T18:00:00Z", role: "Line Manager", canCompleteOwnAssessments: true, disclosure: {}, questions: [], frameworks: [], assessments: [], campaigns: [], availableEmployees: [], reporting: [] } });
const row = () => ({ id: "10000000-0000-4000-8000-000000000001", organisation_id: "tenant-a" });
const evidence = () => ({ format: "levytate-employer-evidence", version: 1, generatedAt: "2026-11-09T18:00:00Z", organisationId: "tenant-a", metrics: [], sources: [], workforce: {}, finance: { currency: "GBP", label: "£ exact text" } });

describe("client confirmation boundaries for existing optional modules and evidence downloads", () => {
  it("accepts a live Lift receipt and historical assessment workspace", () => {
    expect(decodeLiftMutationResponse(lift()).mutationRevision).toBe(3);
    expect(decodeAssessmentMutationResponse(assessment()).role).toBe("Line Manager");
  });
  it.each([undefined, -1, 0.5, "3"])("rejects a missing or malformed live Lift revision %s", (mutationRevision) => {
    expect(() => decodeLiftMutationResponse({ ...lift(), workspace: { ...lift().workspace, mutationRevision } })).toThrow();
  });
  it("does not confirm an unavailable Lift or incomplete historical assessment response", () => {
    expect(() => decodeLiftMutationResponse({ ...lift(), workspace: { ...lift().workspace, enabled: false } })).toThrow();
    expect(() => decodeAssessmentMutationResponse({ ...assessment(), workspace: { ...assessment().workspace, assessments: null } })).toThrow();
    expect(() => decodeAssessmentMutationResponse({ ...assessment(), workspace: { ...assessment().workspace, role: "Platform Admin" } })).toThrow();
  });
  it.each(["activity", "confirmation", "version", "priority"])("confirms the existing Learning Time %s response only for its original tenant", (kind) => {
    expect(decodeLearningTimeMutationResponse({ [kind]: row() }, "tenant-a")[kind]).toEqual(row());
    expect(() => decodeLearningTimeMutationResponse({ [kind]: row() }, "tenant-b")).toThrow();
  });
  it.each([{}, { activity: null }, { activity: { ...row(), id: "" } }, { activity: row(), priority: row() }, { activity: { id: row().id } }])("rejects ambiguous or unconfirmed Learning Time success", (value) => {
    expect(() => decodeLearningTimeMutationResponse(value, "tenant-a")).toThrow();
  });
  it("freezes Lift revision, answers and key through a lost response and a changed caller object", async () => {
    const bodies: string[] = []; const confirmed = vi.fn();
    const controller = createPinnedClientMutation(identity, "/api/levytate-lift", decodeLiftMutationResponse, async (_path, init) => {
      bodies.push(String(init?.body));
      if (bodies.length === 1) throw new TypeError("Synthetic lost response");
      return Response.json(lift());
    });
    const command = { action: "save_assessment", expectedWorkspaceRevision: 2, expectedRevision: 1, answers: { confidence: "original" }, idempotencyKey: "original" };
    await expect(controller.execute(command, confirmed)).rejects.toThrow();
    command.expectedWorkspaceRevision = 99; command.answers.confidence = "changed";
    await controller.retry();
    expect(bodies[0]).toBe(bodies[1]); expect(JSON.parse(bodies[1]).expectedWorkspaceRevision).toBe(2);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it("preserves exact audited UTF-8 download text through the shared pinned transport", async () => {
    const text = JSON.stringify(evidence(), null, 2) + "\n";
    const confirmed = vi.fn();
    const controller = createPinnedClientMutation(identity, "/api/levytate-employer-insights/export", (value) => decodeEvidenceDownload(value, identity.organisationId),
      async (_path, init, expected) => {
        expect(String(init?.body)).toBe("{}"); expect(expected).toEqual(identity);
        expect(new Headers(init?.headers).get("X-LevyTate-Account")).toBe(identity.email);
        return new Response(text, { headers: { "Content-Type": "application/json" } });
      }, (response) => response.text());
    const result = await controller.execute({}, confirmed);
    expect(result).toBe(text);
    expect(createHash("sha256").update(result).digest("hex")).toBe(createHash("sha256").update(text).digest("hex"));
    expect(confirmed).toHaveBeenCalledWith(text);
  });
  it.each([null, "not json", "{}", JSON.stringify({ ...evidence(), organisationId: "tenant-b" }), JSON.stringify({ ...evidence(), version: 2 })])("never downloads malformed or another tenant's evidence", (value) => {
    expect(() => decodeEvidenceDownload(value, "tenant-a")).toThrow();
  });
});
