/** Genuine fictional provider sign-in -> proposal -> employer review -> revocation. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { localUrl, releaseBackend } from "./release-local-fixtures.mjs";
import { lockAcceptanceRuntime } from "./release-runtime-lock.mjs";

const root=process.env.RELEASE_LOCAL_RUNTIME;
if(process.env.RELEASE_PROVIDER_DELIVERY_LOCAL_ENABLE!=="true" ||
  process.env.LEVYTATE_PROVIDER_DELIVERY_ENABLED!=="true" ||
  process.env.VERCEL_ENV || process.env.NODE_ENV==="production" ||
  !/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??""))
  throw Error("BLOCKED: provider browser test requires isolated local capability");
const fixture=JSON.parse(readFileSync(`${root}/provider-delivery-fixture.json`,"utf8"));
if(fixture.environment!=="local" || fixture.synthetic!==true ||
  !/^[a-f0-9-]{36}$/.test(fixture.run) || !fixture.providerEmail.endsWith("@example.test"))
  throw Error("BLOCKED: synthetic provider fixture invalid");
const app=localUrl(process.env.RELEASE_APP_URL,"Local provider test app");
const mailpit=localUrl(process.env.RELEASE_MAILPIT_URL,"Local email capture");
const backend=releaseBackend();
const modulePath=process.env.RELEASE_PLAYWRIGHT_MODULE;
if(!modulePath?.startsWith("/"))throw Error("BLOCKED: pinned local Playwright required");
const {chromium}=await import(pathToFileURL(modulePath).href);
const release=lockAcceptanceRuntime("genuine-provider-delivery-browser");
let browser,provider,lead,passes=0,stage="initialisation";
function check(label,condition) {
  if(!condition)throw Error(`FAIL provider Core acceptance: ${label}`);
  passes++;
  console.log(`PASS provider Core: ${label}`);
}
async function capturedLink(email,pathname,after) {
  for(let attempt=0;attempt<60;attempt++){
    const list=await fetch(`${mailpit}/api/v1/messages`).then(response=>response.json());
    const message=list.messages?.find(item=>item.To?.some(to=>to.Address===email)
      && new Date(item.Created).getTime()>=after-1000);
    if(message){
      const detail=await fetch(`${mailpit}/api/v1/message/${message.ID}`).then(response=>response.json());
      const urls=[...`${detail.HTML??""}\n${detail.Text??""}`.matchAll(/https?:\/\/[^\s<>"']+/g)]
        .map(x=>x[0].replaceAll("&amp;","&"));
      const link=urls.find(candidate=>{
        try{const url=new URL(candidate);return url.origin===app&&url.pathname===pathname&&url.searchParams.has("token_hash");}
        catch{return false;}
      });
      if(!link)throw Error("BLOCKED: local capture lacks the correct sign-in callback");
      return link;
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error("BLOCKED: local sign-in link not captured");
}
try{
  browser=await chromium.launch({headless:true});
  provider=await browser.newContext({viewport:{width:390,height:850}});
  const p=await provider.newPage();
  await p.goto(`${app}/levytate/provider/login`);
  check("provider sign-in page visible",await p.getByRole("heading",{name:"Your provider workspace"}).count()===1);
  const started=Date.now();
  await p.getByLabel("Work email").fill(fixture.providerEmail);
  const loginPost=p.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-provider-auth/request");
  await p.getByRole("button",{name:"Send secure sign-in link"}).click();
  check("provider secure-link request accepted",(await loginPost).status()===200);
  stage="provider magic-link capture";
  const link=await capturedLink(fixture.providerEmail,"/levytate/provider/auth/callback",started);
  stage="provider callback";
  await p.goto(link);
  const callbackPath = new URL(p.url()).pathname;
  console.log("DIAGNOSTIC fictional provider callback path:", callbackPath);
  if (callbackPath==="/levytate/provider/login" || callbackPath.startsWith("/404")) 
    throw Error("Provider callback did not establish a delivery session");
  stage="provider delivery redirect";
  await p.waitForURL(url=>url.pathname==="/levytate/provider/delivery",{timeout:45000});
  check("provider redirected to Core delivery workspace",await p.getByRole("heading",{name:"Programme & learner updates"}).count()===1);
  stage="provider workspace API read";
  const view=await provider.request.get(`${app}/api/levytate-provider/delivery`);
  const initial=await view.json();
  check("exactly one employer and selected programme shared",view.status()===200&&
    initial.workspace?.employers?.length===1&&initial.workspace.employers[0].id===fixture.organisationId&&
    initial.workspace.employers[0].programmes.some(x=>x.id===fixture.programmeId));
  check("second employer records not revealed",!JSON.stringify(initial).includes(fixture.ungrantedOtherEmployerId));
  if(process.env.RELEASE_PREMIUM_VISUAL_JOURNEY==="true"){
    stage="provider delivery visual reflow";
    const{captureProviderVisual}=await import("./release-premium-visual-browser.mjs");
    await captureProviderVisual({app,page:p,fixture,check});
  }
  const notGranted=await provider.request.post(`${app}/api/levytate-provider/delivery`,{
    headers:{Origin:app},
    data:{kind:"programme_note",organisationId:fixture.ungrantedOtherEmployerId,
      targetId:fixture.programmeId,idempotencyKey:crypto.randomUUID(),
      payload:{reportDate:new Date().toISOString().slice(0,10),deliveryNote:"Synthetic disallowed",capacityStatus:"unknown"}},
  });
  check("provider cannot submit to ungranted employer",notGranted.status()===403);
  stage="provider programme submission";
  await p.getByRole("radio",{name:"Programme delivery"}).check();
  await p.locator("#delivery-target").selectOption(fixture.programmeId);
  await p.locator("#delivery-summary").fill("Synthetic delivery evidence: January intake capacity is limited.");
  await p.locator("#delivery-capacity").selectOption("limited");
  const post=p.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-provider/delivery"
    && response.request().method()==="POST");
  await p.getByRole("button",{name:"Submit for employer review"}).click();
  const saved=await post; const body=await saved.json();
  check("provider UI saves pending report with source and timestamp",saved.status()===201&&
    body.update?.status==="pending"&&body.update?.targetId===fixture.programmeId);
  const before=await backend(`rest/v1/levytate_provider_delivery_updates?organisation_id=eq.${fixture.organisationId}&select=id,review_status`);
  check("one provider report exists in durable database",before.length===1&&before[0].review_status==="pending");
  const canonicalBefore=await backend(`rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&select=id,learner_record_id,progress_source&order=id`);
  stage="employer lead reauthentication";
  lead=await browser.newContext({viewport:{width:1280,height:900}});
  const l=await lead.newPage();
  await l.goto(`${app}/levytate/login`);
  const leadStarted=Date.now();
  await l.getByLabel("Work email",{exact:true}).fill(fixture.leadEmail);
  const leadPost=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-auth/request");
  await l.getByRole("button",{name:"Send secure sign-in link"}).click();
  const outcome=await leadPost;
  if(outcome.status()===429)throw Error("BLOCKED: Lead local sign-in budget; no fake session permitted");
  check("employer Lead sign-in request accepted",outcome.status()===200);
  const leadLink=await capturedLink(fixture.leadEmail,"/levytate/auth/callback",leadStarted);
  await l.goto(leadLink);
  if(new URL(l.url()).pathname==="/levytate/accept-terms"){
    await l.getByRole("checkbox").check();
    await l.getByRole("button",{name:"Accept Early Access Terms"}).click();
  }
  stage="employer evidence review";
  await l.goto(`${app}/levytate/app?module=My%20Providers`);
  const panel=l.getByTestId("employer-provider-delivery");
  await panel.waitFor({timeout:30000});
  check("authorised employer receives pending provider report",await panel.getByText("Awaiting your review (1)").count()===1);
  const approve=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-employer/provider-delivery"&&response.request().method()==="POST");
  await panel.getByRole("button",{name:"Accept report"}).click();
  check("employer accepted provider evidence via protected API",(await approve).status()===200);
  const rows=await backend(`rest/v1/levytate_provider_delivery_updates?organisation_id=eq.${fixture.organisationId}&select=id,review_status,reviewed_at`);
  check("accepted report persisted with review date",rows.length===1&&rows[0].review_status==="accepted"&&Boolean(rows[0].reviewed_at));
  const canonical=await backend(`rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&select=id,learner_record_id,progress_source&order=id`);
  check("review leaves existing authoritative learner progress history unchanged",
    JSON.stringify(canonical)===JSON.stringify(canonicalBefore));
  stage="provider learner progress submission";
  await p.getByRole("radio",{name:"Learner progress"}).check();
  await p.locator("#delivery-target").selectOption(fixture.learnerId);
  await p.locator("#delivery-progress").fill("45");
  await p.locator("#delivery-summary").fill("Fictional learner milestone: assessed progress is 45 percent.");
  const learnerPost=p.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-provider/delivery"
    && response.request().method()==="POST");
  await p.getByRole("button",{name:"Submit for employer review"}).click();
  const learnerResponse=await learnerPost;
  const learnerBody=await learnerResponse.json();
  check("provider submits one pending learner progress report",learnerResponse.status()===201&&
    learnerBody.update?.kind==="learner_progress"&&learnerBody.update?.targetId===fixture.learnerId&&
    learnerBody.update?.status==="pending");

  stage="employer atomic learner promotion";
  await panel.getByRole("button",{name:"Refresh provider reports"}).click();
  await panel.getByText("Awaiting your review (1)").waitFor();
  const canonicalPrePromotion=await backend(
    `rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&learner_record_id=eq.${fixture.learnerId}&select=id`);
  check("fictional learner has existing target evidence, not provider-created rows",canonicalPrePromotion.length===1);
  const learnerApproval=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-employer/provider-delivery"
    && response.request().method()==="POST");
  await panel.getByRole("button",{name:"Accept report"}).click();
  check("employer accepted learner progress through protected API",(await learnerApproval).status()===200);
  const promoted=await backend(
    `rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&learner_record_id=eq.${fixture.learnerId}&select=id,target_progress_percentage,actual_progress_percentage,variance_percentage,progress_source,source_reference&order=created_at.desc`);
  check("official learner progress contains exactly one employer-approved provider report",
    promoted.length===2&&promoted.some(row=>row.actual_progress_percentage===45&&row.target_progress_percentage===40
      &&row.variance_percentage===5&&row.progress_source==="provider_report"
      &&row.source_reference===`provider-delivery:${learnerBody.update.id}`));
  const ledger=await backend(
    `rest/v1/levytate_learner_records?organisation_id=eq.${fixture.organisationId}&id=eq.${fixture.learnerId}&select=mutation_revision`);
  check("learner revision advances exactly once",ledger.length===1&&ledger[0].mutation_revision===1);
  const source=await backend(
    `rest/v1/levytate_provider_delivery_updates?id=eq.${learnerBody.update.id}&select=review_status,promoted_progress_id`);
  check("provider report is directly linked to official learner progress",
    source.length===1&&source[0].review_status==="accepted"&&
    promoted.some(row=>row.id===source[0].promoted_progress_id));
  const official=await lead.request.get(`${app}/api/levytate-learners/${fixture.learnerId}/progress`);
  const officialBody=await official.json();
  check("employer learner progress API immediately reflects approved evidence",
    official.status()===200&&officialBody.progress?.some(item=>item.actualProgressPercentage===45&&
      item.sourceReference===`provider-delivery:${learnerBody.update.id}`));
  const retry=await lead.request.post(`${app}/api/levytate-employer/provider-delivery`,{
    headers:{Origin:app},
    data:{action:"review",updateId:learnerBody.update.id,decision:"accepted",expectedLearnerRevision:0},
  });
  const postRetry=await backend(
    `rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&learner_record_id=eq.${fixture.learnerId}&select=id`);
  check("lost-response retry is idempotent with no duplicate learner progress",
    retry.status()===200&&postRetry.length===2);

  stage="employer grant revocation";
  l.on("dialog",dialog=>void dialog.accept());
  const revoke=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-employer/provider-delivery"&&response.request().method()==="POST");
  await panel.getByRole("button",{name:"Revoke access"}).click();
  check("employer revoked grant via UI",(await revoke).status()===200);
  const blocked=await provider.request.get(`${app}/api/levytate-provider/delivery`);
  check("provider access removed on next request",[401,403,404].includes(blocked.status()));
  console.log(`Provider delivery local browser result: ${passes} PASS, 0 FAIL, 0 external emails`);
}catch(error){
  console.error(error instanceof Error&&error.message.startsWith("BLOCKED:")?error.message:
    `FAIL provider Core browser acceptance during ${stage}; local auth state and request payloads withheld`);
  process.exitCode=1;
}finally{
  try{await provider?.close();}catch{}
  try{await lead?.close();}catch{}
  try{await browser?.close();}catch{}
  release();
}
