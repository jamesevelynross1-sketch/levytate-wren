#!/usr/bin/env node
/** No-cost LOCAL candidate SQL verification. Runs inside a single rolled-back transaction. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readRegularFile, validateLocalStackState, readSourceEvidence } from "./release-native-migration-gate.mjs";

const root=process.env.RELEASE_LOCAL_RUNTIME;
if(!/^\/(?:private\/)?tmp\/levytate-release-runtime\.[A-Za-z0-9]+$/.test(root??""))throw Error("Dedicated disposable local runtime required");
const stateBytes=readRegularFile(`${root}/private-stack-state.json`);
const source=readSourceEvidence(root);
const startup=JSON.parse(readRegularFile(`${root}/startup-source-evidence.json`));
const state=JSON.parse(stateBytes);
const db=validateLocalStackState(state,startup,source,stateBytes);
if(db.hostname!=="127.0.0.1")throw Error("Only loopback PostgreSQL can test this SQL candidate");
const sql=readFileSync(resolve("supabase/candidates/provider-delivery-v1.sql"),"utf8");
const assertions=readFileSync(resolve("scripts/test-provider-delivery-candidate.sql"),"utf8");
const input=`begin;\n${sql}\n${assertions}\nrollback;\n`;
const env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,
  PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)};
const result=spawnSync(process.env.RELEASE_PSQL??"/usr/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1"],{
  input,encoding:"utf8",env,maxBuffer:1024*1024,
});
if(result.status!==0){
  console.error("FAIL: isolated provider SQL candidate or synthetic permission checks; raw SQL diagnostics withheld");
  process.exitCode=1;
}else{
  console.log("PASS: rolled-back provider delivery SQL, consent, idempotency, two-tenant denial and employer review; no lasting schema or data changes");
}
