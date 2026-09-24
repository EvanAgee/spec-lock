#!/usr/bin/env node
// The live GitHub walk: node test/github-walk.mjs <owner/repo> [--integration <branch>]... [--no-land]
// The repository must be enrolled with bin/spec-lock-rollout: each protected branch has a ruleset that
// requires the branch's own spec-lock check from GitHub Actions and blocks force pushes, and the
// workflow runs every check on pushes to other branches. For the default branch and each integration
// branch named, the walk pushes candidates to land/* branches, waits for that branch's check, then
// pushes the candidate to the branch:
//   bad     unproved code on the branch                  check fails, push refused
//   good    the bad commit plus a spec and its proof     check passes, push lands
// and one forced candidate to the default branch:
//   forced  unproved code off the default tip's parent   check fails, force push refused
// With --no-land it pushes no good candidate, so nothing lands, and deletes its candidate branches
// afterwards: that is the probe for a real repository.
// It asserts each check job took under 60 seconds and reports queue delay beside it.
// It needs the gh CLI logged in. It prints the evidence as JSON and exits 1 when an assertion fails.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { lintSpec } from '../lib/spec.mjs'

const [repo, ...rest] = process.argv.slice(2)
const integration = rest.flatMap((a, i) => (rest[i - 1] === '--integration' ? [a] : []))
const land = !rest.includes('--no-land')
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || rest.some((a, i) => a !== '--no-land' && a !== '--integration' && rest[i - 1] !== '--integration')) {
  process.stderr.write('usage: node test/github-walk.mjs <owner/repo> [--integration <branch>]... [--no-land]\n')
  process.exit(2)
}

const run = (cmd, args, env) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env, timeout: 120000 })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}
const must = (r, what) => { if (r.code !== 0) throw new Error(`${what}: exit ${r.code}: ${r.err}`); return r.out }

// Git runs with a scratch HOME and global config: no hooks, no settings from this machine except
// the committer identity, and the gh CLI as the credential helper through GH_TOKEN.
const real = (key) => run('git', ['config', '--global', key], process.env).out
const token = must(run('gh', ['auth', 'token'], process.env), 'gh auth token')
const dir = mkdtempSync(join(tmpdir(), 'spec-lock-walk-'))
const config = join(dir, 'global.gitconfig')
writeFileSync(config, '')
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_|GH_|GITHUB_)/.test(k)))
Object.assign(env, { HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1', GH_TOKEN: token, SPEC_LOCK_LOG: join(dir, 'landings.log') })
for (const [key, value] of [['user.name', real('user.name')], ['user.email', real('user.email')], ['credential.https://github.com.helper', '!gh auth git-credential']]) {
  must(run('git', ['config', '--file', config, key, value], env), `set ${key}`)
}
const clone = join(dir, 'clone')
const git = (...args) => run('git', ['-C', clone, ...args], env)
const ok = (...args) => must(git(...args), `git ${args.join(' ')}`)
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
// The API drops a request now and then (a 502, an unexpected EOF), so each read gets three tries.
function api(path) {
  for (let tries = 1; ; tries++) {
    const r = run('gh', ['api', path], env)
    if (r.code === 0 || tries === 3) return JSON.parse(must(r, `gh api ${path}`))
    sleep(5000)
  }
}

must(run('git', ['clone', '-q', `https://github.com/${repo}.git`, clone], env), `git clone ${repo}`)
const def = ok('symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '')
const tipOf = (branch) => ok('ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0]
const stamp = Date.now().toString(36)
const WORKFLOW = '.github/workflows/spec-lock.yml'

// A commit of the given files on top of base, detached from any branch.
function commitOn(base, files, message) {
  ok('checkout', '-q', '--detach', base)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(clone, path)), { recursive: true })
    writeFileSync(join(clone, path), text)
  }
  ok('add', '-A')
  ok('commit', '-q', '-m', message)
  return ok('rev-parse', 'HEAD')
}

// Pushes sha to a candidate branch and waits up to five minutes for its job named name.
const candidates = []
function check(sha, branch, name) {
  ok('push', '-q', 'origin', `${sha}:refs/heads/${branch}`)
  candidates.push(branch)
  const deadline = Date.now() + 300000
  for (;;) {
    const runs = api(`repos/${repo}/actions/runs?head_sha=${sha}&event=push`).workflow_runs.filter((r) => r.head_branch === branch)
    const done = runs.find((r) => r.status === 'completed')
    if (done) {
      const job = api(`repos/${repo}/actions/runs/${done.id}/jobs`).jobs.find((j) => j.name === name)
      if (!job) throw new Error(`run ${done.html_url} has no ${name} job`)
      const seconds = (from, to) => (Date.parse(to) - Date.parse(from)) / 1000
      return {
        sha, branch, run: done.html_url, job: job.html_url, conclusion: job.conclusion,
        queuedSeconds: seconds(done.created_at, job.started_at), jobSeconds: seconds(job.started_at, job.completed_at),
      }
    }
    if (Date.now() > deadline) throw new Error(`no completed check for ${sha} on ${branch} after five minutes`)
    sleep(5000)
  }
}

// Pushes sha to a protected branch and reports the exit code, git's output and the branch's tip afterwards.
function push(sha, target, ...flags) {
  const r = git('push', ...flags, 'origin', `${sha}:refs/heads/${target}`)
  return { exit: r.code, output: r.err, tipAfter: tipOf(target) }
}

// A hardened spec and a proof naming each of its criteria, so a good candidate carries its own evidence.
const spec = `docs/specs/walk-${stamp}.md`
const specText = ['# Walk spec', ...['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions'].flatMap((s) => [
  `## ${s}`,
  s === 'Acceptance Criteria' ? '| AC | Requirement (EARS) | Red test | Observable | Judge |\n|---|---|---|---|---|\n| AC1 | When the walk pushes a proved candidate, the branch shall accept it. | the walk | the pushed branch | the walk |' : 'Text.',
])].join('\n\n') + '\n'
const { faults, ids } = lintSpec(specText)
if (faults.length) throw new Error(`the walk's spec is not hardened: ${faults.join('; ')}`)
const proof = `---\nspec: ${spec}\n---\n# Walk ${stamp}\n\nThe walk names ${ids.join(', ')}.\n`

const context = (branch) => (branch === def ? 'spec-lock' : `spec-lock ${branch}`)
const evidence = { repo, default: def, land, targets: {} }
const a = tipOf(def)
for (const [i, target] of [def, ...integration].entries()) {
  const t = (evidence.targets[target] = { tip: tipOf(target) })
  const b = commitOn(t.tip, { 'app.js': `export const walk = '${stamp}-${i}'\n` }, 'feat: change the app without a proof')
  t.bad = { ...check(b, `land/bad-${stamp}-${i}`, context(target)), push: push(b, target) }
  if (!land) continue
  const c = commitOn(b, { [spec]: specText, [`docs/proof/walk-${stamp}-${i}.md`]: proof }, 'docs(proof): prove the app change')
  t.good = { ...check(c, `land/good-${stamp}-${i}`, context(target)), push: push(c, target) }
}
// The forced candidate starts from the default tip's parent and carries the tip's workflow, so its check runs.
const parent = git('rev-parse', '--verify', '--quiet', `${a}^`).out
if (parent) {
  const d = commitOn(parent, { 'app.js': `export const forced = '${stamp}'\n`, [WORKFLOW]: ok('show', `${a}:${WORKFLOW}`) + '\n' }, 'feat: force an unproved change')
  evidence.forced = { ...check(d, `land/forced-${stamp}`, context(def)), push: push(d, def, '--force') }
} else evidence.forced = { skipped: `${def} at ${a} has no parent to force a sibling from` }
if (!land) for (const branch of candidates) must(git('push', '-q', 'origin', '--delete', branch), `delete ${branch}`)

// GitHub's refusal names the rule; the repository's URL in the same output may contain spec-lock too.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const failures = []
const expect = (cond, what) => { if (!cond) failures.push(what) }
for (const [target, t] of Object.entries(evidence.targets)) {
  const required = new RegExp(`Required status check "${escape(context(target))}"`)
  expect(t.bad.conclusion === 'failure', `the ${context(target)} check passed the unproved candidate`)
  expect(t.bad.push.exit !== 0 && t.bad.push.tipAfter === t.tip, `GitHub accepted the unproved push to ${target}`)
  expect(required.test(t.bad.push.output), `the refused push to ${target} does not name the ${context(target)} check`)
  if (!land) continue
  expect(t.good.conclusion === 'success', `the ${context(target)} check failed the proved candidate`)
  expect(t.good.push.exit === 0 && t.good.push.tipAfter === t.good.sha, `GitHub refused the proved push to ${target}`)
}
if (!evidence.forced.skipped) {
  const before = land ? evidence.targets[def].good.sha : a
  expect(evidence.forced.conclusion === 'failure', 'the check passed the forced unproved candidate')
  expect(evidence.forced.push.exit !== 0 && evidence.forced.push.tipAfter === before, `GitHub accepted the forced unproved push to ${def}`)
  expect(/Cannot force-push|Required status check "spec-lock"/.test(evidence.forced.push.output), 'the refused force push names neither the force-push rule nor the spec-lock check')
}
const jobs = [...Object.entries(evidence.targets).flatMap(([target, t]) => [[`${target} bad`, t.bad], [`${target} good`, t.good]]), ['forced', evidence.forced]]
for (const [name, c] of jobs) if (c?.jobSeconds !== undefined) expect(c.jobSeconds < 60, `the ${name} check job took ${c.jobSeconds} seconds`)
evidence.failures = failures
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n')
process.exit(failures.length ? 1 : 0)
