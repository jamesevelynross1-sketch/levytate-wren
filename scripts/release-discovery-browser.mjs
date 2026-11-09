/** Genuine own-account discovery UI; no cookie injection or fabricated results. */
import{randomUUID}from"node:crypto";
export async function verifyDiscovery({app,manifest,contexts,backend,check}){
 const path=`${app}/api/levytate-programme-discovery`,programme=manifest.catalogue.programmeId;
 for(const key of["a:employee","a:manager"]){
  const actor=contexts.get(key),page=actor.page,label=actor.user.role;
  await page.goto(`${app}/levytate/app?module=My%20Programme`);await page.getByRole("heading",{name:"Explore your programmes",exact:true}).waitFor();
  const beforeResponse=await actor.context.request.get(path),before=(await beforeResponse.json()).choices;
  check(`${label} genuine discovery resolves own People record`,beforeResponse.status()===200&&before.employeeId===actor.user.personId&&before.availableProgrammeIds.includes(programme));
  const card=page.locator("article").filter({has:page.getByRole("button",{name:"View Synthetic acceptance programme",exact:true})});
  await card.getByRole("button",{name:"View Synthetic acceptance programme",exact:true}).waitFor();
  check(`${label} sees genuine published programme card`,await card.count()===1);
  const wasSaved=before.savedProgrammeIds.includes(programme),save=card.getByRole("button",{name:wasSaved?"Remove saved programme":"Save programme",exact:true});
  let intercepted=false,original;
  const drop=async route=>{if(!intercepted&&route.request().method()==="POST"){intercepted=true;original=route.request().postDataJSON();const r=await route.fetch();if(r.status()!==200)throw new Error("Discovery write failed before controlled response loss");await route.abort("connectionreset");}else await route.continue();};
  await page.route("**/api/levytate-programme-discovery",drop);
  try{await save.click();await page.getByRole("button",{name:"Retry original change",exact:true}).waitFor();}finally{await page.unroute("**/api/levytate-programme-discovery",drop);}
  const durable=await backend(`rest/v1/levytate_employee_development_profiles?organisation_id=eq.${actor.tenant.id}&employee_id=eq.${actor.user.personId}&select=saved_programme_ids,discovery_revision`);
  check(`${label} lost response still leaves exact one confirmed choice revision`,intercepted&&durable.length===1&&durable[0].discovery_revision===before.revision+1&&durable[0].saved_programme_ids.includes(programme)===!wasSaved);
  check(`${label} uncertain discovery blocks changing command`,await save.isDisabled()&&await card.getByRole("button",{name:/^(Compare programme|Remove comparison)$/}).isDisabled());
  const retry=page.waitForResponse(r=>r.url()===path&&r.request().method()==="POST");await page.getByRole("button",{name:"Retry original change",exact:true}).click();const retried=await retry;
  check(`${label} UI retries identical choice body and request key`,retried.status()===200&&JSON.stringify(retried.request().postDataJSON())===JSON.stringify(original));
  const audit=await backend(`rest/v1/levytate_audit_events?id=eq.${original.requestId}&organisation_id=eq.${actor.tenant.id}&select=id`);check(`${label} original choice has exactly one durable audit`,audit.length===1);
  await page.reload();await page.getByRole("heading",{name:"Explore your programmes",exact:true}).waitFor();
  const refreshed=await(await actor.context.request.get(path)).json();check(`${label} own choice persists through browser refresh`,refreshed.choices.employeeId===actor.user.personId&&refreshed.choices.savedProgrammeIds.includes(programme)===!wasSaved);
  const afterCard=page.locator("article").filter({has:page.getByRole("button",{name:"View Synthetic acceptance programme",exact:true})});
  if(refreshed.choices.comparedProgrammeIds.includes(programme)){const removed=page.waitForResponse(r=>r.url()===path&&r.request().method()==="POST");await afterCard.getByRole("button",{name:"Remove comparison",exact:true}).click();check(`${label} existing comparison can be removed explicitly`,(await removed).status()===200);}
  const comparing=page.waitForResponse(r=>r.url()===path&&r.request().method()==="POST");await afterCard.getByRole("button",{name:"Compare programme",exact:true}).click();check(`${label} real UI adds programme comparison`,(await comparing).status()===200);
  await page.getByRole("heading",{name:"Your programme comparison",exact:true}).waitFor();check(`${label} comparison renders recorded programme facts`,await page.getByRole("table").getByRole("columnheader",{name:"Synthetic acceptance programme",exact:true}).count()===1);
  if(key==="a:employee"){
   await afterCard.getByRole("button",{name:"View Synthetic acceptance programme",exact:true}).click();const modal=page.getByRole("dialog",{name:"Synthetic acceptance programme",exact:true});
   const blocked=modal.getByRole("button",{name:"One application is already active",exact:true});
   if(await blocked.count())check("existing active application does not prevent discovery but disables a second start",await blocked.isDisabled());
   else check("closed application leaves explicit pathway start available",await modal.getByRole("button",{name:"Start pathway application",exact:true}).isEnabled());
   await modal.getByRole("button",{name:"Close dialog",exact:true}).click();
  }
 }
 const employee=contexts.get("a:employee"),other=contexts.get("b:employee"),lead=contexts.get("a:lead");
 check("Lead cannot read personal discovery endpoint",(await lead.context.request.get(path)).status()===403);
 check("retained personal discovery account header cannot bind another session",(await other.context.request.get(path,{headers:{"X-LevyTate-Account":employee.user.email}})).status()===409);
 const own=await(await other.context.request.get(path)).json();check("second tenant receives only its own empty saved choices",own.choices.employeeId===other.user.personId&&own.choices.savedProgrammeIds.length===0);
 check("personal discovery rejects caller-selected employee scope",(await other.context.request.post(path,{headers:{Origin:app},data:{action:"save",programmeId:programme,requestId:randomUUID(),expectedRevision:own.choices.revision,employeeId:employee.user.personId}})).status()===422);
}
