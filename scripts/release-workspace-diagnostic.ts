/** Read-only service diagnosis after a genuine browser failure; not Auth proof. */
import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME;if(!root?.startsWith("/private/tmp/levytate-release-runtime."))throw new Error("Dedicated local runtime required");
 const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),fixture=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8"));
 if(new URL(state.env.API_URL).hostname!=="127.0.0.1"||!fixture.synthetic||fixture.environment!=="local")throw new Error("Local fixture only");
 process.env.NEXT_PUBLIC_SUPABASE_URL=state.env.API_URL;process.env.SUPABASE_SERVICE_ROLE_KEY=state.env.SERVICE_ROLE_KEY;
 const user=fixture.tenants[0].users.find((u:{key:string})=>u.key==="employee"),r=await fetch(`${state.env.API_URL}/rest/v1/levytate_users?id=eq.${user.membershipId}&select=auth_subject`,{headers:{apikey:state.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${state.env.SERVICE_ROLE_KEY}`}}),rows=await r.json();
 const {getWorkspaceBootstrapForSession}=await import("../lib/server/levytate-workspace");
 try{const data=await getWorkspaceBootstrapForSession({email:user.email,authSubject:rows[0].auth_subject,authMode:"supabase_email",accessLevel:"beta_user",issuedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+300});console.log(JSON.stringify({diagnostic:"read-only-service-context-not-auth-proof",ok:true,applications:data.data.applications.length}));}
 catch(error){const message=error instanceof Error?error.message:"unknown",safe=message.match(/Cannot read properties of (?:undefined|null) \(reading '[A-Za-z_]+'\)|[A-Za-z_]+ is not (?:a function|defined)|[A-Za-z_]+ is not iterable|invalid input syntax for type [a-z]+/g);console.log(JSON.stringify({diagnostic:"read-only-service-context-not-auth-proof",ok:false,type:error instanceof Error?error.name:"unknown",safeCategory:safe,code:message.match(/\b(?:PGRST\d{3}|PT\d{3}|[0-9]{5})\b/g),messageSha256:createHash("sha256").update(message).digest("hex")}));process.exitCode=1;}
}
void main();
