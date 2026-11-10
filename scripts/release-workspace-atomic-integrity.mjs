/** Independent two-session races and failure injection in a dedicated local DB. */
import{spawn,spawnSync}from"node:child_process";import{randomUUID}from"node:crypto";
const host=process.env.RELEASE_PGHOST,database=process.env.RELEASE_PGDATABASE;
if(host!=="127.0.0.1"||!/^levytate_release_[a-z0-9_]+$/.test(database??""))throw new Error("Dedicated local workspace verifier required");
const bin=process.env.RELEASE_PSQL??"psql",args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-h",host,"-p",process.env.RELEASE_PGPORT,"-U",process.env.RELEASE_PGUSER,"-d",database];
const q=v=>`'${String(v).replaceAll("'","''")}'`,j=v=>q(JSON.stringify(v))+"::jsonb",parse=(code,out,err)=>({ok:code===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(bin,args,{input,encoding:"utf8"});return parse(r.status,r.stdout,r.stderr);},need=input=>{const r=sql(input);if(!r.ok)throw new Error(`Fixture SQLSTATE ${r.code??"connection"}`);return r.value;};
const concurrent=input=>new Promise(resolve=>{const p=spawn(bin,args,{stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",v=>{out+=v;});p.stderr.on("data",v=>{err+=v;});p.on("close",code=>resolve(parse(code,out,err)));p.stdin.end(input);});
const service="begin;set local role service_role;set local request.jwt.claim.role='service_role';";
const ids=Object.fromEntries(["org","other","lead","secondLead","employee","otherLead"].map(k=>[k,randomUUID()])),prefix=randomUUID().slice(0,8),person=`race-${prefix}`;
const row={id:person,employee_number:person,name:"Synthetic race A",email:`${person}@example.test`,job_title:"Synthetic analyst",role_id:"",manager_id:"",department:"Synthetic",site:"",platform_role:"Employee",status:"Active",start_date:"2026-01-01"};
const rpc=(actor,action,id,revision,record,organisation=ids.org)=>`select public.levytate_workspace_command(${q(organisation)},${q(ids[actor])},${q(action)},${q(id)},${revision},${j(record)});`;
const call=(...a)=>JSON.parse(need(service+rpc(...a)+"commit;"));
let passed=0,failed=0;const check=(label,ok)=>{ok?passed++:failed++;console.log(`${ok?"PASS":"FAIL"} ${label}`);};
const deny=(label,actor,action,id,revision,record,codes=["PT403","PT409","PT422"])=>{const r=sql(service+rpc(actor,action,id,revision,record)+"commit;");check(label,!r.ok&&codes.includes(r.code));};
try{
 need(`begin;insert into public.levytate_organisations(id,name,slug,status)values(${q(ids.org)},'Synthetic race',${q(`workspace-${prefix}`)},'Active'),(${q(ids.other)},'Synthetic other',${q(`workspace-other-${prefix}`)},'Active');insert into public.levytate_users(id,organisation_id,email,role,active,access_level)values${["lead","secondLead","employee","otherLead"].map(k=>`(${q(ids[k])},${q(k==="otherLead"?ids.other:ids.org)},${q(k==="employee"?row.email:`${prefix}.${k}@example.test`)},${q(k==="employee"?"Employee":"Apprenticeship Lead")},true,'beta_user')`).join(",")};commit;`);
 deny("Employee cannot save People administrative records","employee","saveEmployee",person,0,row,["PT403"]);
 deny("another tenant Lead cannot write People","otherLead","saveEmployee",person,0,row,["PT403"]);
 deny("unknown tenant or role fields cannot be smuggled","lead","saveEmployee",person,0,{...row,organisation_id:ids.other},["PT422"]);
 const inputs=[row,{...row,name:"Synthetic race B"}],actors=["lead","secondLead"];
 const races=await Promise.all(inputs.map((r,i)=>concurrent(service+rpc(actors[i],"saveEmployee",person,0,r)+"commit;")));
 check("two same-base different-payload writers yield one commit and one409",races.filter(r=>r.ok).length===1&&races.some(r=>r.code==="PT409"));
 const winner=races.findIndex(r=>r.ok),result=JSON.parse(races[winner].value);
 check("winning command stores exactly one People row and one audit",need(`select (select count(*) from public.levytate_employees where organisation_id=${q(ids.org)} and id=${q(person)})||':'||(select count(*) from public.levytate_audit_events where organisation_id=${q(ids.org)} and entity_id=${q(person)});`)==="1:1");
 check("lost-response retry returns original version without second audit",call(actors[winner],"saveEmployee",person,0,{...inputs[winner],updated_at:"2000-01-01T00:00:00Z"}).replayed===true&&need(`select count(*) from public.levytate_audit_events where organisation_id=${q(ids.org)};`)==="1");
 const before=need(`select name||':'||(select revision from public.levytate_workspace_entity_versions where organisation_id=${q(ids.org)} and entity_key=${q(`levytate_employees:${person}`)}) from public.levytate_employees where organisation_id=${q(ids.org)} and id=${q(person)};`),constraint=`release_workspace_audit_${prefix}`;
 need(`alter table public.levytate_audit_events add constraint ${constraint} check(organisation_id<>${q(ids.org)}::uuid) not valid;`);
 let rejected;try{rejected=sql(service+rpc("lead","saveEmployee",person,result.revision,{...inputs[winner],name:"Must roll back"})+"commit;");}finally{need(`alter table public.levytate_audit_events drop constraint ${constraint};`);}
 check("injected audit outage aborts existing-row update",!rejected.ok&&rejected.code==="23514");
 check("audit failure preserves previous row and revision",need(`select name||':'||(select revision from public.levytate_workspace_entity_versions where organisation_id=${q(ids.org)} and entity_key=${q(`levytate_employees:${person}`)}) from public.levytate_employees where organisation_id=${q(ids.org)} and id=${q(person)};`)===before);
 check("audit failure creates no success receipt",need(`select count(*) from public.levytate_workspace_command_receipts where organisation_id=${q(ids.org)};`)==="1");
 const recovered=call("lead","saveEmployee",person,result.revision,{...inputs[winner],name:"Recovered durable edit"});
 check("unchanged retry after outage commits row and audit atomically",recovered.revision>result.revision&&need(`select count(*) from public.levytate_audit_events where organisation_id=${q(ids.org)};`)==="2");
 deny("stale editor after reconnect cannot overwrite newer edit","secondLead","saveEmployee",person,result.revision,{...inputs[winner],name:"Stale edit"},["PT409"]);
 const profile={employee_id:person,stage:"role_context",responsibilities:["Synthetic individual draft"],conversation_profile:{synthetic:true}};
 check("genuine individual profile command produces durable receipt",call("employee","saveEmployeeDevelopmentProfile",person,0,profile).revision===1);
 call("lead","archiveEmployee",person,recovered.revision,{status:"Archived"});
 check("People archival atomically revokes associated membership",need(`select (not active and invitation_status='revoked')::text from public.levytate_users where id=${q(ids.employee)};`)==="true");
 deny("revoked Employee cannot replay an old private profile receipt","employee","saveEmployeeDevelopmentProfile",person,0,profile,["PT403"]);
 for(const role of["anon","authenticated"]){const r=sql(`begin;set local role ${role};${rpc("lead","saveEmployee",person,0,row)}rollback;`);check(`${role} cannot execute the workspace transaction`,!r.ok&&r.code==="42501");}
 check("service cannot update append-only audit or inspect receipts",need("select (not has_table_privilege('service_role','public.levytate_audit_events','update') and not has_table_privilege('service_role','public.levytate_workspace_command_receipts','select'))::text;")==="true");
}catch(error){failed++;console.error(`FAIL independent workspace execution ${error.message}`);}
console.log(`Independent workspace atomic integrity: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
