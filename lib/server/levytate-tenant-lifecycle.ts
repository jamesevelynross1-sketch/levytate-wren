import { z } from "zod";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

const suspensionInput = z.strictObject({
  action: z.literal("suspend_workspace"), organisationId: z.uuid(), reason: z.string().trim().min(10).max(1000), requestId: z.uuid(),
});
export type TenantSuspensionResult = { organisationId: string; status: "Suspended"; membershipsRevoked: number; suspendedAt: string };

export async function suspendClientTenant(session: LevyTateBetaSession, input: Record<string, unknown>): Promise<TenantSuspensionResult> {
  const parsed = suspensionInput.safeParse(input);
  if (!parsed.success) throw new ClientRequestError("Select the employer and give a suspension reason of 10–1000 characters.", 400);
  const actor = await getLearnerLifecycleServerContext(session);
  if (actor.user.role !== "Platform Admin") throw new ClientRequestError("Only Platform Admin can suspend an employer.", 403);
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ClientRequestError("Workspace administration is temporarily unavailable.", 503);
  let result: TenantSuspensionResult;
  try {
    result = await supabaseFetchJson<TenantSuspensionResult>(config, "rpc/levytate_suspend_client_tenant", {
      method: "POST", body: JSON.stringify({ p_organisation_id: parsed.data.organisationId, p_actor_user_id: actor.user.id, p_reason: parsed.data.reason, p_request_id: parsed.data.requestId }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PT403")) throw new ClientRequestError("This workspace action is not allowed.", 403);
    if (message.startsWith("PT404")) throw new ClientRequestError("Client workspace not found.", 404);
    if (message.startsWith("PT409") || message.startsWith("23505")) throw new ClientRequestError("The workspace or request changed. Refresh before continuing.", 409);
    if (message.startsWith("PT422")) throw new ClientRequestError("Check the workspace and suspension reason.", 422);
    throw new ClientRequestError("Suspension could not be confirmed. Refresh before retrying the same request.", 503);
  }
  if (!result || result.organisationId !== parsed.data.organisationId || result.status !== "Suspended" || !Number.isSafeInteger(result.membershipsRevoked)) {
    throw new ClientRequestError("Suspension could not be confirmed. Refresh before retrying the same request.", 503);
  }
  return result;
}
