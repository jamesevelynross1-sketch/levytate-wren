import { readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/037_create_pastoral_support_foundation.sql";
const sql = readFileSync(migrationPath, "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

const tables = [
  "levytate_pastoral_access_eligibility",
  "levytate_pastoral_preferences",
  "levytate_pastoral_support_recipients",
  "levytate_pastoral_conversations",
  "levytate_pastoral_messages",
  "levytate_pastoral_support_requests",
  "levytate_pastoral_support_request_events",
  "levytate_pastoral_audit_events",
  "levytate_pastoral_rate_limits",
];

check("037 is additive to the existing organisation capability", /add column if not exists pastoral_support_enabled boolean not null default false/i.test(sql));
check("all pastoral tables are created idempotently", tables.every((table) => new RegExp(`create table if not exists public\\.${table}\\b`, "i").test(sql)));
check("no destructive schema or data statement is present", !/\b(drop table|truncate|delete from|drop column|alter column|rename column)\b/i.test(sql));
check("no existing LevyTate business table is mutated", !/\b(update|insert into)\s+public\.levytate_(organisations|users|employees|applications|learner_records|workforce_assessments|assessment_results|operational_actions|service_requests)\b/i.test(sql));
check("no seeded pastoral records are created", !/insert into public\.levytate_pastoral_(access_eligibility|preferences|support_recipients|conversations|messages)\b/i.test(sql));
check("private history defaults off", /save_history boolean not null default false/i.test(sql));
check("saved conversations require explicit history saving", /history_saving_enabled boolean not null check \(history_saving_enabled = true\)/i.test(sql));
check("adult eligibility fails closed", /age_assurance_status in \('adult','under_18','not_verified'\)/i.test(sql) && /active = false.*age_assurance_status = 'adult'/is.test(sql));
check("conversation messages have authenticated-encryption fields", /ciphertext text not null/i.test(sql) && /nonce text not null/i.test(sql) && /authentication_tag text not null/i.test(sql) && /encryption_key_version text not null/i.test(sql));
check("there is no plaintext conversation-content column", !/\b(message|prompt|response|transcript|content)\s+text\b/i.test(sql));
check("shared requests are separate from conversations", /create table if not exists public\.levytate_pastoral_support_requests/i.test(sql) && /foreign key \(organisation_id, conversation_id, employee_id, owner_user_id\)/i.test(sql) && !/support_requests[\s\S]{0,800}conversation_id/i.test(sql));
check("shared fields are constrained to the approved minimum", [
  "topic",
  "what_i_want_you_to_understand",
  "how_it_is_affecting_me",
  "support_i_want",
  "preferred_contact_method",
  "sharing_restrictions",
  "recipient",
].every((field) => sql.includes(`'${field}'`)));
check("support submission is idempotent", /unique \(organisation_id, owner_user_id, idempotency_key\)/i.test(sql) && /Conflicting pastoral support request idempotency key/i.test(sql));
check("support workflow cannot auto-resolve", /p_action = 'resolve'/i.test(sql) && !/status\s*=\s*'resolved'[^;]*(cron|schedule|automatic)/i.test(sql));
check("employee reopen and dispute are explicit", /p_action in \('reopen','dispute'\)/i.test(sql) && /Only the owning employee may reopen or dispute/i.test(sql));
check("Platform Admin is excluded from pastoral transitions", /v_user\.role = 'Platform Admin'.*not authorised/is.test(sql));
check("recipient access is explicit and revalidated", /levytate_pastoral_support_recipients/i.test(sql) && /active = true/is.test(sql) && /Only the active assigned recipient/i.test(sql));
check("request and audit events are append-only", /Pastoral event history is append-only/i.test(sql) && /before update or delete on public\.levytate_pastoral_support_request_events/i.test(sql));
check("all pastoral tables enable and force RLS", /alter table public\.%I enable row level security/i.test(sql) && /alter table public\.%I force row level security/i.test(sql));
check("browser roles receive no pastoral table privileges", /revoke all privileges on table public\.%I from public, anon, authenticated, service_role/i.test(sql) && !/grant [^;]+ to (public|anon|authenticated)/i.test(sql));
check("service-role privileges are explicitly narrow", /grant select on table public\.levytate_pastoral_support_requests to service_role/i.test(sql) && /grant select on table public\.levytate_pastoral_support_request_events to service_role/i.test(sql));
check("rate limiting stores only HMAC-derived keys", /levytate_pastoral_rate_limits/i.test(sql) && /key_hash text not null/i.test(sql) && /no raw email, IP address or message content/i.test(sql));
check("no diagnosis, score or predictive field is introduced", !/\b(diagnosis|diagnostic|risk_score|wellbeing_score|dropout_prediction|sentiment_score)\b/i.test(sql));
check("migration does not couple pastoral content to Copilot or assessments", !/levytate_(ai_conversation|copilot|assessment_revision|assessment_result)/i.test(sql));

console.log(`\nPastoral support migration validation: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
