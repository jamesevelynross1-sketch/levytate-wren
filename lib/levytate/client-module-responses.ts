import type { LevyFinanceState } from "@/lib/levytate/finance/types";
import type { EmployerRequestsWorkspaceBootstrap } from "@/lib/levytate/requests/api";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The update could not be confirmed.");
  return value as Record<string, unknown>;
}

export function decodeRequestsMutationResponse(value: unknown, organisationId: string | undefined): EmployerRequestsWorkspaceBootstrap {
  const result = record(value), workspace = record(result.workspace), organisation = record(workspace.organisation);
  if (result.ok !== true || !organisationId || organisation.id !== organisationId || workspace.requestsEnabled !== true
    || !Array.isArray(workspace.requests) || !Array.isArray(workspace.providerOptions) || !Array.isArray(workspace.programmeOptions)
    || !workspace.metrics) throw new Error("The Requests update could not be confirmed for this account.");
  return workspace as EmployerRequestsWorkspaceBootstrap;
}

export function decodeFinanceMutationResponse(value: unknown): LevyFinanceState {
  const result = record(value), state = record(result.state);
  if (result.ok !== true || state.version !== 1 || state.mode !== "persistent"
    || !Array.isArray(state.transactions) || !Array.isArray(state.imports)) throw new Error("The Finance update could not be confirmed.");
  return state as LevyFinanceState;
}
