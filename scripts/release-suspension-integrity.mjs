/** Independent tenant suspension transactions. Synthetic loopback DB only. */
import{spawnSync,spawn}from"node:child_process";import{randomUUID}from"node:crypto";
const host=process.env.RELEASE_PGHOST,database=process.env.RELEASE_PGDATABASE;
if(!(host==="127.0.0.1"||host==="localhost"||host?.startsWith("/private/tmp/"))||!/^levytate_release_[a-z0-9_]+$/.test(database??""))throw new Error("Dedicated local verifier database required");
const bin=process.env.RELEASE_PSQL??"psql",args=["-X","-A","-t","-q","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-h",host,"-p",process.env.RELEASE_PGPORT??"5432","-U",process.env.RELEASE_PGUSER??"postgres","-d",database];
const q=v=>`'${String(v).replaceAll("'","''")}'`,parse=(code,out,err)=>({ok:code===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(bin,args,{input,encoding:"utf8"});return parse(r.status,r.stdout,r.stderr);};
const need=input=>{const r=sql(input);if(!r.ok)throw new Error(`SQLSTATE ${r.code??"connection"}`);return r.value;};
const concurrent=input=>new Promise(resolve=>{const p=spawn(bin,args,{stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",v=>{out+=v;});p.stderr.on("data",v=>{err+=v;});p.on("close",code=>resolve(parse(code,out,err)));p.stdin.end(input);});
const service="begin;set local role service_role;set local request.jwt.claim.role='service_role';";
let passed=0,failed=0;const check=(label,value)=>{value?passed++:failed++;console.log(`${value?"PASS":"FAIL"} ${label}`);};
const ids=Object.fromEntries(["platform","a","b","race","wrong","admin","lead","employee","pending","bLead","raceUser"].map(k=>[k,randomUUID()])),prefix=randomUUID().slice(0,8);
const email=k=>`${prefix}.${k}@example.test`,reason="Synthetic local acceptance suspension only";
const command=(org=ids.a,actor=ids.admin,key=randomUUID(),why=reason)=>`select public.levytate_suspend_client_tenant(${q(org)}::uuid,${q(actor)}::uuid,${q(why)},${q(key)}::uuid);`;
const deny=(label,input,states=["PT403","PT404","PT409","PT422","42501"])=>{const r=sql(service+input+"commit;");check(label,!r.ok&&states.includes(r.code));};
try{
  console.log(`Environment local PostgreSQL ${need("show server_version;")}`);
  need(`insert into public.levytate_organisations(id,name,slug,workspace_template,status) values ${["platform","a","b","race","wrong"].map(k=>`(${q(ids[k])},'Synthetic suspension',${q(`${prefix}-${k}`)},${q(k==="wrong"?"demo":"levytate-client-v1")},'Active')`).join(",")};
  insert into public.levytate_users(id,organisation_id,email,role,access_level,active,auth_binding_status,auth_subject,auth_bound_at,invitation_status,invitation_generation) values
  (${q(ids.admin)},${q(ids.platform)},${q(email("admin"))},'Platform Admin','beta_user',true,'bound',${q(randomUUID())},now(),'consumed',1),
  (${q(ids.lead)},${q(ids.a)},${q(email("lead"))},'Apprenticeship Lead','beta_user',true,'bound',${q(randomUUID())},now(),'consumed',2),
  (${q(ids.employee)},${q(ids.a)},${q(email("employee"))},'Employee','beta_user',true,'bound',${q(randomUUID())},now(),'consumed',2),
  (${q(ids.pending)},${q(ids.a)},${q(email("pending"))},'Employee','beta_user',false,'pending',null,null,'sending',3),
  (${q(ids.bLead)},${q(ids.b)},${q(email("bLead"))},'Apprenticeship Lead','beta_user',true,'bound',${q(randomUUID())},now(),'consumed',1),
  (${q(ids.raceUser)},${q(ids.race)},${q(email("race"))},'Employee','beta_user',false,'pending',null,null,'sending',0);`);
  deny("employer Lead cannot suspend own tenant",command(ids.a,ids.lead));
  deny("Employee cannot suspend tenant",command(ids.a,ids.employee));
  deny("platform cannot suspend its own authority tenant",command(ids.platform));
  deny("non-client template cannot be suspended",command(ids.wrong));
  deny("missing meaningful reason is rejected",command(ids.a,ids.admin,randomUUID(),"short"));
  const raw=sql("begin;set local role service_role;"+command()+"rollback;");check("bare database role without service JWT claim is denied",!raw.ok&&raw.code==="42501");
  const constraint=`release_suspend_failure_${prefix}`;need(`alter table public.levytate_audit_events add constraint ${constraint} check(organisation_id<>${q(ids.a)}::uuid or action<>'client_workspace.suspended') not valid;`);
  const fail=sql(service+command()+"commit;");need(`alter table public.levytate_audit_events drop constraint ${constraint};`);
  check("audit failure rolls back entire suspension",!fail.ok&&fail.code==="23514"&&need(`select status||':'||(select count(*) from public.levytate_users where organisation_id=${q(ids.a)} and active) from public.levytate_organisations where id=${q(ids.a)};`)==="Active:2");
  const key=randomUUID(),races=await Promise.all([1,2].map(()=>concurrent(service+command(ids.a,ids.admin,key)+"commit;")));
  check("concurrent same request yields identical durable suspension result",races.every(r=>r.ok)&&races[0].value===races[1].value);
  check("all active and pending memberships revoked with independent generations",need(`select count(*) from public.levytate_users where organisation_id=${q(ids.a)} and not active and invitation_status='revoked' and auth_subject is null and auth_bound_at is null and auth_binding_status='pending' and invitation_generation=case when id=${q(ids.pending)} then 4 else 3 end;`)==="3");
  check("other tenant remains active and bound",need(`select active||':'||auth_binding_status from public.levytate_users where id=${q(ids.bLead)};`)==="true:bound");
  check("one audit receipt persisted for concurrent request",need(`select count(*) from public.levytate_audit_events where id=${q(key)};`)==="1");
  deny("same request cannot change suspension reason",command(ids.a,ids.admin,key,reason+" changed"));
  deny("same request cannot target another tenant",command(ids.b,ids.admin,key));
  deny("in-flight invitation cannot reactivate suspended member",`update public.levytate_users set active=true,invitation_status='accepted' where id=${q(ids.pending)};`);
  deny("new active member cannot be added to suspended tenant",`insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values(${q(randomUUID())},${q(ids.a)},${q(email("new"))},'Employee','beta_user',true);`);
  const mixed=await Promise.all([concurrent(service+`update public.levytate_users set active=true,invitation_status='accepted' where id=${q(ids.raceUser)};select pg_sleep(0.15);commit;`),concurrent(service+command(ids.race)+"commit;")]);
  check("invitation completion versus suspension race leaves no active access",mixed[1].ok&&(mixed[0].ok||mixed[0].code==="PT409")&&need(`select active||':'||invitation_status from public.levytate_users where id=${q(ids.raceUser)};`)==="false:revoked");
  for(const role of["anon","authenticated"]){const r=sql(`begin;set local role ${role};set local request.jwt.claim.role=${q(role)};${command(ids.b)}rollback;`);check(`${role} cannot execute client suspension`,!r.ok&&r.code==="42501");}
}catch(error){failed++;console.error(`FAIL independent suspension execution ${error.message}`);}
console.log(`Independent suspension integrity: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
