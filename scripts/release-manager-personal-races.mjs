/** Independent local-only manager/handoff races. No Auth or browser claim. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
const runtime=process.env.RELEASE_LOCAL_RUNTIME,name=process.env.RELEASE_TEST_DATABASE,fixtureFile=process.env.RELEASE_MANAGER_FIXTURE;
if(!runtime?.startsWith("/private/tmp/levytate-release-runtime.")||!/^levytate_release_manager_[a-z0-9]+$/.test(name??"")||!fixtureFile?.endsWith("/tests/manager-personal-development.sql"))throw new Error("Dedicated local database and exact reviewed fixture required");
const fixture=readFileSync(fixtureFile,"utf8");
if(createHash("sha256").update(fixture).digest("hex")!=="a46f0d6878b8ca707f527248d2f57403b2691478947166a2d2484799a76f12c1")throw new Error("Fixture checksum mismatch");
const db=new URL(JSON.parse(readFileSync(`${runtime}/private-stack-state.json`,"utf8")).env.DB_URL);if(db.hostname!=="127.0.0.1")throw new Error("Loopback required");
const env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:name};
const binary="/opt/homebrew/opt/postgresql@17/bin/psql",args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"],checks=[],run=randomUUID();
const quote=v=>`'${String(v).replaceAll("'","''")}'`,json=v=>`${quote(JSON.stringify(v))}::jsonb`;
function query(input){const r=spawnSync(binary,args,{input,env,encoding:"utf8"});return{ok:r.status===0,value:r.stdout.trim(),code:r.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null};}
function need(input){const r=query(input);if(!r.ok)throw new Error(`Independent fixture failed (${r.code??"connection"})`);return r.value;}
function check(label,passed){checks.push({label,passed});console.log(`${passed?"PASS":"FAIL"} ${label}`);}
function concurrent(input,onLock,extra={}){return new Promise(resolve=>{const p=spawn(binary,args,{env:{...env,...extra},stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",data=>{out+=data;if(out.includes("manager-lock-held")){onLock?.();onLock=null;}});p.stderr.on("data",data=>err+=data);p.on("exit",status=>resolve({ok:status===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null}));p.stdin.end(input);});}
const org="61000000-0000-4000-8000-000000000001",catalog="61000000-0000-4000-8000-000000000003",manager="62000000-0000-4000-8000-000000000001",lead="62000000-0000-4000-8000-000000000004";
const service=input=>`begin;set local role service_role;set local request.jwt.claim.role='service_role';${input}commit;`;
const draft=()=>`select public.levytate_apply_application_command('${org}','${manager}','independent-manager-draft','save_draft',0,'independent-manager-draft',${json({employeeId:"manager-dev-manager",apprenticeshipStandardId:"manager-dev-standard",reason:"Synthetic race",careerGoal:"Synthetic personal development",supportRequired:""})});`;
const handoff=()=>`select public.levytate_start_pre_enrolment('${org}','${lead}','independent-manager-approved',0,'independent-manager-handoff',${json({employeeId:"manager-dev-manager",programmeId:"manager-dev-programme",providerId:"manager-dev-provider",employmentRoute:"existing_employee_upskill",expectedStartDate:"2027-01-01",expectedEndDate:"2028-01-01"})});`;
async function suspensionWins(call,label){let held;const ready=new Promise(r=>held=r),owner=concurrent(`begin;select id from public.levytate_organisations where id='${catalog}' for update;select 'manager-lock-held';select pg_sleep(0.35);update public.levytate_organisations set status='Suspended' where id='${catalog}';commit;`,held);await ready;const result=await concurrent(`begin;set local role service_role;${call}rollback;`),suspended=await owner;check(label,suspended.ok&&!result.ok&&result.code==="PT422");need(`update public.levytate_organisations set status='Active' where id='${catalog}';`);}
try{
  // Reuse only the hash-locked synthetic setup, not its assertion implementation.
  const marker="\nsavepoint availability_retired_standard;";
  if(fixture.split(marker).length!==2)throw new Error("Reviewed fixture boundary changed");
  need(`${fixture.split(marker)[0]}commit;`);
  check("all three manager command RPCs remain service-only",need("select bool_and(not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE') and has_function_privilege('service_role',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('levytate_apply_application_command','levytate_apply_learner_command','levytate_start_pre_enrolment');")==="t");
  await suspensionWins(draft(),"catalogue suspension already locking denies manager personal draft");
  let held;const ready=new Promise(r=>held=r),first=concurrent(`begin;set local role service_role;${draft()}select 'manager-lock-held';select pg_sleep(0.5);rollback;`,held);await ready;
  const appName=`manager-suspension-${run}`,second=concurrent(`update public.levytate_organisations set status='Suspended' where id='${catalog}';`,null,{PGAPPNAME:appName});await new Promise(r=>setTimeout(r,80));
  const waited=need(`select exists(select 1 from pg_stat_activity where application_name=${quote(appName)} and wait_event_type='Lock');`)==="t",made=await first,suspended=await second;
  check("manager draft pins canonical availability through transaction completion",waited&&made.ok&&suspended.ok);need(`update public.levytate_organisations set status='Active' where id='${catalog}';`);
  let catalogueHeld;const archiveReady=new Promise(r=>catalogueHeld=r),archive=concurrent("begin;select pg_advisory_xact_lock(hashtextextended('levytate-catalogue-integrity',0));select 'manager-lock-held';select pg_sleep(0.35);update public.levytate_organisation_programmes set status='Inactive' where programme_id='manager-dev-programme';commit;",catalogueHeld);await archiveReady;
  const archivedDraft=await concurrent(`begin;set local role service_role;${draft()}rollback;`),archived=await archive;
  check("employer programme withdrawal while waiting prevents personal draft",archived.ok&&!archivedDraft.ok&&archivedDraft.code==="PT422");need("update public.levytate_organisation_programmes set status='Active' where programme_id='manager-dev-programme';");
  need(`insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner,reason,career_goal)values('${org}','independent-manager-approved','manager-dev-manager','manager-dev-standard','Approved for Enrolment','Provider Partner','Synthetic approved fixture','Synthetic journey');`);
  await suspensionWins(handoff(),"catalogue suspension already locking denies final-approved handoff");
  const duplicate=await Promise.all([concurrent(service(handoff())),concurrent(service(handoff()))]);
  check("concurrent exact handoff yields one durable learner and receipt",duplicate.every(x=>x.ok)&&need(`select (select count(*) from public.levytate_learner_records where organisation_id='${org}' and application_id='independent-manager-approved')||':'||(select count(*) from public.levytate_application_command_receipts where organisation_id='${org}' and idempotency_key='independent-manager-handoff');`)==="1:1");
  const learner=need(`select id from public.levytate_learner_records where organisation_id='${org}' and application_id='independent-manager-approved';`);
  const writes=[{table:"levytate_learner_pre_enrolment_checks",row:{organisation_id:org,id:"independent-precheck",learner_record_id:learner,probation_status:"not_required",hr_approval_status:"approved"}},{table:"levytate_learner_lifecycle_events",row:{organisation_id:org,id:"independent-precheck-event",learner_record_id:learner,event_type:"verification",summary:"Synthetic independent precheck"}}];
  const precheck=`select public.levytate_apply_learner_command('${org}','${lead}',${quote(learner)},'pre_enrolment','independent-precheck','{}',0,${json(writes)},'{"ok":true}',false);`;
  await suspensionWins(precheck,"catalogue suspension already locking denies pre-enrolment verification");
  check("rejected availability leaves no partial checks events or learner revision",need(`select (select count(*) from public.levytate_learner_pre_enrolment_checks where id='independent-precheck')||':'||(select count(*) from public.levytate_learner_lifecycle_events where id='independent-precheck-event')||':'||(select mutation_revision from public.levytate_learner_records where organisation_id='${org}' and id=${quote(learner)});`)==="0:0:0");
  const prechecks=await Promise.all([concurrent(service(precheck)),concurrent(service(precheck))]);
  check("concurrent exact pre-enrolment command records one mutation",prechecks.every(x=>x.ok)&&need(`select mutation_revision from public.levytate_learner_records where organisation_id='${org}' and id=${quote(learner)};`)==="1");
  check("no Auth identities Storage objects or migration ledger fabricated",need("select (select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from supabase_migrations.schema_migrations);")==="0");
}finally{writeFileSync(`${runtime}/manager-independent-${name}-${run}.json`,JSON.stringify({environment:"local-postgresql17-schema-only",database:name,checks}),{mode:0o600,flag:"wx"});console.log(`Independent manager: ${checks.filter(c=>c.passed).length} PASS, ${checks.filter(c=>!c.passed).length} FAIL`);if(checks.some(c=>!c.passed))process.exitCode=1;}
