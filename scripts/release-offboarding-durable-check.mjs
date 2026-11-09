/** Independent read-only verification of a peer's actual local disposal drill. */
import {readFileSync,readdirSync,statSync,writeFileSync} from "node:fs";
import{join}from"node:path";
import{spawnSync}from"node:child_process";
const root=process.env.RELEASE_LOCAL_RUNTIME,path=process.argv[2];
if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!path?.startsWith(`${root}/offboard-native-`)||!path.endsWith(".json"))throw new Error("Restricted synthetic native drill evidence required");
const fixture=JSON.parse(readFileSync(path,"utf8")),state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8")),db=new URL(state.env.DB_URL),api=new URL(state.env.API_URL);
if(db.hostname!=="127.0.0.1"||api.hostname!=="127.0.0.1"||![fixture.tenant,fixture.other,fixture.caseId,fixture.providerMember,...fixture.users.flatMap(u=>[u.id,u.subject])].every(v=>/^[a-f0-9-]{36}$/.test(v))||fixture.users.some(u=>!u.email.endsWith("@example.test")))throw new Error("Exact local fictional identifiers required");
const checks=[];function check(label,passed){checks.push({label,passed});console.log(`${passed?"PASS":"FAIL"} ${label}`);if(!passed)throw new Error("Durable offboarding assertion failed");}
function sql(input){const r=spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8",env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)}});if(r.status)throw new Error("Independent local observation failed");return r.stdout.trim();}
check("peer recorded actual native drill with every check passing",fixture.checks.length===19&&fixture.checks.every(c=>c.passed));
check("deleted tenant remains absent",sql(`select count(*) from public.levytate_organisations where id='${fixture.tenant}'`) ==="0");
check("other tenant remains active",sql(`select count(*) from public.levytate_organisations where id='${fixture.other}' and status='Active'`) ==="1");
const exclusive=fixture.users.find(u=>u.name==="exclusive"),shared=fixture.users.find(u=>u.name==="shared-provider");
check("exclusive Auth user and sessions are durably absent",sql(`select (select count(*) from auth.users where id='${exclusive.subject}')+(select count(*) from auth.sessions where user_id='${exclusive.subject}')`) ==="0");
check("shared inactive provider binding and Auth user remain",sql(`select count(*) from public.levytate_provider_memberships p join auth.users a on a.id=p.auth_subject where p.id='${fixture.providerMember}' and not p.active and p.auth_subject='${shared.subject}'`) ==="1");
check("target Storage catalogue remains empty",sql(`select count(*) from storage.objects where name like '${fixture.tenant}/%'`) ==="0");
const files=[];for(const directory of readdirSync(`${root}/home/stacks`,{withFileTypes:true}).filter(d=>d.isDirectory())){const folder=`${root}/home/stacks/${directory.name}`,native=JSON.parse(readFileSync(`${folder}/state.json`,"utf8")),base=native.instances.find(x=>x.creation.service==="storage")?.creation.config.filePath;if(!base?.startsWith(`${folder}/`))throw new Error("Restricted native file path required");for(const name of readdirSync(base,{recursive:true}))if(statSync(join(base,name)).isFile())files.push({name,path:join(base,name)});}
check("no target physical bytes survive native Storage removal",files.filter(f=>f.name.includes(fixture.tenant)).length===0);
const otherFiles=files.filter(f=>f.name.includes(fixture.other)&&f.name.includes(fixture.caseId));
check("other tenant exact physical bytes remain",otherFiles.length===1&&readFileSync(otherFiles[0].path,"utf8")==="fictional unaffected bytes");
const response=await fetch(`${api.origin}/storage/v1/object/authenticated/levytate-uploads/${fixture.otherPath}`,{headers:{apikey:state.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${state.env.SERVICE_ROLE_KEY}`}});
check("other tenant bytes still downloadable through actual Storage API",response.ok&&await response.text()==="fictional unaffected bytes");
writeFileSync(`${root}/offboard-independent-${fixture.caseId}-${Date.now()}.json`,JSON.stringify({environment:"local",mode:"read-only-durable-native-observation",caseId:fixture.caseId,checks}),{mode:0o600,flag:"wx"});
