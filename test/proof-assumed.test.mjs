// docs/specs/2026-10-21-proof-assumed.md: a proof dated on or after the go-live date must say what
// the builder assumed. Every repository is synthetic, with a scratch HOME and global git config.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSUMED_FROM, register } from '../lib/lock.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI = join(ROOT, 'bin', 'spec-lock')
const dir = mkdtempSync(join(tmpdir(), 'spec-lock-assumed-'))
after(() => rmSync(dir, { recursive: true, force: true }))
const repo = join(dir, 'repo')
const config = join(dir, 'global.gitconfig')
writeFileSync(config, '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n')
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|FM_|SPEC_LOCK_)/.test(k)))
Object.assign(env, { HOME: dir, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1', SPEC_LOCK_LOG: join(dir, 'landings.log') })
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: repo, env, encoding: 'utf8', timeout: 30000 }); return { code: r.status, out: r.stdout + r.stderr } }
const ok = (...args) => { const r = run('git', args); assert.equal(r.code, 0, r.out); return r.out.trim() }

const spec = ['# Value', '## Problem Statement', 'Text.', '## Seams', 'Text.', '## Acceptance Criteria',
  '| AC | Requirement (EARS) | Red test | Observable | Judge |\n|---|---|---|---|---|\n| AC1 | When the program runs, the program shall print value=14. | a red test | its output | the fixture |',
  '## End-to-end verification', 'Text.', '## Non-goals', 'Text.', '## Open questions', 'Text.'].join('\n\n') + '\n'
const proof = (date, assumed = '') => `---\nspec: docs/specs/value.md\ndate: ${date}\n---\n# Proof\n\n## What I walked\n\nAC1 printed value=14.\n${assumed}`
const dayBefore = new Date(Date.parse(`${ASSUMED_FROM}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

mkdirSync(repo)
ok('init', '-q', '-b', 'main')
writeFileSync(join(repo, 'value.mjs'), 'export const value = 0\n')
ok('add', '-A'); ok('commit', '-q', '-m', 'test: base')
const base = ok('rev-parse', 'HEAD')
// A landing from base, or from the given commit: code unless code is false, the spec, and the proof.
function landing(text, { from = base, code = true } = {}) {
  ok('switch', '-q', '--detach', from)
  mkdirSync(join(repo, 'docs/specs'), { recursive: true }); mkdirSync(join(repo, 'docs/proof'), { recursive: true })
  if (code) writeFileSync(join(repo, 'value.mjs'), `export const value = ${from === base ? 14 : 15}\n`)
  writeFileSync(join(repo, 'docs/specs/value.md'), spec)
  writeFileSync(join(repo, 'docs/proof/value.md'), text)
  ok('add', '-A'); ok('commit', '-q', '-m', 'test: landing')
  const tip = ok('rev-parse', 'HEAD')
  return Object.assign(run('node', [CLI, 'check', from, tip]), { tip })
}
const refusedForSection = (r) => {
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /- docs\/proof\/value\.md: no "## What I assumed" section/)
}
const passes = (r) => { assert.equal(r.code, 0, r.out); assert.match(r.out, /^spec-lock: ok$/m) }

test('AC1: a proof dated on or after go-live with no What I assumed section, or a blank one, is refused', () => {
  refusedForSection(landing(proof(ASSUMED_FROM)))
  refusedForSection(landing(proof(`'${ASSUMED_FROM}'`)))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n   \n\n## Review\n\nTwo rounds.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n```\nNone.\n```\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\r\n## What I assumed\r\n\r\n```\r\nNone.\r\n```\r\n')))
  // A heading of another form ends the section too.
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n   ## Review\n\nTwo rounds.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\nReview\n------\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n### What I assumed\n\nNone.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n# Next\n\nText.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\nWhat I assumed\n---\n\n')))
  // A line that continues a paragraph joins it, so the heading is the whole paragraph.
  refusedForSection(landing(proof(ASSUMED_FROM, '\nAC1 ok.\nWhat I assumed\n---\nNone.\n')))
  // A fence between a line and an underline keeps them apart, so they make no heading.
  refusedForSection(landing(proof(ASSUMED_FROM, '\nWhat I assumed\n```\nx\n```\n---\nNone.\n')))
  // A line indented by a tab is code, so it makes no heading either.
  refusedForSection(landing(proof(ASSUMED_FROM, '\n\tWhat I assumed\n---\nNone.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n  \tWhat I assumed\n---\nNone.\n')))
  // An edited proof, and a landing of documentation alone, are checked the same way.
  const earlier = landing(proof(dayBefore)).tip
  refusedForSection(landing(proof(ASSUMED_FROM), { from: earlier }))
  refusedForSection(landing(proof(ASSUMED_FROM), { code: false }))
  // The Git hook refuses the same move and leaves main where it was.
  const tip = landing(proof(ASSUMED_FROM)).tip
  ok('switch', '-q', 'main')
  register(join(repo, '.git', 'config'))
  const r = run('git', ['update-ref', 'refs/heads/main', tip])
  assert.notEqual(r.code, 0, r.out)
  assert.match(r.out, /- docs\/proof\/value\.md: no "## What I assumed" section/)
  assert.equal(ok('rev-parse', 'main'), base)
})

test('AC2: a proof whose What I assumed section says None passes, and the same proof without the line is refused', () => {
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\nNone.\n')))
  refusedForSection(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n')))
  // Other spellings of the same section.
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\nNone.\n').replace(/\n/g, '\r\n')))
  passes(landing(proof(ASSUMED_FROM, '\n  ## what i assumed ##\n\nNone.\n')))
  passes(landing(proof(ASSUMED_FROM, '\nWhat I assumed\n--------------\n\nNone.\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n### Marked for the owner\n\n- The default page size is 50.\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n- None\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n\tNone\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n    None\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n> None\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n1. None\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\n\n---\n---\n')))
  passes(landing(proof(ASSUMED_FROM, '\n## What I assumed\nFoo\n```\nc\n```\n---\n')))
})

test('AC3: a proof dated before go-live passes without the section, and the same proof dated go-live is refused', () => {
  passes(landing(proof(dayBefore)))
  refusedForSection(landing(proof(ASSUMED_FROM)))
  refusedForSection(landing(proof('2027-01-01')))
})

test('AC4: the README rule section states the section rule and where the go-live date is set', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const rule = readme.slice(readme.indexOf('## The rule'), readme.indexOf('## Evidence bindings'))
  for (const text of ['## What I assumed', 'on or after the go-live date', 'line that is not blank', '`None` counts', 'ASSUMED_FROM', ASSUMED_FROM]) assert.ok(rule.includes(text), `the rule section does not mention ${text}`)
})
