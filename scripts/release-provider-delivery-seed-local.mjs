/** Fictional provider and employer consent on the exclusively owned loopback stack. */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { releaseBackend } from "./release-local-fixtures.mjs";

const root=process.env.RELEASE_LOCAL_RUNTIME;
if (process.env.RELEASE_PROVIDER_DELIVERY_LOCAL_ENABLE!=="true" || process.env.VERCEL_ENV
  || process.env.NODE_ENV==="production"
  || !/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??""))
  throw Error("BLOCKED: fictional provider seed requires disposable local stack");
const manifest=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8"));
if (!manifest.synthetic || manifest.environment!=="local" || manifest.tenants?.length!==2)
  throw Error("BLOCKED: exact two synthetic employers required");
const backend=releaseBackend();
const a=manifest.tenants.find(item=>item.key==="a"),b=manifest.tenants.find(item=>item.key==="b");
const lead=a.users.find(item=>item.key==="lead");
if(!lead?.membershipId || !b?.id || !manifest.catalogue?.providerId || !manifest.catalogue?.programmeId)
  throw Error("BLOCKED: fictional provider assignment unavailable");
const providerId=manifest.catalogue.providerId;
const memberId=randomUUID();
const providerEmail=`release.${manifest.run}.provider.primary@example.test`;
const auth=await backend("auth/v1/admin/users","POST",{
  email:providerEmail,email_confirm:true,app_metadata:{release_fixture:manifest.run},
});
if(!auth?.id)throw Error("BLOCKED: local GoTrue provider identity unavailable");
await backend("rest/v1/levytate_provider_memberships","POST",{
  id:memberId,provider_id:providerId,email:providerEmail,display_name:"Synthetic delivery provider",
  role:"Provider User",active:true,auth_subject:auth.id,auth_binding_status:"bound",
  auth_bound_at:new Date().toISOString(),
});
for(const organisationId of [a.id,b.id]){
  const existing=await backend(`rest/v1/levytate_organisation_capabilities?organisation_id=eq.${organisationId}&select=organisation_id`);
  if(existing.length) await backend(`rest/v1/levytate_organisation_capabilities?organisation_id=eq.${organisationId}`,"PATCH",{provider_delivery_enabled:true});
  else await backend("rest/v1/levytate_organisation_capabilities","POST",{
    organisation_id:organisationId,provider_delivery_enabled:true,
  });
}
const grant=await backend("rest/v1/rpc/levytate_set_provider_delivery_grant","POST",{
  p_organisation_id:a.id,p_actor_user_id:lead.membershipId,p_provider_id:providerId,p_enabled:true,
});
if(grant?.enabled!==true)throw Error("BLOCKED: local employer consent not confirmed");
// A real enrolled fictional learner with a verified target/progress baseline.
// Direct SQL is permitted only for THIS disposable fixture, not application code.
const learnerId=`provider-synthetic-${manifest.run}`;
const employee=a.users.find(item=>item.key==="employee");
const validUuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value??"");
if(!validUuid(a.id)||!validUuid(manifest.run)||employee?.personId!=="a-employee"
  ||providerId!==`synthetic-${manifest.run}`
  ||manifest.catalogue.programmeId!==`synthetic-programme-${manifest.run}`)
  throw Error("BLOCKED: synthetic learner fixture identities changed");
const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8"));
const db=new URL(state.env.DB_URL);
if(db.hostname!=="127.0.0.1" || !["postgres:","postgresql:"].includes(db.protocol))
  throw Error("BLOCKED: local learner baseline database must be loopback");
const sql=`begin;
insert into public.levytate_learner_records(
  organisation_id,id,employee_id,programme_id,provider_id,lifecycle_status,
  employment_route,actual_start_date,expected_end_date,record_status,demonstration_record
) values(
  '${a.id}','${learnerId}','a-employee','${manifest.catalogue.programmeId}','${providerId}',
  'enrolled','existing_employee_upskill',current_date-50,current_date+180,'Active',false
);
insert into public.levytate_learner_progress_updates(
  organisation_id,id,learner_record_id,update_date,target_progress_percentage,actual_progress_percentage,
  variance_percentage,progress_source,source_reference,summary
) values(
  '${a.id}','provider-baseline-${manifest.run}','${learnerId}',current_date-2,40,30,-10,
  'manual_l_and_d_update','local-acceptance-baseline','Fictional learner baseline with approved target.'
);
commit;`;
const psql=spawnSync(process.env.RELEASE_PSQL??"/usr/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{
  input:sql,encoding:"utf8",
  env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,
    PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},
});
if(psql.status!==0)throw Error("BLOCKED: synthetic learner baseline could not be created safely");
const evidence={synthetic:true,environment:"local",run:manifest.run,providerId,memberId,
  providerEmail,organisationId:a.id,ungrantedOtherEmployerId:b.id,
  programmeId:manifest.catalogue.programmeId,leadEmail:lead.email,learnerId};
writeFileSync(`${root}/provider-delivery-fixture.json`,JSON.stringify(evidence),{flag:"wx",mode:0o600});
console.log("PASS: one bound fictional provider, one active learner with baseline target, one employer grant; second tenant ungranted");
