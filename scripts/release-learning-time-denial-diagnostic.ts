/** Exact local service/RPC diagnostic, explicitly not authenticated browser proof. */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME;if(!root?.startsWith('/private/tmp/levytate-release-runtime.'))throw Error('Local runtime required');
 const s=JSON.parse(readFileSync(`${root}/private-stack-state.json`,'utf8')),m=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,'utf8')),t=m.tenants[0],u=t.users.find((x:{key:string})=>x.key==='employee'),db=new URL(s.env.DB_URL);
 if(db.hostname!=='127.0.0.1'||new URL(s.env.API_URL).hostname!=='127.0.0.1'||!m.synthetic||m.environment!=='local'||!/^[-a-f0-9]{36}$/.test(t.id))throw Error('Local fictional target only');
 process.env.NEXT_PUBLIC_SUPABASE_URL=s.env.API_URL;process.env.SUPABASE_SERVICE_ROLE_KEY=s.env.SERVICE_ROLE_KEY;
 const q=async(path:string)=>{const r=await fetch(`${s.env.API_URL}/rest/v1/${path}`,{headers:{apikey:s.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${s.env.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error(`Local read ${r.status}`);return r.json();};
 const cap=async(enabled:boolean)=>{const r=spawnSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-XAtq','-v','ON_ERROR_STOP=1'],{input:`update public.levytate_organisation_capabilities set off_the_job_assistant_enabled=${enabled} where organisation_id='${t.id}' returning organisation_id;`,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},encoding:'utf8'});if(r.status||r.stdout.trim()!==t.id)throw Error('Local capability update not confirmed');};
 const caps=await q(`levytate_organisation_capabilities?organisation_id=eq.${t.id}&select=off_the_job_assistant_enabled`);if(caps.length!==1||caps[0].off_the_job_assistant_enabled!==false)throw Error('Expected disabled local capability');
 const before=await q(`levytate_otj_activities?organisation_id=eq.${t.id}&created_by_user_id=eq.${u.membershipId}&select=id,status,lock_version`);if(before.length!==1||before[0].status!=='submitted')throw Error('Exact retained submitted activity required');
 const requestId=randomUUID();let status:number|null=null;
 const {learningTimeCommand,LevyTateLearningTimeError}=await import('../lib/server/levytate-off-the-job');
 try{await cap(true);try{await learningTimeCommand(t.id,u.membershipId,'transition_activity',{activityId:before[0].id,action:'employer_check',note:'Synthetic independent denial diagnostic',lockVersion:before[0].lock_version,idempotencyKey:requestId});status=200;}catch(error){if(!(error instanceof LevyTateLearningTimeError))throw Error('Unclassified local service error');status=error.status;}}
 finally{await cap(false);}
 const after=await q(`levytate_otj_activities?organisation_id=eq.${t.id}&created_by_user_id=eq.${u.membershipId}&select=id,status,lock_version`),receipts=await q(`levytate_otj_command_receipts?organisation_id=eq.${t.id}&request_id=eq.${requestId}&select=request_id`);
 const evidence={kind:'service-context-not-authentication-proof',observedAt:new Date().toISOString(),serviceStatus:status,stateUnchanged:JSON.stringify(before)===JSON.stringify(after),receiptRows:receipts.length,capabilityRestored:(await q(`levytate_organisation_capabilities?organisation_id=eq.${t.id}&select=off_the_job_assistant_enabled`))[0].off_the_job_assistant_enabled===false};
 writeFileSync(`${root}/learning-time-denial-service-${Date.now()}.json`,JSON.stringify(evidence,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(evidence));if(!evidence.stateUnchanged||evidence.receiptRows||!evidence.capabilityRestored)process.exitCode=1;
}
void main().catch(()=>{console.error('Local service diagnostic failed; raw details withheld');process.exitCode=1});
