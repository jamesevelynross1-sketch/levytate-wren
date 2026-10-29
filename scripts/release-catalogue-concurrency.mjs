/** Independent catalogue/application serialization tests; loopback synthetic DB only. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const host=process.env.RELEASE_PGHOST, database=process.env.RELEASE_PGDATABASE;
if(host!=="127.0.0.1"||!/^levytate_release_[a-z0-9_]+$/.test(database??""))throw new Error("Dedicated loopback verifier required");
const bin=process.env.RELEASE_PSQL??"psql",args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-h",host,"-p",process.env.RELEASE_PGPORT,"-U",process.env.RELEASE_PGUSER,"-d",database];
const q=v=>`'${String(v).replaceAll("'","''")}'`,j=v=>q(JSON.stringify(v))+"::jsonb";
const parse=(status,out,err)=>({ok:status===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(bin,args,{input,encoding:"utf8"});return parse(r.status,r.stdout,r.stderr);};
const need=input=>{const r=sql(input);if(!r.ok)throw new Error(`Fixture SQLSTATE ${r.code??"connection"}`);return r.value;};
function running(input){let readyResolve;const ready=new Promise(r=>{readyResolve=r;});const done=new Promise(resolve=>{const p=spawn(bin,args,{stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",v=>{out+=v;if(out.includes("LOCK_HELD"))readyResolve();});p.stderr.on("data",v=>{err+=v;});p.on("close",code=>{readyResolve();resolve(parse(code,out,err));});p.stdin.end(input);});return{ready,done};}
let passed=0,failed=0;const check=(name,ok)=>{ok?passed++:failed++;console.log(`${ok?"PASS":"FAIL"} ${name}`);};
const id=Object.fromEntries(["org","other","lead","employee","manager","catalog"].map(k=>[k,randomUUID()])),p=randomUUID().slice(0,8),standard=`race-standard-${p}`,provider=`race-provider-${p}`,programme=`race-programme-${p}`,role=`race-role-${p}`;
const service="begin;set local role service_role;set local request.jwt.claim.role='service_role';";
const select=(status,org=id.org,actor=id.lead)=>`select public.levytate_select_catalogue(${q(org)},${q(actor)},'provider',${q(provider)},${q(provider)},${q(status)});`;
const submit=(app,key)=>`select public.levytate_apply_application_command(${q(id.org)},${q(id.employee)},${q(app)},'save_and_submit',0,${q(key)},${j({employeeId:`employee-${p}`,apprenticeshipStandardId:standard,reason:"Synthetic catalogue race",careerGoal:"Synthetic development",supportRequired:""})});`;
try{
  const canonical=need("select id from public.levytate_organisations where slug='levytate-internal';")||id.catalog;
  if(canonical===id.catalog)need(`insert into public.levytate_organisations(id,name,slug,status)values(${q(canonical)},'Synthetic catalogue','levytate-internal','Active');`);
  need(`begin;
  insert into public.levytate_organisations(id,name,slug,status)values(${q(id.org)},'Synthetic race tenant',${q(`catalogue-race-${p}`)},'Active'),(${q(id.other)},'Synthetic other tenant',${q(`catalogue-other-${p}`)},'Active');
  insert into public.levytate_users(id,organisation_id,email,role,access_level,active)values ${["lead","manager","employee"].map(k=>`(${q(id[k])},${q(id.org)},${q(`${p}.${k}@example.test`)},${q({lead:"Apprenticeship Lead",manager:"Line Manager",employee:"Employee"}[k])},'beta_user',true)`).join(",")};
  insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route)values(${q(standard)},'Synthetic race standard',${q(standard)},'Approved for delivery',4,'Synthetic');
  insert into public.levytate_roles(organisation_id,id,title,career_level,status)values(${q(id.org)},${q(role)},'Synthetic role','Experienced','Active');
  insert into public.levytate_role_pathway_mappings(organisation_id,id,role_id,apprenticeship_standard_id,recommendation_type)values(${q(id.org)},${q(`map-${p}`)},${q(role)},${q(standard)},'Primary');
  insert into public.levytate_employees(organisation_id,id,employee_number,name,email,platform_role,start_date,role_id,manager_id)values
    (${q(id.org)},${q(`manager-${p}`)},'manager','Synthetic Manager',${q(`${p}.manager@example.test`)},'Line Manager',current_date,${q(role)},''),
    (${q(id.org)},${q(`employee-${p}`)},'employee','Synthetic Employee',${q(`${p}.employee@example.test`)},'Employee',current_date,${q(role)},${q(`manager-${p}`)});
  insert into public.levytate_providers(organisation_id,provider_id,provider_name,provider_type,status,verification_status,last_verified,source_urls)values(${q(canonical)},${q(provider)},'Synthetic race provider','Independent training provider','Active','verified',current_date,'["https://example.test/provider"]');
  insert into public.levytate_provider_programmes(organisation_id,id,provider_id,programme_name,apprenticeship_standard_id,linked_standard_id,linked_standard_ids,status,record_status,verification_status,source_url)values(${q(canonical)},${q(programme)},${q(provider)},'Synthetic race programme',${q(standard)},${q(standard)},${j([standard])},'Active','Active','LevyTate reviewed','https://example.test/programme');
  insert into public.levytate_organisation_providers(organisation_id,provider_id,status)values(${q(id.org)},${q(provider)},'Active'),(${q(id.other)},${q(provider)},'Active');
  insert into public.levytate_organisation_programmes(organisation_id,programme_id,provider_id,status)values(${q(id.org)},${q(programme)},${q(provider)},'Active'),(${q(id.other)},${q(programme)},${q(provider)},'Active');commit;`);
  check("catalogue and workflow share exact transaction lock",need("select (position('levytate-catalogue-integrity' in pg_get_functiondef('public.levytate_apply_application_command(uuid,uuid,text,text,integer,text,jsonb)'::regprocedure))>0)::text;")==="true");
  const deactivate=running(service+select("Inactive")+"select 'LOCK_HELD';select pg_sleep(0.4);commit;");await deactivate.ready;
  const blockedSubmit=running(service+submit(`denied-${p}`,`denied-submit-${p}`)+"commit;");
  const [deactivated,denied]=await Promise.all([deactivate.done,blockedSubmit.done]);
  check("deactivation wins race and commits provider/programme together",deactivated.ok&&need(`select p.status||':'||s.status from public.levytate_organisation_providers p join public.levytate_organisation_programmes s using(organisation_id,provider_id) where p.organisation_id=${q(id.org)} and p.provider_id=${q(provider)};`)==="Inactive:Inactive");
  check("concurrent submit sees committed deactivation and is denied",!denied.ok&&denied.code==="PT422");
  check("denied race leaves no application or command receipt",need(`select (select count(*) from public.levytate_applications where organisation_id=${q(id.org)})||':'||(select count(*) from public.levytate_application_command_receipts where organisation_id=${q(id.org)});`)==="0:0");
  check("deactivation leaves second tenant selection active",need(`select status from public.levytate_organisation_programmes where organisation_id=${q(id.other)} and programme_id=${q(programme)};`)==="Active");
  need(service+`select public.levytate_select_catalogue(${q(id.org)},${q(id.lead)},'programme',${q(programme)},${q(provider)},'Active');commit;`);
  const submitted=running(service+submit(`accepted-${p}`,`accepted-submit-${p}`)+"select 'LOCK_HELD';select pg_sleep(0.4);commit;");await submitted.ready;
  const nextDeactivation=running(service+select("Inactive")+"commit;");const [accepted,next]=await Promise.all([submitted.done,nextDeactivation.done]);
  check("submission wins opposite race using available catalogue",accepted.ok&&need(`select status from public.levytate_applications where organisation_id=${q(id.org)} and id=${q(`accepted-${p}`)};`)==="Awaiting Manager Review");
  check("later deactivation commits without deleting application history",next.ok&&need(`select count(*) from public.levytate_application_history where organisation_id=${q(id.org)} and application_id=${q(`accepted-${p}`)};`)==="1");
  const archive=sql(`begin;update public.levytate_provider_programmes set record_status='Archived' where organisation_id=${q(canonical)} and id=${q(programme)};commit;`);
  check("other tenant active selection blocks global archive",!archive.ok&&archive.code==="PT409");
  const noSource=sql(`begin;update public.levytate_providers set source_urls='[]' where organisation_id=${q(canonical)} and provider_id=${q(provider)};commit;`);
  check("verified flag cannot replace provenance for selected provider",!noSource.ok&&noSource.code==="PT409");
}catch(error){failed++;console.error(`FAIL independent catalogue execution ${error.message}`);}
console.log(`Independent catalogue concurrency: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
