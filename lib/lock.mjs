// The landing rule over committed objects: what an old-to-new move of a protected branch must carry.
// Everything is read from the object store, never the working tree, so only committed work counts.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintSpec, missingIds } from './spec.mjs'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin')
export const HOOK = 'spec-lock-reference-transaction'
const ZERO = /^0+$/
const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/
const PROOF = /^docs\/proof\/.+\.md$/
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

function specField(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  const m = front && /^spec:[ \t]*(.*?)[ \t]*$/m.exec(front[1])
  return m ? m[1].replace(/^(['"])(.*)\1$/, '$2') : ''
}

// The live AC ids of the spec a proof names, or the faults that stop us from reading them.
function specOf(rev, path, text) {
  const spec = specField(text)
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
  return missing.length ? [`${path}: does not name ${missing.join(', ')} from ${s.spec}`] : []
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
const logFile = () => process.env.SPEC_LOCK_LOG || join(homedir(), '.local', 'state', 'spec-lock', 'landings.log')
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

// Adds the shared hook to a git config file. Git names it HOOK, so a single command can switch it
// off with: git -c hook.spec-lock-reference-transaction.enabled=false <command>
export function register(configFile, binDir = BIN) {
  const quoted = `'${join(binDir, 'spec-lock-hook').replace(/'/g, `'\\''`)}'`
  execFileSync('git', ['config', '--file', configFile, `hook.${HOOK}.command`, `${quoted} reference-transaction`])
  execFileSync('git', ['config', '--file', configFile, `hook.${HOOK}.event`, 'reference-transaction'])
}
