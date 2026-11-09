/** Two actual sign-ins, competing editor, logout and same-account recovery. */
async function requestSignIn(page){
 for(let attempt=0;attempt<2;attempt++){
  const requested=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/levytate-auth/request"&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Send secure sign-in link",exact:true}).click();
  const response=await requested;if(response.status()!==429)return response;
  if(attempt)throw new Error("BLOCKED: genuine authentication budget still exhausted after natural burst-window expiry");
  const reset=Math.ceil(Date.now()/600000)*600000+1000;
  console.log(`WAIT genuine authentication rate window until ${new Date(reset).toISOString()}; no limiter state changed`);
  while(Date.now()<reset)await new Promise(resolve=>setTimeout(resolve,Math.min(10000,reset-Date.now())));
 }
}
export async function verifyStalePeopleEditor({app,mailpit,manifest,lead,browser,backend,waitForCapturedLink,check}){
 const name=`Synthetic retained draft ${manifest.run.slice(0,8)}`,email=`ui.${manifest.run}.person@example.test`,page=lead.page;
 let step="open People";
 try{
 await page.goto(`${app}/levytate/app?module=People`);
 const existing=await backend(`rest/v1/levytate_employees?organisation_id=eq.${lead.tenant.id}&email=eq.${encodeURIComponent(email)}&select=id`);
 if(!existing.length){
  step="open Add employee dialog";
  await page.getByRole("button",{name:"Add employee",exact:true}).click();
  const create=page.getByRole("dialog",{name:"Add employee",exact:true});
  step="fill employee name";await create.getByLabel("Employee name",{exact:true}).fill(name);
  step="fill employee email";await create.getByLabel("Work email",{exact:true}).fill(email);
  step="fill employee job title";await create.getByLabel("Job title",{exact:true}).fill("Synthetic role");
  step="fill employee department";await create.getByLabel("Department",{exact:true}).fill("Synthetic department");
  step="save initial People fixture";
  await create.getByRole("button",{name:"Save employee",exact:true}).click();await create.waitFor({state:"detached"});
  check("stale People scenario creates its own fixture through the real form",(await backend(`rest/v1/levytate_employees?organisation_id=eq.${lead.tenant.id}&email=eq.${encodeURIComponent(email)}&select=id`)).length===1);
 }
 step="open saved employee Details";
 await page.locator("article").filter({has:page.getByText(name,{exact:true})}).getByRole("button",{name:"Details",exact:true}).click();
 await page.getByRole("dialog",{name,exact:true}).getByRole("button",{name:"Edit",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Edit employee",exact:true});
 step="prepare stale employee edit";
 await dialog.getByLabel("Job title",{exact:true}).fill("Stale retained edit must not win");
 const second=await browser.newContext(),secondPage=await second.newPage();
 try{
  step="second genuine editor login";
  await secondPage.goto(`${app}/levytate/login`);const at=Date.now();
  await secondPage.getByLabel("Work email",{exact:true}).fill(lead.user.email);
  await requestSignIn(secondPage);
  await secondPage.getByRole("heading",{name:"Check your email",exact:true}).waitFor();
  await secondPage.goto(await waitForCapturedLink(mailpit,lead.user.email,app,at));
  check("second editor has independently redeemed real Auth",new URL(secondPage.url()).pathname.includes("/app"));
  const response=await second.request.get(`${app}/api/levytate-workspace`),workspace=(await response.json()).workspace,person=workspace.data.employees.find(e=>e.email===email);
  const key=`levytate_employees:${person.id}`,revision=workspace.meta.mutationRevisions[key]??0;
  const change=await second.request.post(`${app}/api/levytate-workspace`,{headers:{Origin:app},data:{type:"saveEmployee",expectedRevision:revision,employee:{...person,jobTitle:"Newer independently saved edit"}}});
  check("independent session commits a newer People revision",change.status()===200);
  step="retain edit during genuine logout";
  await lead.context.request.post(`${app}/api/levytate-beta-logout`,{headers:{Origin:app},maxRedirects:0});
  await dialog.getByRole("button",{name:"Save employee",exact:true}).click();
  await dialog.getByRole("button",{name:"Reconnect workspace",exact:true}).waitFor();
  check("stale editor remains intact after real session loss",await dialog.getByLabel("Job title",{exact:true}).inputValue()==="Stale retained edit must not win");
  step="same-account genuine recovery login";
  const opened=lead.context.waitForEvent("page");await dialog.getByRole("button",{name:"Sign in in new tab",exact:true}).click();const login=await opened;await login.waitForLoadState();const sent=Date.now();
  await login.getByLabel("Work email",{exact:true}).fill(lead.user.email);
  await requestSignIn(login);
  await login.getByRole("heading",{name:"Check your email",exact:true}).waitFor();await login.goto(await waitForCapturedLink(mailpit,lead.user.email,app,sent));await login.close();
  await dialog.getByRole("button",{name:"Reconnect workspace",exact:true}).click();await dialog.getByRole("button",{name:"Sign in in new tab",exact:true}).waitFor({state:"detached"});
  step="reject reconnected stale save";
  const saveResponse=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/levytate-workspace"&&r.request().method()==="POST");
  await dialog.getByRole("button",{name:"Save employee",exact:true}).click();
  check("reconnected stale editor receives409 rather than overwriting",(await saveResponse).status()===409);
  check("conflict retains the original unsaved text",await dialog.getByLabel("Job title",{exact:true}).inputValue()==="Stale retained edit must not win");
  const durable=await backend(`rest/v1/levytate_employees?organisation_id=eq.${lead.tenant.id}&id=eq.${person.id}&select=job_title`);
  check("newer server value survives stale reconnect/save",durable[0]?.job_title==="Newer independently saved edit");
  const audit=await backend(`rest/v1/levytate_audit_events?organisation_id=eq.${lead.tenant.id}&entity_id=eq.${person.id}&action=eq.employee.saved&select=id`);
  check("rejected stale save creates no false-success audit",audit.length===2);
  await dialog.getByRole("button",{name:"Close dialog",exact:true}).click();
 }finally{await second.close();}
 }catch(error){console.log(`DIAGNOSTIC stale People stage: ${step}`);throw error;}
}
