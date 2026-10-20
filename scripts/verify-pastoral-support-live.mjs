import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const EXPECTED_PROJECT_REF = "lzwcahdgchrkeulmlfqv";
const EXPECTED_TABLES = [
  "levytate_pastoral_access_eligibility",
  "levytate_pastoral_audit_events",
  "levytate_pastoral_conversations",
  "levytate_pastoral_messages",
  "levytate_pastoral_preferences",
  "levytate_pastoral_rate_limits",
  "levytate_pastoral_support_recipients",
  "levytate_pastoral_support_request_events",
  "levytate_pastoral_support_requests",
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

const linkedProjectRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (linkedProjectRef !== EXPECTED_PROJECT_REF) {
  fail(`linked project is ${linkedProjectRef || "missing"}, not ${EXPECTED_PROJECT_REF}`);
}
pass(`linked project is ${EXPECTED_PROJECT_REF}`);

// Supabase CLI creates a short-lived database login for the linked project. Capture
// it in memory and never echo it, persist it, or pass it on the command line.
const login = spawnSync(
  "supabase",
  ["db", "dump", "--linked", "--schema", "public", "--dry-run"],
  { encoding: "utf8" },
);

if (login.status !== 0) {
  fail("could not obtain a short-lived read-only verification login");
}

const connection = {};
for (const key of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) {
  const match = login.stdout.match(new RegExp(`export ${key}="([^"]+)"`));
  if (!match) fail(`short-lived verification login omitted ${key}`);
  connection[key] = match[1];
}

const sql = String.raw`
set role postgres;
select jsonb_build_object(
  'migration', (
    select jsonb_build_object(
      'latest', max(version),
      'migration_037_count', count(*) filter (where version = '037')
    )
    from supabase_migrations.schema_migrations
  ),
  'pastoral_tables', (
    select jsonb_build_object(
      'count', count(*),
      'names', jsonb_agg(c.relname order by c.relname),
      'rls_enabled', count(*) filter (where c.relrowsecurity),
      'rls_forced', count(*) filter (where c.relforcerowsecurity)
    )
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname like 'levytate_pastoral_%'
  ),
  'pastoral_policies', (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename like 'levytate_pastoral_%'
  ),
  'browser_privileges', (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name like 'levytate_pastoral_%'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'service_request_privileges', jsonb_build_object(
    'select', has_table_privilege('service_role', 'public.levytate_pastoral_support_requests', 'select'),
    'insert', has_table_privilege('service_role', 'public.levytate_pastoral_support_requests', 'insert'),
    'update', has_table_privilege('service_role', 'public.levytate_pastoral_support_requests', 'update'),
    'delete', has_table_privilege('service_role', 'public.levytate_pastoral_support_requests', 'delete')
  ),
  'pastoral_functions', (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'levytate_%pastoral%'
  ),
  'capability', (
    select jsonb_build_object(
      'column_default', (
        select column_default
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'levytate_organisation_capabilities'
          and column_name = 'pastoral_support_enabled'
      ),
      'enabled_organisations', count(*) filter (where pastoral_support_enabled),
      'total_capability_rows', count(*)
    )
    from public.levytate_organisation_capabilities
  ),
  'pastoral_rows', jsonb_build_object(
    'eligibility', (select count(*) from public.levytate_pastoral_access_eligibility),
    'preferences', (select count(*) from public.levytate_pastoral_preferences),
    'recipients', (select count(*) from public.levytate_pastoral_support_recipients),
    'conversations', (select count(*) from public.levytate_pastoral_conversations),
    'messages', (select count(*) from public.levytate_pastoral_messages),
    'requests', (select count(*) from public.levytate_pastoral_support_requests),
    'request_events', (select count(*) from public.levytate_pastoral_support_request_events),
    'audit_events', (select count(*) from public.levytate_pastoral_audit_events),
    'rate_limits', (select count(*) from public.levytate_pastoral_rate_limits)
  ),
  'existing_rows', jsonb_build_object(
    'organisations', (select count(*) from public.levytate_organisations),
    'users', (select count(*) from public.levytate_users),
    'employees', (select count(*) from public.levytate_employees),
    'applications', (select count(*) from public.levytate_applications),
    'learners', (select count(*) from public.levytate_learner_records),
    'assessment_results', (select count(*) from public.levytate_assessment_results),
    'operational_actions', (select count(*) from public.levytate_operational_actions),
    'providers', (select count(*) from public.levytate_providers),
    'provider_programmes', (select count(*) from public.levytate_provider_programmes)
  )
)::text;
`;

const query = spawnSync(
  "psql",
  ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1"],
  {
    encoding: "utf8",
    env: { ...process.env, ...connection },
    input: sql,
  },
);

for (const key of Object.keys(connection)) connection[key] = undefined;

if (query.status !== 0) {
  fail(`live verification query failed: ${query.stderr.trim() || "unknown error"}`);
}

const evidence = JSON.parse(query.stdout.trim().split("\n").at(-1));
const tableNames = evidence.pastoral_tables.names ?? [];
const pastoralRows = Object.values(evidence.pastoral_rows);

if (evidence.migration.latest !== "037" || evidence.migration.migration_037_count !== 1) {
  fail("migration ledger does not contain exactly one migration 037 as its latest entry");
}
pass("migration ledger contains exactly one migration 037 as its latest entry");

if (JSON.stringify(tableNames) !== JSON.stringify(EXPECTED_TABLES)) {
  fail("live pastoral table inventory differs from the approved nine-table design");
}
pass("live pastoral table inventory matches the approved nine-table design");

if (evidence.pastoral_tables.rls_enabled !== 9 || evidence.pastoral_tables.rls_forced !== 9) {
  fail("not all pastoral tables have RLS enabled and forced");
}
pass("all nine pastoral tables have RLS enabled and forced");

if (evidence.browser_privileges !== 0) fail("a browser database role has a pastoral table grant");
pass("browser database roles have no pastoral table grants");

if (
  evidence.service_request_privileges.select !== true ||
  evidence.service_request_privileges.insert !== false ||
  evidence.service_request_privileges.update !== false ||
  evidence.service_request_privileges.delete !== false
) {
  fail("support-request service-role privileges are broader than approved");
}
pass("support-request service-role writes remain restricted to controlled functions");

if (evidence.capability.column_default !== "false") fail("pastoral capability does not default to false");
if (evidence.capability.enabled_organisations !== 0) fail("one or more organisations were enabled");
pass("pastoral capability defaults off and no organisation is enabled");

if (!pastoralRows.every((value) => value === 0)) fail("pastoral records were unexpectedly created");
pass("no pastoral records exist after schema application");

console.log(JSON.stringify(evidence, null, 2));
