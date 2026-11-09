import type { LevyFinanceState } from "@/lib/levytate/finance/types";
import type { EmployerRequestsWorkspaceBootstrap } from "@/lib/levytate/requests/api";
import type { LiftWorkspace } from "@/lib/levytate/lift/domain";
import type { AssessmentWorkspace } from "@/lib/levytate/assessments/api";

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

const roles = ["Employee", "Line Manager", "Apprenticeship Lead", "Employer Admin"];

export function decodeLiftMutationResponse(value: unknown): LiftWorkspace {
  const result = record(value), workspace = record(result.workspace);
  if (result.ok !== true || workspace.enabled !== true || !roles.includes(String(workspace.role))
    || !Number.isSafeInteger(workspace.mutationRevision) || Number(workspace.mutationRevision) < 0
    || typeof workspace.generatedAt !== "string" || !Number.isFinite(Date.parse(workspace.generatedAt))
    || !workspace.framework || !workspace.coverage
    || [workspace.availableEmployees, workspace.opportunities, workspace.decisions, workspace.proofs].some((items) => !Array.isArray(items))) {
    throw new Error("The Lift update could not be confirmed.");
  }
  return workspace as LiftWorkspace;
}

export function decodeAssessmentMutationResponse(value: unknown): AssessmentWorkspace {
  const result = record(value), workspace = record(result.workspace);
  if (result.ok !== true || !roles.includes(String(workspace.role))
    || typeof workspace.generatedAt !== "string" || !Number.isFinite(Date.parse(workspace.generatedAt))
    || typeof workspace.canCompleteOwnAssessments !== "boolean" || !workspace.disclosure
    || [workspace.questions, workspace.frameworks, workspace.assessments, workspace.campaigns, workspace.availableEmployees, workspace.reporting].some((items) => !Array.isArray(items))) {
    throw new Error("The assessment update could not be confirmed.");
  }
  return workspace as AssessmentWorkspace;
}

export function decodeLearningTimeMutationResponse(value: unknown, organisationId: string | undefined) {
  const result = record(value);
  const records = ["activity", "confirmation", "version", "priority"].filter((key) => result[key] !== undefined);
  if (records.length !== 1) throw new Error("The Learning Time update could not be confirmed.");
  const saved = record(result[records[0]]);
  if (!organisationId || saved.organisation_id !== organisationId || typeof saved.id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.id)) {
    throw new Error("The Learning Time update could not be confirmed for this account.");
  }
  return result;
}

/** Preserve the exact audited UTF-8 response text; never reserialise a download. */
export function decodeEvidenceDownload(value: unknown, organisationId: string | undefined): string {
  if (typeof value !== "string") throw new Error("The evidence download could not be confirmed.");
  let result: Record<string, unknown>;
  try { result = record(JSON.parse(value)); } catch { throw new Error("The evidence download could not be confirmed."); }
  if (!organisationId || result.organisationId !== organisationId || result.format !== "levytate-employer-evidence" || result.version !== 1
    || typeof result.generatedAt !== "string" || !Number.isFinite(Date.parse(result.generatedAt))
    || !Array.isArray(result.metrics) || !Array.isArray(result.sources) || !result.workforce || !result.finance) {
    throw new Error("The evidence download could not be confirmed for this account.");
  }
  return value;
}
