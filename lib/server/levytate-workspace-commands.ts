import type { LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import { workspaceMutationEntity } from "@/lib/levytate/mvp/mutation-revisions";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export async function applyAtomicWorkspaceCommand(organisationId: string, actorUserId: string, mutation: LevyTateWorkspaceMutation, record: Record<string, unknown>) {
  const entityKey = workspaceMutationEntity(mutation, organisationId), revision = mutation.expectedRevision;
  if (!entityKey || !Number.isSafeInteger(revision) || (revision as number) < 0) throw new ClientRequestError("Refresh this workspace before saving. Your input has been kept.", 409);
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ClientRequestError("Workspace persistence is unavailable.", 503);
  try {
    const result = await supabaseFetchJson<{ entityKey: string; revision: number }>(config, "rpc/levytate_workspace_command", { method:"POST", body:JSON.stringify({
      p_organisation_id:organisationId,p_actor_user_id:actorUserId,p_action:mutation.type,p_entity_id:entityKey.slice(entityKey.indexOf(":")+1),p_expected_revision:revision,p_record:record,
    }) });
    if (result?.entityKey !== entityKey || !Number.isSafeInteger(result.revision) || result.revision <= (revision as number)) throw new ClientRequestError("The atomic save receipt was not confirmed. Keep your input and retry.",503);
    return result;
  } catch (error) {
    if (error instanceof ClientRequestError) throw error;
    const code=error instanceof Error?error.message:"";
    if (/^(PT403|42501)/.test(code)) throw new ClientRequestError("This workspace action is not allowed.",403);
    if (code.startsWith("PT404")) throw new ClientRequestError("This record is no longer available in your workspace.",404);
    if (/^(PT409|23505|40001|40P01)/.test(code)) throw new ClientRequestError("This record changed. Refresh before retrying; your input has been kept.",409);
    if (/^(PT422|23514|23503|22)/.test(code)) throw new ClientRequestError("Check the record details and current references. No partial save was applied.",422);
    throw new ClientRequestError("The atomic save could not be confirmed. Keep your input and retry.",503);
  }
}
