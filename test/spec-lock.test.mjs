// Fixture tests for spec-lock. Every repository is synthetic, built in a temp directory, with a
// scratch global git config; nothing touches the real global config or a real repository.
// Run: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, renameSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from '../lib/lock.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI = join(ROOT, 'bin', 'spec-lock')

// A hardened spec with the given live ids; struck ids get a ~~ACn~~ row, omit drops a section.
function specText(ids, { struck = [], omit } = {}) {
  const sections = ['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions']
  const row = (id) => `| ${id} | When the fixture runs, the system shall pass. | a red test | a screen | the fixture |`
  const table = ['| AC | Requirement (EARS) | Red test | Observable | Judge |', '|---|---|---|---|---|', ...ids.map(row), ...struck.map((id) => row(`~~${id}~~`))]
  return ['# Fixture spec', ...sections.filter((s) => s !== omit).flatMap((s) => [`## ${s}`, s === 'Acceptance Criteria' ? table.join('\n') : 'Text.'])].join('\n\n') + '\n'
}
const proofText = (spec, ids) => `---\n${spec ? `spec: ${spec}\n` : 'title: no spec here\n'}---\n# Proof\n\nWalked ${ids.join(' and ')}.\n`

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'spec-lock-test-'))
  const repo = join(dir, 'repo')
  const config = join(dir, 'global.gitconfig')
  writeFileSync(config, '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_)/.test(k)))
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  })
  const run = (cmd, args, extra = {}) => {
    const r = spawnSync(cmd, args, { cwd: repo, env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 })
    return { code: r.status, out: r.stdout, err: r.stderr }
  }
  const s = {
    dir, repo, config, env,
    git: (...args) => run('git', args),
    gitEnv: (extra, ...args) => run('git', args, extra),
    ok(...args) { const r = s.git(...args); assert.equal(r.code, 0, `git ${args.join(' ')}: ${r.err}`); return r.out.trim() },
    rev: (ref) => s.ok('rev-parse', ref),
    check: (old, neu) => run('node', [CLI, 'check', old, neu]),
    write(files) {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(repo, path)), { recursive: true })
        writeFileSync(join(repo, path), text)
      }
    },
    commit(files, msg = 'test: fixture commit') { s.write(files); s.ok('add', '-A'); s.ok('commit', '-q', '-m', msg); return s.rev('HEAD') },
    // Main A holds one file, then the lock is registered in the scratch global config.
    init() {
      mkdirSync(repo)
      s.ok('init', '-q', '-b', 'main')
      const a = s.commit({ 'base.txt': 'base\n' }, 'test: seed main')
      register(config)
      return a
    },
    // A branch from main with the given files, leaving main checked out.
    branch(name, ...commits) {
      s.ok('switch', '-q', '-c', name, 'main')
      let tip
      for (const files of commits) tip = s.commit(files)
      s.ok('switch', '-q', 'main')
      return tip
    },
    // Put the checkout back on A after a refused command; A to A moves nothing.
    restore(a) { s.ok('reset', '-q', '--hard', a); s.git('merge', '--abort') },
  }
  return s
}

const SPEC = 'docs/specs/x.md'
const code = { 'code.js': 'export const answer = 42\n' }

test('AC1: a code landing with no proof is refused and main stays put; the same change with a committed proof lands', () => {
  const s = scratch()
  const a = s.init()
  const b = s.branch('feature', { ...code, [SPEC]: specText(['AC1', 'AC2']) })

  const refused = s.git('merge', '--ff-only', 'feature')
  assert.notEqual(refused.code, 0, 'the unproved fast-forward was allowed')
  assert.match(refused.err, /spec-lock: refused refs\/heads\/main/)
  assert.match(refused.err, /no proof/)
  assert.equal(s.rev('main'), a)
  assert.equal(s.check(a, b).code, 1)

  s.restore(a)
  s.ok('switch', '-q', 'feature')
  const c = s.commit({ 'docs/proof/x.md': proofText(SPEC, ['AC1', 'AC2']) })
  s.ok('switch', '-q', 'main')
  const landed = s.git('merge', '--ff-only', 'feature')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), c)
})

test('AC2: a proof whose spec is absent, unreadable, or not hardened is refused with the proof path and fault', () => {
  const s = scratch()
  const a = s.init()
  const cases = {
    'no spec field': [{ 'docs/proof/p.md': proofText(null, ['AC1', 'AC2']) }, /docs\/proof\/p\.md: no spec: field/],
    'nonexistent spec': [{ 'docs/proof/p.md': proofText('docs/specs/nope.md', ['AC1', 'AC2']) }, /docs\/proof\/p\.md: spec docs\/specs\/nope\.md is not in the landed commit/],
    'spec missing Seams': [{ [SPEC]: specText(['AC1', 'AC2'], { omit: 'Seams' }), 'docs/proof/p.md': proofText(SPEC, ['AC1', 'AC2']) }, /docs\/proof\/p\.md: spec docs\/specs\/x\.md: missing section: Seams/],
    'spec outside the repository': [{ 'docs/proof/p.md': proofText('../x.md', ['AC1', 'AC2']) }, /docs\/proof\/p\.md: spec \.\.\/x\.md is not a path inside the repository/],
    'absolute host path': [{ 'docs/proof/p.md': proofText('/etc/hosts', ['AC1', 'AC2']) }, /docs\/proof\/p\.md: spec \/etc\/hosts is not a path inside the repository/],
  }
  const allowed = []
  for (const [name, [files, fault]] of Object.entries(cases)) {
    const tip = s.branch(`bad-${name.replace(/\W+/g, '-')}`, { ...code, ...files })
    const r = s.check(a, tip)
    if (r.code !== 1 || !fault.test(r.out)) allowed.push(`${name}: exit ${r.code} ${r.out}${r.err}`)
  }
  assert.deepEqual(allowed, [])

  // A symlinked spec is refused rather than followed.
  s.ok('switch', '-q', '-c', 'bad-symlink', 'main')
  mkdirSync(join(s.repo, 'docs/specs'), { recursive: true })
  symlinkSync('/etc/hosts', join(s.repo, SPEC))
  const link = s.commit({ ...code, 'docs/proof/p.md': proofText(SPEC, ['AC1', 'AC2']) })
  s.ok('switch', '-q', 'main')
  assert.match(s.check(a, link).out, /docs\/proof\/p\.md: spec docs\/specs\/x\.md is not a regular file/)

  // The real ref move names the same fault.
  const seams = s.rev('bad-spec-missing-Seams')
  const moved = s.git('update-ref', 'refs/heads/main', seams, a)
  assert.notEqual(moved.code, 0)
  assert.match(moved.err, /docs\/proof\/p\.md: spec docs\/specs\/x\.md: missing section: Seams/)
  assert.equal(s.rev('main'), a)

  // An uncommitted repair changes nothing; only the committed one does.
  s.ok('switch', '-q', 'bad-no-spec-field')
  const unrepaired = s.rev('HEAD')
  s.write({ [SPEC]: specText(['AC1', 'AC2']), 'docs/proof/p.md': proofText(SPEC, ['AC1', 'AC2']) })
  s.ok('add', '-A')
  assert.equal(s.check(a, unrepaired).code, 1)
  s.ok('commit', '-q', '-m', 'test: repair the proof')
  const repaired = s.rev('HEAD')
  s.ok('switch', '-q', 'main')
  const good = s.check(a, repaired)
  assert.equal(good.code, 0, good.out + good.err)
  const landed = s.git('update-ref', 'refs/heads/main', repaired, a)
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), repaired)
})

test('AC3: every proof in a landing is checked against its own spec, and at least one is required', () => {
  const s = scratch()
  const a = s.init()
  const specs = {
    'docs/specs/one.md': specText(['AC1', 'AC2']),
    'docs/specs/two.md': specText(['AC1', 'AC2'], { struck: ['AC3'] }),
  }
  const one = { 'docs/proof/one.md': proofText('docs/specs/one.md', ['AC1', 'AC2']) }
  // AC20 is not AC2, and the struck AC3 is not asked for.
  const b = s.branch('feature', { ...code, ...specs, ...one, 'docs/proof/two.md': proofText('docs/specs/two.md', ['AC1', 'AC20']) })

  const r = s.check(a, b)
  assert.equal(r.code, 1, `an incomplete second proof was let through: ${r.out}`)
  assert.match(r.out, /docs\/proof\/two\.md: does not name AC2 from docs\/specs\/two\.md/)
  assert.doesNotMatch(r.out, /one\.md/)
  assert.doesNotMatch(r.out, /AC3/)
  const refused = s.git('merge', '--ff-only', 'feature')
  assert.notEqual(refused.code, 0)
  assert.match(refused.err, /docs\/proof\/two\.md: does not name AC2/)
  assert.equal(s.rev('main'), a)

  s.restore(a)
  s.ok('switch', '-q', 'feature')
  const c = s.commit({ 'docs/proof/two.md': proofText('docs/specs/two.md', ['AC1', 'AC2']) })
  s.ok('switch', '-q', 'main')
  const landed = s.git('merge', '--ff-only', 'feature')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), c)

  // Complete proofs already on main cannot vouch for a later code change that brings none.
  const d = s.branch('later', { 'code.js': 'export const answer = 43\n' })
  const later = s.check(c, d)
  assert.equal(later.code, 1)
  assert.match(later.out, /no proof/)
  // Git sends zeros as the old value here; the lock must compare against main's real tip, not an empty tree.
  const unconditional = s.git('update-ref', 'refs/heads/main', d)
  assert.notEqual(unconditional.code, 0, 'update-ref with no old value let historic proofs vouch for new code')
  assert.match(unconditional.err, /no proof/)
  assert.equal(s.rev('main'), c)
})

test('AC11: merge, fast-forward, reset, commit and update-ref cannot move main to unproved code in a repository with no remote', (t) => {
  const s = scratch()
  const a = s.init()
  const b = s.branch('feature', { ...code, [SPEC]: specText(['AC1', 'AC2']) })
  assert.equal(s.ok('remote'), '')
  const ops = {
    'merge --no-ff': () => s.git('merge', '--no-ff', '--no-edit', 'feature'),
    'merge --ff-only': () => s.git('merge', '--ff-only', 'feature'),
    'reset --hard': () => s.git('reset', '--hard', b),
    'update-ref with old': () => s.git('update-ref', 'refs/heads/main', b, a),
    'update-ref without old': () => s.git('update-ref', 'refs/heads/main', b),
    'commit on main': () => { s.write(code); s.ok('add', '-A'); return s.git('commit', '-q', '-m', 'test: code straight on main') },
  }
  const allowed = []
  for (const [name, op] of Object.entries(ops)) {
    const r = op()
    const main = s.rev('main')
    if (r.code === 0 || main !== a || !/spec-lock: refused refs\/heads\/main/.test(r.err)) allowed.push(`${name}: exit ${r.code}, main ${main === a ? 'at A' : 'moved'}`)
    // Ref safety is asserted below; what the refused command left in the checkout is only reported.
    t.diagnostic(`${name}: exit ${r.code}; checkout after refusal: ${s.ok('status', '--porcelain') || 'clean'}`)
    s.restore(a)
  }
  assert.deepEqual(allowed, [])
  // Packing refs sends a delete of the loose main through the hook; it must still pass.
  const packed = s.git('pack-refs', '--all')
  assert.equal(packed.code, 0, packed.err)
  assert.equal(s.rev('main'), a)
})

test('AC12: a crashed checker, missing Node, or an unreadable object refuses the update with a diagnostic', () => {
  const s = scratch()
  const a = s.init()
  const v = s.branch('feature', { ...code, [SPEC]: specText(['AC1', 'AC2']), 'docs/proof/x.md': proofText(SPEC, ['AC1', 'AC2']) })

  // The checker crashes with exit 73.
  const copy = join(s.dir, 'crashing')
  cpSync(join(ROOT, 'bin'), join(copy, 'bin'), { recursive: true })
  cpSync(join(ROOT, 'lib'), join(copy, 'lib'), { recursive: true })
  writeFileSync(join(copy, 'bin', 'spec-lock'), 'process.exit(73)\n')
  register(s.config, join(copy, 'bin'))
  const crashed = s.git('update-ref', 'refs/heads/main', v, a)
  assert.notEqual(crashed.code, 0, 'a crashed checker was read as a pass')
  assert.match(crashed.err, /spec-lock: the checker failed \(exit 73\)/)
  assert.equal(s.rev('main'), a)
  register(s.config)

  // Node is not on PATH for the git that runs the hook.
  const bare = [dirname(spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()), '/bin'].join(':')
  assert.notEqual(spawnSync('/bin/sh', ['-c', 'command -v node'], { env: { PATH: bare } }).status, 0, `node is on ${bare}`)
  const nonode = s.gitEnv({ PATH: bare }, 'update-ref', 'refs/heads/main', v, a)
  assert.notEqual(nonode.code, 0, 'missing Node was read as a pass')
  assert.match(nonode.err, /spec-lock: node is not on PATH/)
  assert.equal(s.rev('main'), a)

  // The spec's blob is missing from the object store.
  const oid = s.rev(`${v}:${SPEC}`)
  const loose = join(s.repo, '.git', 'objects', oid.slice(0, 2), oid.slice(2))
  renameSync(loose, `${loose}.away`)
  const unreadable = s.git('update-ref', 'refs/heads/main', v, a)
  assert.notEqual(unreadable.code, 0, 'an unreadable object was read as a pass')
  assert.match(unreadable.err, new RegExp(`spec-lock: cannot read object ${oid}`))
  assert.equal(s.rev('main'), a)
  renameSync(`${loose}.away`, loose)

  // With everything restored, the valid proof lands.
  const landed = s.git('update-ref', 'refs/heads/main', v, a)
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), v)
})
