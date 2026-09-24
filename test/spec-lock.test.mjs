// Fixture tests for spec-lock. Every repository is synthetic, built in a temp directory, with a
// scratch global git config; nothing touches the real global config or a real repository.
// Run: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, renameSync, symlinkSync, rmSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register, HOOK } from '../lib/lock.mjs'

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

// A scratch directory with its own global git config, central spec-lock config, landing log and HOME.
// scratch() works in its "repo" directory; s.at(name) gives the same helpers for another directory.
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'spec-lock-test-'))
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
      unhooked: (...args) => s.ok('-c', `hook.${HOOK}.enabled=false`, ...args),
      ok(...args) { const r = s.git(...args); assert.equal(r.code, 0, `git ${args.join(' ')}: ${r.err}`); return r.out.trim() },
      rev: (ref) => s.ok('rev-parse', ref),
      check: (old, neu) => run('node', [CLI, 'check', old, neu]),
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
    up.ok('push', '-q', 'origin', 'main')
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
