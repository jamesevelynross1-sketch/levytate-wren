import { createHash } from "node:crypto";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export class ApplicationCommandError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "ApplicationCommandError"; }
}

export type ApplicationCommand = {
  applicationId: string;
  action: "save_draft" | "save_and_submit" | "submit" | "approve" | "continue" | "decline" | "request_information" | "resubmit" | "withdraw";
  expectedRevision: number;
  idempotencyKey?: string;
  fields?: { employeeId?: string; apprenticeshipStandardId?: string; reason?: string; careerGoal?: string; supportRequired?: string; note?: string; expectedLockVersion?: number };
};

export async function applyApplicationCommand<T>(organisationId: string, actorUserId: string, command: ApplicationCommand): Promise<T> {
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) throw new ApplicationCommandError("Refresh the application before trying again.", 409);
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ApplicationCommandError("Application persistence is unavailable.", 503);
  // A retry of the same actor/revision/content has the same key, including after
  // a lost response or browser refresh. The DB also compares the full command.
  const idempotencyKey = command.idempotencyKey ?? createHash("sha256").update(JSON.stringify({ organisationId, actorUserId, ...command })).digest("hex");
  try {
    return await supabaseFetchJson<T>(config, "rpc/levytate_apply_application_command", {
      method: "POST",
      body: JSON.stringify({ p_organisation_id: organisationId, p_actor_user_id: actorUserId, p_application_id: command.applicationId,
        p_action: command.action, p_expected_revision: command.expectedRevision, p_idempotency_key: idempotencyKey, p_fields: command.fields ?? {} }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PT409") || message.startsWith("23505")) throw new ApplicationCommandError("The application changed or an active application already exists. Refresh to continue; your input has been retained.", 409);
    if (message.startsWith("PT403")) throw new ApplicationCommandError("You cannot perform this action at the application's current step.", 403);
    if (message.startsWith("PT404")) throw new ApplicationCommandError("Application not found.", 404);
    if (message.startsWith("PT422")) throw new ApplicationCommandError("Check the application details, programme and decision note before trying again.", 422);
    throw new ApplicationCommandError("Application persistence is temporarily unavailable. Retry with the same input.", 503);
  }
}
