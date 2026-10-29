/** Local-only reversible fault injection; never accepts hosted database URLs. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { localUrl } from "./release-local-fixtures.mjs";
const root=process.env.RELEASE_LOCAL_RUNTIME;
if(!root?.startsWith("/private/tmp/levytate-release-runtime."))throw new Error("Dedicated local runtime required");
const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")), db=new URL(state.env.DB_URL);
if(db.hostname!=="127.0.0.1")throw new Error("Fault injection is restricted to the dedicated loopback stack");
const app=localUrl(process.env.RELEASE_APP_URL??"http://localhost:3107","RELEASE_APP_URL");
const signature="public.levytate_consume_auth_rate_limit(text,text,text,integer,integer,text,text,timestamptz)";
const env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)};
function sql(input){const r=spawnSync(process.env.RELEASE_PSQL??"/opt/homebrew/opt/postgresql@17/bin/psql",["-X","-A","-t","-q","-v","ON_ERROR_STOP=1"],{input,env,encoding:"utf8"});if(r.status)throw new Error("Local fault-injection SQL failed");return r.stdout.trim();}
let injected=false,passed=0,failed=0;
function check(name,value){value?passed++:failed++;console.log(`${value?"PASS":"FAIL"} ${name}`);}
const ready=()=>fetch(`${app}/api/levytate-health/ready`,{cache:"no-store"});
const expiry=()=>new Promise(resolve=>setTimeout(resolve,11000));
try{
  const baseline=await ready();check("genuinely available local backend yields readiness200",baseline.status===200&&(await baseline.json()).status==="operational");
  if(sql(`select has_function_privilege('service_role','${signature}','EXECUTE');`)!=="t")throw new Error("Expected original execute grant is absent; no mutation performed");
  sql(`revoke execute on function ${signature} from service_role;`);injected=true;
  await expiry();
  const unavailable=await ready(),body=await unavailable.json();
  check("rate-limit operation failure changes readiness to503",unavailable.status===503&&body.status==="unavailable");
  check("public readiness never reveals schema or credential detail",!JSON.stringify(body).match(/service_role|postgres|levytate_users|eyJ|supabase\.co|127\.0\.0\.1/));
  const request=await fetch(`${app}/api/levytate-auth/request`,{method:"POST",headers:{Origin:app,"Content-Type":"application/json"},body:JSON.stringify({email:"local-outage@example.test"})});
  check("real login fails unavailable when security store fails",request.status===503);
  const refresh=await fetch(`${app}/api/levytate-auth/session`,{method:"POST",headers:{Origin:app}});
  check("session refresh fails unavailable when security store fails",refresh.status===503);
  check("liveness remains distinct from unavailable readiness",(await fetch(`${app}/api/levytate-health/live`)).status===200);
}catch(error){failed++;console.error(`FAIL readiness execution ${error.message}`);}
finally{
  if(injected){try{sql(`grant execute on function ${signature} to service_role;`);console.log("Restored original LOCAL service-role execute grant");await expiry();check("dependency restoration recovers readiness200",(await ready()).status===200);}catch{failed++;console.error("FAIL LOCAL grant restoration; inspect restricted runtime before further tests");}}
}
console.log(`Independent readiness integrity: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
