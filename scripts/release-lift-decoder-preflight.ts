/** Actual local service projections, not an authenticated browser acceptance. */
import{readFileSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';import{pathToFileURL}from'node:url';
let phase='initialisation';
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME,repo=process.env.RELEASE_PRESENTATION_REPO;
 if(!root?.startsWith('/private/tmp/levytate-release-runtime.')||repo!=='/Users/jamesross/Documents/levytate-wren/engineering-worktrees/lg-01')throw Error('Reviewed local paths required');
 const{lockAcceptanceRuntime}=await import(pathToFileURL(`${process.cwd()}/scripts/release-runtime-lock.mjs`).href);const release=lockAcceptanceRuntime('lift-decoder-service-preflight');
 const s=JSON.parse(readFileSync(`${root}/private-stack-state.json`,'utf8')),m=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,'utf8')),t=m.tenants[0],db=new URL(s.env.DB_URL);
 if(!m.synthetic||m.environment!=='local'||db.hostname!=='127.0.0.1'||new URL(s.env.API_URL).hostname!=='127.0.0.1'||!/^[-a-f0-9]{36}$/.test(t.id))throw Error('Local synthetic target required');
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:s.env.API_URL,SUPABASE_SERVICE_ROLE_KEY:s.env.SERVICE_ROLE_KEY,NODE_ENV:'development',LEVYTATE_LIFT_ENABLED:'true',LEVYTATE_LIFT_RUNTIME_SCOPE:'local',LEVYTATE_LIFT_ALLOWED_ORGANISATION_ID:t.id});
 const q=async(path:string)=>{const r=await fetch(`${s.env.API_URL}/rest/v1/${path}`,{headers:{apikey:s.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${s.env.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Local read failed');return r.json();};
 const cap=(enabled:boolean)=>{const r=spawnSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-XAtq','-v','ON_ERROR_STOP=1'],{input:`update public.levytate_organisation_capabilities set lift_enabled=${enabled} where organisation_id='${t.id}' returning organisation_id;`,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)},encoding:'utf8'});if(r.status||r.stdout.trim()!==t.id)throw Error('Local capability not confirmed');};
 phase='read capability';const caps=await q(`levytate_organisation_capabilities?organisation_id=eq.${t.id}&select=lift_enabled`);if(caps.length!==1||caps[0].lift_enabled!==false)throw Error('Expected inactive local capability');
 const checks:Record<string,boolean>={};
 try{
  phase='enable owned local capability';cap(true);phase='import reviewed service';const service=await import(pathToFileURL(`${repo}/lib/server/levytate-lift.ts`).href),decoder=await import(pathToFileURL(`${repo}/lib/levytate/client-module-responses.ts`).href);
  for(const key of['employee','manager','lead']){
   const u=t.users.find((x:{key:string})=>x.key===key),rows=await q(`levytate_users?id=eq.${u.membershipId}&select=auth_subject`);if(rows.length!==1||!rows[0].auth_subject)throw Error('Current identity required');
   const session={email:u.email,authSubject:rows[0].auth_subject,authMode:'supabase_email',accessLevel:'beta_user',issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300};
   phase=`${key} service model`;const workspace=await service.getLiftWorkspaceForSession(session),body={ok:true,workspace};checks[`${key}ActualModelAccepted`]=decoder.decodeLiftMutationResponse(body)===workspace;
   if(key==='employee'){
    checks.retainedSubmittedAndReleased=workspace.assessment?.status==='submitted'&&Boolean(workspace.assessment.releasedManagerObservation?.id);
    checks.ownContextReadbackPresent=Array.isArray(workspace.assessment?.releasedManagerObservation?.ownContexts);
    try{decoder.decodeLiftMutationResponse({ok:true,workspace:{...workspace,assessment:{...workspace.assessment,releasedManagerObservation:{...workspace.assessment.releasedManagerObservation,ownContexts:null}}}});checks.malformedOwnContextsDenied=false;}catch{checks.malformedOwnContextsDenied=true;}
   }else checks[`${key}NoEmployeeContextReadback`]=!JSON.stringify(workspace).includes('"ownContexts"');
   for(const[field,value]of[['framework',{}],['coverage',null],['role','Unknown']]as const){try{decoder.decodeLiftMutationResponse({ok:true,workspace:{...workspace,[field]:value}});checks[`${key}${field}MalformedDenied`]=false;}catch{checks[`${key}${field}MalformedDenied`]=true;}}
  }
 }finally{cap(false);release();}
 checks.capabilityRestored=(await q(`levytate_organisation_capabilities?organisation_id=eq.${t.id}&select=lift_enabled`))[0].lift_enabled===false;
 const result={kind:'actual-service-projection-not-authentication-proof',commit:spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),checks};writeFileSync(`${root}/lift-decoder-preflight-${Date.now()}.json`,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));if(Object.values(checks).some(x=>!x))process.exitCode=1;
}
void main().catch(()=>{console.error(`Lift service preflight failed during ${phase}; raw details withheld`);process.exitCode=1});
