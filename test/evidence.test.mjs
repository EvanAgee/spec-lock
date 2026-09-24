// Fixture tests for the evidence binding a proof may name (docs/specs/fleet-evidence-e1-lock.md).
// Every repository is synthetic, built in a temp directory with a scratch global git config, and every
// task, run, judge and output is made up. Nothing touches the real global config or a real repository.
// Run: node --test test/evidence.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from '../lib/lock.mjs'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'spec-lock')
const SPEC = 'docs/specs/value.md'
const PROOF = 'docs/proof/t1.md'
const MANIFEST = 'docs/proof/t1.evidence.json'
const OUT = 'docs/proof/t1.evidence/t1-r1.stdout'
const ERR = 'docs/proof/t1.evidence/t1-r1.stderr'
const STDOUT = 'value=14\n'
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// A hardened spec with the given live ids.
function specText(ids, title = 'Value') {
  const sections = ['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions']
  const table = ['| AC | Requirement (EARS) | Red test | Observable | Judge |', '|---|---|---|---|---|',
    ...ids.map((id) => `| ${id} | When the fixture runs, the program shall print value=14. | a red test | its output | the fixture |`)]
  return [`# ${title}`, ...sections.flatMap((s) => [`## ${s}`, s === 'Acceptance Criteria' ? table.join('\n') : 'Text.'])].join('\n\n') + '\n'
}
const proofText = (evidence = MANIFEST) => `---\nspec: ${SPEC}\n${evidence === null ? '' : `evidence: ${evidence}\n`}---\n# Proof\n\nAC1 ran on the reviewed commit.\n`

const dirs = []
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }) })

// Main holds B, a program that prints value=0. The lane's commit C, the reviewed commit, repairs it
// and adds the spec. Each landing checked here moves main from B to a commit built on C.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'spec-lock-evidence-'))
  dirs.push(dir)
  const repo = join(dir, 'repo')
  const config = join(dir, 'global.gitconfig')
  writeFileSync(config, '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_)/.test(k)))
  Object.assign(env, {
    HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1',
    SPEC_LOCK_LOG: join(dir, 'landings.log'),
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  })
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd: repo, env, encoding: 'utf8', timeout: 30000 })
    return { code: r.status, out: r.stdout, err: r.stderr }
  }
  const f = {
    // Registers the shared git hooks in the scratch global config.
    hook: () => register(config),
    git: (...args) => run('git', args),
    ok(...args) { const r = run('git', args); assert.equal(r.code, 0, `git ${args.join(' ')}: ${r.err}`); return r.out.trim() },
    check: (tip) => run('node', [CLI, 'check', f.B, tip]),
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
  f.B = f.commit({ 'src/value.mjs': 'export const value = (x) => 0\n', 'test/value.mjs': "import { value } from '../src/value.mjs'\nconsole.log(`value=${value(7)}`)\n" })
  f.ok('switch', '-q', '-c', 'lane')
  f.C = f.commit({
    'src/value.mjs': 'export const value = (x) => x * 2\n',
    [SPEC]: specText(['AC1']),
    'docs/specs/s2.md': specText(['AC1'], 'Another spec'),
    'docs/proof/earlier.txt': 'a note committed before the review\n',
  })
  f.blob = f.ok('rev-parse', `${f.C}:${SPEC}`)
  return f
}

// The binding for one supported run of AC1 on C, judged against base B.
function manifest(f) {
  const evidence = { stdout_sha256: sha256(STDOUT), stderr_sha256: sha256('') }
  return {
    version: 1, task: 't1', reviewed: f.C, base: f.B,
    claims: [{ spec: SPEC, spec_blob: f.blob, ac: 'AC1', state: 'supported', run: 't1-r1', judge: 't1-j1' }],
    runs: [{
      id: 't1-r1', executor: 'v1', command_id: 'k1', argv: ['node', 'test/value.mjs'], revision: f.C, exit: 0, outcome: 'exited',
      stdout: { path: OUT, bytes: Buffer.byteLength(STDOUT), sha256: evidence.stdout_sha256 },
      stderr: { path: ERR, bytes: 0, sha256: evidence.stderr_sha256 },
    }],
    judges: [{ id: 't1-j1', judge: 'v1', run: 't1-r1', ac: 'AC1', revision: f.C, base: f.B, evidence, verdict: 'supported' }],
  }
}

// A branch from `from` (C unless given) whose commit attaches the proof, the manifest after edit(m),
// and the captured output, with files overriding any of them; then each `later` commit on top.
function attach(f, name, { from = f.C, edit = () => {}, files = {}, prep, later = [] } = {}) {
  f.ok('switch', '-q', '-c', name, from)
  const m = manifest(f)
  edit(m)
  let tip = f.commit({ [PROOF]: proofText(), [MANIFEST]: JSON.stringify(m, null, 2) + '\n', [OUT]: STDOUT, [ERR]: '', ...files }, prep)
  for (const next of later) tip = f.commit(next)
  return tip
}

// A fault about one manifest field, as the checker prints it.
const at = (field) => new RegExp(`^- ${PROOF}: evidence ${MANIFEST}: ${field.replace(/[.[\]]/g, '\\$&')}: `, 'm')

// Each case must be refused, exit 1, with its fault; returns a line for every case that was not.
function unrefused(f, cases) {
  const wrong = []
  for (const [name, opts, fault] of cases) {
    const r = f.check(attach(f, name.replace(/\W+/g, '-'), opts))
    if (r.code !== 1 || !fault.test(r.out)) wrong.push(`${name}: exit ${r.code}\n${r.out}${r.err}`)
  }
  return wrong
}

test('AC6: committed output that is absent, altered, hand-written or unrelated is refused; the recorded bytes land, an empty stream as a zero-length file', () => {
  const f = fixture()
  const good = attach(f, 'good')
  const ok = f.check(good)
  assert.equal(ok.code, 0, ok.out + ok.err)
  assert.match(ok.out, /^spec-lock: ok$/m)

  assert.deepEqual(unrefused(f, [
    ['output removed', { files: { [OUT]: null } }, at('runs[0].stdout.path')],
    ['hand-written pass line in place of the output', { files: { [OUT]: 'PASS\n' } }, at('runs[0].stdout.sha256')],
    ['digest altered', { edit: (m) => { m.runs[0].stdout.sha256 = sha256('value=15\n') } }, at('runs[0].stdout.sha256')],
    ['byte count altered', { edit: (m) => { m.runs[0].stdout.bytes = 8 } }, at('runs[0].stdout.bytes')],
    ['no stdout recorded', { edit: (m) => { m.runs[0].stdout = null } }, at('runs[0].stdout')],
    ['empty stderr file removed', { files: { [ERR]: null } }, at('runs[0].stderr.path')],
    ['output outside docs/proof', { edit: (m) => { m.runs[0].stdout.path = 'test/value.mjs' } }, at('runs[0].stdout.path')],
    ['unrelated receipt: output the judge never compared', {
      files: { 'docs/proof/t2.evidence/t2-r1.stdout': 'value=0\n' },
      edit: (m) => { m.runs[0].stdout = { path: 'docs/proof/t2.evidence/t2-r1.stdout', bytes: 8, sha256: sha256('value=0\n') } },
    }, at('judges[0].evidence')],
  ]), [])

  // The git hook runs the same check: a corrupted attachment cannot reach main, the recorded one can.
  f.hook()
  f.ok('switch', '-q', 'main')
  const refused = f.git('merge', '--ff-only', 'output-removed')
  assert.notEqual(refused.code, 0, 'the hook let a missing output land')
  assert.match(refused.err, /spec-lock: refused refs\/heads\/main/)
  assert.match(refused.err, at('runs[0].stdout.path'))
  assert.equal(f.ok('rev-parse', 'main'), f.B)
  const landed = f.git('merge', '--ff-only', 'good')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(f.ok('rev-parse', 'main'), good)
})

test('AC7: a binding resolves to one run and one judge of the same criterion, spec and reviewed commit, and nothing but proof files may follow that commit', () => {
  const f = fixture()
  // Proof-only commits after C, a later prose repair included, still land on C's evidence.
  const repaired = attach(f, 'repaired', { later: [{ [PROOF]: proofText() + '\nA later repair of the prose.\n' }] })
  const ok = f.check(repaired)
  assert.equal(ok.code, 0, ok.out + ok.err)

  // C rewritten as C2 with the same tree, as a rebase or an amend would; and a side commit off B.
  f.ok('switch', '-q', '-c', 'rewritten', f.C)
  f.ok('commit', '--amend', '-q', '-m', 'test: the reviewed commit, rewritten')
  const C2 = f.ok('rev-parse', 'HEAD')
  f.ok('switch', '-q', '-c', 'side', f.B)
  const side = f.commit({ 'side.txt': 'side\n' })

  assert.deepEqual(unrefused(f, [
    ['code after the reviewed commit', { later: [{ 'src/value.mjs': 'export const value = (x) => x * 3\n' }] }, /changed after the reviewed commit/],
    ['spec edited after the reviewed commit', { later: [{ [SPEC]: specText(['AC1'], 'Value, edited after the review') }] }, at('reviewed')],
    ['proof file deleted after the reviewed commit', { files: { 'docs/proof/earlier.txt': null } }, at('reviewed')],
    ['symlink under docs/proof', { prep: (repo) => symlinkSync('../../src/value.mjs', join(repo, 'docs/proof/link')) }, at('reviewed')],
    ['executable under docs/proof', { files: { 'docs/proof/run.sh': 'echo value=14\n' }, prep: (repo) => chmodSync(join(repo, 'docs/proof/run.sh'), 0o755) }, at('reviewed')],
    ['old run after a rebase', { from: C2 }, at('reviewed')],
    ['rewritten commit named, run from before the rebase', { from: C2, edit: (m) => { m.reviewed = C2 } }, at('runs[0].revision')],
    ['short reviewed id', { edit: (m) => { m.reviewed = f.C.slice(0, 12) } }, at('reviewed')],
    ['base not an ancestor of the reviewed commit', { edit: (m) => { m.base = side; m.judges[0].base = side } }, at('base')],
    ['review on another base', { edit: (m) => { m.judges[0].base = f.C } }, at('judges[0].base')],
    ['forged run id', { edit: (m) => { m.claims[0].run = 't1-r99' } }, at('claims[0].run')],
    ['claim with no judge', { edit: (m) => { delete m.claims[0].judge } }, at('claims[0].judge')],
    ['two runs with one id', { edit: (m) => { m.runs.push({ ...m.runs[0] }) } }, at('claims[0].run')],
    ['judge of another run', { edit: (m) => { m.judges[0].run = 't1-r2' } }, at('judges[0].run')],
    ['judge of another criterion', { edit: (m) => { m.judges[0].ac = 'AC2' } }, at('judges[0].ac')],
    ['another spec with its own AC1', { edit: (m) => { m.claims[0].spec = 'docs/specs/s2.md' } }, at('claims[0].spec_blob')],
    ['spec that is not in the reviewed commit', { edit: (m) => { m.claims[0].spec = 'docs/specs/none.md' } }, at('claims[0].spec')],
    ['criterion the spec does not have', { edit: (m) => { m.claims[0].ac = 'AC9'; m.judges[0].ac = 'AC9' } }, at('claims[0].ac')],
    ['substituted observation digest', { edit: (m) => { m.judges[0].evidence.stdout_sha256 = sha256('value=15\n') } }, at('judges[0].evidence')],
    ['no claims', { edit: (m) => { m.claims = [] } }, at('claims')],
    ['version 2', { edit: (m) => { m.version = 2 } }, at('version')],
    ['manifest not a JSON object', { files: { [MANIFEST]: '[]\n' } }, /evidence docs\/proof\/t1\.evidence\.json is not a JSON object/],
    ['manifest path outside docs/proof', { files: { [PROOF]: proofText('docs/proof/../specs/t1.json') } }, /evidence docs\/proof\/\.\.\/specs\/t1\.json is not a path under docs\/proof\//],
    ['manifest not committed', { files: { [PROOF]: proofText('docs/proof/none.json') } }, /evidence docs\/proof\/none\.json is not a regular file in the landed commit/],
  ]), [])

  // The code case names the path and the reviewed commit.
  const r = f.check(f.ok('rev-parse', 'code-after-the-reviewed-commit'))
  assert.match(r.out, new RegExp(`reviewed: src/value\\.mjs changed after the reviewed commit ${f.C}`))
})

test('AC3 (checker side): a failed, unfinished or timed-out run, a run on another commit, or an unsupported verdict cannot back a claim', () => {
  const f = fixture()
  f.ok('switch', '-q', '-c', 'later', f.C)
  const later = f.commit({ 'src/value.mjs': 'export const value = (x) => x + x\n' })
  const ended = (outcome, exit) => (m) => Object.assign(m.runs[0], { outcome, exit })
  assert.deepEqual(unrefused(f, [
    ['failed run', { edit: ended('exited', 1) }, at('runs[0].exit')],
    ['timed out', { edit: ended('timeout', null) }, at('runs[0].outcome')],
    ['never finished', { edit: ended('started', null) }, at('runs[0].outcome')],
    ['changed tracked files', { edit: ended('tracked-files-changed', 0) }, at('runs[0].outcome')],
    ['output over its bound', { edit: ended('output-over-bound', 0) }, at('runs[0].outcome')],
    ['run on a later commit', { edit: (m) => { m.runs[0].revision = later } }, at('runs[0].revision')],
    ['judge of a later commit', { edit: (m) => { m.judges[0].revision = later } }, at('judges[0].revision')],
    ['unsupported verdict', { edit: (m) => { m.judges[0].verdict = 'unsupported' } }, at('judges[0].verdict')],
    ['unsupported claim', { edit: (m) => { m.claims[0].state = 'unsupported' } }, at('claims[0].state')],
  ]), [])
})

test('a proof that names no evidence manifest is judged as before, whatever lies beside it', () => {
  const f = fixture()
  const r = f.check(attach(f, 'plain', { files: { [PROOF]: proofText(null), [MANIFEST]: '[]\n', [OUT]: 'PASS\n' } }))
  assert.equal(r.code, 0, r.out + r.err)
})
