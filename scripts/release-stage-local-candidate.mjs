/** Copy one exact reviewed candidate to the generated LOCAL CLI worktree only. */
import{readFileSync,existsSync,copyFileSync}from"node:fs";
import{createHash}from"node:crypto";
import { releaseRepository } from "./release-repository-path.mjs";
const root=process.env.RELEASE_LOCAL_RUNTIME,repository=releaseRepository(process.env.RELEASE_CANDIDATE_REPOSITORY),name=process.argv[2];
if(!root?.startsWith("/private/tmp/levytate-release-runtime.")||!/^\d{14}_(?:client|tenant)_[a-z_]+\.sql$/.test(name??""))throw new Error("Generated local runtime and explicit candidate required");
const state=JSON.parse(readFileSync(`${root}/private-stack-state.json`,"utf8"));
if(new URL(state.env.DB_URL).hostname!=="127.0.0.1")throw new Error("Loopback only");
const manifest=JSON.parse(readFileSync(`${repository}/supabase/release-migrations/manifest.json`,"utf8"));
const candidate=manifest.migrations.find(item=>item.path===`supabase/release-migrations/${name}`);
if(!candidate)throw new Error("Reviewed manifest does not contain this candidate");
const source=`${repository}/${candidate.path}`,target=`${root}/project/supabase/migrations/${name}`;
if(createHash("sha256").update(readFileSync(source)).digest("hex")!==candidate.sha256)throw new Error("Candidate checksum mismatch");
if(existsSync(target))throw new Error("Generated migration already exists; never overwrite applied bytes");
copyFileSync(source,target);
console.log(`Staged exact ${name} in generated LOCAL worktree; dry-run required before apply`);
