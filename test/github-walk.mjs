#!/usr/bin/env node
// The live GitHub walk for AC14 and AC21: node test/github-walk.mjs <owner/repo>
// The repository must be a throwaway whose main requires the spec-lock check from GitHub Actions,
// with force pushes allowed, and whose workflow runs the check on pushes to every other branch.
// Its main must hold docs/specs/canary.md, a hardened spec. The walk pushes three candidates to
// land/* branches, waits for each check, then pushes the candidate to main:
//   bad    unproved code on main                  check fails, push refused
//   good   the bad commit plus a complete proof    check passes, push lands
//   forced unproved code off an older main        check fails, force push refused
// It asserts each check job took under 60 seconds and reports queue delay beside it.
// It needs the gh CLI logged in. It prints the evidence as JSON and exits 1 when an assertion fails.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { lintSpec } from '../lib/spec.mjs'

const repo = process.argv[2]
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) {
  process.stderr.write('usage: node test/github-walk.mjs <owner/repo>\n')
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
Object.assign(env, { HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1', GH_TOKEN: token, SPEC_LOCK_CONFIG: join(dir, 'spec-lock.config'), SPEC_LOCK_LOG: join(dir, 'landings.log') })
for (const [key, value] of [['user.name', real('user.name')], ['user.email', real('user.email')], ['credential.https://github.com.helper', '!gh auth git-credential']]) {
  must(run('git', ['config', '--file', config, key, value], env), `set ${key}`)
}
const clone = join(dir, 'canary')
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
const a = ok('rev-parse', 'origin/main')
const remoteMain = () => ok('ls-remote', 'origin', 'refs/heads/main').split('\t')[0]
const stamp = Date.now().toString(36)

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

// Pushes sha to a candidate branch and waits up to five minutes for its spec-lock check job.
function check(sha, branch) {
  ok('push', '-q', 'origin', `${sha}:refs/heads/${branch}`)
  const deadline = Date.now() + 300000
  for (;;) {
    const runs = api(`repos/${repo}/actions/runs?head_sha=${sha}&event=push`).workflow_runs.filter((r) => r.head_branch === branch)
    const done = runs.find((r) => r.status === 'completed')
    if (done) {
      const job = api(`repos/${repo}/actions/runs/${done.id}/jobs`).jobs.find((j) => j.name === 'spec-lock')
      if (!job) throw new Error(`run ${done.html_url} has no spec-lock job`)
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

// Pushes sha to main and reports the exit code, git's output and main's tip afterwards.
function land(sha, ...flags) {
  const r = git('push', ...flags, 'origin', `${sha}:refs/heads/main`)
  return { exit: r.code, output: r.err, mainAfter: remoteMain() }
}

const spec = 'docs/specs/canary.md'
const { faults, ids } = lintSpec(readFileSync(join(clone, spec), 'utf8'))
if (faults.length) throw new Error(`${spec} is not hardened: ${faults.join('; ')}`)
const proof = `---\nspec: ${spec}\n---\n# Walk ${stamp}\n\nThe walk names ${ids.join(', ')}.\n`

const evidence = { repo, main: a }
const b = commitOn(a, { 'app.js': `export const walk = '${stamp}'\n` }, 'feat: change the app without a proof')
evidence.bad = { ...check(b, `land/bad-${stamp}`), push: land(b) }
const c = commitOn(b, { [`docs/proof/walk-${stamp}.md`]: proof }, 'docs(proof): prove the app change')
evidence.good = { ...check(c, `land/good-${stamp}`), push: land(c) }
const d = commitOn(a, { 'app.js': `export const forced = '${stamp}'\n` }, 'feat: force an unproved change')
evidence.forced = { ...check(d, `land/forced-${stamp}`), push: land(d, '--force') }

const failures = []
const expect = (cond, what) => { if (!cond) failures.push(what) }
expect(evidence.bad.conclusion === 'failure', 'the check passed the unproved candidate')
expect(evidence.bad.push.exit !== 0 && evidence.bad.push.mainAfter === a, 'GitHub accepted the unproved push to main')
expect(/spec-lock/.test(evidence.bad.push.output), 'the refused push does not name the spec-lock check')
expect(evidence.good.conclusion === 'success', 'the check failed the proved candidate')
expect(evidence.good.push.exit === 0 && evidence.good.push.mainAfter === c, 'GitHub refused the proved push to main')
expect(evidence.forced.conclusion === 'failure', 'the check passed the forced unproved candidate')
expect(evidence.forced.push.exit !== 0 && evidence.forced.push.mainAfter === c, 'GitHub accepted the forced unproved push to main')
expect(/spec-lock/.test(evidence.forced.push.output), 'the refused force push does not name the spec-lock check')
for (const name of ['bad', 'good', 'forced']) expect(evidence[name].jobSeconds < 60, `the ${name} check job took ${evidence[name].jobSeconds} seconds`)
evidence.failures = failures
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n')
process.exit(failures.length ? 1 : 0)
