/** Opt-in generator -> actual service command -> local PostgreSQL integration.
 * Context resolution is mocked; this is not genuine Auth or browser acceptance.
 * Every native fixture/command is rolled back. No remote database is accepted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { analyseOperationsAutopilot, type DetectedAutopilotSignal } from "@/lib/levytate/autopilot/operations-autopilot";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), context: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", async original => ({ ...await original<typeof import("@/lib/server/levytate-supabase")>(), getLevyTateSupabaseConfig: () => ({ url: "https://fictional.invalid", serviceRoleKey: "synthetic-only" }), supabaseFetchJson: mocks.rpc, supabaseSelect: mocks.select }));
vi.mock("@/lib/server/levytate-learner-lifecycle", () => ({ getLearnerLifecycleServerContext: mocks.context, LevyTateLearnerLifecyclePermissionError: class extends Error {} }));
import { LevyTateSupabaseError } from "@/lib/server/levytate-supabase";
import { createAutopilotAction } from "@/lib/server/levytate-autopilot";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";

const runtime = process.env.RELEASE_LOCAL_RUNTIME;
const database = process.env.RELEASE_TEST_DATABASE;
const q = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`;
function executeNative(signal: DetectedAutopilotSignal, actor: string, status: string, owner: string, request: Record<string, unknown>) {
  if (!runtime?.startsWith("/private/tmp/levytate-release-runtime.") || database !== "levytate_release_intelligence_review26") throw new Error("Exclusive local review database required");
  const connection = new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, "utf8")).env.DB_URL);
  if (connection.hostname !== "127.0.0.1") throw new Error("Loopback required");
  const org = signal.organisationId, application = signal.entityId, employee = "synthetic-applicant", standard = randomUUID();
  const input = `begin;set local request.jwt.claim.role='service_role';
    insert into public.levytate_organisations(id,name,slug,status)values(${q(org)},'Synthetic Autopilot workflow',${q(org)},'Active');
    insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_binding_status)values(${q(actor)},${q(org)},'lead@example.test','Apprenticeship Lead',true,'beta_user','pending');
    insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,status,start_date)values(${q(org)},${q(employee)},'SYNTHETIC','Synthetic applicant','applicant@example.test','Employee','Active',current_date);
    insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route)values(${q(standard)},'Synthetic standard',${q(standard)},'Approved for delivery',4,'Synthetic');
    insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner)values(${q(org)},${q(application)},${q(employee)},${q(standard)},${q(status)},${q(owner)});
    do $test$ declare template jsonb; prepared jsonb; code text:='SUCCEEDED'; begin
      insert into public.levytate_intelligence_signals(organisation_id,id,fingerprint,signal_key,entity_type,entity_id,category,signal_type,title,summary,evidence,confidence,priority,recommended_action,suggested_owner_type,suggested_action_type,analyser_version,lane,autopilot_priority)
      values(${q(org)},${q(signal.id)},${q(signal.fingerprint)},${q(signal.signalKey)},${q(signal.entityType)},${q(signal.entityId)},${q(signal.category)},${q(signal.signalType)},${q(signal.title)},${q(signal.summary)},${json(signal.evidence)},'High','High',${q(signal.recommendedAction)},${q(signal.suggestedOwnerType)},${q(signal.suggestedActionType)},'operations-autopilot-v1',${q(signal.lane)},${q(signal.priority)})returning to_jsonb(levytate_intelligence_signals.*)into template;
      delete from public.levytate_intelligence_signals where organisation_id=${q(org)};
      prepared:=public.levytate_apply_intelligence_command(${q(org)},${q(actor)},'operations-autopilot-v1',${json({ action: "refresh", idempotencyKey: randomUUID() })},true);
      perform public.levytate_apply_intelligence_command(${q(org)},${q(actor)},'operations-autopilot-v1',${json({ action: "refresh", idempotencyKey: randomUUID() })},false,prepared->>'sourceHash',(prepared->>'revision')::integer,jsonb_build_array(template));
      begin perform public.levytate_apply_intelligence_command(${q(org)},${q(actor)},'operations-autopilot-v1',${json(request)}); exception when others then get stacked diagnostics code=returned_sqlstate;end;
      perform set_config('test.autopilot_result',jsonb_build_object('code',code,'actions',(select count(*)from public.levytate_operational_actions where organisation_id=${q(org)}),'receipts',(select count(*)from public.levytate_intelligence_command_receipts where organisation_id=${q(org)}),'signalStatus',(select status from public.levytate_intelligence_signals where organisation_id=${q(org)}))::text,true);
    end $test$;
    select current_setting('test.autopilot_result');rollback;`;
  const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", ["-XAtq", "--single-transaction", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", env: { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port, PGUSER: connection.username, PGPASSWORD: connection.password, PGDATABASE: database }, timeout: 15000 });
  if (result.status !== 0) throw new Error("Native synthetic workflow fixture failed; raw database output suppressed");
  return JSON.parse(result.stdout.trim()) as { code: string; actions: number; receipts: number; signalStatus: string };
}
beforeEach(() => vi.resetAllMocks());
describe.skipIf(!runtime)("actual Autopilot application command compatibility", () => {
  it.each([
    { status: "Awaiting Final Approval", owner: "Apprenticeship Lead" as const, type: "application_stalled", code: "PT409", legacyActionType: "review_application" },
    { status: "Approved for Enrolment", owner: "Provider Partner" as const, type: "application_awaiting_provider", code: "PT422", legacyActionType: "confirm_provider" },
  ])("keeps $type on its canonical workflow and preserves native denial of the old generic command", async scenario => {
    const organisationId = randomUUID(), actor = randomUUID();
    const [signal] = analyseOperationsAutopilot({ organisationId, now: "2026-11-10T12:00:00Z", learners: [], actions: [], applications: [{ id: "synthetic-application", employeeId: "synthetic-applicant", employeeName: "Synthetic applicant", status: scenario.status, currentOwner: scenario.owner, updatedAt: "2026-10-01T12:00:00Z" }] });
    expect(signal.signalType).toBe(scenario.type);
    mocks.context.mockResolvedValue({ organisation: { id: organisationId }, user: { id: actor, email: "lead@example.test", role: "Apprenticeship Lead" } });
    // Earlier execution of this suite passed the old generator output through
    // createAutopilotAction to this RPC, reproducing PT409 / PT422 respectively.
    // Keep that exact legacy-row case to prove the new UI does not need broader SQL.
    const legacy = { ...signal, suggestedActionType: scenario.legacyActionType };
    const key = { idempotencyKey: randomUUID(), expectedRevision: 1 };
    const input = { title: signal.title, ownerType: signal.suggestedOwnerType, dueDate: signal.suggestedDueDate, communicationDraft: "" };
    const observed = executeNative(legacy, actor, scenario.status, scenario.owner, { action: "create_action", signalId: signal.id, ...input, ...key });
    expect(observed).toEqual({ code: scenario.code, actions: 0, receipts: 1, signalStatus: "new" });
    mocks.select.mockResolvedValue([{ organisation_id: organisationId, id: signal.id, revision: 1, analyser_version: "operations-autopilot-v1", entity_type: "application", entity_id: signal.entityId, signal_type: signal.signalType, evidence: signal.evidence, deterministic_payload: { applicationId: signal.applicationId }, suggested_action_type: scenario.legacyActionType, title: signal.title, summary: signal.summary, recommended_action: signal.recommendedAction, communication_draft: "" }]);
    mocks.rpc.mockRejectedValue(new LevyTateSupabaseError("Unexpected command"));
    await expect(createAutopilotAction({ email: "lead@example.test" } as LevyTateBetaSession, signal.id, input, key, organisationId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Open the application") });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
