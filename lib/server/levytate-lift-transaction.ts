import { AsyncLocalStorage } from "node:async_hooks";
import type { LiftAction } from "@/lib/levytate/lift/domain";
import { getLevyTateSupabaseConfig, supabaseFetchJson, supabaseSelect, supabaseSelectAll } from "@/lib/server/levytate-supabase";

type Row = Record<string, unknown>;
export type LiftWrite = { table: string; kind: "insert" | "update"; key: Row; row: Row };
type Plan = { organisationId: string; rows: Map<string, Row[]>; writes: LiftWrite[] };
export const liftWritePlan = new AsyncLocalStorage<Plan>();
export class LiftTransactionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const compoundKeys: Record<string, string[]> = {
  levytate_lift_opportunity_route_members: ["opportunity_id", "candidate_id"],
  levytate_lift_opportunity_evidence: ["opportunity_id", "evidence_id", "relationship"],
};
function key(table: string, row: Row) { return Object.fromEntries((compoundKeys[table] ?? ["id"]).map((name) => [name, row[name]])); }
function matches(row: Row, query: Record<string, string>) {
  return Object.entries(query).every(([name, filter]) => {
    if (["select", "order", "limit", "offset"].includes(name)) return true;
    if (filter.startsWith("eq.")) return String(row[name]) === filter.slice(3);
    if (filter.startsWith("in.(") && filter.endsWith(")")) return filter.slice(4, -1).split(",").includes(String(row[name]));
    throw new LiftTransactionError("Unsupported Lift transaction filter.", 503);
  });
}
async function rowsFor(table: string) {
  const plan = liftWritePlan.getStore();
  if (!plan) throw new LiftTransactionError("Lift transaction required.", 503);
  if (!plan.rows.has(table)) {
    const order = [...(compoundKeys[table] ?? ["id"])].map((name) => `${name}.asc`).join(",");
    plan.rows.set(table, await supabaseSelectAll<Row>(config(), table, new URLSearchParams({ select: "*", organisation_id: `eq.${plan.organisationId}`, order })));
  }
  return plan.rows.get(table)!;
}
export async function selectLiftPlan<T>(table: string, query: Record<string, string>): Promise<T[]> {
  let rows = (await rowsFor(table)).filter((row) => matches(row, query));
  if (query.order) {
    rows = [...rows].sort((a, b) => {
      for (const order of query.order.split(",")) {
        const [name, direction] = order.split(".");
        const av = a[name], bv = b[name];
        const delta = av === bv ? 0 : av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1;
        if (delta) return direction === "desc" ? -delta : delta;
      }
      return 0;
    });
  }
  return structuredClone(rows.slice(Number(query.offset ?? 0), query.limit ? Number(query.offset ?? 0) + Number(query.limit) : undefined)) as T[];
}
export async function updateLiftPlan<T>(table: string, query: Record<string, string>, body: Row): Promise<T[]> {
  const rows = (await rowsFor(table)).filter((row) => matches(row, query));
  for (const row of rows) {
    liftWritePlan.getStore()!.writes.push({ table, kind: "update", key: key(table, row), row: body });
    Object.assign(row, body);
  }
  if (rows.length !== 1) throw new LiftTransactionError("Lift changed; refresh before saving. Your input is retained.", 409);
  return structuredClone(rows) as T[];
}
export async function insertLiftPlan(table: string, input: Row[], ignore: boolean) {
  const rows = await rowsFor(table);
  const inserted: Row[] = [];
  for (const value of input) {
    const identity = key(table, value);
    const existing = rows.find((row) => Object.entries(identity).every(([name, item]) => row[name] === item));
    if (existing) {
      if (!ignore) throw new LiftTransactionError("Lift evidence already exists.", 409);
      if (table === "levytate_lift_evidence_records" && ["source_type", "source_record_id", "description", "quantity_value", "quantity_unit", "quantity_population", "quantity_period"].some((name) => (existing[name] ?? null) !== (value[name] ?? null))) throw new LiftTransactionError("Evidence identifiers cannot be reused for different evidence.", 409);
      continue;
    }
    liftWritePlan.getStore()!.writes.push({ table, kind: "insert", key: identity, row: value });
    const row = { current_revision: 1, active_submission_revision: null, current_question_index: 0, status: table.endsWith("participants") ? "invited" : "draft", ...value };
    rows.push(row); inserted.push(row);
  }
  return structuredClone(inserted);
}
export async function liftRevision(organisationId: string) {
  const rows = await supabaseSelect<{ revision: number }>(config(), "levytate_lift_workspace_revisions", new URLSearchParams({ select: "revision", organisation_id: `eq.${organisationId}`, limit: "1" }));
  return rows[0]?.revision ?? 0;
}
export async function runLiftTransaction(organisationId: string, actorId: string, action: LiftAction, build: () => Promise<void>) {
  const invoke = (probe: boolean, writes: LiftWrite[]) => supabaseFetchJson<{ revision: number } | null>(config(), "rpc/levytate_apply_lift_command", { method: "POST", body: JSON.stringify({ p_organisation_id: organisationId, p_actor_user_id: actorId, p_command: action, p_probe: probe, p_writes: writes }) });
  try {
    if (await invoke(true, [])) return;
    if (await liftRevision(organisationId) !== action.expectedWorkspaceRevision) throw new LiftTransactionError("Lift changed; refresh before saving. Your input is retained.", 409);
    const plan: Plan = { organisationId, rows: new Map(), writes: [] };
    await liftWritePlan.run(plan, build);
    await invoke(false, plan.writes);
  } catch (error) {
    if (error instanceof LiftTransactionError || (error instanceof Error && error.name === "LevyTateLiftError")) throw error;
    const code = error instanceof Error ? error.message : "";
    const status = code.startsWith("PT403") ? 403 : code.startsWith("PT404") ? 404 : /^(PT409|23505)/.test(code) ? 409 : /^(PT422|22|23)/.test(code) ? 422 : 503;
    throw new LiftTransactionError(status === 409 ? "Lift changed or the retry key conflicts. Refresh before saving; your input is retained." : status === 403 ? "This Lift action is not allowed for your current role or team." : status === 404 ? "Lift is not enabled or the record is unavailable." : status === 422 ? "Check the Lift evidence and required fields." : "Lift persistence could not be confirmed. Retry the same request; partial updates are not committed.", status);
  }
}
function config() { const value = getLevyTateSupabaseConfig(); if (!value) throw new LiftTransactionError("Lift persistence is unavailable.", 503); return value; }
