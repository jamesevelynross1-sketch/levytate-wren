/** Actual browser layouts using existing genuine local Auth sessions.
 * No remote site, account changes, tokens, traces, request dumps or production
 * data. Screenshots are allowlisted fictional pages in a dedicated directory.
 * A 640 CSS-pixel viewport is effective reflow coverage, NOT native zoom.
 */
import { mkdirSync } from "node:fs";
import { localUrl } from "./release-local-fixtures.mjs";

function rootFor(app,fixture){
  const root=process.env.RELEASE_LOCAL_RUNTIME;
  if(!/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??"")||
    fixture.synthetic!==true||fixture.environment!=="local"||!/^[-a-f0-9]{36}$/.test(fixture.run??"")||process.env.VERCEL_ENV||
    localUrl(app,"Visual app")!==app)throw Error("BLOCKED: disposable synthetic local browser required");
  const output=root+"/visual-evidence";
  mkdirSync(output,{recursive:true,mode:0o700});
  return output;
}
function approvedPage(page,app,path){
  const url=new URL(page.url());
  if(url.origin!==app||url.pathname!==path||url.searchParams.has("token_hash")||url.hash)throw Error("Visual capture requires a safe local page");
}
async function layout(page,width,height=900){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  return page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    return {viewport,scroll:document.documentElement.scrollWidth,fit:document.documentElement.scrollWidth<=viewport+1};
  });
}
async function capture(page,app,path,output,name,scrollToTop=true){
  approvedPage(page,app,path);
  if(!/^[a-z0-9-]+$/.test(name))throw Error("Invalid screenshot name");
  if(scrollToTop)await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  await page.screenshot({path:output+"/"+name+".png",fullPage:false,animations:"disabled",caret:"hide"});
}
async function matrix({page,app,path,output,name,check,widths=[390,640,768,1280,1440]}){
  const findings=[];
  for(const width of widths){
    const size=await layout(page,width);
    if(width===390||width===1440)await capture(page,app,path,output,name+"-"+width);
    console.log("VISUAL "+name+" "+width+"px document "+size.scroll+"px "+(size.fit?"FIT":"OVERFLOW"));
    findings.push({width,fit:size.fit});
  }
  await page.setViewportSize({width:1280,height:900});
  check("Visual "+name+": no document overflow at "+widths.join("/")+" CSS px",findings.every(item=>item.fit));
}
export async function captureBlankLogin({app,page,manifest,check}){
  const output=rootFor(app,manifest);
  approvedPage(page,app,"/levytate/login");
  await page.getByRole("heading",{name:"Sign in to LevyTate",exact:true}).waitFor();
  const email=page.getByLabel("Work email",{exact:true});
  await email.waitFor({state:"visible"});
  check("Visual sign-in: blank email before any authentication",await email.inputValue()==="");
  await matrix({page,app,path:"/levytate/login",output,name:"sign-in",check,widths:[320,390,640,768,1280,1440]});
}
export async function captureProviderVisual({app,page,fixture,check}){
  const output=rootFor(app,fixture);
  approvedPage(page,app,"/levytate/provider/delivery");
  await page.getByRole("heading",{name:"Programme & learner updates",exact:true}).waitFor();
  await matrix({page,app,path:"/levytate/provider/delivery",output,name:"provider-delivery",check});
  await page.setViewportSize({width:390,height:850});
}
export async function verifyPremiumVisual({app,manifest,contexts,check}){
  const output=rootFor(app,manifest);
  const lead=contexts.get("a:lead"),employee=contexts.get("a:employee"),manager=contexts.get("a:manager");
  if(lead?.user.role!=="Apprenticeship Lead"||employee?.user.role!=="Employee"||manager?.user.role!=="Line Manager")throw Error("BLOCKED: genuine three-role contexts required");
  for(const actor of [lead,employee,manager]){
    const response=await actor.context.request.get(app+"/api/levytate-workspace");
    const body=await response.json();
    check("Visual "+actor.user.role+": canonical fictional role and tenant",response.status()===200&&body.workspace?.meta?.userRole===actor.user.role&&body.workspace?.meta?.organisationId===actor.tenant.id);
  }
  const failures=[];
  async function run(name,task){try{await task();}catch(error){failures.push(name);console.log("VISUAL "+name+" FAILED "+(error?.name==="TimeoutError"?"timeout":"assertion"));}}
  async function open(actor,module,label,ready){
    const page=actor.page;
    await page.setViewportSize({width:1280,height:900});
    await page.goto(app+"/levytate/app?module="+encodeURIComponent(module));
    approvedPage(page,app,"/levytate/app");
    await page.getByTestId("levytate-app-shell").waitFor();
    await page.getByRole("heading",{name:label,exact:true,level:1}).waitFor();
    if(ready)await ready(page);
    await page.evaluate(()=>document.fonts.ready);
    return page;
  }
  const screenList=[
    [lead,"Home","Home","employer-home"],
    [lead,"People","People","employer-people",page=>page.getByRole("heading",{name:"Employees",exact:true}).waitFor()],
    [lead,"Applications","Applications","employer-applications",page=>page.getByRole("heading",{name:"Applications",level:2,exact:true}).waitFor()],
    [lead,"Learners","Learners","employer-learners",async page=>{await page.getByRole("heading",{name:"Learners",level:2,exact:true}).waitFor();await page.getByText("Loading learner lifecycle records.",{exact:true}).waitFor({state:"hidden"});}],
    [lead,"Marketplace","Marketplace","employer-marketplace",page=>page.getByRole("heading",{name:"Find providers and apprenticeship programmes",exact:true}).waitFor()],
    [lead,"Insights","Overview","employer-insights",page=>page.getByTestId("employer-insights-overview").waitFor()],
    [lead,"Finance","Finance","employer-finance",page=>page.getByTestId("levy-funding-planner").waitFor()],
    [lead,"Copilot","Copilot","employer-copilot",page=>page.getByRole("heading",{name:"How can Copilot help?",exact:true}).waitFor()],
    [employee,"Home","Home","employee-home"],
    [employee,"My Application","My Application","employee-application"],
    [employee,"My Programme","My Apprenticeship","employee-apprenticeship"],
    [manager,"Home","Home","manager-home"],
    [manager,"My Team","My Team","manager-team"],
    [manager,"Approvals","Approvals","manager-approvals"],
  ];
  for(const [actor,module,label,name,ready] of screenList)await run(name,async()=>{
    const page=await open(actor,module,label,ready);
    await matrix({page,app,path:"/levytate/app",output,name,check});
  });

  await run("mobile navigation and keyboard focus",async()=>{
    const page=await open(lead,"Home","Home");
    await layout(page,390,850);
    const trigger=page.getByRole("button",{name:"Open navigation",exact:true});
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("navigation",{name:"Mobile workspace navigation",exact:true}).waitFor();
    await capture(page,app,"/levytate/app",output,"employer-mobile-navigation-390");
    await page.keyboard.press("Escape");
    await page.getByRole("navigation",{name:"Mobile workspace navigation",exact:true}).waitFor({state:"hidden"});
    check("Visual mobile navigation: Escape closes and returns focus",await trigger.evaluate(el=>el===document.activeElement));
  });
  await run("employee editor cancel and focus",async()=>{
    const page=await open(lead,"People","People");
    await layout(page,390,850);
    await page.getByRole("button",{name:"Add employee",exact:true}).first().click();
    const dialog=page.getByRole("dialog",{name:"Add employee",exact:true});
    await dialog.waitFor();
    await dialog.getByLabel("Employee name",{exact:true}).fill("Fictional unsaved visual check");
    await capture(page,app,"/levytate/app",output,"employer-add-employee-390");
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"hidden"});
    check("Visual People: keyboard dismisses unsaved editor",true);
  });
  await run("application search and cancel",async()=>{
    const page=await open(lead,"Applications","Applications");
    await layout(page,390,850);
    await page.getByRole("button",{name:"Create application",exact:true}).first().click();
    const dialog=page.getByRole("dialog",{name:"Create application",exact:true});
    await dialog.waitFor();
    await dialog.getByPlaceholder("Search programme, level or provider",{exact:true}).fill("unmatched-fictional-programme");
    await dialog.getByText("No matching programmes. Try another search.",{exact:true}).waitFor();
    await capture(page,app,"/levytate/app",output,"employer-application-editor-390");
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    await dialog.waitFor({state:"hidden"});
    check("Visual Applications: unmatched search does not prevent cancel",true);
  });
  await run("finance editor and forecast interaction",async()=>{
    const page=await open(lead,"Finance","Finance",page=>page.getByTestId("levy-funding-planner").waitFor());
    await page.getByRole("button",{name:"Plan a cohort",exact:true}).click();
    const editor=page.getByTestId("cohort-editor");
    await editor.waitFor();
    const search=editor.getByPlaceholder("Search title, level or reference",{exact:true});
    await search.waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute("placeholder")==="Search title, level or reference");
    check("Visual Finance: cohort search receives focus",await search.evaluate(el=>el===document.activeElement));
    const programme=editor.getByLabel("Apprenticeship programme",{exact:true});
    const option=await programme.locator("option").nth(1).getAttribute("value");
    if(!option)throw Error("Synthetic standards unavailable");
    await programme.selectOption(option);
    await editor.getByLabel("Price per learner (£)",{exact:true}).fill("12000");
    await editor.getByLabel("Learners",{exact:true}).fill("3");
    await page.getByText("Live preview of unsaved cohort",{exact:true}).waitFor();
    await layout(page,1440);
    await editor.scrollIntoViewIfNeeded();
    await capture(page,app,"/levytate/app",output,"employer-finance-cohort-1440",false);
    await editor.getByRole("button",{name:"Cancel",exact:true}).click();
    await editor.waitFor({state:"hidden"});
    await page.getByRole("button",{name:"DAS history",exact:true}).click();
    check("Visual Finance: historical evidence remains available",await page.getByTestId("historical-das-evidence").evaluate(el=>el.open));
  });
  await run("contextual Copilot keyboard return",async()=>{
    const page=await open(lead,"People","People");
    await layout(page,1280);
    const launcher=page.getByRole("button",{name:"Open Copilot",exact:true});
    await launcher.focus();
    await page.keyboard.press("Enter");
    const drawer=page.locator("#levytate-persistent-copilot");
    await drawer.getByRole("heading",{name:"Copilot",exact:true}).waitFor();
    await capture(page,app,"/levytate/app",output,"employer-copilot-drawer-1280");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>document.getElementById("levytate-persistent-copilot")?.getAttribute("aria-hidden")==="true");
    await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Open Copilot");
    check("Visual Copilot: Escape restores launcher focus",await launcher.evaluate(el=>el===document.activeElement));
  });
  console.log("VISUAL matrix: "+screenList.length+" screen targets, "+failures.length+" failed or blocked checks");
  check("Premium visual matrix and interaction checks complete",failures.length===0);
}
