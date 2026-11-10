import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normaliseProviderRecord, normaliseProviderProgramme, createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import { parseProvider, parseProgramme, parseRole, parseProfile, parseRelationship, parseMatchingRequest } from "@/lib/server/levytate-catalogue-validation";
import { runCatalogueCommand } from "@/lib/server/levytate-catalogue-commands";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { supabaseDelete } from "@/lib/server/levytate-supabase";
import { assertConfirmedCatalogueResult } from "@/components/levytate-mvp/useCatalogueAction";
const timestamp = "2026-10-29T14:00:00.000Z";
const role = { id: "role-1", title: "Analyst", department: "Data", businessArea: "", careerLevel: "Experienced", skillsTags: [], progression: [], status: "Active", createdAt: timestamp, updatedAt: timestamp,
  pathwayMappings: [{ id: "map-1", apprenticeshipStandardId: "STTEST", recommendationType: "Primary", priority: 1, businessRationale: "", fundingRoute: "Potentially funded through levy/co-investment", deliveryPreference: "Blended" }] };
const provider = () => normaliseProviderRecord({ providerId: "provider-1", providerName: "Fictional provider" });
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fictional-local-key"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("strict catalogue input validation", () => {
  it("requires real source evidence and explicit verification dates", () => {
    expect(provider().lastVerified).toBe("");
    expect(parseProvider(provider()).verificationStatus).toBe("needs_verification");
    expect(() => parseProvider({ ...provider(), verificationStatus: "verified" })).toThrow(/source evidence/);
    expect(parseProvider({ ...provider(), verificationStatus: "verified", sourceUrls: ["https://example.invalid/evidence"], lastVerified: "2026-10-29" }).verificationStatus).toBe("verified");
    expect(() => parseProvider({ ...provider(), lastVerified: "2026-02-30" })).toThrow(/calendar/);
  });
  it("does not accept tenant rebinding or unsafe URLs in a provider payload", () => {
    expect(() => parseProvider({ ...provider(), organisation_id: "other-tenant" })).toThrow();
    expect(() => parseProvider({ ...provider(), website: "javascript:alert(1)" })).toThrow();
    expect(() => parseProvider({ ...provider(), website: "https://private:credential@example.invalid" })).toThrow();
  });
  it("requires one unique primary role mapping and typed fields", () => {
    expect(parseRole(role)).toMatchObject({ title: "Analyst" });
    expect(() => parseRole({ ...role, pathwayMappings: [] })).toThrow();
    expect(() => parseRole({ ...role, pathwayMappings: [role.pathwayMappings[0], role.pathwayMappings[0]] })).toThrow();
    expect(() => parseRole({ ...role, pathwayMappings: [{ ...role.pathwayMappings[0], priority: "1" }] })).toThrow();
    expect(() => parseRole({ ...role, status: null })).toThrow();
  });
  it("requires programme source evidence and coherent primary standard references", () => {
    const programme = normaliseProviderProgramme({ id: "programme-1", providerId: "provider-1", programmeName: "Fictional programme", linkedStandardId: "STTEST", linkedStandardIds: ["STTEST"], createdAt: timestamp, updatedAt: timestamp });
    expect(parseProgramme(programme)).toMatchObject({ linkedStandardId: "STTEST" });
    expect(() => parseProgramme({ ...programme, linkedStandardIds: ["another"] })).toThrow(/primary standard/);
    expect(() => parseProgramme({ ...programme, verificationStatus: "LevyTate reviewed", sourceUrl: "" })).toThrow(/source URL/);
  });
  it("rejects invalid settings, relationships and matching requests", () => {
    expect(() => parseProfile({ ...createEmptyMvpWorkspace().profile, contactEmail: "not-an-email" })).toThrow();
    expect(() => parseRelationship({ id: "r", category: "Digital", preferredProviderId: "p", backupProviderIds: ["p"], programmeIds: [], status: "Preferred", notes: "", reviewDate: "2026-10-29", lastUsedDate: "2026-10-29" })).toThrow(/backup/);
    expect(() => parseMatchingRequest({ id: "match", learnerCount: -1 })).toThrow();
  });
});

describe("catalogue persistence transport", () => {
  it("retains editors for resolved unsuccessful store results, not only rejected promises", () => {
    expect(() => assertConfirmedCatalogueResult({ ok: false, message: "Reconnect this workspace before submitting." })).toThrow(/Reconnect/);
    expect(() => assertConfirmedCatalogueResult(undefined)).toThrow(/not be confirmed/);
    expect(() => assertConfirmedCatalogueResult({ ok: true })).not.toThrow();
  });
  it("requires a matching RPC receipt and sends the authenticated actor/tenant unchanged", async () => {
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockImplementation(async () => Response.json({ id: "role-1" })); vi.stubGlobal("fetch", fetcher);
    await runCatalogueCommand("levytate_save_role", { p_organisation_id: "tenant-a", p_actor_user_id: "actor-a", p_role: { id: "role-1" }, p_mappings: [] });
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({ p_organisation_id: "tenant-a", p_actor_user_id: "actor-a" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "different" })));
    await expect(runCatalogueCommand("levytate_save_role", { p_role: { id: "role-1" } })).rejects.toMatchObject({ status: 503 });
  });
  it.each([["PT403",403],["PT409",409],["PT422",422],["23505",409],["23503",422],["unexpected",503]])("maps %s without leaking provider diagnostics", async (code,status) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, message: "private credential detail" }, { status: 400 })));
    try { await runCatalogueCommand("levytate_select_catalogue", { p_id: "programme" }); throw new Error("Expected rejection"); }
    catch(error) { expect(error).toMatchObject({ status }); expect((error as Error).message).not.toContain("private credential"); }
  });
  it("never describes a failed DELETE as saved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "PT409", message: "Referenced programme" }, { status: 409 })));
    await expect(supabaseDelete({ url: "http://localhost:54321", serviceRoleKey: "fictional" }, "levytate_provider_programmes", "id=eq.test")).rejects.toThrow(/^PT409/);
  });
});

describe("truthful live standards catalogue", () => {
  it("keeps a confirmed empty live catalogue empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([], { headers: { "content-range": "*/0" } })));
    expect(await loadLevyTateStandards()).toEqual({ source: "supabase", counts: { totalRecords: 0, apprenticeshipStandards: 0, approvedForDelivery: 0 }, standards: [] });
  });
  it("reports a failed dependency rather than substituting bundled data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 })));
    expect(await loadLevyTateStandards()).toMatchObject({ source: "unavailable", standards: [] });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await loadLevyTateStandards()).toMatchObject({ source: "unavailable", standards: [] });
  });
  it("does not invent approved status, verification date, version or official URLs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: "STTEST", title: "Fictional", reference_code: "STTEST", status: null, last_verified: null, last_updated: null, version: null, official_url: null }], { headers: { "content-range": "0-0/1" } })));
    const result = await loadLevyTateStandards();
    expect(result.standards[0]).toMatchObject({ status: "Proposed", sourceStatus: "Unknown", lastVerified: "", lastUpdated: "", lastSyncedAt: "", version: "Unknown", officialUrl: "" });
    expect(result.counts.approvedForDelivery).toBe(0);
  });
  it("recognises actual approved data without rewriting its verification history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: "STTEST", title: "Fictional", reference_code: "STTEST", status: "Approved for delivery", last_verified: "2026-10-20", last_updated: "2026-10-18", version: "1.1", official_url: "https://example.invalid/standard" }], { headers: { "content-range": "0-0/1" } })));
    const result = await loadLevyTateStandards();
    expect(result.standards[0]).toMatchObject({ status: "Live", lastVerified: "2026-10-20", lastUpdated: "2026-10-18", version: "1.1" });
    expect(result.counts.approvedForDelivery).toBe(1);
  });
});
