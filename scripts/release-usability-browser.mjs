/** Independent real-session Copilot boundaries and local browser presentation. */
import {writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const normaliseVisibleText=value=>value.normalize("NFKC").replace(/\s+/gu," ").trim().toLocaleLowerCase("en-GB");
function pdfText(path){
 const result=spawnSync(process.env.RELEASE_PDFTOTEXT??"/Users/jamesross/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext",[path,"-"],{encoding:"utf8"});
 if(result.status!==0||typeof result.stdout!=="string")throw new Error("PDF content verification unavailable");
 return result.stdout;
}
export async function verifyUsability({app,manifest,contexts,check}){
 const root=process.env.RELEASE_LOCAL_RUNTIME;if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!manifest.synthetic)throw new Error("Synthetic local browser required");
 for(const key of["a:employee","a:manager","b:lead"]){
  const actor=contexts.get(key)??(key==="b:lead"?contexts.get("a:lead"):undefined),marker=`FORGED-OTHER-TENANT-${manifest.run}`;
  const r=await actor.context.request.post(`${app}/api/levytate-ai`,{headers:{Origin:app},data:{role:"Apprenticeship Lead",userRole:"Apprenticeship Lead",selectedSite:marker,currentSection:"Copilot",userMessage:key.endsWith("employee")?"What programmes are available?":"Which applications need my review?",employerContext:marker,conversationHistory:[],workspaceEmployeeContext:{resolution:"selected_employee",missingData:[],employee:{id:"other-tenant-person",name:marker}}}});
  const body=await r.json();if(r.status()!==200)console.log(`DIAGNOSTIC Copilot ${actor.user.role} status ${r.status()}`);
  check(`${actor.user.role} actual Copilot uses server scope`,r.status()===200&&!JSON.stringify(body).includes(marker)&&body.source==="deterministic");
  check(`${actor.user.role} Copilot response is private and uncached`,/no-store/.test(r.headers()["cache-control"]??""));
 }
 const employee=contexts.get("b:employee");await employee.page.goto(`${app}/levytate/app`);await employee.page.waitForLoadState("load");
 await employee.page.getByRole("button",{name:"My Development",exact:true}).waitFor();
 const buttons=employee.page.getByRole("button");check("Employee application exposes accessible named controls",await buttons.count()>3);
 await employee.page.keyboard.press("Tab");const active=await employee.page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent?.trim()}));
 check("keyboard Tab reaches a labelled application control",["BUTTON","A","INPUT","TEXTAREA","SELECT"].includes(active.tag)&&Boolean(active.label));
 // A 640 CSS-pixel viewport exercises the breakpoints of a 1280px desktop at
 // 200% effective zoom. This is not a claim of native browser zoom control.
 await employee.page.setViewportSize({width:640,height:450});
 const fit=await employee.page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 check("Employee home has no overflow at the 640px effective 200-percent viewport",fit.width===640&&fit.scroll<=fit.width+2);
 if(new URL(employee.page.url()).pathname!=="/levytate/app"||new URL(employee.page.url()).searchParams.has("token_hash"))throw new Error("Synthetic authenticated application page required for capture");
 await employee.page.screenshot({path:`${root}/synthetic-employee-effective-200-top-${Date.now()}.png`,fullPage:false});
 await employee.page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await employee.page.waitForFunction(()=>Math.abs(window.scrollY+window.innerHeight-document.documentElement.scrollHeight)<=2||document.documentElement.scrollHeight<=window.innerHeight);
 const bottom=await employee.page.evaluate(()=>({atBottom:window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2,footerVisible:[...document.querySelectorAll('a')].filter(a=>['Privacy','Terms','Support','Data rights'].includes(a.textContent?.trim()??'')).some(a=>{const b=a.getBoundingClientRect();return b.top>=0&&b.bottom<=window.innerHeight;})}));
 check("Employee effective-200 viewport can scroll to visible bottom content",bottom.atBottom&&bottom.footerVisible);
 await employee.page.screenshot({path:`${root}/synthetic-employee-effective-200-bottom-${Date.now()}.png`,fullPage:false});
 await employee.page.evaluate(()=>window.scrollTo(0,0));
 await employee.page.setViewportSize({width:1280,height:900});
 await employee.page.screenshot({path:`${root}/synthetic-employee-desktop-${Date.now()}.png`,fullPage:true});
 await employee.page.emulateMedia({media:"print"});const pdf=await employee.page.pdf({format:"A4",printBackground:true});
 const employeePdf=`${root}/synthetic-employee-print-${Date.now()}.pdf`;
 writeFileSync(employeePdf,pdf,{mode:0o600,flag:"wx"});
 const employeeText=normaliseVisibleText(pdfText(employeePdf));
 check("Employee print contains actual visible journey text",pdf.subarray(0,4).toString()==="%PDF"&&employeeText.includes(normaliseVisibleText("Your next step"))&&employeeText.includes(normaliseVisibleText("Good to see you"))&&employeeText.trim().length>100);
 await employee.page.emulateMedia({media:"screen"});
 const lead=contexts.get("b:lead")??contexts.get("a:lead");await lead.page.goto(`${app}/levytate/app?module=Insights`);
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
 const employerPdf=`${root}/synthetic-employer-executive-${Date.now()}.pdf`;
 writeFileSync(employerPdf,executive,{mode:0o600,flag:"wx"});
 const employerText=normaliseVisibleText(pdfText(employerPdf));
 check("Lead executive print contains actual operating and financial evidence",executive.subarray(0,4).toString()==="%PDF"&&employerText.includes(normaliseVisibleText("Executive operating brief"))&&employerText.includes(normaliseVisibleText("Levy financial position"))&&employerText.includes(normaliseVisibleText("Evidence definitions and material limitations")));
 await lead.page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));await lead.page.emulateMedia({media:"screen"});
}
