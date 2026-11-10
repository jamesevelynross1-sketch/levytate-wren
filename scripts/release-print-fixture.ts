/** Read current fictional service data for presentation, not Auth acceptance. */
import{readFileSync,writeFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{spawnSync}from'node:child_process';
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME,repo=process.env.RELEASE_PRESENTATION_REPO;
 if(!root?.startsWith('/private/tmp/levytate-release-runtime.')||repo!=='/Users/jamesross/Documents/levytate-wren/engineering-worktrees/lg-01')throw Error('Reviewed local paths required');
 const s=JSON.parse(readFileSync(`${root}/private-stack-state.json`,'utf8')),m=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,'utf8'));
 if(!m.synthetic||m.environment!=='local'||new URL(s.env.API_URL).hostname!=='127.0.0.1')throw Error('Local synthetic only');
 process.env.NEXT_PUBLIC_SUPABASE_URL=s.env.API_URL;process.env.SUPABASE_SERVICE_ROLE_KEY=s.env.SERVICE_ROLE_KEY;
 async function serviceContext(key:string,role:string){const t=m.tenants.find((x:{key:string})=>x.key===key),u=t.users.find((x:{key:string})=>x.key===role);const r=await fetch(`${s.env.API_URL}/rest/v1/levytate_users?id=eq.${u.membershipId}&select=auth_subject`,{headers:{apikey:s.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${s.env.SERVICE_ROLE_KEY}`}});if(!r.ok)throw Error('Membership unavailable');const rows=await r.json();return {email:u.email,authSubject:rows[0].auth_subject,authMode:'supabase_email',accessLevel:'beta_user',issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300};}
 const intelligenceModule=await import(pathToFileURL(`${repo}/lib/server/levytate-employer-intelligence.ts`).href),reportModule=await import(pathToFileURL(`${repo}/lib/levytate/intelligence/executive-report.ts`).href),workspaceModule=await import(pathToFileURL(`${repo}/lib/server/levytate-workspace.ts`).href);
 const report=reportModule.buildEmployerExecutiveReportContract(await intelligenceModule.getEmployerIntelligenceForSession(await serviceContext('a','lead')),null),employee=await workspaceModule.getWorkspaceBootstrapForSession(await serviceContext('b','employee'));
 if(report.finance.currentBalancePence!==71500||report.finance.contributionsPence!==100000)throw Error('Actual imported finance not confirmed');
 const commit=spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
 writeFileSync(`${root}/presentation-current-data.json`,JSON.stringify({kind:'service-read-presentation-not-auth-proof',commit,report,employee}),{mode:0o600});console.log(JSON.stringify({kind:'service-read-presentation-not-auth-proof',commit,financeBalancePence:report.finance.currentBalancePence}));
}
void main().catch(()=>{console.error('Presentation source read failed; details withheld');process.exitCode=1});
