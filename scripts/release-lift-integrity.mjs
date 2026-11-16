/** Independent Lift transaction tests. Synthetic SQL evidence, not Auth/UI acceptance. */
import{spawn,spawnSync}from"node:child_process";import{randomUUID}from"node:crypto";
const host=process.env.RELEASE_PGHOST,database=process.env.RELEASE_PGDATABASE;
if(host!=="127.0.0.1"||!/^levytate_release_[a-z0-9_]+$/.test(database??""))throw new Error("Dedicated local Lift verifier required");
const bin=process.env.RELEASE_PSQL??"psql",args=["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-h",host,"-p",process.env.RELEASE_PGPORT,"-U",process.env.RELEASE_PGUSER,"-d",database];
const q=v=>`'${String(v).replaceAll("'","''")}'`,j=v=>`${q(JSON.stringify(v))}::jsonb`,parse=(status,out,err)=>({ok:status===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(bin,args,{input,encoding:"utf8"});return parse(r.status,r.stdout,r.stderr);};
const need=input=>{const r=sql(input);if(!r.ok)throw new Error(`Fixture SQLSTATE ${r.code??"connection"}`);return r.value;};
const parallel=input=>new Promise(resolve=>{const p=spawn(bin,args,{stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",v=>{out+=v;});p.stderr.on("data",v=>{err+=v;});p.on("close",code=>resolve(parse(code,out,err)));p.stdin.end(input);});
const service="begin;set local role service_role;set local request.jwt.claim.role='service_role';";
const id=Object.fromEntries(["org","other","lead","employee","manager","otherEmployee","campaign","participant","assessment","revision","observation","managerRevision"].map(k=>[k,randomUUID()])),prefix=randomUUID().slice(0,8),person=`lift-person-${prefix}`,manager=`lift-manager-${prefix}`;
let passed=0,failed=0;const check=(label,ok)=>{ok?passed++:failed++;console.log(`${ok?"PASS":"FAIL"} ${label}`);};
const write=(table,kind,key,row)=>({table:`levytate_lift_${table}`,kind,key:{id:key},row});
const command=(action,revision,fields={})=>({action,idempotencyKey:randomUUID(),expectedWorkspaceRevision:revision,...fields});
const rpc=(actor,cmd,writes,probe=false)=>`select public.levytate_apply_lift_command(${q(id.org)},${q(id[actor])},${j(cmd)},${probe},${j(writes)});`;
const invoke=(actor,cmd,writes,probe=false)=>need(service+rpc(actor,cmd,writes,probe)+"commit;");
const deny=(label,actor,cmd,writes,codes=["PT403","PT404","PT409","PT422"],probe=false)=>{const r=sql(service+rpc(actor,cmd,writes,probe)+"commit;");check(label,!r.ok&&codes.includes(r.code));};
const version=()=>need(`select revision from public.levytate_lift_workspace_revisions where organisation_id=${q(id.org)};`);
try{
  need(`insert into public.levytate_organisations(id,name,slug,status)values(${q(id.org)},'Synthetic Lift verifier',${q(`lift-${prefix}`)},'Active'),(${q(id.other)},'Synthetic other Lift',${q(`other-lift-${prefix}`)},'Active');
  insert into public.levytate_users(id,organisation_id,email,role,access_level,active)values ${["lead","employee","manager","otherEmployee"].map(k=>`(${q(id[k])},${q(k==="otherEmployee"?id.other:id.org)},${q(`${prefix}.${k}@example.test`)},${q(k==="lead"?"Apprenticeship Lead":k==="manager"?"Line Manager":"Employee")},'beta_user',true)`).join(",")};
  insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date,manager_id)values
   (${q(id.org)},${q(manager)},'manager','Synthetic Lift Manager',${q(`${prefix}.manager@example.test`)},'Synthetic manager','Synthetic','Line Manager','Active',current_date,''),
   (${q(id.org)},${q(person)},'employee','Synthetic Lift Employee',${q(`${prefix}.employee@example.test`)},'Synthetic employee','Synthetic','Employee','Active',current_date,${q(manager)});
  insert into public.levytate_organisation_capabilities(organisation_id,lift_enabled)values(${q(id.org)},false);`);
  const invite=command("invite_people",0,{employeeIds:[person]});
  const invitation=[
   write("campaigns","insert",id.campaign,{id:id.campaign,organisation_id:id.org,title:"Synthetic transaction only",business_objective:"Verify persistence, not assess a person",status:"open",created_by:id.lead,framework_key:"lift-workforce-v1",questionnaire_version:"lift-workforce-questionnaire-v1.1",interpretation_version:"lift-workforce-rules-v1.1"}),
   write("participants","insert",id.participant,{id:id.participant,organisation_id:id.org,campaign_id:id.campaign,employee_id:person,manager_employee_id:manager,employee_name_snapshot:"Synthetic employee"}),
   write("assessments","insert",id.assessment,{id:id.assessment,organisation_id:id.org,campaign_id:id.campaign,participant_id:id.participant,employee_id:person,framework_key:"lift-workforce-v1",questionnaire_version:"lift-workforce-questionnaire-v1.1",interpretation_version:"lift-workforce-rules-v1.1"}),
   write("assessment_revisions","insert",id.revision,{id:id.revision,organisation_id:id.org,assessment_id:id.assessment,revision_number:1,created_by:id.lead}),
   write("manager_observations","insert",id.observation,{id:id.observation,organisation_id:id.org,campaign_id:id.campaign,participant_id:id.participant,employee_id:person,manager_employee_id:manager}),
   write("manager_observation_revisions","insert",id.managerRevision,{id:id.managerRevision,organisation_id:id.org,observation_id:id.observation,revision_number:1,created_by:id.lead,observed_work:"",observation_recency:"",opportunity_to_observe:"not_enough",support_degree:"not_observed"}),
  ];
  deny("default-disabled Lift rejects all writes","lead",invite,invitation,["PT404"]);
  need(`update public.levytate_organisation_capabilities set lift_enabled=true where organisation_id=${q(id.org)};`);
  deny("Employee cannot invite a Lift campaign","employee",invite,invitation,["PT403"]);
  deny("cross-tenant actor cannot mutate Lift","otherEmployee",invite,invitation,["PT403"]);
  const unclaimed=sql("begin;set local role service_role;"+rpc("lead",invite,invitation)+"rollback;");check("unclaimed database role cannot impersonate server credential",!unclaimed.ok&&unclaimed.code==="PT403");
  deny("partial invitation cannot leave a campaign without participants","lead",invite,invitation.slice(0,1),["PT422"]);
  check("failed invitation leaves no campaign or receipt",need(`select (select count(*) from public.levytate_lift_campaigns where organisation_id=${q(id.org)})||':'||(select count(*) from public.levytate_lift_command_receipts where organisation_id=${q(id.org)});`)==="0:0");
  const invited=invoke("lead",invite,invitation);check("complete invitation commits six related rows atomically",JSON.parse(invited).revision===1&&need(`select count(*) from public.levytate_lift_manager_observation_revisions where organisation_id=${q(id.org)};`)==="1");
  check("exact invitation probe returns durable original receipt",invoke("lead",invite,[],true)===invited);
  deny("receipt cannot be reused for a different command","lead",{...invite,title:"different"},invitation,["PT409"]);
  const draft=(value)=>[write("assessment_revisions","update",id.revision,{answers:{check_01:value}}),write("assessments","update",id.assessment,{current_question_index:1})];
  const saves=["first","second"].map(value=>({cmd:command("save_assessment",1,{assessmentId:id.assessment,expectedRevision:1,answers:{check_01:value}}),writes:draft(value)}));
  const race=await Promise.all(saves.map(s=>parallel(service+rpc("employee",s.cmd,s.writes)+"commit;")));
  check("concurrent drafts with same workspace revision yield one commit",race.filter(r=>r.ok).length===1&&race.some(r=>r.code==="PT409")&&version()==="2");
  const winner=saves[race.findIndex(r=>r.ok)],before=need(`select answers::text from public.levytate_lift_assessment_revisions where id=${q(id.revision)};`);
  check("lost-response draft retry returns same result without second audit",invoke("employee",winner.cmd,winner.writes)===race.find(r=>r.ok).value&&need(`select count(*) from public.levytate_audit_events where organisation_id=${q(id.org)} and action='lift.save_assessment';`)==="1");
  const fresh=command("save_assessment",2,{assessmentId:id.assessment,expectedRevision:1});
  deny("Lead cannot write Employee's private draft","lead",fresh,draft("forged"),["PT403"]);
  deny("manager cannot write Employee's private draft","manager",fresh,draft("forged"),["PT403"]);
  deny("Employee cannot rewrite immutable assessment owner","employee",fresh,[...draft("forged"),write("assessments","update",id.assessment,{employee_id:"foreign"})],["PT403"]);
  check("late write rejection rolls back earlier answers and revision",need(`select answers::text from public.levytate_lift_assessment_revisions where id=${q(id.revision)};`)===before&&version()==="2");
  const constraint=`release_lift_audit_${prefix}`;need(`alter table public.levytate_audit_events add constraint ${constraint} check(organisation_id<>${q(id.org)}::uuid or action<>'lift.save_assessment') not valid;`);
  let auditFailure;try{auditFailure=sql(service+rpc("employee",fresh,draft("audit failure"))+"commit;");}finally{need(`alter table public.levytate_audit_events drop constraint ${constraint};`);}
  check("audit failure aborts domain writes and command receipt",!auditFailure.ok&&auditFailure.code==="23514"&&version()==="2"&&need(`select answers::text from public.levytate_lift_assessment_revisions where id=${q(id.revision)};`)===before);
  const managerSave=command("save_manager_perspective",2,{employeeId:person,expectedRevision:1});
  const managerWrites=[write("manager_observation_revisions","update",id.managerRevision,{observed_work:"Synthetic independent manager observation",observation_recency:"Today",opportunity_to_observe:"enough",support_degree:"some_support"})];
  need(`update public.levytate_employees set manager_id='' where organisation_id=${q(id.org)} and id=${q(person)};`);
  deny("reassigned manager immediately loses observation write authority","manager",managerSave,managerWrites,["PT403"]);
  need(`update public.levytate_employees set manager_id=${q(manager)} where organisation_id=${q(id.org)} and id=${q(person)};`);
  check("current manager independently saves their own observation",JSON.parse(invoke("manager",managerSave,managerWrites)).revision===3);
  const submitManager=command("submit_manager_perspective",3,{employeeId:person,expectedRevision:1}),now=new Date().toISOString();
  const submittedWrites=[write("manager_observations","update",id.observation,{status:"submitted",active_submission_revision:1,submitted_at:now}),write("manager_observation_revisions","update",id.managerRevision,{status:"submitted",submitted_at:now})];
  check("manager submission commits independently without releasing employee draft",JSON.parse(invoke("manager",submitManager,submittedWrites)).revision===4&&need(`select status from public.levytate_lift_manager_observations where id=${q(id.observation)};`)==="submitted");
  const contextCmd=command("record_employee_context",4,{managerObservationId:id.observation});
  deny("Employee cannot see or add context before independent release","employee",contextCmd,[write("employee_observation_contexts","insert",randomUUID(),{id:randomUUID(),organisation_id:id.org,observation_id:id.observation,employee_id:person,context:"Synthetic context",created_by:id.employee})],["PT403"]);
  deny("submitted manager perspective is immutable","manager",command("save_manager_perspective",4,{employeeId:person,expectedRevision:1}),managerWrites,["PT409"]);
  for(const role of["anon","authenticated"]){const r=sql(`begin;set local role ${role};set local request.jwt.claim.role=${q(role)};${rpc("employee",fresh,draft("forged"))}rollback;`);check(`${role} cannot call privileged Lift command`,!r.ok&&r.code==="42501");}
  const direct=sql(service+`update public.levytate_lift_assessments set status='submitted' where id=${q(id.assessment)};rollback;`);check("service role cannot bypass command boundary with direct UPDATE",!direct.ok&&direct.code==="42501");
  need(`update public.levytate_organisation_capabilities set lift_enabled=false where organisation_id=${q(id.org)};`);
  deny("capability revocation denies even historical receipt probe","lead",invite,[],["PT404"],true);
  check("other tenant never receives any Lift rows",need(`select count(*) from public.levytate_lift_campaigns where organisation_id=${q(id.other)};`)==="0");
}catch(error){failed++;console.error(`FAIL independent Lift execution ${error.message}`);}
console.log(`Independent Lift integrity: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
