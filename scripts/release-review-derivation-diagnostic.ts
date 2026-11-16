/** Exact unchanged service-derived Operations command, executed under rollback.
 * Canonical fictional service context only: this is not browser authentication.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME,repo=process.cwd(),reviewDatabase=process.env.RELEASE_DIAGNOSTIC_TEST_DATABASE;
 if(!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??"")||!repo.endsWith("/engineering-worktrees/verification"))throw Error("Dedicated local verifier required");
 const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),manifest=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8")),marker=JSON.parse(readFileSync(`${root}/workspace-recovery-application.json`,"utf8"));
 const tenant=manifest.tenants.find((item:{key:string})=>item.key==="a"),user=tenant.users.find((item:{key:string})=>item.key==="employee"),db=new URL(state.env.DB_URL),api=new URL(state.env.API_URL);
 if(db.hostname!=="127.0.0.1"||api.hostname!=="127.0.0.1"||!manifest.synthetic||manifest.environment!=="local"||marker.parentRun!==manifest.run||marker.organisationId!==tenant.id||marker.employeeId!==user.personId||!/^application-[a-f0-9-]{36}$/.test(marker.applicationId))throw Error("Exact fictional recovery application required");
 process.env.NEXT_PUBLIC_SUPABASE_URL=api.origin;process.env.SUPABASE_SERVICE_ROLE_KEY=state.env.SERVICE_ROLE_KEY;
 const originalFetch=globalThis.fetch,headers={apikey:state.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${state.env.SERVICE_ROLE_KEY}`};
 const membershipResponse=await originalFetch(`${api.origin}/rest/v1/levytate_users?id=eq.${user.membershipId}&select=id,active,auth_binding_status,auth_subject`,{headers});const members=await membershipResponse.json();
 if(!membershipResponse.ok||members.length!==1||!members[0].active||members[0].auth_binding_status!=="bound"||!members[0].auth_subject)throw Error("Current canonical fictional membership required");
 const session={email:user.email,authSubject:members[0].auth_subject,authMode:"supabase_email",accessLevel:"beta_user",issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300};
 const args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"],env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)};
 const sql=(input:string,database=env.PGDATABASE)=>spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql",args,{input,encoding:"utf8",env:{...env,PGDATABASE:database}});
 const literal=(value:unknown)=>value==null?"null":`'${String(value).replaceAll("'","''")}'`;
 const snapshot=()=>{const r=sql(`select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.levytate_operational_actions a where application_id=${literal(marker.applicationId)};`);if(r.status)throw Error("Read-only snapshot failed");return r.stdout.trim();};
 if(reviewDatabase){if(reviewDatabase!=="levytate_release_operations_review28")throw Error("Exact dedicated candidate database required");const fingerprint=sql("select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)'::regprocedure;",reviewDatabase);if(fingerprint.status||fingerprint.stdout.trim()!=="2c71209d6fb0d8bc6954bd9af1bae69cea22ccd2266d00a4fe84e382dc8d62e9")throw Error("Exact reviewed candidate28 RPC required");}
 const scalarProbe=sql("select array['detected']||'regenerated';");const scalarArrayLiteralSqlstate=scalarProbe.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??(scalarProbe.status===0?"00000":"unknown");
 const before=snapshot(),diagnostics:Array<{operation:string;sqlstate:string;errorCategory:string;replayed?:boolean;events?:number;receipts?:number;audits?:number}> = [];
 const source=readFileSync("supabase/release-migrations/20261109182509_client_personal_review_derivation.sql","utf8"),knownMessages=new Set([...source.matchAll(/message='([^']+)'/g)].map(match=>match[1]));
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url),method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
  if(url.origin!==api.origin)throw Error("Non-local service access blocked");
  if(method==="GET")return originalFetch(input,init);
  if(url.pathname!=="/rest/v1/rpc/levytate_apply_operational_action"||method!=="POST"||typeof init?.body!=="string")throw Error("Unapproved service mutation blocked");
  const p=JSON.parse(init.body);
  if(p.p_organisation_id!==tenant.id||p.p_actor_user_id!==user.membershipId||p.p_operation!=="create"||p.p_expected_version!==0||p.p_changes?.application_id!==marker.applicationId||p.p_changes?.employee_id!==user.personId||p.p_changes?.action_type!=="review_application"||p.p_request!==null||p.p_probe!==false)throw Error("Unexpected derived command blocked");
  const values=[`${literal(p.p_organisation_id)}::uuid`,`${literal(p.p_actor_user_id)}::uuid`,literal(p.p_action_id),"0",literal(p.p_operation),`${literal(JSON.stringify(p.p_changes))}::jsonb`,`${literal(p.p_source_version)}::timestamptz`,literal(p.p_summary),"null::jsonb","false"];
  let fixture="";
  if(reviewDatabase){
   const org=literal(tenant.id),person=literal(user.personId),application=literal(marker.applicationId),actor=literal(user.membershipId),owner=literal(p.p_changes.owner_user_id);
   const selections=[
    ["levytate_organisations",`id=${org} and slug=${literal(`release-${manifest.run}-a`)}`],
    ["levytate_users",`organisation_id=${org} and id in(${actor},${owner})`],
    ["levytate_employees",`organisation_id=${org} and(id=${person} or id=(select manager_id from public.levytate_employees where organisation_id=${org} and id=${person}))`],
    ["levytate_applications",`organisation_id=${org} and id=${application}`],
    ["levytate_application_history",`organisation_id=${org} and application_id=${application}`],
    ["levytate_operational_actions",`organisation_id=${org} and application_id=${application} and learner_record_id is null`],
   ];
   for(const[table,condition]of selections){const records=sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.${table} r where ${condition};`);if(records.status)throw Error("Fictional source observation unavailable");const rows=JSON.parse(records.stdout.trim());if(!rows.length)throw Error("Exact current source fixture required");fixture+=`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},${literal(JSON.stringify(rows))}::jsonb);`;}
  }
  const commandSql=`select public.levytate_apply_operational_action(${values.join(",")});`;
  const stats=`select jsonb_build_object('events',(select count(*) from public.levytate_operational_action_events where operational_action_id=${literal(p.p_action_id)}),'receipts',(select count(*) from public.levytate_operational_action_receipts where action_id=${literal(p.p_action_id)}),'audits',(select count(*) from public.levytate_audit_events where entity_id=${literal(p.p_action_id)}));`;
  const r=sql(`begin;${fixture}set local role service_role;set local request.jwt.claim.role='service_role';${commandSql}${reviewDatabase?commandSql+stats:""}rollback;`,reviewDatabase);
  if(r.status){const match=r.stderr.match(/ERROR:\s+([A-Z0-9]{5}):\s+([^\n]+)/),code=match?.[1]??"unknown",category=knownMessages.has(match?.[2]??"")?match![2]:"Unclassified database rejection";diagnostics.push({operation:p.p_operation,sqlstate:code,errorCategory:category});return new Response(JSON.stringify({code,message:category}),{status:code.startsWith("PT")?Number(code.slice(2)):400,headers:{"Content-Type":"application/json"}});}
  const output=r.stdout.trim().split("\n");
  if(reviewDatabase){const summary=JSON.parse(output[2]);if(output.length!==3||output[0]!==output[1]||summary.events!==2||summary.receipts!==1||summary.audits!==1)throw Error("Exact regenerated receipt or event counts differ");diagnostics.push({operation:p.p_operation,sqlstate:"00000",errorCategory:"Successful original command and exact retry rolled back",replayed:true,...summary});}
  else diagnostics.push({operation:p.p_operation,sqlstate:"00000",errorCategory:"Successful command rolled back"});
  return new Response(output[0],{status:200,headers:{"Content-Type":"application/json"}});
 };
 let serviceResult="unclassified";
 try{const service=await import(pathToFileURL(`${repo}/lib/server/levytate-operational-actions.ts`).href);await service.synchroniseApplicationReviewOperationalActions(session,[marker.applicationId]);serviceResult="returned";}catch(error){serviceResult=error instanceof Error&&/^[A-Za-z]+Error$/.test(error.name)?error.name:"Error";}finally{globalThis.fetch=originalFetch;}
 const sourceCommit=spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).stdout.trim();if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error("Source commit unavailable");
 const empty=reviewDatabase?sql("select (select count(*) from public.levytate_organisations)+(select count(*) from public.levytate_users)+(select count(*) from public.levytate_employees)+(select count(*) from public.levytate_operational_actions)+(select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from supabase_migrations.schema_migrations);",reviewDatabase):null;
 const result={kind:"actual-service-derived-command-native-rollback-not-authentication-proof",sourceCommit,serviceSourceSha256:createHash("sha256").update(readFileSync(`${repo}/lib/server/levytate-operational-actions.ts`)).digest("hex"),reviewDatabase:reviewDatabase??null,reviewDatabaseEmptyAfterRollback:empty?empty.status===0&&empty.stdout.trim()==="0":null,scalarArrayLiteralSqlstate,diagnostics,serviceResult,actionsUnchanged:before===snapshot()};
 if(!diagnostics.length||!result.actionsUnchanged||(reviewDatabase&&result.reviewDatabaseEmptyAfterRollback!==true))throw Error("Diagnostic did not preserve its exact boundary");
 writeFileSync(`${root}/review-derivation-diagnostic-${Date.now()}.json`,JSON.stringify(result,null,2),{mode:0o600,flag:"wx"});console.log(JSON.stringify(result));
}
void main().catch(()=>{console.error("Bounded review diagnostic failed; private service details withheld");process.exitCode=1;});
