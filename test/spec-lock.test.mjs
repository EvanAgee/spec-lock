// Fixture tests for spec-lock. Every repository is synthetic, built in a temp directory, with a
// scratch global git config; nothing touches the real global config or a real repository.
// Run: node --test test/
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, renameSync, symlinkSync, rmSync, readFileSync, realpathSync, chmodSync } from 'node:fs'
import { tmpdir, loadavg } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register, HOOK, PUSH_HOOK } from '../lib/lock.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI = join(ROOT, 'bin', 'spec-lock')
const ACTION = join(ROOT, 'bin', 'spec-lock-action')

// A hardened spec with the given live ids; struck ids get a ~~ACn~~ row, omit drops a section.
function specText(ids, { struck = [], omit } = {}) {
  const sections = ['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions']
  const row = (id) => `| ${id} | When the fixture runs, the system shall pass. | a red test | a screen | the fixture |`
  const table = ['| AC | Requirement (EARS) | Red test | Observable | Judge |', '|---|---|---|---|---|', ...ids.map(row), ...struck.map((id) => row(`~~${id}~~`))]
  return ['# Fixture spec', ...sections.filter((s) => s !== omit).flatMap((s) => [`## ${s}`, s === 'Acceptance Criteria' ? table.join('\n') : 'Text.'])].join('\n\n') + '\n'
}
const proofText = (spec, ids) => `---\n${spec ? `spec: ${spec}\n` : 'title: no spec here\n'}---\n# Proof\n\nWalked ${ids.join(' and ')}.\n`

// Every scratch directory is removed once the tests finish, pass or fail.
const scratchDirs = []
after(() => { for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true }) })

// A scratch directory with its own global git config, central spec-lock config, landing log and HOME.
// scratch() works in its "repo" directory; s.at(name) gives the same helpers for another directory.
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'spec-lock-test-'))
  scratchDirs.push(dir)
  const config = join(dir, 'global.gitconfig')
  writeFileSync(config, '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_)/.test(k)))
  Object.assign(env, {
    HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1',
    SPEC_LOCK_CONFIG: join(dir, 'spec-lock.config'), SPEC_LOCK_LOG: join(dir, 'landings.log'),
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  })
  const at = (repo) => {
    const run = (cmd, args, extra = {}) => {
      const r = spawnSync(cmd, args, { cwd: repo, env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 })
      return { code: r.status, out: r.stdout, err: r.stderr }
    }
    const s = {
      repo,
      git: (...args) => run('git', args),
      gitEnv: (extra, ...args) => run('git', args, extra),
      // The owner's one-shot escape, used only to build fixtures such as a remote's history.
      unhooked: (...args) => s.ok('-c', `hook.${HOOK}.enabled=false`, '-c', `hook.${PUSH_HOOK}.enabled=false`, ...args),
      ok(...args) { const r = s.git(...args); assert.equal(r.code, 0, `git ${args.join(' ')}: ${r.err}`); return r.out.trim() },
      rev: (ref) => s.ok('rev-parse', ref),
      check: (old, neu) => run('node', [CLI, 'check', old, neu]),
      // The GitHub action adapter as the runner starts it for a push of sha to ref.
      action: (sha, target, ref) => run('node', [ACTION], { INPUT_TARGET: target, GITHUB_SHA: sha, GITHUB_REF: ref }),
      // Writes files; a null text deletes the path.
      write(files) {
        for (const [path, text] of Object.entries(files)) {
          if (text === null) { rmSync(join(repo, path)); continue }
          mkdirSync(dirname(join(repo, path)), { recursive: true })
          writeFileSync(join(repo, path), text)
        }
      },
      commit(files, msg = 'test: fixture commit') { s.write(files); s.ok('add', '-A'); s.ok('commit', '-q', '-m', msg); return s.rev('HEAD') },
      // Main A holds one file, committed past any lock already registered, then the lock is
      // registered in the scratch global config.
      init() {
        mkdirSync(repo)
        s.ok('init', '-q', '-b', 'main')
        s.write({ 'base.txt': 'base\n' })
        s.ok('add', '-A')
        s.unhooked('commit', '-q', '-m', 'test: seed main')
        register(config)
        return s.rev('HEAD')
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
  return {
    ...at(join(dir, 'repo')), dir, config, env, at: (name) => at(join(dir, name)),
    central: (text) => writeFileSync(env.SPEC_LOCK_CONFIG, text),
    // The landing log as rows of [time, repo, ref, old, new, verdict].
    landings: () => { try { return readFileSync(env.SPEC_LOCK_LOG, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) } catch { return [] } },
  }
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

// A PATH that holds git and /bin but no Node, as a GUI git client or a cron job might run git.
function noNode() {
  const PATH = [dirname(spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()), '/bin'].join(':')
  assert.notEqual(spawnSync('/bin/sh', ['-c', 'command -v node'], { env: { PATH } }).status, 0, `node is on ${PATH}`)
  return { PATH }
}

test('AC4: a landing that changes only docs/ or .md paths needs no proof; code added, deleted or renamed to .md still does', () => {
  const s = scratch()
  const a = s.init()
  const docs = { 'docs/guide.txt': 'guide\n', 'README.md': '# Readme\n' }
  const controls = {
    'code added': { ...docs, 'src/main.js': 'export {}\n' },
    'code deleted': { ...docs, 'base.txt': null },
    'code renamed to markdown': { ...docs, 'base.txt': null, 'base.md': 'base\n' },
  }
  const allowed = []
  for (const [name, files] of Object.entries(controls)) {
    const r = s.check(a, s.branch(name.replace(/\W+/g, '-'), files))
    if (r.code !== 1 || !/no proof/.test(r.out)) allowed.push(`${name}: exit ${r.code} ${r.out}${r.err}`)
  }
  assert.deepEqual(allowed, [])
  const mixed = s.git('merge', '--ff-only', 'code-added')
  assert.notEqual(mixed.code, 0, 'a mixed code landing without a proof was allowed')
  assert.match(mixed.err, /spec-lock: refused refs\/heads\/main[\s\S]*no proof/)
  assert.equal(s.rev('main'), a)
  s.restore(a)

  // A proof in a documentation landing is still checked: every proof in a landing must be complete.
  const badProof = s.check(a, s.branch('docs-bad-proof', { ...docs, 'docs/proof/p.md': proofText(null, ['AC1']) }))
  assert.equal(badProof.code, 1)
  assert.match(badProof.out, /docs\/proof\/p\.md: no spec: field/)

  const b = s.branch('docs-only', docs)
  const landed = s.git('merge', '--ff-only', 'docs-only')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), b)
})

test('AC5: a pull of commits already on the remote default branch lands without a new proof; local code on top is still checked', () => {
  const s = scratch()
  const a = s.init()
  // The bare remote stands in for GitHub, where this machine's lock does not run.
  const remote = s.at('remote.git')
  mkdirSync(remote.repo)
  remote.ok('init', '-q', '--bare', '-b', 'main')
  remote.ok('config', `hook.${HOOK}.enabled`, 'false')
  s.ok('remote', 'add', 'origin', remote.repo)
  s.ok('push', '-q', '-u', 'origin', 'main')
  s.ok('remote', 'set-head', 'origin', 'main')

  // Someone else lands R on the remote: code and an old-style proof with no spec field.
  const up = s.at('upstream')
  s.ok('clone', '-q', remote.repo, up.repo)
  const remoteWork = (files, msg) => {
    up.write(files)
    up.ok('add', '-A')
    up.unhooked('commit', '-q', '-m', msg)
    up.unhooked('push', '-q', 'origin', 'main')
    return up.rev('HEAD')
  }
  const r = remoteWork({ ...code, 'docs/proof/old.md': proofText(null, ['AC1']) }, 'feat: remote work')
  s.ok('fetch', '-q', 'origin')
  assert.equal(s.rev('origin/main'), r)

  // L is local code on top of R with no proof: it is refused, and R's pull does not carry it.
  s.ok('switch', '-q', '-c', 'local', 'origin/main')
  const l = s.commit({ 'code.js': 'export const answer = 43\n' })
  s.ok('switch', '-q', 'main')
  const refused = s.git('merge', '--ff-only', 'local')
  assert.notEqual(refused.code, 0, 'unproved local code rode in on a pull')
  assert.match(refused.err, /spec-lock: refused refs\/heads\/main[\s\S]*no proof/)
  assert.equal(s.rev('main'), a)
  assert.equal(s.check(a, l).code, 1)
  s.restore(a)

  const pulled = s.git('pull', '-q', '--ff-only')
  assert.equal(pulled.code, 0, pulled.err)
  assert.equal(s.rev('main'), r)

  // With its own complete proof, L lands; R's old-style proof is not held against it.
  s.ok('switch', '-q', 'local')
  const lp = s.commit({ [SPEC]: specText(['AC1']), 'docs/proof/local.md': proofText(SPEC, ['AC1']) })
  s.ok('switch', '-q', 'main')
  const landed = s.git('merge', '--ff-only', 'local')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), lp)

  // A merging pull into a main that has landed work of its own passes too.
  const r2 = remoteWork({ 'more.js': 'export const more = 1\n' }, 'feat: more remote work')
  const merged = s.git('-c', 'pull.rebase=false', 'pull', '-q', '--no-edit')
  assert.equal(merged.code, 0, merged.err)
  assert.equal(s.ok('rev-list', '--parents', '-n', '1', 'main').split(' ').slice(1).join(' '), `${lp} ${r2}`)
})

test('AC6: an empty repository takes its first commit; an existing or deleted and recreated main cannot claim that exemption', () => {
  const s = scratch()
  register(s.config)
  mkdirSync(s.repo)
  s.ok('init', '-q', '-b', 'main')
  s.write(code)
  s.ok('add', '-A')
  const first = s.git('commit', '-q', '-m', 'test: first commit, with code and no proof')
  assert.equal(first.code, 0, `the first commit of an empty repository was refused: ${first.err}`)
  const a = s.rev('main')

  // An unconditional update of the existing main is not a first commit.
  const b = s.branch('more', { 'code.js': 'export const answer = 43\n' })
  const unconditional = s.git('update-ref', 'refs/heads/main', b)
  assert.notEqual(unconditional.code, 0, 'update-ref with no old value on an existing main was read as a first commit')
  assert.match(unconditional.err, /spec-lock: refused refs\/heads\/main[\s\S]*no proof/)
  assert.equal(s.rev('main'), a)

  // Land a complete proof, delete main, and recreate it on unproved code: the old proof cannot vouch.
  s.branch('proved', { [SPEC]: specText(['AC1']), 'docs/proof/x.md': proofText(SPEC, ['AC1']) })
  const landed = s.git('merge', '--ff-only', 'proved')
  assert.equal(landed.code, 0, landed.err)
  const c = s.rev('main')
  // A free branch named below a guarded name is not a guarded branch, so it vouches for nothing.
  const d = s.branch('master/later', { 'code.js': 'export const answer = 44\n' })
  s.ok('update-ref', '-d', 'refs/heads/main')
  const recreated = s.git('update-ref', 'refs/heads/main', d)
  assert.notEqual(recreated.code, 0, 'a deleted and recreated main let its old proof vouch for new code')
  assert.match(recreated.err, /spec-lock: refused refs\/heads\/main[\s\S]*no proof/)
  assert.equal(s.git('rev-parse', '--verify', '--quiet', 'refs/heads/main').code, 1)

  // Recreating main where it was passes, and packing refs still passes.
  const back = s.git('update-ref', 'refs/heads/main', c)
  assert.equal(back.code, 0, back.err)
  const packed = s.git('pack-refs', '--all')
  assert.equal(packed.code, 0, packed.err)
  assert.equal(s.rev('main'), c)
})

test('AC7: the default branch, whatever its name, and each listed integration branch are guarded; a feature branch is not', () => {
  const s = scratch()
  s.central('# integration branches\nintegration integration/candidate\n')
  register(s.config)
  const seed = s.at('seed')
  mkdirSync(seed.repo)
  seed.ok('init', '-q', '-b', 'trunk')
  seed.commit({ 'base.txt': 'base\n' })
  mkdirSync(join(s.dir, 'remote.git'))
  s.at('remote.git').ok('init', '-q', '--bare', '-b', 'trunk')
  seed.ok('push', '-q', join(s.dir, 'remote.git'), 'trunk')

  // A fresh clone creates trunk from nothing; its content is already on the remote, so it passes.
  const cloned = s.at('.').git('clone', '-q', join(s.dir, 'remote.git'), s.repo)
  assert.equal(cloned.code, 0, cloned.err)
  const a = s.rev('trunk')
  s.ok('switch', '-q', '-c', 'integration/candidate')
  s.ok('switch', '-q', '-c', 'feature/demo', 'trunk')

  // Unproved code commits freely on a feature branch.
  s.write(code)
  s.ok('add', '-A')
  const free = s.git('commit', '-q', '-m', 'test: code on a feature branch')
  assert.equal(free.code, 0, free.err)

  const allowed = []
  for (const branch of ['trunk', 'integration/candidate']) {
    s.ok('switch', '-q', branch)
    s.write(code)
    s.ok('add', '-A')
    const r = s.git('commit', '-q', '-m', 'test: unproved code')
    if (r.code === 0 || s.rev(branch) !== a || !r.err.includes(`spec-lock: refused refs/heads/${branch}`)) allowed.push(`${branch}: exit ${r.code} ${r.err}`)
    s.restore(a)
  }
  assert.deepEqual(allowed, [])

  // Without Node the adapter still tells the guarded branches from the free ones.
  const PATH = noNode()
  s.ok('switch', '-q', 'feature/demo')
  s.write({ 'code.js': 'export const answer = 45\n' })
  s.ok('add', '-A')
  const freeNoNode = s.gitEnv(PATH, 'commit', '-q', '-m', 'test: feature commit without node')
  assert.equal(freeNoNode.code, 0, `a feature branch commit was refused without Node: ${freeNoNode.err}`)
  const guardedNoNode = s.gitEnv(PATH, 'update-ref', 'refs/heads/trunk', s.rev('feature/demo'), a)
  assert.notEqual(guardedNoNode.code, 0)
  assert.match(guardedNoNode.err, /spec-lock: node is not on PATH/)
  assert.equal(s.rev('trunk'), a)
})

test('AC8: a repository on the central opt-out list is not checked; an unlisted one, and its linked worktrees, still are', () => {
  const s = scratch()
  const listed = s.at('listed')
  const unlisted = s.at('unlisted')
  // Listed by the path the temp directory gives, which is a symlink on macOS; matching follows it.
  // A relative entry would match whatever directory git runs the hook in, so it never matches.
  s.central(`opt-out ${listed.repo}\nopt-out .\n`)
  const a = listed.init()
  const b = unlisted.init()
  const la = listed.branch('feature', code)
  const lb = unlisted.branch('feature', code)
  listed.ok('worktree', 'add', '-q', join(s.dir, 'listed-wt'), '-b', 'wt')
  unlisted.ok('worktree', 'add', '-q', join(s.dir, 'unlisted-wt'), '-b', 'wt')
  // Pretend exemptions inside the unlisted repository change nothing: only the central list counts.
  unlisted.ok('config', 'spec-lock.opt-out', 'true')
  unlisted.write({ '.config/spec-lock/config': `opt-out ${unlisted.repo}\n` })

  const refused = unlisted.git('merge', '--ff-only', 'feature')
  assert.notEqual(refused.code, 0, 'an unlisted repository was exempted')
  assert.match(refused.err, /spec-lock: refused refs\/heads\/main/)
  const fromWorktree = s.at('unlisted-wt').git('update-ref', 'refs/heads/main', lb, b)
  assert.notEqual(fromWorktree.code, 0, 'a linked worktree of an unlisted repository was exempted')
  assert.equal(unlisted.rev('main'), b)

  const exempt = listed.git('merge', '--ff-only', 'feature')
  assert.equal(exempt.code, 0, exempt.err)
  assert.ok(exempt.err.includes(`spec-lock: not checked: ${realpathSync(listed.repo)} is on the opt-out list in ${s.env.SPEC_LOCK_CONFIG}`), exempt.err)
  assert.equal(listed.rev('main'), la)
  const worktreeExempt = s.at('listed-wt').gitEnv(noNode(), 'update-ref', 'refs/heads/main', a, la)
  assert.equal(worktreeExempt.code, 0, worktreeExempt.err)
  assert.equal(listed.rev('main'), a)
})

test('landing log: every checked move of a guarded branch is logged, and a tip a move leaves behind stays reachable', () => {
  const s = scratch()
  const a = s.init()
  const proved = (name) => ({ [SPEC]: specText(['AC1']), [`docs/proof/${name}.md`]: proofText(SPEC, ['AC1']), [`${name}.js`]: 'export {}\n' })
  const c = s.branch('one', proved('one'))
  const d = s.branch('two', proved('two'))
  const e = s.branch('three', { 'code.js': 'export const answer = 42\n' })
  assert.equal(s.git('merge', '--ff-only', 'one').code, 0)
  // Packing refs sends a delete of the loose main, which is not a move and is not logged.
  s.ok('pack-refs', '--all')
  assert.notEqual(s.git('update-ref', 'refs/heads/main', e, c).code, 0)
  // A force move to a sibling drops C from main, and a delete drops D.
  assert.equal(s.git('update-ref', 'refs/heads/main', d, c).code, 0)
  s.ok('switch', '-q', '--detach', 'main')
  s.ok('update-ref', '-d', 'refs/heads/main', d)
  // Now only the kept refs hold C and D.
  s.ok('switch', '-q', 'three')
  s.ok('branch', '-q', '-D', 'one', 'two')
  s.ok('pack-refs', '--all')
  s.ok('reflog', 'expire', '--expire=now', '--all')
  s.ok('gc', '-q', '--prune=now')

  const repo = realpathSync(s.repo)
  const rows = s.landings().map(([time, ...rest]) => { assert.match(time, /^\d{4}-\d\d-\d\dT/); return rest.join(' ') })
  const z = '0'.repeat(40)
  assert.deepEqual(rows, [
    `${repo} refs/heads/main ${a} ${c} allowed`,
    `${repo} refs/heads/main ${c} ${e} refused`,
    `${repo} refs/heads/main ${c} ${d} allowed`,
    `${repo} refs/heads/main ${d} ${z} deleted`,
  ])
  assert.equal(s.rev(`refs/spec-lock/kept/${c}`), c)
  assert.equal(s.rev(`refs/spec-lock/kept/${d}`), d)
  assert.equal(s.git('cat-file', '-e', `${c}:one.js`).code, 0, 'the tip a force move dropped was pruned')
  assert.equal(s.git('cat-file', '-e', `${d}:two.js`).code, 0, 'the tip a delete dropped was pruned')
  assert.deepEqual(s.ok('for-each-ref', '--format=%(refname)', 'refs/spec-lock').split('\n'), [`refs/spec-lock/kept/${c}`, `refs/spec-lock/kept/${d}`].sort())
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
  const nonode = s.gitEnv(noNode(), 'update-ref', 'refs/heads/main', v, a)
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

// Fault lines and the checker line of a verdict, as the git hook or the action printed it.
const verdict = (text) => text.split('\n').filter((l) => l.startsWith('- ') || l.startsWith('spec-lock checker '))

// A bare repository standing in for GitHub, where this machine's lock does not run, as the origin of s.
// runner(branch) gives what actions/checkout leaves after a push of that branch: one commit, no other refs.
function github(s) {
  const remote = s.at('github.git')
  mkdirSync(remote.repo)
  remote.ok('init', '-q', '--bare', '-b', 'main')
  remote.ok('config', `hook.${HOOK}.enabled`, 'false')
  s.ok('remote', 'add', 'origin', remote.repo)
  s.ok('push', '-q', 'origin', 'main')
  let runs = 0
  return {
    runner(branch) {
      const r = s.at(`runner-${++runs}`)
      s.unhooked('clone', '-q', '--depth=1', '--branch', branch, `file://${remote.repo}`, r.repo)
      return r
    },
  }
}

test('AC13: the git hook and the GitHub action run the same check and print the same verdict and checker line', () => {
  const s = scratch()
  const a = s.init()
  const gh = github(s)
  // The AC3 landing: two proofs, and the second one does not name AC2.
  const specs = { 'docs/specs/one.md': specText(['AC1', 'AC2']), 'docs/specs/two.md': specText(['AC1', 'AC2']) }
  const one = { 'docs/proof/one.md': proofText('docs/specs/one.md', ['AC1', 'AC2']) }
  const b = s.branch('land/feature', { ...code, ...specs, ...one, 'docs/proof/two.md': proofText('docs/specs/two.md', ['AC1', 'AC20']) })
  s.ok('push', '-q', 'origin', 'land/feature')

  const hook = s.git('merge', '--ff-only', 'land/feature')
  const action = gh.runner('land/feature').action(b, 'main', 'refs/heads/land/feature')
  assert.notEqual(hook.code, 0, 'the git hook let the incomplete proof land')
  assert.equal(action.code, 1, `the action passed the incomplete proof: ${action.out}${action.err}`)
  assert.match(action.out, new RegExp(`spec-lock: checking ${b} as a landing on main at ${a}`))
  const printed = verdict(hook.err)
  assert.equal(printed.length, 2, hook.err)
  assert.equal(printed[0], '- docs/proof/two.md: does not name AC2 from docs/specs/two.md')
  assert.match(printed[1], /^spec-lock checker \d+\.\d+\.\d+\+[0-9a-f]{12}$/)
  assert.deepEqual(verdict(action.out), printed)
  assert.equal(s.rev('main'), a)

  // Repaired, the next commit passes both, and the action names the same checker.
  s.restore(a)
  s.ok('switch', '-q', 'land/feature')
  const c = s.commit({ 'docs/proof/two.md': proofText('docs/specs/two.md', ['AC1', 'AC2']) })
  s.ok('switch', '-q', 'main')
  s.ok('push', '-q', 'origin', 'land/feature')
  const passed = gh.runner('land/feature').action(c, 'main', 'refs/heads/land/feature')
  assert.equal(passed.code, 0, passed.out + passed.err)
  assert.deepEqual(verdict(passed.out), [printed[1]])
  const landed = s.git('merge', '--ff-only', 'land/feature')
  assert.equal(landed.code, 0, landed.err)
  assert.equal(s.rev('main'), c)
})

test('AC14: the action judges the pushed commit against each target as it stands when the check runs', () => {
  const s = scratch()
  const a = s.init()
  const gh = github(s)
  // The integration branch already holds unproved code, so its tip is not main's.
  const i = s.branch('integration/candidate', { 'other.js': 'export const other = 1\n' })
  s.ok('switch', '-q', '-c', 'land/note', 'integration/candidate')
  const d = s.commit({ 'notes.md': 'A note.\n' })
  s.ok('switch', '-q', 'main')
  s.ok('push', '-q', 'origin', 'integration/candidate', 'land/note')

  // One commit, two targets: a note on the integration branch, unproved code on main.
  const run = gh.runner('land/note')
  const onIntegration = run.action(d, 'integration/candidate', 'refs/heads/land/note')
  assert.equal(onIntegration.code, 0, onIntegration.out + onIntegration.err)
  assert.match(onIntegration.out, new RegExp(`as a landing on integration/candidate at ${i}`))
  const onMain = run.action(d, 'main', 'refs/heads/land/note')
  assert.equal(onMain.code, 1, `the action passed unproved code bound for main: ${onMain.out}`)
  assert.match(onMain.out, new RegExp(`as a landing on main at ${a}\n[\\s\\S]*- no proof`))

  // E passes while main is A. Once main moves to M, landing E would undo M's code, and the same
  // check, run again, reads main's new tip and refuses.
  const e = s.branch('land/e', { 'notes.md': 'A note.\n' })
  s.ok('push', '-q', 'origin', 'land/e')
  const runE = gh.runner('land/e')
  const before = runE.action(e, 'main', 'refs/heads/land/e')
  assert.equal(before.code, 0, before.out + before.err)
  const m = s.branch('land/m', { ...code, [SPEC]: specText(['AC1']), 'docs/proof/m.md': proofText(SPEC, ['AC1']) })
  s.ok('push', '-q', 'origin', 'land/m:main')
  const after = runE.action(e, 'main', 'refs/heads/land/e')
  assert.equal(after.code, 1, `a check against a stale main passed: ${after.out}`)
  assert.match(after.out, new RegExp(`as a landing on main at ${m}\n[\\s\\S]*- no proof`))

  // A push to the target itself has already landed: main's tip against itself is an empty range, which
  // would pass anything. A target that does not exist cannot be read.
  const self = runE.action(m, 'main', 'refs/heads/main')
  assert.equal(self.code, 2, self.out)
  assert.match(self.err, /spec-lock: this push is to main itself/)
  const missing = runE.action(e, 'nope', 'refs/heads/land/e')
  assert.equal(missing.code, 2, missing.out)
  assert.match(missing.err, /spec-lock: .*nope/)
})

// The live walk pushes to a real repository, so it runs only when one is named.
const canary = process.env.SPEC_LOCK_CANARY
test('AC14 and AC21: GitHub refuses an unproved push to main and a forced one, lands a proved one, and each check takes under 60 seconds', { skip: !canary && 'set SPEC_LOCK_CANARY=<owner/repo> to walk a real GitHub repository' }, () => {
  const r = spawnSync('node', [join(ROOT, 'test', 'github-walk.mjs'), canary], { encoding: 'utf8', timeout: 1200000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

// The two events the shared hooks use; every fixture layout has its own hook for each.
const EVENTS = ['reference-transaction', 'pre-push']
// A repository's own hook: it appends "<directory> <event> <first argument>" to a marker file.
const markHook = (marker) => `#!/bin/sh\necho "$(pwd -P) $(basename "$0") $1" >> '${marker}'\n`
// Husky 9's dispatcher, cut down: .husky/_/<event> sources h, which runs .husky/<event> unless HUSKY=0.
const HUSKY_H = '#!/usr/bin/env sh\nn=$(basename "$0")\ns=$(dirname "$(dirname "$0")")/$n\n[ ! -f "$s" ] && exit 0\n[ "${HUSKY-}" = "0" ] && exit 0\nsh -e "$s" "$@"\n'
const hooksAt = (dir, text) => Object.fromEntries(EVENTS.map((e) => [`${dir}/${e}`, text]))

test('AC9: the shared hooks run beside husky, tracked, absolute and default hook folders and in a linked worktree, and change none of their config', () => {
  const s = scratch()
  const marker = join(s.dir, 'marker')
  const mark = markHook(marker)
  const layouts = {
    husky: { hooksPath: () => '.husky/_', files: { '.husky/_/h': HUSKY_H, ...hooksAt('.husky/_', '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n'), ...hooksAt('.husky', mark) } },
    tracked: { hooksPath: () => '.githooks', files: hooksAt('.githooks', mark) },
    absolute: { hooksPath: (repo) => join(repo, '.git', 'hooks'), files: hooksAt('.git/hooks', mark) },
    default: { files: hooksAt('.git/hooks', mark) },
    // A linked worktree of a repository with a tracked, relative hooks folder, used only from the worktree.
    worktree: { hooksPath: () => '.githooks', files: hooksAt('.githooks', mark), worktree: true },
  }
  const proved = { ...code, [SPEC]: specText(['AC1']), 'docs/proof/x.md': proofText(SPEC, ['AC1']) }
  const cases = Object.entries(layouts).map(([name, { hooksPath, files, worktree }]) => {
    const h = s.at(name)
    mkdirSync(h.repo)
    h.ok('init', '-q', '-b', 'main')
    h.write(files)
    for (const path of Object.keys(files)) chmodSync(join(h.repo, path), 0o755)
    if (hooksPath) h.ok('config', 'core.hooksPath', hooksPath(h.repo))
    const a = h.commit({ 'base.txt': 'base\n' }, 'test: seed main')
    // Each has its own bare remote standing in for GitHub, with the lock off there.
    const remote = s.at(`${name}.git`)
    mkdirSync(remote.repo)
    remote.ok('init', '-q', '--bare', '-b', 'main')
    remote.ok('config', `hook.${HOOK}.enabled`, 'false')
    h.ok('remote', 'add', 'origin', remote.repo)
    h.ok('push', '-q', 'origin', 'main')
    const good = h.branch('good', proved)
    const bad = h.branch('bad', code)
    if (worktree) h.ok('worktree', 'add', '-q', join(s.dir, `${name}-wt`), '-b', 'wt')
    const w = worktree ? s.at(`${name}-wt`) : h
    return { name, h, w, remote, a, good, bad, before: w.ok('config', '--list', '--show-scope').split('\n') }
  })

  register(s.config)
  const failures = []
  const fail = (c, what) => failures.push(`${c.name}: ${what}`)
  const marks = () => { try { return readFileSync(marker, 'utf8') } catch { return '' } }
  for (const c of cases) {
    const { h, w, remote, a, good, bad } = c
    const dir = realpathSync(w.repo)
    // Config: only the four global entries of the shared hooks are new, and nothing was removed.
    const after = w.ok('config', '--list', '--show-scope').split('\n')
    const added = after.filter((l) => !c.before.includes(l))
    const removed = c.before.filter((l) => !after.includes(l))
    if (removed.length || added.length !== 4 || !added.every((l) => l.startsWith('global\thook.spec-lock-'))) fail(c, `config changed: +${JSON.stringify(added)} -${JSON.stringify(removed)}`)
    // Git lists the shared hook and the repository's own hook for both events.
    for (const [event, name] of [['reference-transaction', HOOK], ['pre-push', PUSH_HOOK]]) {
      const list = w.ok('hook', 'list', event).split('\n')
      if (!list.includes(name) || !list.includes('hook from hookdir')) fail(c, `git hook list ${event}: ${list.join(', ')}`)
    }

    writeFileSync(marker, '')
    const refused = w.git('update-ref', 'refs/heads/main', bad, a)
    if (refused.code === 0 || h.rev('main') !== a || !/spec-lock: refused refs\/heads\/main/.test(refused.err)) fail(c, `unproved update: exit ${refused.code} ${refused.err}`)
    if (!marks().includes(`${dir} reference-transaction prepared`)) fail(c, `own reference-transaction hook did not run on the refused update: ${marks()}`)

    writeFileSync(marker, '')
    const landed = w.git('update-ref', 'refs/heads/main', good, a)
    if (landed.code !== 0 || h.rev('main') !== good) fail(c, `proved update: exit ${landed.code} ${landed.err}`)
    if (!marks().includes(`${dir} reference-transaction committed`)) fail(c, `own reference-transaction hook did not run on the landing: ${marks()}`)
    if (!s.landings().some(([, repo, ref, old, neu, verdict]) => repo === realpathSync(h.repo) && ref === 'refs/heads/main' && old === a && neu === good && verdict === 'allowed')) fail(c, 'the shared hook did not judge the landing')

    writeFileSync(marker, '')
    const pushRefused = w.git('push', '-q', 'origin', 'bad:main')
    if (pushRefused.code === 0 || remote.rev('main') !== a || !/spec-lock: refused push to origin refs\/heads\/main/.test(pushRefused.err)) fail(c, `unproved push: exit ${pushRefused.code} ${pushRefused.err}`)
    if (!marks().includes(`${dir} pre-push origin`)) fail(c, `own pre-push hook did not run on the refused push: ${marks()}`)

    writeFileSync(marker, '')
    const pushed = w.git('push', '-q', 'origin', 'good:main')
    if (pushed.code !== 0 || remote.rev('main') !== good) fail(c, `proved push: exit ${pushed.code} ${pushed.err}`)
    if (!marks().includes(`${dir} pre-push origin`)) fail(c, `own pre-push hook did not run on the push: ${marks()}`)
  }
  assert.deepEqual(failures, [])

  // HUSKY=0 switches off husky's hooks, not the lock.
  const husky = cases[0]
  const worse = husky.h.branch('worse', { 'code.js': 'export const answer = 43\n' })
  writeFileSync(marker, '')
  const off = husky.h.gitEnv({ HUSKY: '0' }, 'update-ref', 'refs/heads/main', worse, husky.good)
  assert.notEqual(off.code, 0, 'HUSKY=0 switched off the lock')
  assert.match(off.err, /spec-lock: refused refs\/heads\/main/)
  assert.equal(marks(), '')
})

test('AC10: a push to a guarded remote branch is judged from the tip the remote advertised to the pushed commit, force pushes and other refspecs included', () => {
  const s = scratch()
  const a = s.init()
  // The bare remote stands in for GitHub: its own lock is off, so only the pre-push adapter judges.
  const remote = s.at('remote.git')
  mkdirSync(remote.repo)
  remote.ok('init', '-q', '--bare', '-b', 'main')
  remote.ok('config', `hook.${HOOK}.enabled`, 'false')
  s.ok('remote', 'add', 'origin', remote.repo)
  // The repository's own pre-push hook keeps the ref lines git hands the hooks, in order.
  const pushedFile = join(s.dir, 'pushed')
  s.write({ '.git/hooks/pre-push': `#!/bin/sh\ncat > '${pushedFile}'\n` })
  chmodSync(join(s.repo, '.git/hooks/pre-push'), 0o755)

  // A new remote branch holding what local main holds passes.
  const created = s.git('push', '-q', 'origin', 'main')
  assert.equal(created.code, 0, created.err)
  const proved = (name) => ({ [SPEC]: specText(['AC1']), [`docs/proof/${name}.md`]: proofText(SPEC, ['AC1']), [`${name}.js`]: 'export {}\n' })
  const r = s.branch('landed', proved('landed'))
  const ff = s.git('push', '-q', 'origin', 'landed:main')
  assert.equal(ff.code, 0, ff.err)
  assert.equal(remote.rev('main'), r)
  s.ok('merge', '-q', '--ff-only', 'landed')

  const b = s.branch('feature', code)
  // A free remote branch takes unproved code. Its name sorts before main, and git hands the hooks a
  // remote's existing refs in name order, so a later push of both lists main second.
  const aside = s.branch('aside', { 'aside.js': 'export {}\n' })
  const free = s.git('push', '-q', 'origin', 'aside')
  assert.equal(free.code, 0, free.err)
  assert.equal(remote.rev('aside'), aside)
  s.ok('switch', '-q', 'aside')
  s.commit({ 'aside.js': 'export const more = 1\n' })
  // Siblings of R: a push of either drops R from the remote main, so only a force push sends them.
  s.ok('switch', '-q', '-c', 'sibling', a)
  s.commit({ 'code.js': 'export const answer = 7\n' })
  s.ok('switch', '-q', '-c', 'proved-sibling', a)
  const e = s.commit(proved('sibling'))
  s.ok('switch', '-q', 'main')
  // The owner's escape moved local main to unproved code, past the local lock.
  s.unhooked('update-ref', 'refs/heads/main', b, r)

  const cases = {
    'main, moved past the local lock': ['main'],
    'feature to main': ['feature:main'],
    'force push of a tip that is not a descendant': ['--force', 'sibling:main'],
    'forced refspec of a tip that is not a descendant': ['+sibling:main'],
    // master is guarded and the remote has none, so the whole tree is new but for what local main holds.
    'a guarded branch new to the remote': ['sibling:master'],
    'two refs, main second': ['aside', 'feature:main'],
  }
  const allowed = []
  for (const [name, args] of Object.entries(cases)) {
    const p = s.git('push', '-q', 'origin', ...args)
    const ref = args.at(-1).endsWith(':master') ? 'refs/heads/master' : 'refs/heads/main'
    if (p.code === 0 || remote.rev('main') !== r || !new RegExp(`spec-lock: refused push to origin ${ref} \\S+\\.\\.[0-9a-f]{12}\n- no proof`).test(p.err)) allowed.push(`${name}: exit ${p.code}, remote main ${remote.rev('main') === r ? 'at R' : 'moved'}: ${p.err}`)
  }
  assert.deepEqual(allowed, [])
  assert.equal(remote.git('rev-parse', '--verify', '--quiet', 'refs/heads/master').code, 1)
  // Git handed the hooks the free branch first and main second, and the refused push sent neither.
  assert.deepEqual(readFileSync(pushedFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[2]), ['refs/heads/aside', 'refs/heads/main'])
  assert.equal(remote.rev('aside'), aside)

  // A proved tip that is not a descendant force-pushes.
  const forced = s.git('push', '-q', '--force', 'origin', 'proved-sibling:main')
  assert.equal(forced.code, 0, forced.err)
  assert.equal(remote.rev('main'), e)
})

test('AC20: the lock adds less than a second to a local landing, valid or refused', (t) => {
  const s = scratch()
  const a = s.init()
  const ranges = {
    valid: s.branch('valid', { ...code, [SPEC]: specText(['AC1', 'AC2']), 'docs/proof/x.md': proofText(SPEC, ['AC1', 'AC2']) }),
    invalid: s.branch('invalid', code),
  }
  const timed = (fn) => { const t0 = process.hrtime.bigint(); const r = fn(); return [Number(process.hrtime.bigint() - t0) / 1e6, r] }
  const median = (xs) => xs.sort((x, y) => x - y)[xs.length >> 1]
  const slow = []
  for (const [name, tip] of Object.entries(ranges)) {
    const on = []
    const off = []
    for (let i = 0; i < 3; i++) {
      const [locked, r] = timed(() => s.git('update-ref', 'refs/heads/main', tip, a))
      assert.equal(r.code === 0, name === 'valid', `${name} range: exit ${r.code} ${r.err}`)
      s.unhooked('update-ref', 'refs/heads/main', a)
      const [unlocked] = timed(() => s.unhooked('update-ref', 'refs/heads/main', tip, a))
      s.unhooked('update-ref', 'refs/heads/main', a)
      on.push(locked)
      off.push(unlocked)
    }
    const added = median(on) - median(off)
    t.diagnostic(`${name}: with the lock ${on.map(Math.round).join(', ')} ms, without ${off.map(Math.round).join(', ')} ms, median added ${Math.round(added)} ms, load ${loadavg()[0].toFixed(1)}`)
    if (added >= 1000) slow.push(`${name}: added ${Math.round(added)} ms`)
  }
  assert.deepEqual(slow, [])
})
