import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { personalProgrammeChoices, personalProgrammeCommand } from "@/lib/levytate/mvp/programme-discovery";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export async function personalProgrammeState(session: LevyTateBetaSession, input?: unknown) {
  const parsed = input === undefined ? null : personalProgrammeCommand.safeParse(input);
  if (parsed && !parsed.success) throw new ClientRequestError("Choose a valid programme action and current revision.", 422);
  const context = await getLearnerLifecycleServerContext(session);
  if (!["Employee", "Line Manager"].includes(context.user.role)) throw new ClientRequestError("Personal programme choices belong to individual employees.", 403);
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ClientRequestError("Programme choices are temporarily unavailable.", 503);
  try {
    const result = await supabaseFetchJson<unknown>(config, "rpc/levytate_personal_programme_choices", { method: "POST", body: JSON.stringify({ p_actor: context.user.id, p_command: parsed?.success ? parsed.data : null }) });
    return personalProgrammeChoices.parse(result);
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 5) : "";
    const status = code === "PT403" ? 403 : code === "PT409" || code === "23505" ? 409 : code === "PT422" ? 422 : 503;
    throw new ClientRequestError(status === 409 ? "Your saved choices changed. Inspect the current choices before editing." : "Programme choices could not be confirmed. Retry the original action or inspect the saved state.", status);
  }
}
