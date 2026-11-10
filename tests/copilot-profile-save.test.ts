import { describe, expect, it, vi } from "vitest";
import { captureCopilotProfileDraft, persistCopilotProfileDraft } from "@/lib/levytate/copilot-profile-save";
import { createEmployeeDevelopmentProfile } from "@/lib/levytate/mvp/workspace";

const context = { organisationId: "fictional-a", userEmail: "employee@fictional.invalid", mutationRevisions: { "levytate_employee_development_profiles:person-a": 3 } };
describe("Copilot profile persistence (unit, not hosted acceptance)", () => {
  it("pins the account, immutable profile and displayed revision before async work", () => {
    const profile = createEmployeeDevelopmentProfile("person-a");
    const draft = captureCopilotProfileDraft(profile, context);
    profile.preferredStandardId = "subsequent-edit";
    expect(draft).toMatchObject({ actorEmail: context.userEmail, organisationId: context.organisationId, expectedRevision: 3 });
    expect(draft.profile.preferredStandardId).not.toBe("subsequent-edit");
  });
  it("waits for confirmed persistence before reporting success", async () => {
    let complete!: (result: { ok: true }) => void;
    const save = vi.fn(() => new Promise<{ ok: true }>(resolve => { complete = resolve; }));
    const draft = captureCopilotProfileDraft(createEmployeeDevelopmentProfile("person-a"), context);
    let settled = false;
    const pending = persistCopilotProfileDraft(draft, context, save).then(result => { settled = true; return result; });
    await Promise.resolve(); expect(settled).toBe(false); expect(save).toHaveBeenCalledWith(draft.profile, 3);
    complete({ ok: true }); expect(await pending).toEqual({ ok: true });
  });
  it("retains the exact revision through reconnect, failed save and explicit retry", async () => {
    const draft = captureCopilotProfileDraft(createEmployeeDevelopmentProfile("person-a"), context);
    const save = vi.fn().mockResolvedValueOnce({ ok: false, message: "Changed; refresh without overwriting." }).mockResolvedValueOnce({ ok: true });
    const reconnected = { ...context, mutationRevisions: { "levytate_employee_development_profiles:person-a": 9 } };
    expect(await persistCopilotProfileDraft(draft, reconnected, save)).toMatchObject({ ok: false });
    expect(await persistCopilotProfileDraft(draft, reconnected, save)).toEqual({ ok: true });
    expect(save.mock.calls).toEqual([[draft.profile, 3], [draft.profile, 3]]);
  });
  it.each([null, { ...context, organisationId: "fictional-b" }, { ...context, userEmail: "different@fictional.invalid" }])("does not replay another account's retained draft", async current => {
    const save = vi.fn(); const draft = captureCopilotProfileDraft(createEmployeeDevelopmentProfile("person-a"), context);
    expect(await persistCopilotProfileDraft(draft, current, save)).toMatchObject({ ok: false }); expect(save).not.toHaveBeenCalled();
  });
  it("does not convert an uncertain exception into success or expose provider diagnostics", async () => {
    const draft = captureCopilotProfileDraft(createEmployeeDevelopmentProfile("person-a"), context);
    const result = await persistCopilotProfileDraft(draft, context, vi.fn().mockRejectedValue(new Error("private diagnostic")));
    expect(result).toMatchObject({ ok: false }); expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });
});
