import { randomUUID } from "node:crypto";

import type { LevyTateOperationalCopilotIntent } from "@/lib/levytate/ai/types";
import type { LearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseInsert } from "@/lib/server/levytate-supabase";

type CopilotQueryAuditInput = {
  intent: LevyTateOperationalCopilotIntent;
  resultCount: number;
  tool: string;
  durationMs: number;
  success: boolean;
};

type AuditEventRow = {
  id: string;
  organisation_id: string;
  actor_email: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function recordCopilotQueryAudit(
  context: LearnerLifecycleServerContext,
  input: CopilotQueryAuditInput,
) {
  const config = getLevyTateSupabaseConfig();
  if (!config) return;
  const id = randomUUID();
  const now = new Date().toISOString();
  const row: AuditEventRow = {
    id,
    organisation_id: context.organisation.id,
    actor_email: context.user.email,
    actor_role: context.user.role,
    entity_type: "copilot_query",
    entity_id: id,
    action: input.success ? "copilot.query.succeeded" : "copilot.query.safe_failure",
    summary: input.success ? "Copilot operational query completed." : "Copilot operational query ended safely.",
    metadata: {
      classifiedIntent: input.intent,
      resultCount: Math.max(0, Math.trunc(input.resultCount)),
      tool: input.tool.slice(0, 120),
      totalDurationMs: Math.max(0, Math.round(input.durationMs * 10) / 10),
      success: input.success,
    },
    created_at: now,
  };

  await supabaseInsert<AuditEventRow>(config, "levytate_audit_events", [row], {
    query: "on_conflict=id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}
