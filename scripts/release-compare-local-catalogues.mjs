// Read-only independent schema comparison. Never emits connection values or SQL data.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
try {
const [accepted, fresh, destination] = process.argv.slice(2);
if (![accepted, fresh].every(value => /^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(value ?? '')) || accepted === fresh || !destination) throw Error('Two distinct exact local runtime directories and evidence destination required');
const sha = value => createHash('sha256').update(value).digest('hex');
const signature = readFileSync(new URL('../supabase/bootstrap/catalogue_signature.sql', import.meta.url), 'utf8');
function query(runtime, sql) {
  const db = new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`, 'utf8')).env.DB_URL);
  if (db.hostname !== '127.0.0.1') throw Error('Loopback-only database required');
  const result = spawnSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1'], {
    input: `begin read only;\nset local statement_timeout='30s';\n${sql}\ncommit;`, encoding: 'utf8', timeout: 40000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port, PGUSER: db.username, PGPASSWORD: db.password, PGDATABASE: db.pathname.slice(1) },
  });
  if (result.status !== 0) throw Error('Read-only catalogue comparison query failed');
  return result.stdout.trim();
}
const securitySql = `select jsonb_build_object(
  'tableCount',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (c.relname like 'levytate\\_%' escape '\\' or c.relname like 'provider\\_intelligence\\_%' escape '\\')),
  'rlsCount',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and (c.relname like 'levytate\\_%' escape '\\' or c.relname like 'provider\\_intelligence\\_%' escape '\\')),
  'invalidIndexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (not i.indisvalid or not i.indisready)),
  'unvalidatedConstraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated),
  'publicBuckets',(select count(*) from storage.buckets where public),
  'privateBuckets',(select count(*) from storage.buckets where not public),
  'browserColumnGrants',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid cross join lateral aclexplode(a.attacl) acl where n.nspname='public' and (acl.grantee=0 or pg_get_userbyid(acl.grantee) in ('anon','authenticated')))
);`;
const supplementalSql = `select jsonb_build_object(
 'columnGrants',coalesce((select jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'role',case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,'privilege',acl.privilege_type,'grantable',acl.is_grantable) order by c.relname,a.attname,acl.privilege_type,case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid cross join lateral aclexplode(a.attacl) acl where n.nspname='public'),'[]'::jsonb),
 'storageGuards',coalesce((select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true),'function',t.tgfoid::regprocedure::text) order by t.tgname) from pg_trigger t where t.tgrelid='storage.objects'::regclass and not t.tgisinternal and t.tgname like 'levytate%'),'[]'::jsonb),
 'buckets',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'limit',file_size_limit,'mime',allowed_mime_types) order by id) from storage.buckets)
);`;
function inspect(runtime) {
 const catalogue = query(runtime, signature), rows = catalogue.split('\n').map(line => JSON.parse(line));
 const ledger = query(runtime, 'select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m;');
 const parsedLedger = JSON.parse(ledger);
 const supplemental = query(runtime, supplementalSql), extra = JSON.parse(supplemental);
 const browserGrantCount = rows.filter(row => ['table-grant','function-grant','sequence-grant'].includes(row.kind) && /:(PUBLIC|anon|authenticated):/.test(row.key)).length;
 return { postgres: query(runtime, 'show server_version;'), catalogueSha256: sha(catalogue), catalogueRows: rows.length, ledgerSha256: sha(ledger), ledgerEntries: parsedLedger.length, excluded038Absent: parsedLedger.every(row => !String(row.name).match(/(^|_)038(_|$)/)), supplementalSha256: sha(supplemental), storageGuardCount: extra.storageGuards.length, security: { ...JSON.parse(query(runtime, securitySql)), browserGrantCount } };
}
const a=inspect(accepted), b=inspect(fresh);
const empty = JSON.parse(query(fresh, `select jsonb_build_object('authUsers',(select count(*) from auth.users),'authIdentities',(select count(*) from auth.identities),'authSessions',(select count(*) from auth.sessions),'storageObjects',(select count(*) from storage.objects),'employers',(select count(*) from public.levytate_organisations),'people',(select count(*) from public.levytate_employees),'memberships',(select count(*) from public.levytate_users),'applications',(select count(*) from public.levytate_applications),'learners',(select count(*) from public.levytate_learner_records));`));
const registrations = JSON.parse(query(fresh, `select jsonb_build_object('otjRequirements',(select count(*) from public.levytate_standard_otj_requirements),'assessmentFrameworks',(select count(*) from public.levytate_assessment_framework_versions),'liftFrameworks',(select count(*) from public.levytate_lift_framework_versions),'apprenticeshipStandards',(select count(*) from public.levytate_apprenticeship_standards));`));
const checks = {
 samePostgres:a.postgres===b.postgres, exactNormalizedCatalogue:a.catalogueSha256===b.catalogueSha256,
 exactFullLedger:a.ledgerSha256===b.ledgerSha256, exactSupplementalCatalogue:a.supplementalSha256===b.supplementalSha256,
 exactSecurity:JSON.stringify(a.security)===JSON.stringify(b.security), expected28Ledger:b.ledgerEntries===28,
 all135TablesRls:b.security.tableCount===135&&b.security.rlsCount===135, noBrowserGrants:b.security.browserGrantCount===0&&b.security.browserColumnGrants===0,
 validIndexesAndConstraints:b.security.invalidIndexes===0&&b.security.unvalidatedConstraints===0,
 fourPrivateBuckets:b.security.privateBuckets===4&&b.security.publicBuckets===0,
 storageGuardPresent:b.storageGuardCount===1, migration038Excluded:a.excluded038Absent&&b.excluded038Absent,
 freshDataEmpty:Object.values(empty).every(value=>value===0), requiredRegistrations:registrations.otjRequirements===2&&registrations.assessmentFrameworks===3&&registrations.liftFrameworks===1&&registrations.apprenticeshipStandards===0,
};
const evidence={schemaVersion:1,environment:'local',createdAt:new Date().toISOString(),readOnly:true,acceptedRuntime:accepted.split('/').at(-1),freshRuntime:fresh.split('/').at(-1),signatureSourceSha256:sha(signature),accepted:a,fresh:b,freshEmptyCounts:empty,freshRegistrations:registrations,checks,passed:Object.values(checks).every(Boolean),limitations:['Schema/ledger/security parity only; no hosted acceptance or authentication claim.','Application data in the accepted runtime was neither read nor compared.']};
writeFileSync(resolve(destination),`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600,flag:'wx'});
console.log(JSON.stringify(evidence));
if(!evidence.passed)process.exitCode=1;

} catch { console.error("Independent local catalogue comparison failed; private details withheld"); process.exitCode=1; }
