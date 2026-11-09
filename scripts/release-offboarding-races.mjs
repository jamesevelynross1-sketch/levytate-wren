/** Independent schema-only offboarding expiry and external-FK races; no provider calls. */
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const root=process.env.RELEASE_LOCAL_RUNTIME,database=process.env.RELEASE_TEST_DATABASE;
if(!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??"")||!/^levytate_release_offboard_[a-z0-9_]+$/.test(database??""))throw Error("Dedicated local offboarding verifier required");
const db=new URL(JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")).env.DB_URL);if(db.hostname!=="127.0.0.1")throw Error("Loopback only");
const env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:database},bin="/opt/homebrew/opt/postgresql@17/bin/psql",args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"];
const parse=(status,out,err)=>({ok:status===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(bin,args,{env,input,encoding:"utf8"});return parse(r.status,r.stdout,r.stderr);};
const need=input=>{const r=sql(input);if(!r.ok)throw Error(`Local SQLSTATE ${r.code??"connection"}`);return r.value;};
const parallel=input=>new Promise(resolve=>{const p=spawn(bin,args,{env,stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",c=>out+=c);p.stderr.on("data",c=>err+=c);p.on("close",code=>resolve(parse(code,out,err)));p.stdin.end(input);});
const q=v=>`'${String(v).replaceAll("'","''")}'`,j=v=>`${q(JSON.stringify(v))}::jsonb`,ids=Object.fromEntries(["operator","tenant","other","admin","approver","member","case"].map(k=>[k,randomUUID()]));
const tx=input=>`begin;set local role service_role;set local request.jwt.claim.role='service_role';${input}commit;`;
const snapshot=()=>tx(`select public.levytate_offboarding_snapshot(${q(ids.admin)},${q(ids.case)});`);
async function whileLocked(holder,statement){
 let mark;const ready=new Promise(resolve=>mark=resolve);
 const held=new Promise(resolve=>{const p=spawn(bin,args,{env,stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",c=>{out+=c;if(out.includes("LOCKED"))mark();});p.stderr.on("data",c=>err+=c);p.on("close",code=>{mark();resolve(parse(code,out,err));});p.stdin.end(`begin;${holder}select 'LOCKED';select pg_sleep(2);commit;`);});
 await ready;const result=await parallel(statement);if(!(await held).ok)throw Error("Synthetic lock holder failed");return result;
}
let passed=0,failed=0;const check=(label,pass)=>{pass?passed++:failed++;console.log(`${pass?"PASS":"FAIL"} ${label}`);};
try{
 need(`insert into public.levytate_organisations(id,name,slug,status,workspace_template)values(${q(ids.operator)},'Synthetic offboard operator',${q(ids.operator)},'Active','levytate-client-v1'),(${q(ids.tenant)},'Synthetic expiry target',${q(ids.tenant)},'Suspended','levytate-client-v1'),(${q(ids.other)},'Synthetic protected other tenant',${q(ids.other)},'Active','levytate-client-v1');
 insert into public.levytate_users(id,organisation_id,email,role,active,access_level,auth_subject,auth_binding_status,auth_bound_at)values${["admin","approver"].map(k=>`(${q(ids[k])},${q(ids.operator)},${q(`${ids[k]}@example.test`)},'Platform Admin',true,'beta_user',${q(randomUUID())},'bound',now())`).join(",")},(${q(ids.member)},${q(ids.tenant)},${q(`${ids.member}@example.test`)},'Apprenticeship Lead',false,'beta_user',null,'pending',null);
 insert into public.levytate_tenant_offboarding_cases(id,tenant_id,requester_id,approver_id,purpose,status,policy,recipient_public_key,export_expires_at,request_hash,evidence_retain_until,approved_at)values(${q(ids.case)},${q(ids.tenant)},${q(ids.admin)},${q(ids.approver)},'export','approved','{}','synthetic-public-key',clock_timestamp()+interval '1 day','synthetic',clock_timestamp()+interval '30 days',clock_timestamp());`);
 const initial=JSON.parse(need(snapshot()));
 check("snapshot is only the approved synthetic tenant",initial.organisationId===ids.tenant&&initial.tables.levytate_users.length===1&&initial.tables.levytate_users[0].id===ids.member);
 need(`update public.levytate_tenant_offboarding_cases set export_expires_at=clock_timestamp()+interval '1 second' where id=${q(ids.case)};`);
 const waited=await whileLocked(`select pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||${q(ids.tenant)}::text,0));`,snapshot());
 check("snapshot expiry during tenant lock wait is denied",!waited.ok&&["PT403","PT409"].includes(waited.code));
 need(`update public.levytate_tenant_offboarding_cases set export_expires_at=clock_timestamp()+interval '1 second' where id=${q(ids.case)};`);
 const rowWait=await whileLocked(`select id from public.levytate_organisations where id=${q(ids.tenant)} for update;`,snapshot());
 check("snapshot expiry during later organisation row lock is denied",!rowWait.ok&&rowWait.code==="PT409");
 need(`update public.levytate_tenant_offboarding_cases set status='exported',encrypted_package='{"version":"synthetic-ciphertext-only"}',export_expires_at=clock_timestamp()+interval '1 second' where id=${q(ids.case)};`);
 const delayedDownload=await whileLocked("lock table public.levytate_tenant_offboarding_events in share mode;",tx(`select public.levytate_offboarding_download(${q(ids.admin)},${q(ids.case)});`));
 check("download expiry during audit wait returns no package and rolls back issuance",!delayedDownload.ok&&delayedDownload.code==="PT409"&&need(`select (issued_at is null)::text from public.levytate_tenant_offboarding_cases where id=${q(ids.case)};`)==="true"&&need(`select count(*) from public.levytate_tenant_offboarding_events where case_id=${q(ids.case)};`)==="0");
 const inserts=[
  ["CASCADE prospect reference",`insert into public.levytate_prospect_access(organisation_id,user_id)values(${q(ids.other)},${q(ids.member)});`],
  ["SET NULL external connection reference",`insert into public.levytate_external_tenant_connections(organisation_id,provider,external_tenant_id,connected_by)values(${q(ids.other)},'microsoft_entra',${q(randomUUID())},${q(ids.member)});`],
  ["global provider ownership reference",`insert into public.levytate_provider_memberships(provider_id,email,role,active,created_by)values('synthetic',${q(`${randomUUID()}@example.test`)},'Provider User',false,${q(ids.member)});`],
 ];
 for(const[label,statement]of inserts){
  need(`update public.levytate_tenant_offboarding_cases set status='requested',export_expires_at=clock_timestamp()+interval '1 day' where id=${q(ids.case)};`);
  const result=await whileLocked(`select pg_advisory_xact_lock(hashtextextended('offboard-tenant:'||${q(ids.tenant)}::text,0));update public.levytate_tenant_offboarding_cases set status='approved' where id=${q(ids.case)};`,statement);
  check(`${label} waiting behind approval is denied`,!result.ok&&result.code==="PT409");
 }
 check("rejected cross-tenant references leave other tenant untouched",need(`select (select count(*) from public.levytate_prospect_access where organisation_id=${q(ids.other)})||':'||(select count(*) from public.levytate_external_tenant_connections where organisation_id=${q(ids.other)})||':'||(select count(*) from public.levytate_organisations where id=${q(ids.other)} and status='Active');`)==="0:0:1");
 check("schema-only independent races create no Auth identities or Storage bytes",need("select (select count(*) from auth.users)||':'||(select count(*) from storage.objects);")==="0:0");
}catch(error){failed++;console.error(`FAIL independent offboarding execution: ${error.message}`);}
console.log(`Independent offboarding races: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
