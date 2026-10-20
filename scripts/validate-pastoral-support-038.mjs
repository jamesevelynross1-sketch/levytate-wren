import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/038_create_pastoral_human_follow_up.sql", "utf8");
let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("038 creates only the two follow-up tables", [
  "levytate_pastoral_support_actions",
  "levytate_pastoral_support_action_events",
].every((table) => new RegExp(`create table if not exists public\\.${table}\\b`, "i").test(sql)));
check("038 has no destructive table, column or data operation", !/\b(drop table|drop column|truncate|delete from)\b/i.test(sql));
check("038 does not mutate non-pastoral business data", !/\b(update|insert into)\s+public\.levytate_(organisations|users|employees|applications|learner_records|assessment_results|operational_actions|providers)\b/i.test(sql));
check("follow-up and closure metadata are distinct", sql.includes("agreed_follow_up_at") && sql.includes("administratively_closed_at") && sql.includes("employee_confirmed_resolved_at"));
check("employee outcome distinguishes helped from further support", sql.includes("'helped','further_support_requested'") && sql.includes("employee_requested_further_support"));
check("support-action content and progress evidence are encrypted", ["payload_ciphertext", "payload_nonce", "payload_authentication_tag", "note_ciphertext", "note_nonce", "note_authentication_tag"].every((field) => sql.includes(field)));
check("support actions use authorised recipient ownership", sql.includes("responsible_recipient_id") && sql.includes("The responsible support-action owner is unavailable"));
check("recipient matching requires an explicit non-null principal", sql.includes("p_actor_user_id is not null and v_recipient.employer_user_id = p_actor_user_id") && sql.includes("p_actor_provider_membership_id is not null and v_recipient.provider_membership_id = p_actor_provider_membership_id"));
check("unassigned recipients cannot progress a request", sql.includes("Only the active assigned recipient may update this support request"));
check("action and request updates use optimistic concurrency", (sql.match(/lock_version <> p_expected_lock_version/g) ?? []).length >= 4);
check("create and transitions are idempotent", sql.includes("Conflicting pastoral support action idempotency key") && (sql.match(/idempotency_key = p_idempotency_key/g) ?? []).length >= 5);
check("action events are append-only", sql.includes("levytate_pastoral_support_action_events_immutable") && sql.includes("levytate_reject_pastoral_append_only_mutation"));
check("new tables enable and force RLS", (sql.match(/enable row level security/g) ?? []).length === 2 && (sql.match(/force row level security/g) ?? []).length === 2);
check("browser roles have no grants", sql.includes("from public, anon, authenticated, service_role") && !/grant [^;]+ to (public|anon|authenticated)/i.test(sql));
check("service role has read-only table grants", sql.includes("grant select on table public.levytate_pastoral_support_actions to service_role") && !/grant (insert|update|delete).*levytate_pastoral_support_actions/i.test(sql));
check("writes are available only through controlled RPCs", [
  "levytate_record_pastoral_follow_up",
  "levytate_create_pastoral_support_action",
  "levytate_transition_pastoral_support_action",
  "levytate_record_pastoral_employee_outcome",
].every((name) => sql.includes(`grant execute on function public.${name}`)));
check("Platform Admin is excluded from pastoral actors", sql.includes("role <> 'Platform Admin'"));
check("no health diagnosis, score or prediction is introduced", !/\b(diagnosis|risk_score|wellbeing_score|dropout_prediction|sentiment_score)\b/i.test(sql));
check("no ordinary operations, Insights or Copilot coupling is introduced", !/levytate_(operational_actions|intelligence|copilot|assessment_results)/i.test(sql));

console.log(`\nPastoral migration 038 validation: ${passed} passed, 0 failed.`);
