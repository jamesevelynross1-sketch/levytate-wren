/** Read-only durable observation after the real local browser lifecycle. */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertLifecycleManifest } from "./release-lifecycle-fixtures.mjs";

const root=process.env.RELEASE_LOCAL_RUNTIME, evidencePath=process.argv[2];
if(!/^\/private\/tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??"")||!evidencePath?.startsWith(`${root}/browser-evidence-`)||!evidencePath.endsWith(".json"))throw Error("Exact local browser evidence required");
const base=JSON.parse(readFileSync(`${root}/fixture-manifest.json`,"utf8")), plan=JSON.parse(readFileSync(`${root}/lifecycle-fixture-manifest.json`,"utf8")), evidence=JSON.parse(readFileSync(evidencePath,"utf8"));
assertLifecycleManifest(plan,base.run,true);
if(evidence.environment!=="local"||!evidence.results.some(item=>item.name==="Lifecycle: owned tenant is durably absent"&&item.status==="PASS")||evidence.results.some(item=>item.status==="FAIL"))throw Error("Successful actual lifecycle evidence required");
const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),db=new URL(state.env.DB_URL);
if(db.hostname!=="127.0.0.1")throw Error("Loopback only");
function sql(input){const r=spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8",env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)}});if(r.status)throw Error("Local durable observation failed; private details withheld");return r.stdout.trim();}
const checks=[];function check(label,passed){checks.push({label,passed});console.log(`${passed?"PASS":"FAIL"} ${label}`);if(!passed)throw Error("Lifecycle durable observation failed");}
const member=plan.users.find(user=>user.key==="member");
check("browser-deleted organisation remains absent",sql(`select count(*) from public.levytate_organisations where id='${plan.target.id}'`)==="0");
check("exclusive member Auth user and sessions remain absent",sql(`select (select count(*) from auth.users where id='${member.authSubject}')+(select count(*) from auth.sessions where user_id='${member.authSubject}')`)==="0");
check("owned Storage catalogue remains empty",sql(`select count(*) from storage.objects where name like '${plan.target.id}/%'`)==="0");
const files=[];
for(const directory of readdirSync(`${root}/home/stacks`,{withFileTypes:true}).filter(item=>item.isDirectory())){
 const folder=`${root}/home/stacks/${directory.name}`,native=JSON.parse(readFileSync(`${folder}/state.json`,"utf8")),storage=native.instances.find(item=>item.creation.service==="storage")?.creation.config.filePath;
 if(!storage?.startsWith(`${folder}/`))throw Error("Native local Storage file root required");
 for(const name of readdirSync(storage,{recursive:true}))if(statSync(join(storage,name)).isFile())files.push({name,path:join(storage,name)});
}
check("native Storage contains no physical target bytes",files.filter(item=>item.name.includes(plan.target.id)).length===0);
check("both original fictional employers remain active",sql(`select count(*) from public.levytate_organisations where id in ('${base.tenants[0].id}','${base.tenants[1].id}') and status='Active'`)==="2");
// Independently retained physical control from the earlier native-service drill.
const controls=readdirSync(root).filter(name=>/^offboard-native-[a-f0-9-]{36}\.json$/.test(name)).map(name=>JSON.parse(readFileSync(`${root}/${name}`,"utf8"))).filter(item=>item.checks?.length===19&&item.checks.every(check=>check.passed));
if(controls.length!==1||!/^[a-f0-9-]{36}$/.test(controls[0].other))throw Error("Exact existing native control required");
const control=controls[0], otherFiles=files.filter(item=>item.name.includes(control.other)&&item.name.includes(control.caseId));
const expected=createHash("sha256").update("fictional unaffected bytes").digest("hex");
check("independent other-tenant physical control remains exact",otherFiles.length===1&&createHash("sha256").update(readFileSync(otherFiles[0].path)).digest("hex")===expected);
const result={environment:"local",mode:"read-only-native-observation-after-genuine-browser",appCodeCommit:evidence.appCodeCommit,harnessCommit:evidence.candidateCommit,targetId:plan.target.id,checks};
writeFileSync(`${root}/lifecycle-durable-${Date.now()}.json`,JSON.stringify(result,null,2),{mode:0o600,flag:"wx"});
