/** Independent Finance durability tests. Never run against a hosted database. */
import { spawnSync, spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
const host=process.env.RELEASE_PGHOST, database=process.env.RELEASE_PGDATABASE;
if (!(host==="127.0.0.1"||host==="localhost"||host?.startsWith("/private/tmp/"))||!/^levytate_release_[a-z0-9_]+$/.test(database??"")){console.error("BLOCKED dedicated loopback verifier database required");process.exit(2);}
const args=["-X","-A","-t","-q","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-h",host,"-p",process.env.RELEASE_PGPORT??"5432","-U",process.env.RELEASE_PGUSER??"postgres","-d",database], binary=process.env.RELEASE_PSQL??"psql";
const q=s=>`'${String(s).replaceAll("'","''")}'`, j=s=>`${q(JSON.stringify(s))}::jsonb`;
const parsed=(code,out,err)=>({ok:code===0,value:out.trim(),code:err.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]});
const sql=input=>{const r=spawnSync(binary,args,{input,encoding:"utf8"});return parsed(r.status,r.stdout,r.stderr);};
const need=input=>{const r=sql(input);if(!r.ok)throw new Error(`SQLSTATE ${r.code??"connection"}`);return r.value;};
const concurrent=input=>new Promise(resolve=>{const p=spawn(binary,args,{stdio:["pipe","pipe","pipe"]});let out="",err="";p.stdout.on("data",v=>{out+=v;});p.stderr.on("data",v=>{err+=v;});p.on("close",code=>resolve(parsed(code,out,err)));p.stdin.end(input);});
let passed=0,failed=0;const check=(name,ok)=>{ok?passed++:failed++;console.log(`${ok?"PASS":"FAIL"} ${name}`);};
const deny=(name,input,states=["PT403","PT409","PT422","42501"])=>{const r=sql(`begin;set local role service_role;${input}commit;`);check(name,!r.ok&&states.includes(r.code));};
const org=randomUUID(),other=randomUUID(),lead=randomUUID(),employee=randomUUID(),foreign=randomUUID(),prefix=randomUUID().slice(0,8);
const transaction=(extra={})=>{const row={transaction_id:randomUUID(),transaction_date:"2026-10-01",description:`Synthetic levy ${prefix}`,category:"levy_in",amount_pence:100000,provider_name:"",apprentice_name:"",programme_name:"",paye_scheme:"SYNTHETIC",payroll_month:"2026-10",reported_balance_pence:null,source_row:1,...extra};return{...row,fingerprint:createHash("sha256").update([row.transaction_date,row.description.trim().toLowerCase().replace(/\s+/g," "),row.amount_pence,row.provider_name,row.apprentice_name,row.programme_name].join("|")).digest("hex")};};
const command=(action,input,key=randomUUID(),actor=lead,tenant=org)=>`select public.levytate_apply_finance_command(${q(tenant)}::uuid,${q(actor)}::uuid,${q(key)},${q(action)},${j(input)});`;
const call=(...args)=>JSON.parse(need(`begin;set local role service_role;${command(...args)}commit;`));
const input=rows=>({fileName:"synthetic.csv",sourceRows:rows.length,transactions:rows});
try{
  console.log(`Environment local PostgreSQL ${need("show server_version;")}`);
  need(`insert into public.levytate_organisations(id,name,slug,status) values(${q(org)},'Synthetic Finance A',${q(`finance-${prefix}-a`)},'Active'),(${q(other)},'Synthetic Finance B',${q(`finance-${prefix}-b`)},'Active');insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values(${q(lead)},${q(org)},${q(`${prefix}.lead@example.test`)},'Apprenticeship Lead','beta_user',true),(${q(employee)},${q(org)},${q(`${prefix}.employee@example.test`)},'Employee','beta_user',true),(${q(foreign)},${q(other)},${q(`${prefix}.foreign@example.test`)},'Apprenticeship Lead','beta_user',true);`);
  const row=transaction(), body=input([row]), key=randomUUID();
  const race=await Promise.all([1,2].map(()=>concurrent(`begin;set local role service_role;${command("import",body,key)}commit;`)));
  check("lost-response concurrent retry returns identical import",race.every(r=>r.ok)&&race[0].value===race[1].value);
  const imported=JSON.parse(race[0].value);check("first import reports exact persisted counts",imported.new_transactions===1&&imported.duplicate_rows===0&&imported.source_rows===1);
  check("retry writes one transaction import receipt and audit",need(`select (select count(*) from public.levytate_finance_transactions where organisation_id=${q(org)})||':'||(select count(*) from public.levytate_finance_imports where organisation_id=${q(org)})||':'||(select count(*) from public.levytate_finance_command_receipts where organisation_id=${q(org)})||':'||(select count(*) from public.levytate_audit_events where organisation_id=${q(org)} and action='finance.import');`)==="1:1:1:1");
  const otherKeys=await Promise.all([1,2].map(()=>concurrent(`begin;set local role service_role;${command("import",body)}commit;`)));
  check("concurrent repeated files report duplicates without adding rows",otherKeys.every(r=>r.ok&&JSON.parse(r.value).new_transactions===0&&JSON.parse(r.value).duplicate_rows===1));
  check("Finance version increments for committed commands only",need(`select revision from public.levytate_finance_versions where organisation_id=${q(org)};`)==="3");
  deny("changed payload cannot reuse request key",command("import",{...body,fileName:"different.csv"},key));
  deny("Employee cannot import Finance",command("import",body,randomUUID(),employee));
  deny("foreign tenant Lead cannot write Finance",command("import",body,randomUUID(),foreign));
  for(const field of ["paye_scheme","payroll_month","category","reported_balance_pence"]){deny(`changed ${field} cannot hide behind same fingerprint`,command("import",input([{...row,[field]:field==="reported_balance_pence"?42:field==="category"?"other":"changed"}])));}
  deny("forged fingerprint rejected",command("import",input([{...transaction({description:"New source"}),fingerprint:row.fingerprint}])));
  deny("invalid source count denied",command("import",{...body,sourceRows:2}));
  deny("fractional pence denied",command("import",input([transaction({amount_pence:1.5})])));
  deny("invalid calendar date denied",command("import",input([transaction({transaction_date:"2026-02-30"})])));
  deny("null transaction denied",command("import",input([null])));
  deny("null action denied",command("import",body).replace("'import'","null"));
  const failureKey=randomUUID(), failedRow=transaction({description:`Failure injection ${prefix}`}), constraint=`release_finance_failure_${prefix}`;
  need(`alter table public.levytate_audit_events add constraint ${constraint} check(organisation_id<>${q(org)}::uuid or action<>'finance.import') not valid;`);
  const failure=sql(`begin;set local role service_role;${command("import",input([failedRow]),failureKey)}commit;`);
  need(`alter table public.levytate_audit_events drop constraint ${constraint};`);
  check("audit failure aborts Finance transaction",!failure.ok&&failure.code==="23514");
  check("failed audit leaves no source receipt or revision change",need(`select (select count(*) from public.levytate_finance_transactions where organisation_id=${q(org)} and fingerprint=${q(failedRow.fingerprint)})||':'||(select count(*) from public.levytate_finance_command_receipts where organisation_id=${q(org)} and request_id=${q(failureKey)})||':'||(select revision from public.levytate_finance_versions where organisation_id=${q(org)});`)==="0:0:3");
  check("retry after dependency recovery commits same request",call("import",input([failedRow]),failureKey).new_transactions===1);
  const balanceKey=randomUUID(), balanceInput={amountPence:50000,expectedConfirmedAt:null};
  const balance=call("balance",balanceInput,balanceKey);
  check("balance lost-response retry returns original confirmation",JSON.stringify(balance)===JSON.stringify(call("balance",balanceInput,balanceKey)));
  const balanceRace=await Promise.all([60000,70000].map(amountPence=>concurrent(`begin;set local role service_role;${command("balance",{amountPence,expectedConfirmedAt:balance.confirmed_at})}commit;`)));
  check("concurrent balance confirmation yields one success and one conflict",balanceRace.filter(r=>r.ok).length===1&&balanceRace.some(r=>r.code==="PT409"));
  deny("stale confirmed balance cannot overwrite current value",command("balance",balanceInput));
  deny("negative confirmed balance denied",command("balance",{amountPence:-1,expectedConfirmedAt:balance.confirmed_at}));
  deny("service direct balance write denied",`update public.levytate_finance_balances set amount_pence=0 where organisation_id=${q(org)};`);
  deny("service direct transaction write denied",`delete from public.levytate_finance_transactions where organisation_id=${q(org)};`);
  check("second tenant independently imports identical source fingerprint",call("import",body,randomUUID(),foreign,other).new_transactions===1);
  for(const role of["anon","authenticated"]){const r=sql(`begin;set local role ${role};${command("import",body)}rollback;`);check(`${role} cannot execute Finance command`,!r.ok&&r.code==="42501");}
}catch(error){failed++;console.error(`FAIL independent Finance execution ${error.message}`);}
console.log(`Independent Finance integrity: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
