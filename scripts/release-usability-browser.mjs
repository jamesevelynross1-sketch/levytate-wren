/** Independent real-session Copilot boundaries and local browser presentation. */
import {writeFileSync} from "node:fs";
export async function verifyUsability({app,manifest,contexts,check}){
 const root=process.env.RELEASE_LOCAL_RUNTIME;if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!manifest.synthetic)throw new Error("Synthetic local browser required");
 for(const key of["a:employee","a:manager","b:lead"]){
  const actor=contexts.get(key),marker=`FORGED-OTHER-TENANT-${manifest.run}`;
  const r=await actor.context.request.post(`${app}/api/levytate-ai`,{headers:{Origin:app},data:{role:"Apprenticeship Lead",userRole:"Apprenticeship Lead",selectedSite:marker,currentSection:"Copilot",userMessage:key.endsWith("employee")?"What programmes are available?":"Which applications need my review?",employerContext:marker,conversationHistory:[],workspaceEmployeeContext:{resolution:"selected_employee",missingData:[],employee:{id:"other-tenant-person",name:marker}}}});
  const body=await r.json();if(r.status()!==200)console.log(`DIAGNOSTIC Copilot ${actor.user.role} status ${r.status()}`);
  check(`${actor.user.role} actual Copilot uses server scope`,r.status()===200&&!JSON.stringify(body).includes(marker)&&body.source==="deterministic");
  check(`${actor.user.role} Copilot response is private and uncached`,/no-store/.test(r.headers()["cache-control"]??""));
 }
 const employee=contexts.get("b:employee");await employee.page.goto(`${app}/levytate/app`);await employee.page.waitForLoadState("load");
 const buttons=employee.page.getByRole("button");check("Employee application exposes accessible named controls",await buttons.count()>3);
 await employee.page.keyboard.press("Tab");const active=await employee.page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent?.trim()}));
 check("keyboard Tab reaches a labelled application control",["BUTTON","A","INPUT","TEXTAREA","SELECT"].includes(active.tag)&&Boolean(active.label));
 await employee.page.evaluate(()=>{document.documentElement.style.zoom="200%";});await employee.page.waitForTimeout(100);
 const fit=await employee.page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 check("Employee home reflows at 200 percent CSS zoom",fit.scroll<=fit.width+2);
 if(new URL(employee.page.url()).pathname!=="/levytate/app"||new URL(employee.page.url()).searchParams.has("token_hash"))throw new Error("Synthetic authenticated application page required for capture");
 await employee.page.screenshot({path:`${root}/synthetic-employee-zoom-${Date.now()}.png`,fullPage:true});
 await employee.page.evaluate(()=>{document.documentElement.style.zoom="";});
 await employee.page.screenshot({path:`${root}/synthetic-employee-desktop-${Date.now()}.png`,fullPage:true});
 await employee.page.emulateMedia({media:"print"});const pdf=await employee.page.pdf({format:"A4",printBackground:true});
 check("Employee print rendering produces a real PDF",pdf.subarray(0,4).toString()==="%PDF"&&pdf.length>1000);
 writeFileSync(`${root}/synthetic-employee-print-${Date.now()}.pdf`,pdf,{mode:0o600,flag:"wx"});await employee.page.emulateMedia({media:"screen"});
 const lead=contexts.get("b:lead");await lead.page.goto(`${app}/levytate/app?module=Insights`);
 await lead.page.getByRole("button",{name:"Print executive report",exact:true}).waitFor();
 if(new URL(lead.page.url()).pathname!=="/levytate/app")throw new Error("Authenticated report application required");
 await lead.page.screenshot({path:`${root}/synthetic-employer-insights-${Date.now()}.png`,fullPage:true});
 // Suppress only the native print dialog; the actual application handler still
 // mounts its real aggregate report and applies its own print stylesheet.
 await lead.page.evaluate(()=>{window.print=()=>{};});
 await lead.page.getByRole("button",{name:"Print executive report",exact:true}).click();
 await lead.page.locator(".employer-intelligence-report").waitFor({state:"attached"});
 await lead.page.emulateMedia({media:"print"});
 const executive=await lead.page.pdf({format:"A4",printBackground:true});
 check("Lead executive print renders actual aggregate employer report",executive.subarray(0,4).toString()==="%PDF"&&executive.length>1000);
 writeFileSync(`${root}/synthetic-employer-executive-${Date.now()}.pdf`,executive,{mode:0o600,flag:"wx"});
 await lead.page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));await lead.page.emulateMedia({media:"screen"});
}
