import type { LiftAction, LiftWorkspace } from "@/lib/levytate/lift/domain";

export type LiftWorkspaceResponse = { ok: true; workspace: LiftWorkspace } | { ok?: false; message: string };
export type LiftActionInput = LiftAction extends infer Action
  ? Action extends LiftAction ? Omit<Action, "idempotencyKey"> : never
  : never;
