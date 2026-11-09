/** Service diagnosis after a genuine browser failure; not Auth proof.
 * Default is read-only; explicit replay reuses the original committed command. */
import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME;if(!root?.startsWith("/private/tmp/levytate-release-runtime."))throw new Error("Dedicated local runtime required");
 const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),fixture=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8"));
 if(new URL(state.env.API_URL).hostname!=="127.0.0.1"||!fixture.synthetic||fixture.environment!=="local")throw new Error("Local fixture only");
 process.env.NEXT_PUBLIC_SUPABASE_URL=state.env.API_URL;process.env.SUPABASE_SERVICE_ROLE_KEY=state.env.SERVICE_ROLE_KEY;
 const user=fixture.tenants[0].users.find((u:{key:string})=>u.key==="employee"),r=await fetch(`${state.env.API_URL}/rest/v1/levytate_users?id=eq.${user.membershipId}&select=auth_subject`,{headers:{apikey:state.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${state.env.SERVICE_ROLE_KEY}`}}),rows=await r.json();
 const {getWorkspaceBootstrapForSession,applyWorkspaceMutationForSession}=await import("../lib/server/levytate-workspace");
 const session={email:user.email,authSubject:rows[0].auth_subject,authMode:"supabase_email" as const,accessLevel:"beta_user" as const,issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300};
 try{const data=process.argv.includes("--replay-committed-application")?await applyWorkspaceMutationForSession(session,{type:"saveApplication",expectedRevision:0,idempotencyKey:`browser-submit-${fixture.run}`,application:{id:`browser-${fixture.run}`,employeeId:user.personId,apprenticeshipStandardId:fixture.catalogue.standardId,reason:"Synthetic acceptance work need",careerGoal:"Synthetic professional development",supportRequired:"None",status:"Awaiting Manager Review",currentOwner:"Line Manager",revision:0,managerNote:"",submittedAt:"",updatedAt:"",history:[]}}):await getWorkspaceBootstrapForSession(session);console.log(JSON.stringify({diagnostic:process.argv.includes("--replay-committed-application")?"exact-application-retry-service-not-auth-proof":"read-only-service-context-not-auth-proof",ok:true,applications:data.data.applications.length}));}
 catch(error){const message=error instanceof Error?error.message:"unknown",safe=message.match(/Cannot read properties of (?:undefined|null) \(reading '[A-Za-z_]+'\)|[A-Za-z_]+ is not (?:a function|defined)|[A-Za-z_]+ is not iterable|invalid input syntax for type [a-z]+/g);console.log(JSON.stringify({diagnostic:"read-only-service-context-not-auth-proof",ok:false,type:error instanceof Error?error.name:"unknown",safeCategory:safe,code:message.match(/\b(?:PGRST\d{3}|PT\d{3}|[0-9]{5})\b/g),messageSha256:createHash("sha256").update(message).digest("hex")}));process.exitCode=1;}
}
void main();
