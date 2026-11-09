import { z } from "zod";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";

/** A technical taxonomy, not a retention schedule or legal approval. */
export const tenantDataClasses = ["identity", "people", "applications", "learners", "finance", "catalogue", "files", "assessments", "lift", "support", "audit"] as const;
export type TenantDataClass = typeof tenantDataClasses[number];
const evidenceReference = z.string().trim().min(5).max(500);
const schedule = z.strictObject({ dataClass: z.enum(tenantDataClasses), retainUntil: z.iso.datetime({ offset: true }), action: z.enum(["delete", "retain"]), approvalReference: evidenceReference });
const policy = z.strictObject({
  version: z.literal("levytate-offboarding-v1"), approvalReference: evidenceReference, clientNoticeReference: evidenceReference,
  supportHandoverReference: evidenceReference, recoveryBoundaryReference: evidenceReference,
  dataOwnerUserId: z.uuid(), serviceOwnerUserId: z.uuid(), evidenceRetainUntil: z.iso.datetime({ offset: true }), schedules: z.array(schedule).length(tenantDataClasses.length),
}).refine((value) => new Set(value.schedules.map((item) => item.dataClass)).size === tenantDataClasses.length, "Every data class requires exactly one explicit schedule.");
export type TenantRetentionPolicy = z.infer<typeof policy>;

export function parseTenantRetentionPolicy(value: unknown): TenantRetentionPolicy {
  const result = policy.safeParse(value);
  if (!result.success) throw new ClientRequestError("Provide the approved retention schedule for every data class, named owners and client notice, support and recovery evidence references.", 422);
  return result.data;
}

export function retentionExceptions(value: TenantRetentionPolicy, legalHold: boolean, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new ClientRequestError("A valid evaluation time is required.", 422);
  return value.schedules.map((item) => ({ dataClass: item.dataClass, retainUntil: item.retainUntil,
    state: legalHold ? "held" as const : item.action === "retain" ? "retained" as const : Date.parse(item.retainUntil) > now.getTime() ? "pending" as const : "due" as const,
  }));
}

/** Whole-tenant removal cannot silently override a retained financial/audit class. */
export function assertTenantDeletionDue(value: TenantRetentionPolicy, legalHold: boolean, now: Date) {
  if (retentionExceptions(value, legalHold, now).some((item) => item.state !== "due")) throw new ClientRequestError("Deletion is blocked by a legal hold, an unexpired schedule or an explicitly retained data class.", 409);
}

export function assertIndependentLifecycleApproval(requester: string, approver: string) {
  if (!z.uuid().safeParse(requester).success || !z.uuid().safeParse(approver).success || requester === approver) {
    throw new ClientRequestError("A different authorised person must approve this lifecycle action.", 403);
  }
}

// Explicit versioned inventory. A newly added organisation-owned table must be
// classified and independently reviewed; it is never silently skipped on export.
const tableGroups: Record<TenantDataClass, readonly string[]> = {
  identity: ["users", "organisation_capabilities", "prospect_access", "external_identities", "external_tenant_connections", "provider_access_invites", "retired_auth_bindings", "client_admin_commands"],
  people: ["employees", "employee_development_profiles", "people_import_receipts"],
  applications: ["applications", "application_history", "application_command_receipts", "application_workflows", "application_workflow_versions", "application_workflow_instances", "application_workflow_events"],
  learners: ["enrolments", "learner_records", "learner_eligibility_declarations", "learner_pre_enrolment_checks", "learner_breaks_in_learning", "learner_withdrawals", "learner_reviews", "learner_progress_updates", "learner_assessment_readiness", "learner_achievements", "learner_operational_actions", "learner_lifecycle_events", "learner_command_receipts", "operational_actions", "operational_action_events", "operational_action_receipts", "intelligence_signals", "intelligence_signal_events", "otj_plans", "otj_plan_versions", "otj_learning_priorities", "otj_activities", "otj_activity_confirmations", "otj_activity_events", "otj_command_receipts"],
  finance: ["finance_balances", "finance_imports", "finance_transactions", "finance_command_receipts", "finance_versions"],
  catalogue: ["roles", "role_pathway_mappings", "providers", "provider_programmes", "provider_relationships", "matching_requests", "organisation_providers", "organisation_programmes", "service_requests", "service_request_versions", "service_request_invitations", "service_request_responses", "service_request_response_versions", "service_request_clarifications", "service_request_decisions", "service_request_agreements", "service_request_handovers", "service_request_events", "request_command_receipts", "workspace_entity_versions", "workspace_command_receipts"],
  files: ["file_assets"],
  assessments: ["assessment_campaigns", "assessment_participants", "workforce_assessments", "assessment_revisions", "assessment_results", "assessment_shares", "assessment_reviews", "assessment_actions", "assessment_application_links", "assessment_events"],
  lift: ["lift_campaigns", "lift_participants", "lift_assessments", "lift_assessment_revisions", "lift_evidence_records", "lift_interpretations", "lift_manager_observations", "lift_manager_observation_revisions", "lift_employee_observation_contexts", "lift_team_context_revisions", "lift_opportunities", "lift_opportunity_candidates", "lift_opportunity_evidence", "lift_opportunity_route_members", "lift_decisions", "lift_decision_assumptions", "lift_proof_records", "lift_proof_events", "lift_workspace_revisions", "lift_command_receipts"],
  support: ["pastoral_access_eligibility", "pastoral_preferences", "pastoral_conversations", "pastoral_messages", "pastoral_audit_events", "pastoral_support_recipients", "pastoral_support_requests", "pastoral_support_request_events", "pastoral_history_receipts"],
  audit: ["audit_events", "early_access_terms_acceptances", "external_connector_events", "tenant_reactivation_requests"],
};
export const tenantTableInventory = Object.fromEntries(Object.entries(tableGroups).flatMap(([dataClass, tables]) => tables.map((table) => [`levytate_${table}`, dataClass]))) as Record<string, TenantDataClass>;
export const tenantInventoryVersion = "levytate-tenant-data-v1";
export function assertTenantInventoryComplete(actualOrganisationTables: readonly string[]) {
  if (actualOrganisationTables.some((table) => !Object.hasOwn(tenantTableInventory, table))) throw new ClientRequestError("The tenant data inventory changed. Independent review is required before export or deletion.", 409);
}
