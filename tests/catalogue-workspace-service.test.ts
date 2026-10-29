import { beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ select: vi.fn(), all: vi.fn(), insert: vi.fn(), update: vi.fn(), remove: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", async (original) => ({ ...await original<typeof import("@/lib/server/levytate-supabase")>(),
  getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "fictional" }), supabaseSelect: transport.select,
  supabaseSelectAll: transport.all, supabaseInsert: transport.insert, supabaseUpdate: transport.update, supabaseDelete: transport.remove, supabaseFetchJson: transport.rpc,
}));
vi.mock("@/lib/server/levytate-prospect-access", () => ({ getProspectAccessForSession: async () => null }));
vi.mock("@/lib/server/levytate-early-access", () => ({ getEarlyAccessRequestByEmail: async () => null }));
vi.mock("@/lib/server/levytate-beta-access-grants", () => ({ getPersistentEarlyAccessState: async () => "approved" }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getOrganisationLearnerLifecycleCollectionsForWorkspace: async () => null }));
import { applyWorkspaceMutationForSession } from "@/lib/server/levytate-workspace";
import { normaliseProviderRecord, normaliseProviderProgramme } from "@/lib/levytate/mvp/workspace";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

const user = { id: "actor-1", organisation_id: "actor-org", email: "fictional@example.invalid", role: "Platform Admin", active: true, auth_subject: "fictional-subject" };
const org = { id: "actor-org", name: "Fictional employer", slug: "actor-workspace", workspace_name: "Fictional workspace", primary_contact: "Fictional contact", contact_email: user.email, status: "Active", sites: [], departments: [], priorities: [] };
const canonical = { ...org, id: "canonical-org", slug: "levytate-internal" };
const platform: LevyTateBetaSession = { email: user.email, accessLevel: "beta_admin", issuedAt: 0, expiresAt: 9999999999 };
const client: LevyTateBetaSession = { ...platform, accessLevel: "beta_user", authMode: "supabase_email", authSubject: user.auth_subject };
beforeEach(() => {
  vi.clearAllMocks(); user.role = "Platform Admin";
  transport.all.mockResolvedValue([]);
  transport.select.mockImplementation(async (_config, table, query: URLSearchParams) => {
    if (table === "levytate_users") return [user];
    if (table === "levytate_organisations") return [query.get("slug") === "eq.levytate-internal" ? canonical : org];
    if (table === "levytate_apprenticeship_standards") return [{ id: "STTEST", title: "Official source title", level: 4, route: "Digital", funding_band: 15000, official_url: "https://example.invalid/official" }];
    return [];
  });
  transport.insert.mockImplementation(async (_config, _table, rows) => rows);
  transport.rpc.mockImplementation(async (_config, _path: string, init: RequestInit) => { const body = JSON.parse(init.body as string); const table=({saveProvider:"levytate_providers",saveProviderProgramme:"levytate_provider_programmes",saveRole:"levytate_roles",saveOrganisationProgramme:"levytate_organisation_programmes"} as Record<string,string>)[body.p_action];return {entityKey:`${table}:${body.p_entity_id}`,revision:body.p_expected_revision+1}; });
});
describe("actual workspace catalogue mutation service (transport isolated)", () => {
  it("allows Platform Admin without People and delegates canonical targeting to the atomic command", async () => {
    await applyWorkspaceMutationForSession(platform, { type: "saveProvider", expectedRevision:0, provider: normaliseProviderRecord({ providerId: "provider-1", providerName: "Fictional provider" }) });
    const command=JSON.parse(transport.rpc.mock.calls[0][2].body);
    expect(command).toMatchObject({p_organisation_id:org.id,p_action:"saveProvider",p_record:{provider_id:"provider-1",last_verified:null}});
    expect(command.p_record).not.toHaveProperty("organisation_id");
    expect(transport.insert.mock.calls.some((item)=>item[1]==="levytate_providers")).toBe(false);
    expect(transport.insert.mock.calls.filter((item) => item[1] === "levytate_employees")).toHaveLength(0);
  });
  it.each(["Employer Admin", "Apprenticeship Lead", "Line Manager", "Employee"])("denies %s global catalogue writes before persistence", async (role) => {
    user.role = role;
    await expect(applyWorkspaceMutationForSession(client, { type: "saveProvider", provider: normaliseProviderRecord({ providerId: "provider-1", providerName: "Fictional" }) })).rejects.toThrow(/Only Platform Admin/);
    expect(transport.insert.mock.calls.some((item) => item[1] === "levytate_providers")).toBe(false);
  });
  it("derives funding and title from the current official standard rather than the submitted programme", async () => {
    const programme = normaliseProviderProgramme({ id: "programme-1", providerId: "provider-1", programmeName: "Fictional programme", linkedStandardId: "STTEST", linkedStandardIds: ["STTEST"], linkedStandardName: "Forged title", level: 2, fundingBand: 1 });
    await applyWorkspaceMutationForSession(platform, { type: "saveProviderProgramme", expectedRevision:0, programme });
    expect(JSON.parse(transport.rpc.mock.calls[0][2].body).p_record).toMatchObject({linked_standard_name: "Official source title", level: 4, funding_band: 15000 });
  });
  it("saves a role through exactly one transaction with no standalone mapping DELETE", async () => {
    user.role = "Apprenticeship Lead";
    const timestamp = "2026-10-29T14:00:00.000Z";
    await applyWorkspaceMutationForSession(client, { type: "saveRole", expectedRevision:0, role: { id: "role-1", title: "Fictional role", department: "Data", businessArea: "", careerLevel: "Experienced", skillsTags: [], progression: [], status: "Active", createdAt: timestamp, updatedAt: timestamp,
      pathwayMappings: [{ id: "map-1", apprenticeshipStandardId: "STTEST", recommendationType: "Primary", priority: 1, businessRationale: "", fundingRoute: "Potentially funded through levy/co-investment", deliveryPreference: "Blended" }] } });
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    const body = JSON.parse(transport.rpc.mock.calls[0][2].body);
    expect(body).toMatchObject({ p_organisation_id: org.id, p_actor_user_id: user.id });
    expect(transport.remove).not.toHaveBeenCalled();
    expect(transport.insert.mock.calls.some((item) => ["levytate_roles", "levytate_role_pathway_mappings"].includes(item[1]))).toBe(false);
  });
  it("selects a programme through one authoritative tenant transaction, not sequential provider/programme calls", async () => {
    user.role = "Apprenticeship Lead";
    await applyWorkspaceMutationForSession(client, { type: "saveOrganisationProgramme", expectedRevision:0, selection: { programmeId: "programme-1", providerId: "provider-1", status: "Active", selectedAt: "2026-10-29T14:00:00Z", updatedAt: "2026-10-29T14:00:00Z" } });
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toMatchObject({ p_organisation_id: org.id, p_actor_user_id: user.id, p_action:"saveOrganisationProgramme",p_entity_id:"programme-1",p_record:{provider_id:"provider-1",status:"Active"} });
    expect(transport.insert.mock.calls.some((item) => ["levytate_organisation_providers", "levytate_organisation_programmes"].includes(item[1]))).toBe(false);
  });
});
