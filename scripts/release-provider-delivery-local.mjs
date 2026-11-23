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
const progress = readFileSync(resolve("supabase/candidates/provider-delivery-progress-v2.sql"),"utf8");
const progressAssertions = readFileSync(resolve("scripts/test-provider-delivery-progress.sql"),"utf8");
const input=`begin;\n${sql}\n${assertions}\n${progress}\n${progressAssertions}\nrollback;\n`;
const env={...process.env,PGHOST:db.hostname,PGPORT:db.port,PGUSER:db.username,
  PGPASSWORD:db.password,PGDATABASE:db.pathname.slice(1)};
const result=spawnSync(process.env.RELEASE_PSQL??"/usr/bin/psql",["-XAtq","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"],{
  input,encoding:"utf8",env,maxBuffer:1024*1024,
});
if(result.status!==0){
  // Emit only SQLSTATE, static test assertion label and input line location.
  // Never expose SQL, database credentials or raw psql output in CI logs.
  const raw = result.stderr ?? "";
  const state = raw.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? "unknown";
  const line = raw.match(/psql:(?:stdin:)?(\d+):/)?.[1] ?? null;
  const assertions = readFileSync(resolve("scripts/test-provider-delivery-progress.sql"),"utf8");
  const messages = [...assertions.matchAll(/raise exception '([^']+)'/gi)].map(match => match[1]);
  const assertion = messages.find(message => raw.includes(message)) ?? null;
  console.error("FAIL: isolated provider SQL verification", JSON.stringify({
    sqlstate: state,
    ...(line ? { inputLine: Number(line) } : {}),
    ...(assertion ? { assertion } : {}),
  }));
  process.exitCode=1;
}else{
  console.log("PASS: rolled-back V1 and V2 provider SQL, official learner progress promotion, stale/revoked denial and idempotency; no lasting schema or data changes");
}
