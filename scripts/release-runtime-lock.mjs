/** Prevent global fault injection from racing genuine browser acceptance. */
import { openSync, writeFileSync, closeSync, unlinkSync } from "node:fs";
export function lockAcceptanceRuntime(label) {
  const root=process.env.RELEASE_LOCAL_RUNTIME;
  if(!root?.startsWith("/private/tmp/levytate-release-runtime."))throw new Error("BLOCKED: dedicated acceptance runtime required");
  const path=`${root}/acceptance-exclusive.lock`;
  let fd;
  try{fd=openSync(path,"wx",0o600);}catch{throw new Error("BLOCKED: another acceptance/fault-injection run owns this local runtime; inspect before retrying");}
  writeFileSync(fd,JSON.stringify({pid:process.pid,label}));
  let released=false;
  const release=()=>{if(released)return;released=true;closeSync(fd);unlinkSync(path);};
  process.once("exit",release);
  return release;
}
