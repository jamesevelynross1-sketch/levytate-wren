import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseSelect } from "@/lib/server/levytate-supabase";

export type LearnerWrite = { table: string; row: Record<string, unknown> };
export const learnerWritePlan = new AsyncLocalStorage<{ writes: LearnerWrite[]; synchronise: boolean }>();
export class LearnerTransactionError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "LearnerTransactionError"; }
}
export type LearnerCommandIdentity = { organisationId: string; actorId: string; learnerId: string; action: string; input: unknown; idempotencyKey?: string };
export function learnerCommandKey(command: LearnerCommandIdentity) {
  return command.idempotencyKey ?? createHash("sha256").update(JSON.stringify(command)).digest("hex");
}
export async function learnerRevision(organisationId: string, learnerId: string) {
  const row = (await supabaseSelect<{ mutation_revision: number }>(config(), "levytate_learner_records", new URLSearchParams({ select: "mutation_revision", organisation_id: `eq.${organisationId}`, id: `eq.${learnerId}`, limit: "1" })))[0];
  if (!row) throw new LearnerTransactionError("Learner record not found.", 404);
  return row.mutation_revision;
}
export async function applyLearnerTransaction<T>(command: LearnerCommandIdentity, options: { probe?: boolean; expectedRevision?: number; writes?: LearnerWrite[]; result?: T } = {}): Promise<T | null> {
  try {
    return await supabaseFetchJson<T | null>(config(), "rpc/levytate_apply_learner_command", { method: "POST", body: JSON.stringify({
      p_organisation_id: command.organisationId, p_actor_user_id: command.actorId, p_learner_id: command.learnerId,
      p_action: command.action, p_request_id: learnerCommandKey(command), p_command: command.input,
      p_probe: options.probe ?? false, p_expected_revision: options.expectedRevision ?? null,
      p_writes: options.writes ?? [], p_result: options.result ?? null,
    }) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("PT409") || code.startsWith("23505")) throw new LearnerTransactionError("This learner record changed or the request key conflicts. Refresh before retrying; your input is retained.", 409);
    if (code.startsWith("PT403")) throw new LearnerTransactionError("This action is not allowed for your current role, learner or journey step.", 403);
    if (code.startsWith("PT404")) throw new LearnerTransactionError("Learner record not found.", 404);
    if (code.startsWith("PT422")) throw new LearnerTransactionError("Check the learner evidence, dates and mandatory readiness checks.", 422);
    throw new LearnerTransactionError("Learner persistence could not be confirmed. Retry the same request; partial updates are not committed.", 503);
  }
}
function config() { const result = getLevyTateSupabaseConfig(); if (!result) throw new LearnerTransactionError("Learner persistence is unavailable.", 503); return result; }
