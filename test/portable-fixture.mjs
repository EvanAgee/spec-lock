// Shared synthetic repositories for the candidate capture CLI and its v1 baseline.
// Every repository is synthetic, built in a temp directory with a scratch global git config, and every
// task, run, judge and output is made up. Nothing touches the real global config or a real repository.
// Run through test/portable-evidence.test.mjs or test/portable-evidence-walk.mjs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDigest } from '../lib/portable.mjs'
import { register } from '../lib/lock.mjs'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'spec-lock')
export const SPEC = 'docs/specs/value.md'
export const PROOF = 'docs/proof/t1.md'
export const MANIFEST = 'docs/proof/t1.evidence.json'
export const OUT = 'docs/proof/t1.evidence/t1-r1.stdout'
export const ERR = 'docs/proof/t1.evidence/t1-r1.stderr'
export const STDOUT = 'value=14\n'
export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// A hardened spec with the given live ids.
function specText(ids, title = 'Value') {
  const sections = ['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions']
  const table = ['| AC | Requirement (EARS) | Red test | Observable | Judge |', '|---|---|---|---|---|',
    ...ids.map((id) => `| ${id} | When the fixture runs, the program shall print value=14. | a red test | its output | the fixture |`)]
  return [`# ${title}`, ...sections.flatMap((s) => [`## ${s}`, s === 'Acceptance Criteria' ? table.join('\n') : 'Text.'])].join('\n\n') + '\n'
}
const proofText = (evidence = MANIFEST) => `---\nspec: ${SPEC}\n${evidence === null ? '' : `evidence: ${evidence}\n`}---\n# Proof\n\nAC1 and AC2 ran on the reviewed commit.\n`

const identity = Object.fromEntries(['name', 'email'].map(k => [k, spawnSync('git', ['config', `user.${k}`], {encoding:'utf8'}).stdout.trim()]))
assert.ok(identity.name && identity.email, 'machine Git identity required')
const dirs = []
process.on('exit', () => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }) })

// Main holds B, a program that prints value=0. The lane's commit C, the reviewed commit, repairs it
// and adds the spec. Each landing checked here moves main from B to a commit built on C.
export function fixture(cli = CLI, assertion = true) {
  const dir = mkdtempSync(join(tmpdir(), 'spec-lock-evidence-'))
  dirs.push(dir)
  const repo = join(dir, 'repo')
  const config = join(dir, 'global.gitconfig')
  writeFileSync(config, '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_|NODE_TEST_CONTEXT$)/.test(k)))
  Object.assign(env, {
    HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1',
    SPEC_LOCK_LOG: join(dir, 'landings.log'),
    GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email,
    GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email,
  })
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd: repo, env, encoding: 'utf8', timeout: 30000 })
    return { code: r.status, out: r.stdout, err: r.stderr }
  }
  const f = {
    repo, dir, env, run, cli,
    // Registers the shared git hooks in the scratch global config.
    hook: () => register(config),
    git: (...args) => run('git', args),
    ok(...args) { const r = run('git', args); assert.equal(r.code, 0, `git ${args.join(' ')}: ${r.err}`); return r.out.trim() },
    check: (tip) => run('node', [cli, 'check', f.B, tip]),
    // Writes files, a null text deletes the path, runs prep, and commits everything.
    commit(files, prep = () => {}) {
      for (const [path, text] of Object.entries(files)) {
        if (text === null) { rmSync(join(repo, path), { force: true }); continue }
        mkdirSync(dirname(join(repo, path)), { recursive: true })
        writeFileSync(join(repo, path), text)
      }
      prep(repo)
      f.ok('add', '-A')
      f.ok('commit', '-q', '-m', 'test: fixture commit')
      return f.ok('rev-parse', 'HEAD')
    },
  }
  mkdirSync(repo)
  f.ok('init', '-q', '-b', 'main')
  f.B = f.commit({ 'src/value.mjs': 'export const value = (x) => 0\n', 'test/value.mjs': "import { value } from '../src/value.mjs'\n" + (assertion ? "import assert from 'node:assert/strict'\nassert.equal(value(7),14, 'double seven')\n" : '') + "console.log(`value=${value(7)}`)\n" })
  f.ok('switch', '-q', '-c', 'lane')
  f.C = f.commit({
    'src/value.mjs': 'export const value = (x) => x * 2\n',
    [SPEC]: specText(['AC1', 'AC2']),
    'docs/specs/s2.md': specText(['AC1'], 'Another spec'),
    'docs/proof/earlier.txt': 'a note committed before the review\n',
  })
  f.blob = f.ok('rev-parse', `${f.C}:${SPEC}`)
  return f
}

// The binding for one supported run of AC1 on C, judged against base B.
export function manifest(f) {
  const evidence = { stdout_sha256: sha256(STDOUT), stderr_sha256: sha256('') }
  const m = {
    version: 1, task: 't1', reviewed: f.C, base: f.B,
    claims: [{ spec: SPEC, spec_blob: f.blob, ac: 'AC1', state: 'supported', run: 't1-r1', judge: 't1-j1' }],
    runs: [{
      id: 't1-r1', executor: 'v1', command_id: 'k1', argv: ['node', 'test/value.mjs'], revision: f.C, exit: 0, outcome: 'exited',
      stdout: { path: OUT, bytes: Buffer.byteLength(STDOUT), sha256: evidence.stdout_sha256 },
      stderr: { path: ERR, bytes: 0, sha256: evidence.stderr_sha256 },
    }],
    judges: [{ id: 't1-j1', judge: 'v1', run: 't1-r1', ac: 'AC1', revision: f.C, base: f.B, evidence, verdict: 'supported' }],
  }
  m.claims.push({...m.claims[0], ac:'AC2', judge:'t1-j2'})
  m.judges.push({...m.judges[0], id:'t1-j2', ac:'AC2'})
  return m
}

// A branch from `from` (C unless given) whose commit attaches the proof, the manifest after edit(m),
// and the captured output, with files overriding any of them; then each `later` commit on top.
export function attach(f, name, { from = f.C, edit = () => {}, files = {}, prep, later = [] } = {}) {
  f.ok('switch', '-q', '-c', name, from)
  const m = manifest(f)
  edit(m)
  let tip = f.commit({ [PROOF]: proofText(), [MANIFEST]: JSON.stringify(m, null, 2) + '\n', [OUT]: STDOUT, [ERR]: '', ...files }, prep)
  for (const next of later) tip = f.commit(next)
  return tip
}

export function approval(f, argv = ['node','test/value.mjs']) {
  return {version:2,id:'approved-1',task:'t1',spec:SPEC,spec_blob:f.blob,base:f.B,revision:f.C,criteria:['AC1','AC2'],argv,cwd:'.',inputs:['src/value.mjs','test/value.mjs'].map(path=>({path,sha256:sha256(readFileSync(join(f.repo,path)))})),expected:{exit:0,stdout:'value=14\n'},limits:{timeout_ms:3000,output_bytes:1024},author:'a1',verifier:'v1',approved_by:'v1',authorization:'Synthetic fixture approved command',sessions:['a1','v1'].map(id=>({id,source:{session_id:id,provider:'fixture'},source_raw:JSON.stringify({session_id:id,provider:'fixture'})})),role:'green'}
}
export function capture(f, a=approval(f), suffix='capture', extra=[]) {
  const file=join(f.dir,`${suffix}.approval.json`), scratch=join(f.dir,suffix)
  writeFileSync(file,JSON.stringify(a)); const result=f.run('node',[f.cli,'capture',file,scratch,...extra])
  return {result,scratch,record:result.code===2 ? null : JSON.parse(readFileSync(join(scratch,'capture.json')))}
}
export function judgments(f,c){
  return ['AC1','AC2'].map((ac,i)=>({id:`j${i}`,author:'a1',verifier:'v1',spec:SPEC,spec_blob:f.blob,ac,run:c.record.run.id,run_sha256:runDigest(c.record.run),revision:f.C,base:f.B,evidence:{stdout_sha256:c.record.run.stdout.sha256,stderr_sha256:c.record.run.stderr.sha256},verdict:'supported',reason:'Observed the required result',observation:{kind:'test',tests:['double seven'],executed:1,skipped:0,assertion:'double(7) equals 14',expected:'14',observed:'14'}}))
}
export function exported(f,c,suffix='export',judges=judgments(f,c)){
  const j=join(f.dir,`${suffix}.judgments.json`);writeFileSync(j,JSON.stringify(judges))
  const path=`docs/proof/${suffix}`;const result=f.run('node',[f.cli,'export',c.scratch,j,path])
  return {result,path,manifest:result.code===0?JSON.parse(readFileSync(join(f.repo,path,'manifest.json'))):null}
}
