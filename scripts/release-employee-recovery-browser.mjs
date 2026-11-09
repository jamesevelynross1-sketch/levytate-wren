/** Start or naturally reopen one fictional application for real UI recovery. */
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {verifyWorkspaceRecovery} from "./release-workspace-recovery-browser.mjs";
const active=new Set(["Draft","Submitted to Line Manager","Awaiting Manager Review","More information requested","Approved by Line Manager","Submitted to Apprenticeship Lead","Awaiting Final Approval","Approved for Enrolment"]);
export async function verifyEmployeeRecovery({app,mailpit,manifest,contexts,backend,waitForCapturedLink,check}){
 const root=process.env.RELEASE_LOCAL_RUNTIME,applicant=contexts.get("a:employee"),reviewer=contexts.get("a:manager"),page=applicant.page;
 if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!manifest.synthetic||manifest.environment!=="local")throw new Error("Synthetic local recovery scope required");
 const marker=`${root}/workspace-recovery-application.json`;
 const applications=()=>backend(`rest/v1/levytate_applications?organisation_id=eq.${applicant.tenant.id}&employee_id=eq.${applicant.user.personId}&select=id,status,revision`);
 let applicationId;
 if(existsSync(marker)){
  const saved=JSON.parse(readFileSync(marker,"utf8"));
  if(saved.parentRun!==manifest.run||saved.organisationId!==applicant.tenant.id||saved.employeeId!==applicant.user.personId)throw new Error("Recovery application scope mismatch");
  applicationId=saved.applicationId;let current=(await applications()).find(item=>item.id===applicationId);
  if(!current)throw new Error("Preserved recovery application missing");
  if(["Awaiting Manager Review","Submitted to Line Manager"].includes(current.status)){
   const response=await reviewer.context.request.post(`${app}/api/levytate-workspace`,{headers:{Origin:app,"X-LevyTate-Account":reviewer.user.email,"X-LevyTate-Organisation":reviewer.tenant.id},data:{type:"updateApplicationStatus",id:applicationId,status:"More information requested",expectedRevision:current.revision,idempotencyKey:randomUUID(),note:"Synthetic independent request to clarify the retained application after recovery testing."}});
   check("genuine direct manager naturally reopens the recorded recovery application",response.status()===200);
   current=(await applications()).find(item=>item.id===applicationId);
  }
  check("recorded recovery application is editable without resetting history",["Draft","More information requested"].includes(current.status));
  await page.goto(`${app}/levytate/app?module=My%20Application`);
 }else{
  check("new recovery journey begins only after previous own application ended",!(await applications()).some(item=>active.has(item.status)));
  await page.goto(`${app}/levytate/app?module=My%20Programme`);
  await page.getByRole("button",{name:"View Synthetic acceptance programme",exact:true}).click();
  const started=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/levytate-workspace"&&r.request().method()==="POST");
  await page.getByRole("dialog",{name:"Synthetic acceptance programme",exact:true}).getByRole("button",{name:"Start pathway application",exact:true}).click();
  check("Employee creates a fresh own draft through the actual programme UI",(await started).status()===200);
  const current=(await applications()).filter(item=>active.has(item.status));
  check("one newly started own draft is durable",current.length===1&&current[0].status==="Draft");applicationId=current[0].id;
  // Only fictional row identity is retained, never a draft, command or session.
  writeFileSync(marker,JSON.stringify({parentRun:manifest.run,organisationId:applicant.tenant.id,employeeId:applicant.user.personId,applicationId}),{mode:0o600,flag:"wx"});
 }
 for(const[index,label]of["Why are you interested in this programme?","How could it help your current role or future development?","What support will you need from your manager?"].entries())await page.getByLabel(label,{exact:true}).fill(`Synthetic genuine recovery answer ${index+1}; no customer information.`);
 await verifyWorkspaceRecovery({app,applicant,applicationId,backend,check,mailpit,waitForCapturedLink});
}
