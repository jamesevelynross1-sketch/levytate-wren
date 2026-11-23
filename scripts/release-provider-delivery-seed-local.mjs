/** Fictional provider and employer consent on the exclusively owned loopback stack. */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
const evidence={synthetic:true,environment:"local",run:manifest.run,providerId,memberId,
  providerEmail,organisationId:a.id,ungrantedOtherEmployerId:b.id,
  programmeId:manifest.catalogue.programmeId,leadEmail:lead.email};
writeFileSync(`${root}/provider-delivery-fixture.json`,JSON.stringify(evidence),{flag:"wx",mode:0o600});
console.log("PASS: one bound fictional provider and exactly one employer delivery grant; second tenant ungranted");
