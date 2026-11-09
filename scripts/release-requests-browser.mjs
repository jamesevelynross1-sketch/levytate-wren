/** Real provider and employer sessions. Only fixture setup uses the local owner.
 * Resend is intercepted by a separately reviewed loopback-only SMTP preload;
 * this proves capture and persistence, never external delivery. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export async function verifyRequests({app,mailpit,manifest,contexts,browser,backend,check}) {
  const root=process.env.RELEASE_LOCAL_RUNTIME,tenant=manifest.tenants.find(t=>t.key==="b");
  if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!manifest.synthetic||manifest.environment!=="local"||!/^[-a-f0-9]{36}$/.test(manifest.run)||!/^[-a-f0-9]{36}$/.test(tenant?.id))throw new Error("Exact synthetic local Requests fixture required");
  const db=new URL(JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")).env.DB_URL);
  if(db.hostname!=="127.0.0.1")throw new Error("Requests fixture database must remain loopback");
  function capability(enabled){const r=spawnSync(process.env.RELEASE_PSQL??"/opt/homebrew/opt/postgresql@17/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{encoding:"utf8",env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},input:`insert into public.levytate_organisation_capabilities(organisation_id,requests_enabled) select id,${enabled} from public.levytate_organisations where id='${tenant.id}' and slug='release-${manifest.run}-b' on conflict(organisation_id)do update set requests_enabled=excluded.requests_enabled returning organisation_id;`});if(r.status||r.stdout.trim()!==tenant.id)throw new Error("Local Requests capability update failed");}
  const lead=contexts.get("b:lead"),path=`${app}/api/levytate-requests`,providerPath=`${app}/api/levytate-provider/opportunities`,providers=[];
  const post=(actor,url,body)=>actor.context.request.post(url,{headers:{Origin:app},data:body});
  const request=async(body)=>{const r=await post(lead,path,body);if(r.status()!==200)console.log(`DIAGNOSTIC Requests ${body.action} status ${r.status()}`);check(`Requests ${body.action} persists through authenticated API`,r.status()===200);return(await r.json()).workspace;};
  const capture=async(email,subject,after)=>{for(let i=0;i<40;i++){const list=await fetch(`${mailpit}/api/v1/messages`).then(r=>r.json());const found=list.messages?.find(m=>m.To?.some(to=>to.Address===email)&&m.Subject===subject&&new Date(m.Created).getTime()>=after-1000);if(found)return fetch(`${mailpit}/api/v1/message/${found.ID}`).then(r=>r.json());await new Promise(r=>setTimeout(r,250));}throw new Error("Expected fictional Requests email not captured locally");};
  const providerPost=(actor,body)=>post(actor,providerPath,body);
  capability(true);
  try {
    const catalogue=(await backend("rest/v1/levytate_organisations?slug=eq.levytate-internal&select=id"))[0];
    if(!catalogue)throw new Error("Synthetic catalogue fixture unavailable");
    for(const key of["primary","secondary"]){
      const providerId=key==="primary"?manifest.catalogue.providerId:`synthetic-secondary-${manifest.run}`,email=`release.${manifest.run}.provider.${key}@example.test`;
      if(key==="secondary"&&!(await backend(`rest/v1/levytate_providers?organisation_id=eq.${catalogue.id}&provider_id=eq.${providerId}&select=provider_id`)).length)await backend("rest/v1/levytate_providers","POST",{organisation_id:catalogue.id,provider_id:providerId,provider_name:"Synthetic second acceptance provider",provider_type:"Independent training provider",status:"Active",verification_status:"verified",last_verified:new Date().toISOString().slice(0,10),source_urls:["https://example.test/synthetic-secondary-evidence"]});
      let membership=(await backend(`rest/v1/levytate_provider_memberships?email=eq.${email}&select=id,auth_subject`))[0];
      if(!membership){
        // Admin fixture creates a confirmed identity, never a login link/session.
        const auth=await backend("auth/v1/admin/users","POST",{email,email_confirm:true,app_metadata:{release_fixture:manifest.run}});
        if(!auth.id)throw new Error("Synthetic provider Auth identity creation failed");
        membership=(await backend("rest/v1/levytate_provider_memberships","POST",{id:randomUUID(),provider_id:providerId,email,display_name:`Synthetic ${key} provider`,role:"Provider Admin",active:true,auth_subject:null,auth_binding_status:"pending"}))[0];
      }
      providers.push({key,providerId,email,membershipId:membership.id});
    }
    check("other employer tenant stays Requests-disabled",(await contexts.get("a:lead").context.request.get(path)).status()===404);
    for(const key of["b:employee","b:manager"])check(`${key} cannot read employer Requests`,(await contexts.get(key).context.request.get(path)).status()===403);
    const title=`Synthetic provider handoff ${manifest.run.slice(0,8)}`,privateMarker=`PRIVATE-${manifest.run}`,afterInvite=Date.now();
    const content={title,requestMode:"need_led",requirement:"Synthetic data development requirement with no real workforce records.",readiness:"planning",learnerVolume:{kind:"exact",count:2},workplaceLocation:{kind:"remote_or_distributed",label:"Synthetic UK workplace"},deliveryPreferences:["Online"],preferredStart:{kind:"flexible"},responseDeadline:new Date(Date.now()+30*86400000).toISOString().slice(0,10)};
    const send={action:"send_request",idempotencyKey:randomUUID(),content,privateContext:{privateNotes:privateMarker},providerIds:providers.map(p=>p.providerId)};
    let workspace=await request(send),saved=workspace.requests.find(r=>r.content.title===title);
    check("published Request and both delivered invitations are persisted",saved?.currentVersion===1&&saved.invitations.length===2&&saved.invitations.every(i=>i.status==="sent"&&i.notificationStatus==="accepted"));
    const repeated=await request(send);check("send retry preserves exactly one Request",repeated.requests.filter(r=>r.content.title===title).length===1&&repeated.requests.find(r=>r.id===saved.id)?.invitations.length===2);
    check("other employer cannot mutate this Request",[403,404].includes((await post(contexts.get("a:lead"),path,{action:"cancel",requestId:saved.id,reason:"Forbidden cross-tenant attempt",idempotencyKey:randomUUID()})).status()));
    for(const provider of providers){
      const invitation=saved.invitations.find(i=>i.providerId===provider.providerId);provider.invitationId=invitation.id;
      const invited=await capture(provider.email,"A new employer opportunity is ready in LevyTate",afterInvite);
      check(`${provider.key} provider invitation captured without private context`,!JSON.stringify(invited).includes(privateMarker));
      provider.context=await browser.newContext({viewport:{width:1280,height:900}});provider.page=await provider.context.newPage();
      await provider.page.goto(`${app}/levytate/provider/login`);
      const after=Date.now();await provider.page.getByLabel("Work email",{exact:true}).fill(provider.email);
      const outcome=provider.page.waitForResponse(r=>new URL(r.url()).pathname==="/api/levytate-provider-auth/request"&&r.request().method()==="POST");
      await provider.page.getByRole("button",{name:"Send secure sign-in link",exact:true}).click();
      const outcomeResponse=await outcome;
      if(outcomeResponse.status()===429)throw new Error("BLOCKED: genuine provider sign-in budget reached; no budget resets permitted");
      check(`${provider.key} provider uses genuine public sign-in request`,outcomeResponse.status()===200);
      const email=await capture(provider.email,"LevyTate local acceptance sign-in",after),links=[...`${email.HTML??""}\n${email.Text??""}`.matchAll(/https?:\/\/[^\s<>"']+/g)].map(m=>m[0].replaceAll("&amp;","&"));
      const link=links.find(value=>{try{const u=new URL(value);return u.origin===app&&u.pathname==="/levytate/provider/auth/callback"&&u.searchParams.has("token_hash");}catch{return false;}});
      if(!link)throw new Error("Provider capture lacks approved local callback");
      const callback=provider.page.waitForResponse(r=>new URL(r.url()).pathname==="/levytate/provider/auth/callback");await provider.page.goto(link);
      const cookieHeaders=(await(await callback).headersArray()).filter(h=>h.name.toLowerCase()==="set-cookie"&&!/Max-Age=0/i.test(h.value));
      check(`${provider.key} provider callback stays on app origin`,new URL(provider.page.url()).origin===app&&new URL(provider.page.url()).pathname==="/levytate/provider");
      const cookies=(await provider.context.cookies()).filter(c=>/^levytate_provider_(session|auth_access|auth_refresh)$/.test(c.name));
      check(`${provider.key} provider has three host-only HttpOnly cookies`,cookies.length===3&&cookies.every(c=>c.httpOnly&&c.domain==="localhost"&&c.path==="/")&&cookieHeaders.every(h=>!/Domain=/i.test(h.value)));
      const r=await provider.context.request.get(providerPath),data=await r.json();
      check(`${provider.key} sees only its approved provider opportunity`,r.status()===200&&data.workspace.provider.id===provider.providerId&&data.workspace.opportunities.length===1&&data.workspace.opportunities[0].invitation.id===invitation.id&&!JSON.stringify(data).includes(privateMarker));
      check(`${provider.key} provider cannot read employer workspace`,(await provider.context.request.get(`${app}/api/levytate-workspace`)).status()===401);
      const bound=await backend(`rest/v1/levytate_provider_memberships?id=eq.${provider.membershipId}&select=auth_binding_status,auth_subject`);
      check(`${provider.key} genuine callback durably binds identity`,bound.length===1&&bound[0].auth_binding_status==="bound"&&typeof bound[0].auth_subject==="string");
    }
    const primary=providers[0],secondary=providers[1];
    check("secondary provider cannot mutate primary invitation",[403,404].includes((await providerPost(secondary,{action:"mark_viewed",invitationId:primary.invitationId,idempotencyKey:randomUUID()})).status()));
    const responseContent={proposedProgramme:{kind:"canonical_programme",programmeId:manifest.catalogue.programmeId,programmeTitle:"Synthetic acceptance programme"},whyThisFits:"Synthetic training matches the fictional requirement.",earliestAvailableStart:"2027-01-01",deliveryApproach:{models:["Online"],notes:"Synthetic remote delivery"},cohortCapacity:{kind:"can_accommodate",value:2},workplaceRequirements:"Fictional project access",employerReportingSupport:"Monthly synthetic report",proposedTrainingAssessmentPricePence:100000,priceBasisAndAssumptions:"Fictional non-binding test quote"};
    const draft={action:"save_draft",invitationId:primary.invitationId,idempotencyKey:randomUUID(),content:responseContent};
    check("genuine provider saves private structured draft",(await providerPost(primary,draft)).status()===200);
    await primary.page.reload();
    const afterDraft=await(await primary.context.request.get(providerPath)).json();check("provider draft survives browser refresh",afterDraft.workspace.opportunities[0].response?.draftContent.whyThisFits===responseContent.whyThisFits);
    const employerDraft=await(await lead.context.request.get(path)).json();check("employer cannot see unsubmitted provider response",employerDraft.workspace.requests.find(r=>r.id===saved.id).responses.length===0);
    const submit={action:"submit_response",invitationId:primary.invitationId,idempotencyKey:randomUUID(),content:responseContent},afterResponse=Date.now();
    const submitted=await providerPost(primary,submit);if(submitted.status()!==200)console.log(`DIAGNOSTIC provider submit_response status ${submitted.status()}`);
    check("provider submits immutable response through actual service",submitted.status()===200&&(await submitted.json()).opportunity.response.currentVersion===1);
    check("provider exact submit retry succeeds",(await providerPost(primary,submit)).status()===200);
    check("provider reused submit key cannot change content",(await providerPost(primary,{...submit,content:{...responseContent,whyThisFits:"Changed content forbidden for identical key"}})).status()===409);
    await capture(lead.user.email,"A provider response is ready in LevyTate",afterResponse);check("employer response notice captured in local SMTP",true);
    const versions=await backend(`rest/v1/levytate_service_request_response_versions?organisation_id=eq.${tenant.id}&request_id=eq.${saved.id}&select=version,submitted_content`);
    check("one immutable submitted response exists in actual database",versions.length===1&&versions[0].version===1&&versions[0].submitted_content.whyThisFits===responseContent.whyThisFits);
    check("second provider cannot inspect competing response",!JSON.stringify(await(await secondary.context.request.get(providerPath)).json()).includes(responseContent.whyThisFits));
    workspace=(await(await lead.context.request.get(path)).json()).workspace;saved=workspace.requests.find(r=>r.id===saved.id);const responseId=saved.responses[0]?.id;
    check("employer sees submitted response and comparison",Boolean(responseId)&&saved.responses[0].submittedContent.whyThisFits===responseContent.whyThisFits);
    await request({action:"shortlist",requestId:saved.id,responseId,privateDecisionNote:privateMarker,idempotencyKey:randomUUID()});
    await request({action:"progress_to_agreement",requestId:saved.id,responseId,privateDecisionNote:privateMarker,idempotencyKey:randomUUID()});
    const handover={action:"confirm_and_handover",requestId:saved.id,responseId,addProvider:true,addProgramme:true,idempotencyKey:randomUUID()};
    const completed=await request(handover),handoverView=completed.requests.find(r=>r.id===saved.id);
    check("agreement and catalogue handoff are connected",handoverView.agreementSnapshots.length===1&&handoverView.handovers.length===1);
    await request(handover);
    const actual=await backend(`rest/v1/levytate_service_request_handovers?organisation_id=eq.${tenant.id}&request_id=eq.${saved.id}&select=id`);check("handoff retry creates exactly one durable handover",actual.length===1);
    await lead.page.reload();check("completed Request survives fresh employer page",(await(await lead.context.request.get(path)).json()).workspace.requests.find(r=>r.id===saved.id).handovers.length===1);
    check("provider outcome still excludes employer private decision",!JSON.stringify(await(await primary.context.request.get(providerPath)).json()).includes(privateMarker));
    await backend(`rest/v1/levytate_provider_memberships?id=eq.${secondary.membershipId}`,"PATCH",{active:false});
    check("revoked provider denied on next request",(await secondary.context.request.get(providerPath)).status()===401);
    check("revocation leaves other provider functional",(await primary.context.request.get(providerPath)).status()===200);
    for(const provider of providers){const r=await provider.context.request.post(`${app}/api/levytate-provider/logout`,{headers:{Origin:app},maxRedirects:0});check(`${provider.key} actual provider logout succeeds`,r.status()===303);check(`${provider.key} cannot regain workspace after logout`,(await provider.context.request.get(providerPath)).status()===401);}
  } finally { capability(false);for(const provider of providers)await provider.context?.close(); }
  check("Requests capability restored disabled",(await lead.context.request.get(path)).status()===404);
}
