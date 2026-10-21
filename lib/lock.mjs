// The landing rule over committed objects: what an old-to-new move of a protected branch must carry.
// Everything is read from the object store, never the working tree, so only committed work counts.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { portableFaults, approvalFault, runDigest } from './portable.mjs'
import { ownerPolicy, afterReview } from './policy.mjs'
import { semanticFaults } from './semantic.mjs'
import { lintSpec, missingIds, unfenced } from './spec.mjs'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin')
export const HOOK = 'spec-lock-reference-transaction'
export const PUSH_HOOK = 'spec-lock-pre-push'
const ZERO = /^0+$/
const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/
// A proof sits directly in docs/proof/; a .md file in a folder below it is documentation.
const PROOF = /^docs\/proof\/[^/]+\.md$/
// Documentation: a path under docs/ or ending in .md.
const isDoc = (path) => path.startsWith('docs/') || path.endsWith('.md')
// The go-live date of the "What I assumed" rule: a proof dated on or after it must say what the
// builder assumed. One constant, so the hooks, the CLI and the GitHub action agree.
export const ASSUMED_FROM = '2026-10-22'

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

// An ATX heading, a setext underline, and the start of a line that cannot be setext heading text:
// an indented code line, a list item, a quote, or an underline itself.
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const UNDER = /^ {0,3}(=+|-+)[ \t]*$/
const NOT_TEXT = /^( {0,3}\t| {4}| {0,3}([-+*]|\d{1,9}[.)])([ \t]|$)| {0,3}>)/
// The Markdown heading starting at line i, ATX or setext, or null. Setext text must start a
// paragraph: a line that continues one joins it, and the heading is then the whole paragraph.
function heading(lines, i) {
  const atx = ATX.exec(lines[i])
  if (atx) return { level: atx[1].length, text: atx[2] ?? '', setext: false }
  const under = UNDER.exec(lines[i + 1] ?? '')
  const starts = i === 0 || !lines[i - 1].trim() || ATX.test(lines[i - 1]) || UNDER.test(lines[i - 1])
  if (under && starts && lines[i].trim() && !NOT_TEXT.test(lines[i]) && !UNDER.test(lines[i])) return { level: under[1][0] === '=' ? 1 : 2, text: lines[i], setext: true }
  return null
}

// True when the proof is dated before ASSUMED_FROM, has no date in YYYY-MM-DD form, or holds a
// "What I assumed" level-two section, outside code fences, with a line that is not blank before
// the next level-one or level-two heading.
function assumed(text) {
  const date = /^\d{4}-\d{2}-\d{2}/.exec(field(text, 'date') ?? '')
  if (!date || date[0] < ASSUMED_FROM) return true
  const lines = unfenced(text.replace(/\r\n?/g, '\n'), true).split('\n')
  let open = false
  for (let i = 0; i < lines.length; i++) {
    const h = heading(lines, i)
    if (h && h.level <= 2) {
      open = h.level === 2 && /^what i assumed$/i.test(h.text.trim().replace(/\s+/g, ' '))
      if (h.setext) i++
    } else if (open && lines[i].trim()) return true
  }
  return false
}

function proofFaults(rev, path, e, candidate) {
  if (!regular(e)) return [`${path}: not a regular file`]
  const text = read(e, path, rev)
  const s = specOf(rev, path, text)
  if (s.faults) return s.faults
  const missing = missingIds(s.ids, text)
  const faults = missing.length ? [`${path}: does not name ${missing.join(', ')} from ${s.spec}`] : []
  if (!assumed(text)) faults.push(`${path}: no "## What I assumed" section with a line that is not blank ("None" counts); a proof dated ${ASSUMED_FROM} or later must say what the builder assumed`)
  // The evidence binding is optional: a proof without an evidence: field is judged as before.
  const evidence = field(text, 'evidence')
  if (candidate?.required && evidence === null) faults.push(`${path}: required version 2 evidence is missing`)
  return evidence === null ? faults : [...faults, ...evidenceFaults(rev, evidence, `${path}: evidence ${evidence}`, s, candidate)]
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
function evidenceFaults(P, path, where, ownSpec, candidate) {
  if (!underProof(path)) return [`${where} is not a path under docs/proof/`]
  const e = entry(P, path)
  if (!e || !regular(e)) return [`${where} is not a regular file in the landed commit`]
  const text = read(e, path, P)
  let m
  try { m = JSON.parse(text) } catch { return [`${where} is not a JSON object`] }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return [`${where} is not a JSON object`]
  if (candidate?.semantic && m.version !== 2 && !(candidate.documentation && m.version === 1)) return [`${where}: semantic checking requires version 2 evidence`]
  if (m.version !== 1 && !(m.version === 2 && candidate)) return [`${where}: version: ${show(m.version)} is not 1`]
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
  if (m.version === 2) {
    portableFaults(m, { ...ownSpec, entry, blob, C, P, bad, policy: candidate?.id })
    if(candidate.semantic)semanticFaults(m,{C,P,entry,blob,bad,approvalFault,runDigest,isCommit,ancestor,changed:changes})
    if(candidate && typeof candidate === 'object') candidate.checked++
  }
  return out
}

// Exact identity, not ancestry: after C, the landed commit may only add or edit regular proof files,
// and the regular files the owner lists for a bot in ~/.config/spec-lock/after-review.
function changedAfter(C, P, bad) {
  // Read before the loop, so a malformed list refuses even a landing that needs no entry.
  const allowed = afterReview()
  // Raw diff-tree records: ":<old mode> <new mode> <old oid> <new oid> <status>", then the path.
  const diff = git('diff-tree', '-r', '-z', '--no-renames', C, P).split('\0')
  for (let i = 0; i + 1 < diff.length; i += 2) {
    const [, mode, , , status] = diff[i].split(' ')
    const p = diff[i + 1]
    if (!['A', 'M'].includes(status) || mode !== '100644' || !(underProof(p) || allowed.includes(p))) {
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
export function checkRange(old, neu, known = [], candidate = false, policy = ownerPolicy()) {
  if (policy.mode === 'selected' && !policy.active) return []
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
  if (policy.required) candidate = {...policy, semantic:true, checked:0, required:changed.some(p=>!isDoc(p)), documentation:changed.every(isDoc)}
  // Only proofs this landing adds or edits count; one already on the branch cannot vouch for new code.
  const proofs = changed.filter((p) => PROOF.test(p)).map((p) => [p, entry(to, p)]).filter(([, e]) => e)
  if (proofs.length === 0) return changed.every(isDoc) ? [] : ['no proof: this code landing adds or edits no docs/proof/*.md file']
  // Each proof answers to its own spec; text from one proof never fills a gap in another.
  return proofs.flatMap(([p, e]) => proofFaults(to, p, e, candidate))
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
export function referenceTransaction(state, input, repo, guarded = [], policy = ownerPolicy()) {
  const updates = lines(input).map((line) => line.split(' '))
  return state === 'committed' ? committed(repo) : prepared(updates, repo, guarded, policy)
}

function prepared(updates, repo, guarded, policy) {
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
    if (base) faults = checkRange(base, neu, [], false, policy)
    // A repository's first commit has nothing to be checked against. A branch created where
    // history exists is compared with the empty tree, and content already on a guarded branch,
    // or kept from one, is not new; so a deleted and recreated branch cannot claim its old proofs.
    else if (git('for-each-ref', '--count=1', '--format=x') === '') faults = []
    else faults = checkRange(null, neu, [...tips('refs/spec-lock/kept'), ...guardedTips(guarded)], false, policy)
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
export function prePush(remote, input, guarded = [], policy = ownerPolicy()) {
  const out = []
  for (const [, neu, ref, old] of lines(input).map((line) => line.split(' '))) {
    if (ZERO.test(neu)) continue // a deletion lands nothing
    // A branch new to the remote is compared with the empty tree, less what a guarded branch here holds.
    const faults = ZERO.test(old) ? checkRange(null, neu, [...tips('refs/spec-lock/kept'), ...guardedTips(guarded)], false, policy) : checkRange(old, neu, [], false, policy)
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

export function hookConfig(binDir = BIN, mode = 'legacy', common) {
  const quote = value => `'${value.replace(/'/g, `'\\''`)}'`
  const quoted = quote(join(binDir, 'spec-lock-hook'))
  const scope = name => common ? `common=$(git rev-parse --path-format=absolute --git-common-dir) || exit 1; if ! [ "$common" -ef ${quote(common)} ]; then git config --local --no-includes --get hook.${name}.command >/dev/null 2>&1; [ "$?" = 1 ] && exit 0; echo 'spec-lock: registered repository moved; owner migration required' >&2; exit 1; fi; ` : ''
  return Object.fromEntries([[HOOK, 'reference-transaction'], [PUSH_HOOK, 'pre-push']].flatMap(([name,event]) => [
    [`hook.${name}.command`, `${scope(name)}${quoted} ${event}${mode === 'legacy' ? '' : ` --${mode}`}`],
    [`hook.${name}.event`, event],
  ]))
}
// Adds the shared hooks to a git config file, or to the global config when none is named, one
// friendly name per event, so a single command can switch either off:
// git -c hook.spec-lock-reference-transaction.enabled=false <command>
export function register(configFile, binDir = BIN, mode = 'legacy', common) {
  const where = configFile ? ['--file', configFile] : ['--global']
  for (const [key,value] of Object.entries(hookConfig(binDir,mode,common))) {
    execFileSync('git', ['config', ...where, key, value])
  }
}
