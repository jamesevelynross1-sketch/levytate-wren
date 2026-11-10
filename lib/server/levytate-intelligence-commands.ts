import { getLevyTateSupabaseConfig, LevyTateSupabaseError, supabaseFetchJson, supabaseSelect } from "@/lib/server/levytate-supabase";
export type IntelligenceCommandKey = { idempotencyKey: string };
export type IntelligenceDecisionKey = IntelligenceCommandKey & { expectedRevision: number };
export type IntelligenceActorScope = { organisationId: string; userId: string; userEmail: string; role: string };
export type IntelligenceCommandConfirmation = { idempotencyKey: string; action: string; organisationId: string; userEmail: string; role: string; signalId: string | null; revision: number };
export type IntelligenceCommandResult = {
  signals: Record<string, unknown>[];
  state: { organisation_id: string; family: string; revision: number; reconciled_at: string | null };
  signal: Record<string, unknown> | null;
  confirmation: IntelligenceCommandConfirmation;
  operationalActionId: string | null;
  reused: boolean;
  learnerCount: number;
};
export type IntelligenceCommandPreparation = { sourceHash: string; revision: number; signals: Record<string, unknown>[] };
export class IntelligenceCommandError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 | 503 = 503) { super(message); this.name = "IntelligenceCommandError"; }
}
function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new IntelligenceCommandError("Intelligence persistence is unavailable."); return value; }
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export async function intelligenceCommand(scope: IntelligenceActorScope, family: string, command: Record<string, unknown>, preparation?: IntelligenceCommandPreparation, rows?: unknown[], prepare = false): Promise<{ receipt: IntelligenceCommandResult } | IntelligenceCommandPreparation> {
  try {
    const response: unknown = await supabaseFetchJson(config(), "rpc/levytate_apply_intelligence_command", { method: "POST", body: JSON.stringify({ p_organisation_id: scope.organisationId, p_actor_user_id: scope.userId, p_family: family, p_command: command, p_prepare: prepare, p_source_hash: preparation?.sourceHash ?? null, p_workspace_revision: preparation?.revision ?? null, p_rows: rows ?? null }) });
    if (!object(response)) throw new IntelligenceCommandError("The Intelligence update could not be confirmed.");
    if (object(response.receipt)) {
      const result = response.receipt, confirmation = result.confirmation, state = result.state;
      if (!Array.isArray(result.signals) || result.signals.some(row => !object(row) || row.organisation_id !== scope.organisationId || row.analyser_version !== family || !Number.isSafeInteger(row.revision))
        || !object(state) || state.organisation_id !== scope.organisationId || state.family !== family || !Number.isSafeInteger(state.revision)
        || !(state.reconciled_at === null || (typeof state.reconciled_at === "string" && Number.isFinite(Date.parse(state.reconciled_at))))
        || !object(confirmation) || confirmation.idempotencyKey !== command.idempotencyKey || confirmation.action !== command.action || confirmation.organisationId !== scope.organisationId || confirmation.userEmail !== scope.userEmail || confirmation.role !== scope.role
        || confirmation.signalId !== (command.signalId ?? null) || !Number.isSafeInteger(confirmation.revision)
        || (command.expectedRevision !== undefined && confirmation.revision !== Number(command.expectedRevision) + 1)
        || typeof result.reused !== "boolean" || !(result.operationalActionId === null || typeof result.operationalActionId === "string")) throw new IntelligenceCommandError("The Intelligence update could not be confirmed.");
      return { receipt: result as IntelligenceCommandResult };
    }
    if (!prepare || typeof response.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(response.sourceHash) || !Number.isSafeInteger(response.revision) || Number(response.revision) < 0 || !Array.isArray(response.signals)) throw new IntelligenceCommandError("The Intelligence source snapshot is unavailable.");
    return response as IntelligenceCommandPreparation;
  } catch (error) {
    if (error instanceof IntelligenceCommandError) throw error;
    if (error instanceof LevyTateSupabaseError) {
      if (/PT409|40001|40P01|23505/.test(error.message)) throw new IntelligenceCommandError("The signal or its source changed. Refresh before starting a new action.", 409);
      if (/PT403/.test(error.message)) throw new IntelligenceCommandError("You do not have current authority for this Intelligence action.", 403);
      if (/PT404/.test(error.message)) throw new IntelligenceCommandError("The Intelligence signal is unavailable.", 404);
      if (/PT422/.test(error.message)) throw new IntelligenceCommandError("Check the Intelligence action and try again.", 400);
    }
    throw new IntelligenceCommandError("The Intelligence update could not be confirmed. Retain the original request and retry.");
  }
}
export async function intelligenceWorkspaceState(scope: IntelligenceActorScope, family: string) {
  const rows = await supabaseSelect<{ revision: number; reconciled_at: string | null }>(config(), "levytate_intelligence_workspaces", new URLSearchParams({ select: "revision,reconciled_at", organisation_id: `eq.${scope.organisationId}`, family: `eq.${family}`, limit: "2" }));
  if (rows.length > 1 || (rows[0] && (!Number.isSafeInteger(rows[0].revision) || rows[0].revision < 0 || !(rows[0].reconciled_at === null || (typeof rows[0].reconciled_at === "string" && Number.isFinite(Date.parse(rows[0].reconciled_at))))))) throw new IntelligenceCommandError("The recorded analysis state is unavailable.");
  return rows[0] ?? { revision: 0, reconciled_at: null };
}
