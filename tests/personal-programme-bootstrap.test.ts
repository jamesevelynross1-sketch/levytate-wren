import { beforeEach, describe, expect, it, vi } from "vitest";
import { availablePersonalProgrammes } from "@/lib/levytate/mvp/programme-discovery";
import type { MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";
const source = vi.hoisted(() => ({ role: "Employee", select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseSelect: source.select, supabaseSelectAll: source.select, supabaseInsert: vi.fn(), supabaseUpdate: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getOrganisationLearnerLifecycleCollectionsForWorkspace: async () => null }));
vi.mock("@/lib/server/levytate-request-capability", () => ({ isRequestsEnabledForOrganisation: async () => false }));
vi.mock("@/lib/server/levytate-application-workflow-capability", () => ({ isApplicationWorkflowsEnabledForOrganisation: async () => false }));
vi.mock("@/lib/server/levytate-off-the-job-capability", () => ({ isOffTheJobAssistantEnabledForOrganisation: async () => false }));
vi.mock("@/lib/server/levytate-lift-capability", () => ({ isLiftEnabledForOrganisation: async () => false }));
import { getWorkspaceBootstrapForMicrosoftCopilotActor } from "@/lib/server/levytate-workspace";

const email = "own@example.invalid", at = "2026-11-09T19:00:00Z";
function actor(role: "Employee" | "Line Manager") { return { organisationId: "tenant-a", organisationName: "Fictional tenant", userId: "own-user", email, role, tenantId: "synthetic-external-tenant", objectId: "synthetic-object", identityId: "synthetic-binding" }; }
beforeEach(() => {
  source.select.mockReset();
  source.select.mockImplementation(async (_config, table: string, query: URLSearchParams) => {
    if (table === "levytate_users") return [{ id: "own-user", organisation_id: "tenant-a", email, role: source.role, active: true, access_level: "beta_user" }];
    if (table === "levytate_organisations") return [{ id: query.get("slug") ? "catalogue" : "tenant-a", name: "Fictional tenant", slug: query.get("slug") ? "levytate-internal" : "fictional", status: "Active" }];
    if (table === "levytate_employees") return [{ id: "own", employee_number: "own", name: "Fictional own person", email, job_title: "Synthetic role", role_id: "role", manager_id: "", department: "Test", site: "Test", platform_role: source.role, status: "Active", start_date: "", created_at: at, updated_at: at }];
    if (table === "levytate_roles") return [{ id: "role", title: "Synthetic role", status: "Active", department: "Test", career_level: "Manager", skills_tags: [], progression: [], created_at: at, updated_at: at }];
    if (table === "levytate_role_pathway_mappings") return [{ id: "mapping", role_id: "role", apprenticeship_standard_id: "ST0118", recommendation_type: "Primary", priority: 1, business_rationale: "Fictional role mapping", funding_route: "Potentially levy-funded", delivery_preference: "Blended" }];
    if (table === "levytate_providers") return [{ provider_id: "provider", provider_name: "Fictional provider", status: "Active", verification_status: "verified", last_verified: "2026-11-09", source_urls: ["https://evidence.example.invalid/internal-provider"], contact_email: "private@example.invalid" }];
    if (table === "levytate_provider_programmes") return [{ id: "programme", provider_id: "provider", programme_name: "Fictional programme", status: "Active", record_status: "Active", verification_status: "LevyTate reviewed", linked_standard_id: "ST0118", linked_standard_ids: ["ST0118"], source_url: "https://evidence.example.invalid/internal-programme", created_at: at, updated_at: at }];
    if (table === "levytate_organisation_providers") return [{ provider_id: "provider", status: "Active", selected_at: at, updated_at: at }];
    if (table === "levytate_organisation_programmes") return [{ programme_id: "programme", provider_id: "provider", status: "Active", selected_at: at, updated_at: at }];
    return [];
  });
});

describe("actual shared scoped-bootstrap catalogue feeding personal discovery", () => {
  it.each(["Employee", "Line Manager"] as const)("shows an authoritative verified choice for %s despite deliberate provenance redaction", async role => {
    source.role = role;
    // This real read-only bootstrap uses the same loader/projection as the app.
    // Database transport is stubbed with fictional rows; no Auth claim is made.
    const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor(role));
    expect(data.providers[0].sourceUrls).toEqual([]); expect(data.providers[0].contactEmail).toBe("");
    expect(data.providerProgrammes[0].sourceUrl).toBe("");
    expect(availablePersonalProgrammes(data, email, ["programme"]).map(item => item.programme.id)).toEqual(["programme"]);
    expect(availablePersonalProgrammes(data, email, ["programme"])[0].mapping?.apprenticeshipStandardId).toBe("ST0118");
    expect(availablePersonalProgrammes(data, email)).toEqual([]);
    expect(availablePersonalProgrammes(data, email, [])).toEqual([]);
    expect(availablePersonalProgrammes(data, email, ["another-programme"])).toEqual([]);
  });

  it.each([
    ["archived person", data => { data.employees[0].status = "Archived"; }],
    ["inactive provider selection", data => { data.organisationProviders[0].status = "Inactive"; }],
    ["inactive programme selection", data => { data.organisationProgrammes[0].status = "Inactive"; }],
    ["archived provider", data => { data.providers[0].status = "Archived"; }],
    ["unverified provider", data => { data.providers[0].verificationStatus = "needs_verification"; }],
    ["undated provider verification", data => { data.providers[0].lastVerified = ""; }],
    ["paused programme", data => { data.providerProgrammes[0].status = "Paused"; }],
    ["archived programme", data => { data.providerProgrammes[0].recordStatus = "Archived"; }],
    ["unverified programme", data => { data.providerProgrammes[0].verificationStatus = "Needs manual verification"; }],
    ["missing standard links", data => { data.providerProgrammes[0].linkedStandardIds = []; }],
  ] satisfies Array<[string, (data: MvpWorkspaceData) => void]>)("still denies %s when the server availability list contains its ID", async (_label, invalidate) => {
    source.role = "Employee";
    const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor("Employee"));
    invalidate(data);
    expect(availablePersonalProgrammes(data, email, ["programme"])).toEqual([]);
  });
});
