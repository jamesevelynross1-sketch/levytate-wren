import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  assertValidApplicationWorkflowSteps,
  createDefaultApplicationWorkflow,
  type ApplicationWorkflowStep,
  type ApplicationWorkflowVersion,
} from "@/lib/levytate/application-workflows/domain";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { deriveApplicationWorkflowCompatibility } from "@/lib/levytate/application-workflows/compatibility";
import type { MvpApplication } from "@/lib/levytate/mvp/workspace";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { isApplicationWorkflowsEnabledForOrganisation } from "@/lib/server/levytate-application-workflow-capability";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/server/levytate-supabase";

type WorkflowRow = { id: string; organisation_id: string; name: string; published_version_id: string | null; created_at: string; updated_at: string };
type VersionRow = { id: string; organisation_id: string; workflow_id: string; version_number: number; status: "draft" | "published" | "superseded"; steps: ApplicationWorkflowStep[]; created_at: string; published_at: string | null };
type InstanceRow = { id: string; organisation_id: string; application_id: string; workflow_version_id: string; current_step_id: string; state: "active" | "needs_information" | "declined" | "ready_for_provider"; return_step_id: string | null; lock_version: number; last_progressed_at: string };
type EventRow = { id: string; organisation_id: string; application_id: string; workflow_version_id: string; step_id: string; action: "submit" | "approve" | "continue" | "request_information" | "resubmit" | "decline"; actor_user_id: string; actor_role: "Employee" | "Line Manager" | "Apprenticeship Lead" | "Employer Admin"; note: string; idempotency_key: string; from_lock_version: number; to_lock_version: number; created_at: string };
type ActorRow = { id: string; display_name: string; email: string };

export class ApplicationWorkflowServiceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); this.name = "ApplicationWorkflowServiceError"; }
}

export async function hasPublishedApplicationWorkflow(organisationId: string) {
  const rows = await supabaseSelect<{ id: string }>(requiredConfig(), "levytate_application_workflows", new URLSearchParams({ select: "id", organisation_id: `eq.${organisationId}`, published_version_id: "not.is.null", limit: "1" }));
  return rows.length === 1;
}

export async function attachApplicationWorkflowContexts(organisationId: string, applications: MvpApplication[]) {
  if (!applications.length) return applications;
  const config = requiredConfig();
  const instances = await supabaseSelect<InstanceRow>(config, "levytate_application_workflow_instances", new URLSearchParams({
    select: "id,organisation_id,application_id,workflow_version_id,current_step_id,state,return_step_id,lock_version,last_progressed_at",
    organisation_id: `eq.${organisationId}`,
    application_id: `in.(${applications.map((application) => application.id).join(",")})`,
  }));
  if (!instances.length) return applications;
  const versionIds = [...new Set(instances.map((instance) => instance.workflow_version_id))];
  const [versions, events] = await Promise.all([
    supabaseSelect<VersionRow>(config, "levytate_application_workflow_versions", new URLSearchParams({ select: "id,organisation_id,workflow_id,version_number,status,steps,created_at,published_at", id: `in.(${versionIds.join(",")})` })),
    supabaseSelect<EventRow>(config, "levytate_application_workflow_events", new URLSearchParams({ select: "id,organisation_id,application_id,workflow_version_id,step_id,action,actor_user_id,actor_role,note,idempotency_key,from_lock_version,to_lock_version,created_at", organisation_id: `eq.${organisationId}`, application_id: `in.(${applications.map((application) => application.id).join(",")})`, order: "created_at.asc" })),
  ]);
  const actorIds = [...new Set(events.map((event) => event.actor_user_id))];
  const actors = actorIds.length ? await supabaseSelect<ActorRow>(config, "levytate_users", new URLSearchParams({ select: "id,display_name,email", organisation_id: `eq.${organisationId}`, id: `in.(${actorIds.join(",")})` })) : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor.display_name || actor.email]));
  const byInstance = new Map(instances.map((instance) => [instance.application_id, instance]));
  const byVersion = new Map(versions.map((version) => [version.id, fromVersionRow(version)]));
  return applications.map((application) => {
    const instance = byInstance.get(application.id);
    const version = instance ? byVersion.get(instance.workflow_version_id) : undefined;
    if (!instance || !version) return application;
    const enriched = { ...application, workflow: { version, instance: { id: instance.id, organisationId: instance.organisation_id, applicationId: instance.application_id, workflowVersionId: instance.workflow_version_id, currentStepId: instance.current_step_id, state: instance.state, returnStepId: instance.return_step_id ?? undefined, lockVersion: instance.lock_version, lastProgressedAt: instance.last_progressed_at }, events: events.filter((event) => event.application_id === application.id).map((event) => ({ id: event.id, organisationId: event.organisation_id, applicationId: event.application_id, workflowVersionId: event.workflow_version_id, stepId: event.step_id, action: event.action, actorRole: event.actor_role, actorLabel: actorById.get(event.actor_user_id), note: event.note || undefined, idempotencyKey: event.idempotency_key, fromLockVersion: event.from_lock_version, toLockVersion: event.to_lock_version, createdAt: event.created_at })) } };
    const compatible = deriveApplicationWorkflowCompatibility(enriched);
    return { ...enriched, status: compatible.status, currentOwner: compatible.currentOwner, updatedAt: compatible.lastProgressedAt };
  });
}

export async function startApplicationWorkflow(session: LevyTateBetaSession, applicationId: string, idempotencyKey: string) {
  assertTransitionIdentifiers(applicationId, idempotencyKey);
  const context = await participantContext(session);
  const rows = await supabaseFetchJson<InstanceRow[]>(requiredConfig(), "rpc/levytate_start_application_workflow", { method: "POST", body: JSON.stringify({ p_organisation_id: context.organisation.id, p_application_id: applicationId, p_actor_user_id: context.user.id, p_idempotency_key: idempotencyKey }) });
  if (!rows[0]) throw new ApplicationWorkflowServiceError("Application workflow could not be started.", 409);
  return rows[0];
}

export async function transitionApplicationWorkflowForSession(session: LevyTateBetaSession, input: { applicationId: string; action: string; note?: string; idempotencyKey: string; expectedLockVersion: number }) {
  assertTransitionIdentifiers(input.applicationId, input.idempotencyKey);
  if (!new Set(["submit", "approve", "continue", "request_information", "resubmit", "decline"]).has(input.action)) throw new ApplicationWorkflowServiceError("Unsupported workflow transition.", 400);
  if (!Number.isInteger(input.expectedLockVersion) || input.expectedLockVersion < 0) throw new ApplicationWorkflowServiceError("A valid workflow version is required.", 400);
  if ((input.note ?? "").length > 2000) throw new ApplicationWorkflowServiceError("Decision notes must be 2,000 characters or fewer.", 400);
  const context = await participantContext(session);
  const rows = await supabaseFetchJson<InstanceRow[]>(requiredConfig(), "rpc/levytate_transition_application_workflow", { method: "POST", body: JSON.stringify({ p_organisation_id: context.organisation.id, p_application_id: input.applicationId, p_actor_user_id: context.user.id, p_action: input.action, p_note: input.note ?? "", p_idempotency_key: input.idempotencyKey, p_expected_lock_version: input.expectedLockVersion }) });
  if (!rows[0]) throw new ApplicationWorkflowServiceError("Application workflow transition failed.", 409);
  return rows[0];
}

export async function getApplicationWorkflowAdminState(session: LevyTateBetaSession) {
  const context = await workflowContext(session);
  const config = requiredConfig();
  const workflows = await supabaseSelect<WorkflowRow>(config, "levytate_application_workflows", new URLSearchParams({
    select: "id,organisation_id,name,published_version_id,created_at,updated_at", organisation_id: `eq.${context.organisation.id}`, limit: "1",
  }));
  if (!workflows[0]) return { published: createDefaultApplicationWorkflow(context.organisation.id), draft: null, history: [], syntheticDefault: true };
  const versions = await supabaseSelect<VersionRow>(config, "levytate_application_workflow_versions", new URLSearchParams({
    select: "id,organisation_id,workflow_id,version_number,status,steps,created_at,published_at", organisation_id: `eq.${context.organisation.id}`, workflow_id: `eq.${workflows[0].id}`, order: "version_number.desc",
  }));
  const mapped = versions.map(fromVersionRow);
  return { published: mapped.find((version) => version.id === workflows[0].published_version_id) ?? null, draft: mapped.find((version) => version.status === "draft") ?? null, history: mapped.filter((version) => version.status !== "draft"), syntheticDefault: false };
}

export async function createApplicationWorkflowDraft(session: LevyTateBetaSession) {
  const context = await workflowContext(session);
  const current = await getApplicationWorkflowAdminState(session);
  if (current.draft) throw new ApplicationWorkflowServiceError("A draft already exists.", 409);
  const config = requiredConfig();
  const now = new Date().toISOString();
  let workflows = await supabaseSelect<WorkflowRow>(config, "levytate_application_workflows", new URLSearchParams({ select: "*", organisation_id: `eq.${context.organisation.id}`, limit: "1" }));
  if (!workflows[0]) workflows = await supabaseInsert<WorkflowRow>(config, "levytate_application_workflows", [{ id: randomUUID(), organisation_id: context.organisation.id, name: "Application workflow", created_at: now, updated_at: now }]);
  const version = Math.max(0, ...current.history.map((item) => item.version)) + 1;
  const source = current.published ?? createDefaultApplicationWorkflow(context.organisation.id, now);
  const rows = await supabaseInsert<VersionRow>(config, "levytate_application_workflow_versions", [{ id: randomUUID(), organisation_id: context.organisation.id, workflow_id: workflows[0].id, version_number: version, status: "draft", steps: source.steps, created_by: context.user.id, created_at: now }]);
  await audit(context, "application_workflow_draft_created", rows[0].id, { version });
  return fromVersionRow(rows[0]);
}

export async function updateApplicationWorkflowDraft(session: LevyTateBetaSession, versionId: string, steps: ApplicationWorkflowStep[]) {
  const context = await workflowContext(session);
  assertValidApplicationWorkflowSteps(steps);
  const config = requiredConfig();
  const before = await supabaseSelect<VersionRow>(config, "levytate_application_workflow_versions", new URLSearchParams({ select: "id,organisation_id,workflow_id,version_number,status,steps,created_at,published_at", id: `eq.${versionId}`, organisation_id: `eq.${context.organisation.id}`, status: "eq.draft", limit: "1" }));
  if (!before[0]) throw new ApplicationWorkflowServiceError("Draft workflow was not found.", 404);
  const rows = await supabaseUpdate<VersionRow>(config, "levytate_application_workflow_versions", `id=eq.${encodeURIComponent(versionId)}&organisation_id=eq.${context.organisation.id}&status=eq.draft`, { steps });
  if (!rows[0]) throw new ApplicationWorkflowServiceError("Draft workflow was not found.", 404);
  await audit(context, "application_workflow_draft_updated", versionId, { stepCount: steps.length });
  const previousIds = before[0].steps.map((step) => step.id);
  const nextIds = steps.map((step) => step.id);
  const added = nextIds.filter((id) => !previousIds.includes(id));
  const removed = previousIds.filter((id) => !nextIds.includes(id));
  if (added.length) await audit(context, "application_workflow_steps_added", versionId, { stepIds: added });
  if (removed.length) await audit(context, "application_workflow_steps_removed", versionId, { stepIds: removed });
  if (!added.length && !removed.length && previousIds.some((id, index) => nextIds[index] !== id)) await audit(context, "application_workflow_steps_reordered", versionId, { stepIds: nextIds });
  return fromVersionRow(rows[0]);
}

export async function publishApplicationWorkflowDraft(session: LevyTateBetaSession, versionId: string) {
  const context = await workflowContext(session);
  const config = requiredConfig();
  const rows = await supabaseFetchJson<VersionRow[]>(config, "rpc/levytate_publish_application_workflow", { method: "POST", body: JSON.stringify({ p_organisation_id: context.organisation.id, p_version_id: versionId, p_actor_user_id: context.user.id }) });
  if (!rows[0]) throw new ApplicationWorkflowServiceError("Workflow could not be published.", 409);
  await audit(context, "application_workflow_published", versionId, { version: rows[0].version_number });
  await audit(context, "application_workflow_version_activated", versionId, { version: rows[0].version_number });
  return fromVersionRow(rows[0]);
}

async function workflowContext(session: LevyTateBetaSession) {
  const context = await participantContext(session);
  if (!hasMvpPermission(context.user.role, "applicationWorkflows:manage")) throw new ApplicationWorkflowServiceError(`${normaliseMvpUserRole(context.user.role)} cannot configure application workflows.`, 403);
  return context;
}

async function participantContext(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (!await isApplicationWorkflowsEnabledForOrganisation(context.organisation.id)) throw new ApplicationWorkflowServiceError("Configurable application workflows are not enabled for this workspace.", 404);
  return context;
}

function requiredConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ApplicationWorkflowServiceError("Workflow persistence is unavailable.", 503);
  return config;
}

function assertTransitionIdentifiers(applicationId: string, idempotencyKey: string) {
  if (!applicationId || applicationId.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9:_-]+$/.test(applicationId)) throw new ApplicationWorkflowServiceError("Application id is invalid.", 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(idempotencyKey)) throw new ApplicationWorkflowServiceError("Idempotency key is invalid.", 400);
}

function fromVersionRow(row: VersionRow): ApplicationWorkflowVersion {
  return { id: row.id, organisationId: row.organisation_id, workflowId: row.workflow_id, version: row.version_number, status: row.status, steps: row.steps, createdAt: row.created_at, publishedAt: row.published_at ?? undefined };
}

async function audit(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>, action: string, entityId: string, metadata: Record<string, unknown>) {
  const config = requiredConfig();
  await supabaseInsert(config, "levytate_audit_events", [{ id: randomUUID(), organisation_id: context.organisation.id, actor_email: context.user.email, actor_role: context.user.role, entity_type: "application_workflow", entity_id: entityId, action, summary: action.replaceAll("_", " "), metadata, created_at: new Date().toISOString() }], { prefer: "return=minimal" });
}
