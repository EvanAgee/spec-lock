// The landing rule over committed objects: what an old-to-new move of a protected branch must carry.
// Everything is read from the object store, never the working tree, so only committed work counts.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintSpec, missingIds } from './spec.mjs'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin')
export const HOOK = 'spec-lock-reference-transaction'
export const PUSH_HOOK = 'spec-lock-pre-push'
const ZERO = /^0+$/
const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/
// A proof sits directly in docs/proof/; a .md file in a folder below it is documentation.
const PROOF = /^docs\/proof\/[^/]+\.md$/
// Documentation: a path under docs/ or ending in .md.
const isDoc = (path) => path.startsWith('docs/') || path.endsWith('.md')

const git = (...args) => execFileSync('git', ['--literal-pathspecs', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 })
const short = (oid) => (oid ? oid.slice(0, 12) : '(none)')
const lines = (text) => text.split('\n').filter(Boolean)

function commit(oid) {
  try { return git('rev-parse', '--verify', '--quiet', '--end-of-options', `${oid}^{commit}`).trim() } catch { throw new Error(`cannot read object ${oid}`) }
}

// The tree entry at path in rev, or null when the path is not there.
function entry(rev, path) {
  const line = git('ls-tree', '--full-tree', '-z', rev, '--', path).split('\0')[0]
  const m = /^(\d+) (\w+) (\w+)\t(.*)$/s.exec(line)
  return m && m[4] === path ? { mode: m[1], type: m[2], oid: m[3] } : null
}
const regular = (e) => e.type === 'blob' && (e.mode === '100644' || e.mode === '100755')

function read(e, path, rev) {
  try { return git('cat-file', 'blob', e.oid) } catch { throw new Error(`cannot read object ${e.oid} (${path} in ${short(rev)})`) }
}

// A front-matter field of a proof: its value, '' when it is empty, or null when the proof has none.
function field(text, name) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  const m = front && new RegExp(`^${name}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(front[1])
  return m ? m[1].replace(/^(['"])(.*)\1$/, '$2') : null
}

// The live AC ids of the spec a proof names, or the faults that stop us from reading them.
function specOf(rev, path, text) {
  const spec = field(text, 'spec')
  if (!spec) return { faults: [`${path}: no spec: field in its front matter`] }
  const rel = posix.normalize(spec)
  if (rel.startsWith('/') || rel === '.' || rel.split('/')[0] === '..') return { faults: [`${path}: spec ${spec} is not a path inside the repository`] }
  const e = entry(rev, rel)
  if (!e) return { faults: [`${path}: spec ${spec} is not in the landed commit`] }
  if (!regular(e)) return { faults: [`${path}: spec ${spec} is not a regular file`] }
  const { faults, ids } = lintSpec(read(e, rel, rev))
  return faults.length ? { faults: faults.map((f) => `${path}: spec ${spec}: ${f}`) } : { spec, ids }
}

function proofFaults(rev, path, e) {
  if (!regular(e)) return [`${path}: not a regular file`]
  const text = read(e, path, rev)
  const s = specOf(rev, path, text)
  if (s.faults) return s.faults
  const missing = missingIds(s.ids, text)
  const faults = missing.length ? [`${path}: does not name ${missing.join(', ')} from ${s.spec}`] : []
  // The evidence binding is optional: a proof without an evidence: field is judged as before.
  const evidence = field(text, 'evidence')
  return evidence === null ? faults : [...faults, ...evidenceFaults(rev, evidence, `${path}: evidence ${evidence}`)]
}

// A repository path with no empty, "." or ".." segment, and one that is also under docs/proof/.
const inRepo = (p) => typeof p === 'string' && p.split('/').every((s) => s && s !== '.' && s !== '..')
const underProof = (p) => inRepo(p) && p.startsWith('docs/proof/')
const show = (v) => JSON.stringify(v) ?? 'nothing'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const blob = (oid) => execFileSync('git', ['cat-file', 'blob', oid], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 })
// A full commit id that names a commit here: never a prefix, a tag or another object.
const isCommit = (v) => typeof v === 'string' && OID.test(v) && current(`${v}^{commit}`) === v
function ancestor(a, b) {
  try { git('merge-base', '--is-ancestor', a, b); return true } catch (e) { if (e.status === 1) return false; throw e }
}

// The evidence binding a proof names, version 1 of the format in README.md, checked against the
// landed commit P from committed objects alone. Each fault after `where` names the manifest field.
// Who ran or judged anything cannot be known here: executor and judge are copies for reading, and
// the caller that holds the run records checks them.
function evidenceFaults(P, path, where) {
  if (!underProof(path)) return [`${where} is not a path under docs/proof/`]
  const e = entry(P, path)
  if (!e || !regular(e)) return [`${where} is not a regular file in the landed commit`]
  const text = read(e, path, P)
  let m
  try { m = JSON.parse(text) } catch { return [`${where} is not a JSON object`] }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return [`${where} is not a JSON object`]
  if (m.version !== 1) return [`${where}: version: ${show(m.version)} is not 1`]
  const C = m.reviewed
  if (!isCommit(C)) return [`${where}: reviewed: ${show(C)} is not a full commit id in this repository`]
  const out = []
  const bad = (f, msg) => out.push(`${where}: ${f}: ${msg}`)
  if (!isCommit(m.base) || !ancestor(m.base, C)) bad('base', `${show(m.base)} is not a full commit id of an ancestor of the reviewed commit ${C}`)
  if (!ancestor(C, P)) bad('reviewed', `${C} is not the landed commit ${P} or an ancestor of it`)
  else changedAfter(C, P, bad)
  const list = (name) => {
    if (Array.isArray(m[name])) return m[name]
    bad(name, 'is not a list')
    return []
  }
  const x = { C, P, base: m.base, runs: list('runs'), judges: list('judges'), bad }
  const claims = list('claims')
  if (Array.isArray(m.claims) && claims.length === 0) bad('claims', 'is empty')
  claims.forEach((c, i) => claimFaults(c, `claims[${i}]`, x))
  return out
}

// Exact identity, not ancestry: after C, the landed commit may only add or edit regular proof files.
function changedAfter(C, P, bad) {
  // Raw diff-tree records: ":<old mode> <new mode> <old oid> <new oid> <status>", then the path.
  const diff = git('diff-tree', '-r', '-z', '--no-renames', C, P).split('\0')
  for (let i = 0; i + 1 < diff.length; i += 2) {
    const [, mode, , , status] = diff[i].split(' ')
    const p = diff[i + 1]
    if (!['A', 'M'].includes(status) || mode !== '100644' || !underProof(p)) {
      bad('reviewed', `${p} changed after the reviewed commit ${C}; after it, only regular files under docs/proof/ may be added or edited`)
    }
  }
}

// One claim: its spec and criterion at C, and the one run and one judge it names.
function claimFaults(c, at, x) {
  const { C, bad } = x
  if (!c || typeof c !== 'object') { bad(at, 'is not an object'); return }
  const s = inRepo(c.spec) && entry(C, c.spec)
  if (!s || !regular(s)) bad(`${at}.spec`, `${show(c.spec)} is not a regular file at the reviewed commit ${C}`)
  else {
    if (c.spec_blob !== s.oid) bad(`${at}.spec_blob`, `${show(c.spec_blob)} is not the blob of ${c.spec} at ${C}, ${s.oid}`)
    if (!lintSpec(read(s, c.spec, C)).ids.includes(c.ac)) bad(`${at}.ac`, `${show(c.ac)} is not a live criterion of ${c.spec}`)
  }
  // The index of the one entry the claim's run or judge id names, or -1.
  const one = (name, entries) => {
    if (typeof c[name] !== 'string' || !c[name]) { bad(`${at}.${name}`, `names no ${name}`); return -1 }
    const found = entries.flatMap((y, k) => (y?.id === c[name] ? [k] : []))
    if (found.length !== 1) bad(`${at}.${name}`, `${c[name]} names ${found.length} entries in ${name}s, not one`)
    return found.length === 1 ? found[0] : -1
  }
  const r = one('run', x.runs)
  const j = one('judge', x.judges)
  if (r >= 0) runFaults(x.runs[r], `runs[${r}]`, x)
  if (j >= 0) judgeFaults(x.judges[j], `judges[${j}]`, c, x.runs[r], x)
  if (c.state !== 'supported') bad(`${at}.state`, `the claim for ${show(c.ac)} is ${show(c.state)}, not supported`)
}

// A claimed run: exited 0 on C, with its output committed as exactly the recorded bytes.
function runFaults(run, rat, { C, P, bad }) {
  if (run.revision !== C) bad(`${rat}.revision`, `run ${run.id} ran on ${show(run.revision)}, not the reviewed commit ${C}`)
  if (run.outcome !== 'exited') bad(`${rat}.outcome`, `run ${run.id} ended ${show(run.outcome)}, not exited`)
  if (run.exit !== 0) bad(`${rat}.exit`, `run ${run.id} exited ${show(run.exit)}, not 0`)
  // An empty stream is a zero-length file, and it must be there.
  for (const stream of ['stdout', 'stderr']) {
    const o = run[stream]
    const sat = `${rat}.${stream}`
    if (!o || typeof o !== 'object') { bad(sat, `run ${run.id} has no committed ${stream}`); continue }
    const f = underProof(o.path) && entry(P, o.path)
    if (!f || !regular(f)) { bad(`${sat}.path`, `${show(o.path)} is not a regular file under docs/proof/ in the landed commit`); continue }
    const bytes = blob(f.oid)
    if (bytes.length !== o.bytes) bad(`${sat}.bytes`, `${o.path} holds ${bytes.length} bytes, not ${show(o.bytes)}`)
    if (sha256(bytes) !== o.sha256) bad(`${sat}.sha256`, `${o.path} has sha256 ${sha256(bytes)}, not ${show(o.sha256)}`)
  }
}

// A claimed judge: of this run and criterion, on C against the manifest's base, over the run's own
// output digests, and supported.
function judgeFaults(judge, jat, c, run, { C, base, bad }) {
  if (judge.run !== c.run) bad(`${jat}.run`, `judge ${judge.id} judged run ${show(judge.run)}, not ${c.run}`)
  if (judge.ac !== c.ac) bad(`${jat}.ac`, `judge ${judge.id} judged ${show(judge.ac)}, not ${show(c.ac)}`)
  if (judge.revision !== C) bad(`${jat}.revision`, `judge ${judge.id} judged ${show(judge.revision)}, not the reviewed commit ${C}`)
  if (judge.base !== base) bad(`${jat}.base`, `judge ${judge.id} reviewed against ${show(judge.base)}, not the manifest's base ${show(base)}`)
  if (run && (judge.evidence?.stdout_sha256 !== run.stdout?.sha256 || judge.evidence?.stderr_sha256 !== run.stderr?.sha256)) {
    bad(`${jat}.evidence`, `judge ${judge.id} compared other output than run ${run.id} records`)
  }
  if (judge.verdict !== 'supported') bad(`${jat}.verdict`, `judge ${judge.id} found ${show(c.ac)} ${show(judge.verdict)}, not supported`)
}

// Paths whose content differs between two commits, deleted and renamed-away paths included.
const changes = (from, to) => git('diff-tree', '-r', '-z', '--name-only', '--no-renames', from, to).split('\0').filter(Boolean)

// Tips of the refs matching the given for-each-ref patterns; a symbolic ref gives its target's tip.
const tips = (...patterns) => lines(git('for-each-ref', '--format=%(objectname)', ...patterns))

// Faults that refuse moving a protected branch from old to neu; empty means the move may land.
// old is null or all zeros when the branch does not exist yet, so the whole tree is compared.
// A path whose landed content already matches a known tip is not part of the landing: the tip of
// every remote's default branch always counts (a pull brings nothing new), and the adapter adds more.
// Throws when an object cannot be read, which callers must treat as a refusal.
export function checkRange(old, neu, known = []) {
  if (ZERO.test(neu)) return [] // a deletion lands nothing
  const to = commit(neu)
  const from = old && !ZERO.test(old) ? commit(old) : git('hash-object', '-t', 'tree', '/dev/null').trim()
  // A plain tree diff, not a merge-base range: deleted and renamed-away paths count as changes too.
  let changed = changes(from, to)
  for (const tip of [...tips('refs/remotes/*/HEAD'), ...known]) {
    if (changed.length === 0) break
    const differs = new Set(changes(commit(tip), to))
    changed = changed.filter((p) => differs.has(p))
  }
  if (changed.length === 0) return []
  // Only proofs this landing adds or edits count; one already on the branch cannot vouch for new code.
  const proofs = changed.filter((p) => PROOF.test(p)).map((p) => [p, entry(to, p)]).filter(([, e]) => e)
  if (proofs.length === 0) return changed.every(isDoc) ? [] : ['no proof: this code landing adds or edits no docs/proof/*.md file']
  // Each proof answers to its own spec; text from one proof never fills a gap in another.
  return proofs.flatMap(([p, e]) => proofFaults(to, p, e))
}

function current(ref) {
  try { return git('rev-parse', '--verify', '--quiet', ref).trim() } catch { return null }
}

const ZEROS = '0'.repeat(40)
export const logFile = () => process.env.SPEC_LOCK_LOG || join(homedir(), '.local', 'state', 'spec-lock', 'landings.log')
// Moves that passed prepared and leave a tip behind; the committed state keeps each tip once its
// move has happened. Every prepared state replaces the list, so a move that never happened is dropped.
const pendingFile = () => join(git('rev-parse', '--path-format=absolute', '--git-common-dir').trim(), 'spec-lock-pending')
function setPending(file, moves) {
  if (moves.length) writeFileSync(file, moves.map((m) => m.join(' ') + '\n').join(''))
  else rmSync(file, { force: true })
}

// One tab-separated line per checked move: time, repository, ref, old, new, verdict.
function log(repo, ref, old, neu, verdict) {
  mkdirSync(dirname(logFile()), { recursive: true })
  appendFileSync(logFile(), `${new Date().toISOString()}\t${repo}\t${ref}\t${old || ZEROS}\t${neu}\t${verdict}\n`)
}

// The reference-transaction adapter. The shell hook passes only updates of guarded branches, one
// "<old> <new> <ref>" line each, with the repository and the names of every guarded branch.
// In the prepared state it returns the refusal lines to print; empty means every update may land.
// In the committed state it keeps each tip a landing left behind reachable under refs/spec-lock/kept/.
export function referenceTransaction(state, input, repo, guarded = []) {
  const updates = lines(input).map((line) => line.split(' '))
  return state === 'committed' ? committed(repo) : prepared(updates, repo, guarded)
}

function prepared(updates, repo, guarded) {
  const out = []
  const pending = []
  for (const [old, neu, ref] of updates) {
    if (!OID.test(old) || !OID.test(neu)) {
      out.push(`spec-lock: refused ${ref}`, `- ${ref} can only be updated to a commit, not ${neu}`)
      continue
    }
    // Git sends zeros as old for an update that names no old value, so read what the branch holds now.
    const base = ZERO.test(old) ? current(ref) : old
    // Deletions pass: git pack-refs, and so gc, deletes each loose ref after packing it.
    if (ZERO.test(neu)) { if (base) pending.push([ref, base, neu]); continue }
    if (base === neu) continue
    let faults
    if (base) faults = checkRange(base, neu)
    // A repository's first commit has nothing to be checked against. A branch created where
    // history exists is compared with the empty tree, and content already on a guarded branch,
    // or kept from one, is not new; so a deleted and recreated branch cannot claim its old proofs.
    else if (git('for-each-ref', '--count=1', '--format=x') === '') faults = []
    else faults = checkRange(null, neu, [...tips('refs/spec-lock/kept'), ...guardedTips(guarded)])
    log(repo, ref, base, neu, faults.length ? 'refused' : 'allowed')
    if (faults.length) out.push(`spec-lock: refused ${ref} ${short(base)}..${short(neu)}`, ...faults.map((f) => `- ${f}`))
    else if (base && git('rev-list', '--count', `${neu}..${base}`).trim() !== '0') pending.push([ref, base, neu])
  }
  setPending(pendingFile(), out.length ? [] : pending)
  return out
}

// The pre-push adapter. The shell hook passes only pushes to guarded remote branches, one
// "<local ref> <local oid> <remote ref> <remote oid>" line each. Each is judged as the move the remote
// would make, from the tip it advertised to the pushed commit, so a force push, a tip that is not a
// descendant, and another branch pushed to main are all checked like a local landing.
// Returns the refusal lines to print; empty means the push may go.
export function prePush(remote, input, guarded = []) {
  const out = []
  for (const [, neu, ref, old] of lines(input).map((line) => line.split(' '))) {
    if (ZERO.test(neu)) continue // a deletion lands nothing
    // A branch new to the remote is compared with the empty tree, less what a guarded branch here holds.
    const faults = ZERO.test(old) ? checkRange(null, neu, [...tips('refs/spec-lock/kept'), ...guardedTips(guarded)]) : checkRange(old, neu)
    if (faults.length) out.push(`spec-lock: refused push to ${remote} ${ref} ${short(ZERO.test(old) ? null : old)}..${short(neu)}`, ...faults.map((f) => `- ${f}`))
  }
  return out
}

// Tips of the guarded branches that exist, matched by exact name: a for-each-ref pattern would
// also match a free branch below it, such as master/wip.
function guardedTips(guarded) {
  const names = new Set(guarded.map((b) => `refs/heads/${b}`))
  return lines(git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads')).map((l) => l.split(' ')).filter(([r]) => names.has(r)).map(([, oid]) => oid)
}

function committed(repo) {
  const file = pendingFile()
  let text = ''
  try { text = readFileSync(file, 'utf8') } catch (e) { if (e.code !== 'ENOENT') throw e }
  const waiting = []
  for (const move of new Set(lines(text))) {
    const [ref, old, neu] = move.split(' ')
    // A delete of a packed ref commits a nested transaction first, while the loose ref still stands,
    // and pack-refs "deletes" a ref it has just packed; neither has happened yet.
    const now = current(ref)
    if (ZERO.test(neu) ? now : now !== neu) { waiting.push(move.split(' ')); continue }
    git('update-ref', `refs/spec-lock/kept/${old}`, old)
    if (ZERO.test(neu)) log(repo, ref, old, neu, 'deleted')
  }
  setPending(file, waiting)
  return []
}

// Adds the shared hooks to a git config file, or to the global config when none is named, one
// friendly name per event, so a single command can switch either off:
// git -c hook.spec-lock-reference-transaction.enabled=false <command>
export function register(configFile, binDir = BIN) {
  const quoted = `'${join(binDir, 'spec-lock-hook').replace(/'/g, `'\\''`)}'`
  const where = configFile ? ['--file', configFile] : ['--global']
  for (const [name, event] of [[HOOK, 'reference-transaction'], [PUSH_HOOK, 'pre-push']]) {
    execFileSync('git', ['config', ...where, `hook.${name}.command`, `${quoted} ${event}`])
    execFileSync('git', ['config', ...where, `hook.${name}.event`, event])
  }
}
