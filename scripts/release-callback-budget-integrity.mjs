/** Native local Data API checks: exact grants and failed-only callback budget. */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const root=process.env.RELEASE_LOCAL_RUNTIME;
if(!root?.startsWith("/private/tmp/levytate-release-runtime."))throw new Error("Dedicated local runtime required");
const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8"));
const origin=new URL(state.env.API_URL);if(origin.hostname!=="127.0.0.1")throw new Error("Loopback only");
const hash=randomBytes(32).toString("hex"),other=randomBytes(32).toString("hex");
let passed=0,failed=0;function check(label,value){value?passed++:failed++;console.log(`${value?"PASS":"FAIL"} ${label}`);}
async function rpc(name,body,key=state.env.SERVICE_ROLE_KEY){const r=await fetch(`${origin.origin}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};}
const inspect=(key=hash,environment="local")=>rpc("levytate_check_auth_callback_failures",{p_environment_namespace:environment,p_key_hash:key});
try{
  const first=await inspect();check("service-only callback inspector accepts exact contract",first.status===200&&first.body?.[0]?.allowed===true&&Object.keys(first.body[0]).sort().join(",")==="allowed,reset_at");
  for(let i=0;i<12;i++)await inspect();
  const consume=()=>rpc("levytate_consume_auth_rate_limit",{p_environment_namespace:"local",p_action:"magic_link.callback.failure",p_key_hash:hash,p_window_seconds:900,p_limit:10,p_route:"/levytate/auth/callback",p_event_type:"callback_abuse_threshold_reached"});
  const one=await consume();check("successful-attempt inspection never consumes failed budget",one.status===200&&one.body[0].request_count===1);
  for(let i=0;i<8;i++)await consume();
  check("nine actual recorded failures retain one opportunity",(await inspect()).body?.[0]?.allowed===true);
  await consume();check("ten actual recorded failures close the callback window",(await inspect()).body?.[0]?.allowed===false);
  check("budget isolated by exact key hash",(await inspect(other)).body?.[0]?.allowed===true);
  check("budget isolated by environment namespace",(await inspect(hash,"preview")).body?.[0]?.allowed===true);
  for(const [label,body] of [["null hash",{p_environment_namespace:"local",p_key_hash:null}],["invalid namespace",{p_environment_namespace:"other",p_key_hash:hash}],["malformed hash",{p_environment_namespace:"local",p_key_hash:"not-a-key"}],["null environment",{p_environment_namespace:null,p_key_hash:hash}]]){
    const r=await rpc("levytate_check_auth_callback_failures",body);check(`callback inspector rejects ${label}`,r.status>=400&&r.body?.code==="22023");
  }
  const anonymous=await rpc("levytate_check_auth_callback_failures",{p_environment_namespace:"local",p_key_hash:hash},state.env.ANON_KEY);
  check("anonymous Data API cannot inspect callback budgets",[401,403].includes(anonymous.status));
  const table=await fetch(`${origin.origin}/rest/v1/levytate_auth_rate_limits?select=request_count&limit=1`,{headers:{apikey:state.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${state.env.SERVICE_ROLE_KEY}`}});
  check("service role still cannot read the underlying budget table",table.status===403);
}catch{failed++;console.error("FAIL callback budget contract; credentials and raw provider response omitted");}
console.log(`Independent callback budget: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
