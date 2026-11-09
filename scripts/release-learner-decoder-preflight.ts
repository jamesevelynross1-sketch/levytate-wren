/** Read-only actual fictional learner model; no authenticated journey claim. */
import{readFileSync,writeFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{spawnSync}from'node:child_process';
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME,repo=process.env.RELEASE_PRESENTATION_REPO;
 if(!root?.startsWith('/private/tmp/levytate-release-runtime.')||repo!=='/Users/jamesross/Documents/levytate-wren/engineering-worktrees/lg-01')throw Error('Reviewed local paths required');
 const s=JSON.parse(readFileSync(`${root}/private-stack-state.json`,'utf8')),m=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,'utf8')),t=m.tenants[0],u=t.users.find((x:{key:string})=>x.key==='lead');
 if(!m.synthetic||m.environment!=='local'||new URL(s.env.API_URL).hostname!=='127.0.0.1')throw Error('Local synthetic only');
 process.env.NEXT_PUBLIC_SUPABASE_URL=s.env.API_URL;process.env.SUPABASE_SERVICE_ROLE_KEY=s.env.SERVICE_ROLE_KEY;
 const q=async(path:string)=>{const r=await fetch(`${s.env.API_URL}/rest/v1/${path}`,{headers:{apikey:s.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${s.env.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Local read failed');return r.json();};
 const users=await q(`levytate_users?id=eq.${u.membershipId}&select=auth_subject`),rows=await q(`levytate_learner_records?organisation_id=eq.${t.id}&application_id=eq.browser-${m.run}&select=id,employee_id,application_id,programme_id,provider_id`);if(rows.length!==1)throw Error('Exact retained learner required');
 const row=rows[0],session={email:u.email,authSubject:users[0].auth_subject,authMode:'supabase_email',accessLevel:'beta_user',issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300};
 const service=await import(pathToFileURL(`${repo}/lib/server/levytate-learner-lifecycle.ts`).href),decoder=await import(pathToFileURL(`${repo}/lib/levytate/learner-command-response.ts`).href);
 const learner=await service.getOrganisationLearnerLifecycleRecordDetail(session,row.id),body={ok:true,learner},expected={learnerRecordId:row.id,employeeId:row.employee_id,applicationId:row.application_id,programmeId:row.programme_id,providerId:row.provider_id};
 const checks:Record<string,boolean>={actualCurrentLearnerAccepted:decoder.decodeLearnerCommandResponse(body,expected)===learner};
 for(const key of Object.keys(expected)){try{decoder.decodeLearnerCommandResponse(body,{...expected,[key]:'wrong-fictional-scope'});checks[`${key}MismatchDenied`]=false;}catch{checks[`${key}MismatchDenied`]=true;}}
 for(const[value,name]of[[null,'null'],[{ok:true,learner:{}},'empty'],[{...body,learner:{...learner,progressHistory:null}},'malformedHistory']]as const){try{decoder.decodeLearnerCommandResponse(value,expected);checks[`${name}Denied`]=false;}catch{checks[`${name}Denied`]=true;}}
 const commit=spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),result={kind:'actual-service-model-decoder-not-authentication-proof',commit,checks};writeFileSync(`${root}/learner-decoder-preflight-${Date.now()}.json`,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));if(Object.values(checks).some(x=>!x))process.exitCode=1;
}
void main().catch(()=>{console.error('Learner model preflight failed; raw details withheld');process.exitCode=1});
