import type { MvpEmployeeDevelopmentProfile } from "@/lib/levytate/mvp/workspace";

type ProfileContext = { organisationId: string; userEmail: string; mutationRevisions?: Record<string, number> };
export type CopilotProfileDraft = {
  profile: MvpEmployeeDevelopmentProfile;
  organisationId: string;
  actorEmail: string;
  expectedRevision: number;
  successMessage: string;
};
type SaveResult = { ok: true } | { ok: false; message: string };

/** Pin the displayed profile version and account before asynchronous generation.
 * Reconnecting must not silently rebase old text onto a newer profile revision.
 */
export function captureCopilotProfileDraft(profile: MvpEmployeeDevelopmentProfile, context: ProfileContext, successMessage = "Development conversation saved."): CopilotProfileDraft {
  return {
    profile: structuredClone(profile), organisationId: context.organisationId, actorEmail: context.userEmail,
    expectedRevision: context.mutationRevisions?.[`levytate_employee_development_profiles:${profile.employeeId}`] ?? 0,
    successMessage,
  };
}

/** Returns success only after the workspace has confirmed persistence. Retrying
 * uses the identical draft/revision and never calls the generation service.
 */
export async function persistCopilotProfileDraft(draft: CopilotProfileDraft, context: ProfileContext | null, save: (profile: MvpEmployeeDevelopmentProfile, expectedRevision?: number) => Promise<SaveResult>): Promise<SaveResult> {
  if (!context || context.organisationId !== draft.organisationId || context.userEmail !== draft.actorEmail) {
    return { ok: false, message: "The signed-in account changed. This draft has not been saved." };
  }
  try { return await save(draft.profile, draft.expectedRevision); }
  catch { return { ok: false, message: "The profile save could not be confirmed. Your draft is kept; retry the same save." }; }
}
