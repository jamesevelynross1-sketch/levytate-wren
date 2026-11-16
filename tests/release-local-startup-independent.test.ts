import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Independent offline artifact/control-flow verification. The test CLI below
// never starts PostgreSQL/Auth/Storage, connects to a database or executes SQL.
const repository = process.env.RELEASE_STARTUP_REVIEW_SOURCE ?? fileURLToPath(new URL('../', import.meta.url));
const artifacts: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const path of artifacts.splice(0)) rmSync(path, { recursive: true, force: true }); });
function offlineRuntime() {
  const root = mkdtempSync('/private/tmp/levytate-release-runtime.'); artifacts.push(root);
  const code = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
if(process.argv[2]==='--version'){console.log('2.122.1');process.exit(0);}
if(process.argv[2]!=='stack'||process.argv[3]!=='start')process.exit(79);
const project=process.argv[process.argv.indexOf('--workdir')+1],entries=[];
function walk(folder){for(const name of fs.readdirSync(folder)){const value=path.join(folder,name),stat=fs.lstatSync(value);if(stat.isSymbolicLink())entries.push({path:path.relative(project,value),kind:'symlink'});else if(stat.isDirectory())walk(value);else if(/\\.sql$/i.test(name))entries.push({path:path.relative(project,value),kind:'sql'});}}
walk(project);fs.writeFileSync(path.join(path.dirname(project),'offline-first-cli-start.json'),JSON.stringify({offlineStub:true,entries}));
console.log(JSON.stringify({runtime:'native',id:'offline-test-only',env:{DB_URL:'postgresql://offline:offline@127.0.0.1:59999/postgres'},endpoints:{}}));
`;
  writeFileSync(`${root}/supabase`, code, { mode: 0o700 });
  return root;
}
function script(name: string, root: string) {
  // No inherited Supabase token, database URL, service credential or hook key.
  return spawnSync(process.execPath, [resolve(repository, `scripts/${name}`)], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', RELEASE_LOCAL_RUNTIME: root }, encoding: 'utf8', timeout: 30000,
  });
}
describe('independent first native start ordering (offline fake CLI, no DB evidence)', () => {
  it('the actual creator and start wrapper expose no SQL or symlink to the first CLI start', () => {
    const root = offlineRuntime();
    const created = script('release-create-native-runtime.mjs', root);
    expect(created.status, 'creator exit code; raw diagnostics intentionally withheld').toBe(0);
    const started = script('release-start-local-stack.mjs', root);
    expect(started.status, 'start-wrapper exit code; raw diagnostics intentionally withheld').toBe(0);
    const observation = JSON.parse(readFileSync(`${root}/offline-first-cli-start.json`, 'utf8'));
    expect(observation.offlineStub).toBe(true);
    expect(observation.entries).toEqual([]);
  });
});


describe('independent first-start source refusal before invoking the fake CLI', () => {
  it.each(['nested SQL', 'uppercase SQL', 'migration symlink', 'directory symlink', 'config symlink'])('refuses %s before starting the CLI', kind => {
    const root = offlineRuntime();
    expect(script('release-create-native-runtime.mjs', root).status).toBe(0);
    // Remove only this offline test copy. This never touches a live runtime,
    // a source migration, or a real database's schema/ledger.
    const migrations = `${root}/project/supabase/migrations`;
    rmSync(migrations, { recursive: true, force: true }); mkdirSync(migrations);
    const config = `${root}/project/supabase/config.toml`;
    const outside = `${root}/outside`; mkdirSync(outside); writeFileSync(`${outside}/untrusted.sql`, 'select 1;');
    if (kind === 'nested SQL') { mkdirSync(`${root}/project/supabase/extra`); writeFileSync(`${root}/project/supabase/extra/038_unapproved.sql`, 'select 1;'); }
    else if (kind === 'uppercase SQL') writeFileSync(`${migrations}/UNEXPECTED.SQL`, 'select 1;');
    else if (kind === 'migration symlink') symlinkSync(`${outside}/untrusted.sql`, `${migrations}/20261116000000_alias.sql`);
    else if (kind === 'directory symlink') symlinkSync(outside, `${root}/project/supabase/aliased-sources`);
    else { writeFileSync(`${outside}/config.toml`, readFileSync(config)); rmSync(config); symlinkSync(`${outside}/config.toml`, config); }
    const started = script('release-start-local-stack.mjs', root);
    expect(started.status, 'source guard must stop before CLI execution').not.toBe(0);
    expect(existsSync(`${root}/offline-first-cli-start.json`)).toBe(false);
  });
});

const gate = await import(pathToFileURL(resolve(repository, 'scripts/release-native-migration-gate.mjs')).href);
const staging = await import(pathToFileURL(resolve(repository, 'scripts/release-stage-native-migrations.mjs')).href);
const countKeys = ['publicRelations', 'publicFunctions', 'publicTypes', 'applicationSchemas', 'ledgerRows', 'authUsers', 'authIdentities', 'authSessions', 'storageBuckets', 'storageObjects'];
const empty = (): { postgresMajorVersion: number; ledgerExists: boolean; schemaNames: string[] } & Record<string, unknown> => ({ postgresMajorVersion: 17, ledgerExists: false, schemaNames: ['public', 'auth', 'storage', 'extensions'], ...Object.fromEntries(countKeys.map(key => [key, 0])) });
async function stagedFixture() {
  const root = offlineRuntime(); expect(script('release-create-native-runtime.mjs', root).status).toBe(0); expect(script('release-start-local-stack.mjs', root).status).toBe(0);
  vi.stubEnv('RELEASE_LOCAL_RUNTIME', root); vi.stubEnv('RELEASE_RUNTIME_QUIESCENT', 'true');
  const { expected } = await gate.canonicalExpectedMigrations(repository);
  const names = expected.map((item: { filename: string }) => item.filename);
  const io = { readStatus: vi.fn(async () => JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8'))), readDatabase: vi.fn(() => empty()), invokeCli: vi.fn(async (args: string[]) => { if (args[0] !== 'db' || args[1] !== 'push') throw Error('Unexpected offline CLI command'); return `DRY RUN: The following migrations would be pushed:\n${names.map((name: string) => ` • ${name}`).join('\n')}\n`; }), verifyApplied: vi.fn(async () => ({ offlineStub: true })) };
  const run = (mode: string) => staging.runNativeMigrationStage({ runtime: root, repository, mode }, io);
  return { root, expected, names, io, run };
}
describe('independent empty managed-database evidence contract (synthetic metadata only)', () => {
  it('accepts PostgreSQL17 managed objects only with every application/data/ledger count zero', () => {
    expect(gate.validateEmptyDatabase(empty())).toEqual(empty());
    expect(gate.validateEmptyDatabase({ ...empty(), ledgerExists: true })).toMatchObject({ ledgerRows: 0 });
  });
  it.each(countKeys)('rejects nonempty %s', key => { expect(() => gate.validateEmptyDatabase({ ...empty(), [key]: 1 })).toThrow(); });
  it.each([undefined, null, '0', -1])('does not coerce missing or invalid empty counts: %s', value => { expect(() => gate.validateEmptyDatabase({ ...empty(), authUsers: value })).toThrow(); });
  it('rejects an unexpected schema, wrong database major version or credential-bearing evidence', () => {
    for (const schema of ['unreviewed_app', 'pgclient', 'pgx']) expect(() => gate.validateEmptyDatabase({ ...empty(), schemaNames: [...empty().schemaNames, schema] })).toThrow();
    expect(() => gate.validateEmptyDatabase({ ...empty(), postgresMajorVersion: 16 })).toThrow();
    expect(() => gate.validateEmptyDatabase({ ...empty(), privateCredential: 'fictional-test-value' })).toThrow();
  });
});
describe('independent exact staged source and explicit dry-run controls', () => {
  it('the actual stage function copies only reviewed28 after empty checks, never applies before an explicit exact dry-run', async () => {
    const { root, expected, io, run } = await stagedFixture();
    expect(expected).toHaveLength(28); expect(expected.some((item: { filename: string }) => item.filename.startsWith('038_'))).toBe(false);
    const active = `${root}/project/supabase/migrations`; expect(readdirSync(active)).toEqual([]);
    await run('stage'); expect(io.readDatabase).toHaveBeenCalledTimes(2); expect(io.invokeCli).not.toHaveBeenCalled();
    gate.verifyExactMigrationFiles(active, expected);
    await expect(run('apply')).rejects.toThrow(); expect(io.invokeCli).not.toHaveBeenCalled();
    await run('dry-run'); await run('apply');
    expect(io.invokeCli.mock.calls.map(call => call[0])).toEqual([staging.localMigrationArguments('dry-run', root), staging.localMigrationArguments('apply', root)]);
    expect(io.verifyApplied).toHaveBeenCalledOnce();
    await run('deactivate'); expect(readdirSync(active)).toEqual([]); gate.verifyInactiveArtifact(root, expected);
  });
  it.each(['extra038', 'renamed', 'tampered', 'symlink'])('refuses %s in the inactive approved artifact before activation', async kind => {
    const { root, expected, io, run } = await stagedFixture(), folder = `${root}/reviewed-project/supabase/migrations`, first = `${folder}/${expected[0].filename}`;
    if (kind === 'extra038') writeFileSync(`${folder}/038_unapproved.sql`, 'select 1;');
    else if (kind === 'renamed') { writeFileSync(`${folder}/20990101000000_unknown.sql`, readFileSync(first)); rmSync(first); }
    else if (kind === 'tampered') appendFileSync(first, '\n-- unexpected bytes\n');
    else { const data = readFileSync(first); rmSync(first); writeFileSync(`${root}/replacement.sql`, data); symlinkSync(`${root}/replacement.sql`, first); }
    await expect(run('stage')).rejects.toThrow(); expect(readdirSync(`${root}/project/supabase/migrations`)).toEqual([]); expect(io.invokeCli).not.toHaveBeenCalled(); expect(io.readDatabase).not.toHaveBeenCalled();
  });
  it('refuses a nonempty database before exposing any active SQL', async () => {
    const { root, io, run } = await stagedFixture(); io.readDatabase.mockReturnValue({ ...empty(), ledgerRows: 1 });
    await expect(run('stage')).rejects.toThrow(); expect(readdirSync(`${root}/project/supabase/migrations`)).toEqual([]); expect(io.invokeCli).not.toHaveBeenCalled();
  });
  it('a wrong target/state cannot borrow the original guarded startup evidence', async () => {
    const { root, io, run } = await stagedFixture();
    const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8')); state.env.DB_URL = 'postgresql://offline:offline@127.0.0.1:59998/postgres';
    writeFileSync(`${root}/private-stack-state.json`, JSON.stringify(state));
    await expect(run('stage')).rejects.toThrow('startup identity'); expect(io.readDatabase).not.toHaveBeenCalled(); expect(io.invokeCli).not.toHaveBeenCalled();
  });
  it.each(['id', 'endpoint'])('refuses live CLI registry %s drift before exposing SQL', async changed => {
    const { root, io, run } = await stagedFixture(), current = JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8'));
    if (changed === 'id') current.id = 'another-native-stack';
    else current.env.DB_URL = 'postgresql://offline:offline@127.0.0.1:59998/postgres';
    io.readStatus.mockResolvedValue(current);
    await expect(run('stage')).rejects.toThrow('Live local CLI target');
    expect(io.readDatabase).not.toHaveBeenCalled(); expect(io.invokeCli).not.toHaveBeenCalled(); expect(readdirSync(`${root}/project/supabase/migrations`)).toEqual([]);
  });
  it('rechecks live targeting after the empty read and before first source activation', async () => {
    const { root, io, run } = await stagedFixture(), current = JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8'));
    io.readDatabase.mockImplementationOnce(() => { io.readStatus.mockResolvedValue({ ...current, id: 'changed-during-read' }); return empty(); });
    await expect(run('stage')).rejects.toThrow('Live local CLI target');
    expect(io.invokeCli).not.toHaveBeenCalled(); expect(readdirSync(`${root}/project/supabase/migrations`)).toEqual([]);
  });
  it('a target change after the final empty read stops apply despite an earlier valid dry-run', async () => {
    const { root, io, run } = await stagedFixture(); await run('stage'); await run('dry-run');
    const current = JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8'));
    io.readDatabase.mockReturnValueOnce(empty()).mockImplementationOnce(() => { io.readStatus.mockResolvedValue({ ...current, id: 'changed-before-apply' }); return empty(); });
    await expect(run('apply')).rejects.toThrow('Live local CLI target');
    expect(io.invokeCli).toHaveBeenCalledTimes(1); expect(io.verifyApplied).not.toHaveBeenCalled();
  });
  it('an unexpected post-apply registry change is never reported as accepted and does not trigger repair', async () => {
    const { root, io, run } = await stagedFixture(); await run('stage'); await run('dry-run');
    const current = JSON.parse(readFileSync(`${root}/private-stack-state.json`, 'utf8'));
    io.invokeCli.mockImplementationOnce(async () => { io.readStatus.mockResolvedValue({ ...current, id: 'changed-after-apply' }); return 'Offline CLI stub accepted command'; });
    await expect(run('apply')).rejects.toThrow('Live local CLI target');
    expect(io.invokeCli).toHaveBeenCalledTimes(2); expect(io.verifyApplied).not.toHaveBeenCalled();
    expect(readdirSync(root).some(name => name.startsWith('migration-apply-'))).toBe(false);
  });
  it.each(['missing', 'extra', 'duplicate', 'reordered', 'disabled', 'include-all', 'not-dry-run'])('refuses a %s dry-run schedule and never permits apply', async kind => {
    const { root, names, io, run } = await stagedFixture(); await run('stage');
    let scheduled = [...names], prefix = 'DRY RUN';
    if (kind === 'missing') scheduled.pop();
    if (kind === 'extra') scheduled.push('038_unapproved.sql');
    if (kind === 'duplicate') scheduled.push(names[0]);
    if (kind === 'reordered') scheduled = scheduled.reverse();
    if (kind === 'disabled') prefix += ' migrations are disabled';
    if (kind === 'include-all') prefix += ' use --include-all';
    if (kind === 'not-dry-run') prefix = 'Applied migrations';
    io.invokeCli.mockResolvedValue(`${prefix}\n${scheduled.join('\n')}`);
    await expect(run('dry-run')).rejects.toThrow(); expect(existsSync(`${root}/latest-migration-dry-run.json`)).toBe(false);
    await expect(run('apply')).rejects.toThrow(); expect(io.invokeCli).toHaveBeenCalledTimes(1);
  });
  it('detects unexpected dry-run ledger mutation and does not issue an apply receipt', async () => {
    const { root, io, run } = await stagedFixture(); await run('stage');
    io.readDatabase.mockReturnValueOnce(empty()).mockReturnValueOnce({ ...empty(), ledgerRows: 1 });
    await expect(run('dry-run')).rejects.toThrow(); expect(existsSync(`${root}/latest-migration-dry-run.json`)).toBe(false); expect(io.verifyApplied).not.toHaveBeenCalled();
  });
  it('a changed active SQL file invalidates a previously successful dry-run', async () => {
    const { root, expected, io, run } = await stagedFixture(); await run('stage'); await run('dry-run');
    appendFileSync(`${root}/project/supabase/migrations/${expected[0].filename}`, '\n-- changed after dry-run\n');
    await expect(run('apply')).rejects.toThrow(); expect(io.invokeCli).toHaveBeenCalledTimes(1); expect(io.verifyApplied).not.toHaveBeenCalled();
  });
  it('a replaced CLI executable cannot reuse the original startup evidence or dry-run receipt', async () => {
    const { root, io, run } = await stagedFixture(); await run('stage'); await run('dry-run');
    appendFileSync(`${root}/supabase`, '\n// replaced executable bytes\n');
    const readCount = io.readDatabase.mock.calls.length;
    await expect(run('apply')).rejects.toThrow('CLI executable changed');
    expect(io.readDatabase).toHaveBeenCalledTimes(readCount); expect(io.invokeCli).toHaveBeenCalledTimes(1); expect(io.verifyApplied).not.toHaveBeenCalled();
  });
  it('never constructs a hosted, reset, repair or include-all CLI invocation', () => {
    const root = '/private/tmp/levytate-release-runtime.Offline';
    expect(staging.localStatusArguments(root)).toEqual(['stack', 'status', '--output-format', 'json', '--workdir', `${root}/project`]);
    expect(staging.localMigrationArguments('dry-run', root)).toEqual(['db', 'push', '--local', '--skip-vault', '--dry-run', '--workdir', `${root}/project`]);
    expect(staging.localMigrationArguments('apply', root)).toEqual(['db', 'push', '--local', '--skip-vault', '--yes', '--workdir', `${root}/project`]);
    for (const value of ['--linked', '--include-all', 'repair', 'reset']) expect(() => staging.localMigrationArguments(value, root)).toThrow();
  });
});
