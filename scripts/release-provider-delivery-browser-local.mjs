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
let browser,provider,lead,passes=0;
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
  const link=await capturedLink(fixture.providerEmail,"/levytate/provider/auth/callback",started);
  await p.goto(link);
  await p.waitForURL(url=>url.pathname==="/levytate/provider/delivery",{timeout:30000});
  check("provider redirected to Core delivery workspace",await p.getByRole("heading",{name:"Programme & learner updates"}).count()===1);
  const view=await provider.request.get(`${app}/api/levytate-provider/delivery`);
  const initial=await view.json();
  check("exactly one employer and selected programme shared",view.status()===200&&
    initial.workspace?.employers?.length===1&&initial.workspace.employers[0].id===fixture.organisationId&&
    initial.workspace.employers[0].programmes.some(x=>x.id===fixture.programmeId));
  check("second employer records not revealed",!JSON.stringify(initial).includes(fixture.ungrantedOtherEmployerId));
  const notGranted=await provider.request.post(`${app}/api/levytate-provider/delivery`,{
    headers:{Origin:app},
    data:{kind:"programme_note",organisationId:fixture.ungrantedOtherEmployerId,
      targetId:fixture.programmeId,idempotencyKey:crypto.randomUUID(),
      payload:{reportDate:new Date().toISOString().slice(0,10),deliveryNote:"Synthetic disallowed",capacityStatus:"unknown"}},
  });
  check("provider cannot submit to ungranted employer",notGranted.status()===403);
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
  await l.goto(`${app}/levytate/app?module=My%20Providers`);
  const panel=l.getByTestId("employer-provider-delivery");
  await panel.waitFor({timeout:30000});
  check("authorised employer receives pending provider report",await panel.getByText("Awaiting your review (1)").count()===1);
  const approve=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-employer/provider-delivery"&&response.request().method()==="POST");
  await panel.getByRole("button",{name:"Accept report"}).click();
  check("employer accepted provider evidence via protected API",(await approve).status()===200);
  const rows=await backend(`rest/v1/levytate_provider_delivery_updates?organisation_id=eq.${fixture.organisationId}&select=id,review_status,reviewed_at`);
  check("accepted report persisted with review date",rows.length===1&&rows[0].review_status==="accepted"&&Boolean(rows[0].reviewed_at));
  const canonical=await backend(`rest/v1/levytate_learner_progress_updates?organisation_id=eq.${fixture.organisationId}&select=id`);
  check("review did not modify authoritative learner progress ledger",canonical.length===0);
  l.on("dialog",dialog=>void dialog.accept());
  const revoke=l.waitForResponse(response=>new URL(response.url()).pathname==="/api/levytate-employer/provider-delivery"&&response.request().method()==="POST");
  await panel.getByRole("button",{name:"Revoke access"}).click();
  check("employer revoked grant via UI",(await revoke).status()===200);
  const blocked=await provider.request.get(`${app}/api/levytate-provider/delivery`);
  check("provider access removed on next request",[401,403,404].includes(blocked.status()));
  console.log(`Provider delivery local browser result: ${passes} PASS, 0 FAIL, 0 external emails`);
}catch(error){
  console.error(error instanceof Error&&error.message.startsWith("BLOCKED:")?error.message:
    "FAIL provider Core browser acceptance; local auth state and request payloads withheld");
  process.exitCode=1;
}finally{
  try{await provider?.close();}catch{}
  try{await lead?.close();}catch{}
  try{await browser?.close();}catch{}
  release();
}
