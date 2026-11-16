import { beforeEach, describe, expect, it, vi } from "vitest";
import { availablePersonalProgrammes, ownDevelopmentPerson, personalProgrammeChoices, personalProgrammeCommand } from "@/lib/levytate/mvp/programme-discovery";
import { createEmptyMvpWorkspace, normaliseProviderProgramme, normaliseProviderRecord, type MvpEmployee } from "@/lib/levytate/mvp/workspace";
const dependencies = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: dependencies.context }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: dependencies.config, supabaseFetchJson: dependencies.rpc }));
import { personalProgrammeState } from "@/lib/server/levytate-programme-discovery";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
const command = { action: "save", programmeId: "programme-a", requestId: "12345678-1234-4234-8234-123456789abc", expectedRevision: 0 };
const choices = { employeeId: "own-person", savedProgrammeIds: ["programme-a"], comparedProgrammeIds: [], availableProgrammeIds: ["programme-a"], revision: 1 };
const session = { email: "manager@example.test" } as LevyTateBetaSession;
const person = (id: string, email: string) => ({ id, email, status: "Active", roleId: "role-a" }) as MvpEmployee;
beforeEach(() => { vi.resetAllMocks(); dependencies.config.mockReturnValue({}); dependencies.context.mockResolvedValue({ user: { id: "canonical-manager", role: "Line Manager" }, organisation: { id: "canonical-tenant" } }); dependencies.rpc.mockResolvedValue(choices); });
describe("individual programme discovery contracts", () => {
  it("selects the signed-in manager rather than the first direct report", () => {
    const data = createEmptyMvpWorkspace(); data.employees = [person("report", "report@example.test"), person("own", "manager@example.test")];
    expect(ownDevelopmentPerson(data, " MANAGER@example.test ")?.id).toBe("own");
    expect(ownDevelopmentPerson(data, "missing@example.test")).toBeNull();
    data.employees.push(person("ambiguous", "MANAGER@example.test")); expect(ownDevelopmentPerson(data, session.email)).toBeNull();
  });
  it("never displays unselected, unverified or source-free choices and preserves alternatives during an active application", () => {
    const data = createEmptyMvpWorkspace(); data.employees = [person("own", session.email)];
    data.providers = [normaliseProviderRecord({ providerId: "provider", providerName: "Fictional provider", status: "Active", verificationStatus: "verified", sourceUrls: ["https://example.test/provider"], lastVerified: "2026-11-09" })];
    data.providerProgrammes = [normaliseProviderProgramme({ id: "programme-a", providerId: "provider", programmeName: "Fictional pathway", status: "Active", recordStatus: "Active", verificationStatus: "LevyTate reviewed", sourceUrl: "https://example.test/programme", linkedStandardIds: ["synthetic-standard"] })];
    data.organisationProviders = [{ providerId: "provider", status: "Active", selectedAt: "", updatedAt: "" }];
    data.organisationProgrammes = [{ programmeId: "programme-a", providerId: "provider", status: "Active", selectedAt: "", updatedAt: "" }];
    expect(availablePersonalProgrammes(data, session.email)).toHaveLength(1);
    data.applications = [{ id: "active", employeeId: "own", status: "Awaiting Manager Review" }] as typeof data.applications;
    expect(availablePersonalProgrammes(data, session.email)).toHaveLength(1);
    data.providerProgrammes[0].sourceUrl = ""; expect(availablePersonalProgrammes(data, session.email)).toEqual([]);
    data.providerProgrammes[0].sourceUrl = "   "; expect(availablePersonalProgrammes(data, session.email)).toEqual([]);
    data.providerProgrammes[0].sourceUrl = "https://example.test/programme";
    data.providers[0].verificationStatus = "Needs verification" as typeof data.providers[0]["verificationStatus"];
    expect(availablePersonalProgrammes(data, session.email)).toEqual([]);
    data.providers[0].verificationStatus = "verified"; data.organisationProgrammes[0].status = "Inactive";
    expect(availablePersonalProgrammes(data, session.email)).toEqual([]);
  });
  it.each([{ ...command, programmeId: 123 }, { ...command, employeeId: "someone-else" }, { ...command, expectedRevision: 0.1 }, { ...command, action: null }])("rejects caller identity or malformed command %j", (input) => {
    expect(personalProgrammeCommand.safeParse(input).success).toBe(false);
  });
  it("sends only the current canonical actor and exact command", async () => {
    expect(await personalProgrammeState(session, command)).toEqual(choices);
    expect(JSON.parse(dependencies.rpc.mock.calls[0][2].body)).toEqual({ p_actor: "canonical-manager", p_command: command });
  });
  it("reads choices without issuing a write command", async () => {
    await personalProgrammeState(session);
    expect(JSON.parse(dependencies.rpc.mock.calls[0][2].body)).toEqual({ p_actor: "canonical-manager", p_command: null });
  });
  it.each(["Department Head", "Apprenticeship Lead", "Platform Admin"])("does not grant %s another person's discovery choices", async (role) => {
    dependencies.context.mockResolvedValue({ user: { id: "canonical-other", role } });
    await expect(personalProgrammeState(session, command)).rejects.toMatchObject({ status: 403 });
    expect(dependencies.rpc).not.toHaveBeenCalled();
  });
  it.each([["PT403", 403], ["PT409", 409], ["PT422", 422], ["23505", 409], ["private", 503]])("reports %s safely", async (code, status) => {
    dependencies.rpc.mockRejectedValue(new Error(`${code}: secret diagnostic`));
    await expect(personalProgrammeState(session, command)).rejects.toMatchObject({ status });
    await expect(personalProgrammeState(session, command)).rejects.not.toThrow("secret");
  });
  it("does not confirm malformed database results", async () => {
    dependencies.rpc.mockResolvedValue({ ...choices, comparedProgrammeIds: ["a", "b", "c", "d"] });
    await expect(personalProgrammeState(session, command)).rejects.toMatchObject({ status: 503 });
    expect(personalProgrammeChoices.safeParse({ ...choices, revision: "1" }).success).toBe(false);
  });
});
