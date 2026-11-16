/** Make a NEW local native stack; preserves all previous runtime/evidence. */
import { mkdtempSync, mkdirSync, symlinkSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
const previous=process.env.RELEASE_LOCAL_RUNTIME,repository=process.env.RELEASE_CANDIDATE_REPOSITORY;
if(!previous?.startsWith("/private/tmp/levytate-release-runtime.")||!repository?.startsWith("/private/tmp/levytate-"))throw new Error("Dedicated runtime and candidate repository required");
const hash=value=>createHash("sha256").update(value).digest("hex");
const source=[
  [`${previous}/project/supabase/migrations/20261027174133_006_create_levytate_production_foundation.sql`,"876321865fd5efd9473c8863078c1d3cd2173927b737555c36266039fea16f35"],
  [`${previous}/project/supabase/migrations/20261027190000_levytate_fresh_project_convergence.sql`,"3bd6b681196ff865f50976129981b48601314d2bab2421794648fba51aefb204"],
];
const manifest=JSON.parse(readFileSync(`${repository}/supabase/release-migrations/manifest.json`,"utf8"));
for(const item of manifest.migrations){if(!/^supabase\/release-migrations\/\d{14}_[a-z_]+\.sql$/.test(item.path))throw new Error("Historical/unrecognised candidate rejected");source.push([`${repository}/${item.path}`,item.sha256]);}
for(const[path,expected]of source)if(hash(readFileSync(path))!==expected)throw new Error("Migration checksum mismatch before new runtime creation");
const root=mkdtempSync("/private/tmp/levytate-release-runtime.");
mkdirSync(`${root}/home`);mkdirSync(`${root}/project/supabase/migrations`,{recursive:true});
symlinkSync(`${previous}/supabase`,`${root}/supabase`);symlinkSync(`${previous}/home/cache`,`${root}/home/cache`);
const original=readFileSync(`${previous}/project/supabase/config.toml`,"utf8");
if(!original.includes('secrets = "env(RELEASE_EMAIL_HOOK_SECRET)"'))throw new Error("Expected environment-only hook secret");
const config=original.replace('project_id = "levytate-release-local"',`project_id = "levytate-release-full-${randomBytes(4).toString("hex")}"`).replace('uri = "http://127.0.0.1:3117/email"','uri = "http://127.0.0.1:3118/email"');
writeFileSync(`${root}/project/supabase/config.toml`,config,{flag:"wx",mode:0o600});
for(const[path]of source)copyFileSync(path,`${root}/project/supabase/migrations/${path.split("/").at(-1)}`);
writeFileSync(`${root}/private-app-secrets.json`,JSON.stringify({hookSecret:randomBytes(32).toString("base64"),sessionSecret:randomBytes(48).toString("base64url")}),{flag:"wx",mode:0o600});
console.log(`Prepared ${root}; ${source.length} hash-verified migrations; no database copied; secrets remain private; local hook port 3118`);
