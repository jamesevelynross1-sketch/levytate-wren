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
  await page.evaluate(async()=>{await document.fonts.load('400 14px "LevyTate Inter"');await document.fonts.ready;});
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

  await run("typography, application row and KPI alignment",async()=>{
    const page=await open(lead,"Applications","Applications");
    await page.setViewportSize({width:1600,height:900});
    const table=page.getByTestId("applications-responsive-list");
    await table.waitFor();
    await page.evaluate(async()=>{await document.fonts.load('600 14px "LevyTate Inter"');await document.fonts.ready;});
    const geometry=await table.evaluate(el=>{
      const wordBreaks=[];
      const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      while(walk.nextNode()){
        const node=walk.currentNode;
        if(!node.parentElement||node.parentElement.getBoundingClientRect().width===0)continue;
        if(!node.parentElement.closest('[data-testid="application-owner"],[data-testid="application-stage"],time'))continue;
        for(const match of node.textContent.matchAll(/\S+/g)){
          const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
          const lines=new Set([...range.getClientRects()].map(r=>Math.round(r.top)));
          if(lines.size>1)wordBreaks.push(true);
        }
      }
      const row=el.querySelector('tbody tr');if(!row)return {wordBreaks:1,aligned:false,font:"",loaded:false};const cells=[...row.querySelectorAll('td')];
      return {wordBreaks:wordBreaks.length,aligned:Math.max(...cells.map(cell=>cell.getBoundingClientRect().top))-Math.min(...cells.map(cell=>cell.getBoundingClientRect().top))<2,font:getComputedStyle(cells[0]).fontFamily,loaded:[...document.fonts].some(f=>f.family.replace(/["']/g,"")==="LevyTate Inter"&&f.status==="loaded")};
    });
    check("Visual Applications: bundled Inter actually loaded",geometry.loaded&&geometry.font.includes("LevyTate Inter"));
    check("Visual Applications: owner, stage and date words do not split",geometry.wordBreaks===0&&geometry.aligned);
    await table.scrollIntoViewIfNeeded();await capture(page,app,"/levytate/app",output,"application-table-aligned-1600",false);
    const brief=await open(lead,"Insights","Overview",p=>p.getByTestId("insight-metric-rail").waitFor());
    for(const width of [768,1280,1440,1600]){
      await layout(brief,width);
      const rail=brief.getByTestId("insight-metric-rail");
      const aligned=await rail.evaluate(el=>{
        const groups=new Map();
        for(const card of el.querySelectorAll('[data-testid="insight-metric"]')){
          const top=Math.round(card.getBoundingClientRect().top);
          const values=['label','value','detail','evidence'].map(name=>card.querySelector('[data-testid="insight-metric-'+name+'"]').getBoundingClientRect().top);
          const row=groups.get(top)??[];row.push(values);groups.set(top,row);
        }
        return [...groups.values()].every(row=>[0,1,2,3].every(i=>Math.max(...row.map(v=>v[i]))-Math.min(...row.map(v=>v[i]))<=1));
      });
      check("Visual Insights: shared label/value/detail/evidence baselines at "+width+"px",aligned);
      if(width===1440||width===1600){await rail.scrollIntoViewIfNeeded();await capture(brief,app,"/levytate/app",output,"insight-kpis-aligned-"+width,false);}
    }
  });
  await run("employee record detail hierarchy",async()=>{
    const page=await open(lead,"People","People");
    for(const width of [390,1440]){
      await layout(page,width);
      await page.getByRole("button",{name:"Details",exact:true}).first().click();
      const detail=page.getByTestId("employee-record-detail");
      await detail.waitFor();
      check("Visual employee record: one Copilot action at "+width+"px",await detail.getByRole("button",{name:"Open Copilot",exact:true}).count()===1);
      await capture(page,app,"/levytate/app",output,"employee-record-"+width,false);
      await page.keyboard.press("Escape");await detail.waitFor({state:"hidden"});
    }
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
    const programme=editor.getByRole("combobox",{name:"Apprenticeship programme",exact:true});
    console.log("VISUAL finance programme selector count",await programme.count());
    console.log("VISUAL finance step: awaiting a real approved standard in the selector");
    try {
      await programme.locator("option").nth(1).waitFor({state:"attached",timeout:12000});
    } catch {
      // This is an isolated fictional browser session; only status/counts are
      // recorded, never the response body, learner data or authentication.
      const response=await page.request.get(app+"/api/levytate-standards");
      let data=null;
      try {data=await response.json();}catch{}
      console.log("VISUAL finance catalogue diagnostic",JSON.stringify({
        httpStatus:response.status(),
        source:typeof data?.source==="string"?data.source:"unavailable",
        approvedCount:Number(data?.counts?.approvedForDelivery??0),
        responseCount:Array.isArray(data?.standards)?data.standards.length:0,
        accessibleSelectCount:await programme.count(),
        allEditorSelects:await editor.locator("select").count(),
        selectorCount:await programme.locator("option").count(),
      }));
      throw Error("Finance programme selector has no approved standard after catalogue load");
    }
    console.log("VISUAL finance step: approved programme option now available");
    const option=await programme.locator("option").nth(1).getAttribute("value");
    if(!option)throw Error("Synthetic standards unavailable");
    await programme.selectOption(option);
    console.log("VISUAL finance step: programme selected");
    await editor.getByLabel("Price per learner (£)",{exact:true}).fill("12000");
    // The local catalogue fixture has no confirmed band or duration; supply
    // explicit synthetic planning assumptions without claiming eligibility.
    console.log("VISUAL finance step: opening funding assumptions");
    await editor.getByText("Programme details & eligibility",{exact:true}).click();
    await editor.getByLabel("Funding band (£)",{exact:true}).fill("12000");
    await editor.getByLabel("Training months",{exact:true}).fill("12");
    console.log("VISUAL finance step: funding assumptions entered");
    await editor.getByLabel("Learners",{exact:true}).fill("3");
    console.log("VISUAL finance valid draft input controls reached");
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
