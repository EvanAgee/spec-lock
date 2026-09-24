// Times the lock on a real repository without changing it. Each sample runs `spec-lock check <old> <new>`
// alone, then the git adapter the way git runs it for a move of main from old to new: preparing, prepared,
// then committed (or aborted after a refusal). The adapter's total is the time the lock adds to that landing.
// The adapter's HOME, which holds the central file, and its landing log go to a scratch directory,
// and a fast-forward leaves no pending move, so nothing is written to the repository. Pick a pair
// where old is an ancestor of new.
// Run: node test/time-check.mjs <repository> <old> <new> [samples]
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { cpus, loadavg, tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin')
const [repo, old, neu, samples = '5'] = process.argv.slice(2)
const scratch = mkdtempSync(join(tmpdir(), 'spec-lock-time-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_)/.test(k)))
Object.assign(env, { HOME: scratch, SPEC_LOCK_LOG: join(scratch, 'landings.log') })

const run = (cmd, args, input = '') => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(cmd, args, { cwd: repo, env, input, encoding: 'utf8' })
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, code: r.status, first: `${r.stdout}${r.stderr}`.split('\n')[0] }
}
const hook = (state) => run(join(BIN, 'spec-lock-hook'), ['reference-transaction', state], `${old} ${neu} refs/heads/main\n`)
const median = (xs) => [...xs].sort((x, y) => x - y)[xs.length >> 1]

console.log(`${cpus().length} cpus; ${old.slice(0, 12)}..${neu.slice(0, 12)}`)
const checks = []
const added = []
for (let i = 1; i <= Number(samples); i++) {
  const load = loadavg()[0].toFixed(1)
  const check = run('node', [join(BIN, 'spec-lock'), 'check', old, neu])
  const steps = [hook('preparing'), hook('prepared')]
  steps.push(hook(steps[1].code === 0 ? 'committed' : 'aborted'))
  const total = steps.reduce((sum, s) => sum + s.ms, 0)
  checks.push(check.ms)
  added.push(total)
  console.log(`sample ${i}, load ${load}: check ${Math.round(check.ms)} ms, exit ${check.code}, "${check.first}"; adapter ${steps.map((s) => Math.round(s.ms)).join(' + ')} = ${Math.round(total)} ms, prepared exit ${steps[1].code}`)
}
console.log(`median: check ${Math.round(median(checks))} ms, adapter (added to the landing) ${Math.round(median(added))} ms`)
rmSync(scratch, { recursive: true, force: true })
