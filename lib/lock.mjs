// The landing rule over committed objects: what an old-to-new move of a protected branch must carry.
// Everything is read from the object store, never the working tree, so only committed work counts.
import { execFileSync } from 'node:child_process'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintSpec, missingIds } from './spec.mjs'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin')
export const HOOK = 'spec-lock-reference-transaction'
const ZERO = /^0+$/
const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/
const PROOF = /^docs\/proof\/.+\.md$/

const git = (...args) => execFileSync('git', ['--literal-pathspecs', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 })
const short = (oid) => (oid ? oid.slice(0, 12) : '(none)')

// Which branches the lock guards. Default-branch detection and the integration list widen it later.
export const isProtected = (ref) => ref === 'refs/heads/main'

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

// Faults that refuse moving a protected branch from old to neu; empty means the move may land.
// old is null or all zeros when the branch does not exist yet, so the whole tree is compared.
// Throws when an object cannot be read, which callers must treat as a refusal.
export function checkRange(old, neu) {
  if (ZERO.test(neu)) return [] // a deletion lands nothing
  const to = commit(neu)
  const from = old && !ZERO.test(old) ? commit(old) : git('hash-object', '-t', 'tree', '/dev/null').trim()
  // A plain tree diff, not a merge-base range: deleted and renamed-away paths count as changes too.
  const changed = git('diff-tree', '-r', '-z', '--name-only', '--no-renames', from, to).split('\0').filter(Boolean)
  if (changed.length === 0) return []
  // Only proofs this landing adds or edits count; one already on the branch cannot vouch for new code.
  const proofs = changed.filter((p) => PROOF.test(p)).map((p) => [p, entry(to, p)]).filter(([, e]) => e)
  if (proofs.length === 0) return ['no proof: this code landing adds or edits no docs/proof/*.md file']
  // Each proof answers to its own spec; text from one proof never fills a gap in another.
  return proofs.flatMap(([p, e]) => proofFaults(to, p, e))
}

// The reference-transaction adapter: one "<old> <new> <ref>" line per update, in the prepared state.
// Returns the refusal lines to print; empty means every protected update may land.
export function referenceTransaction(input) {
  const out = []
  for (const line of input.split('\n').filter(Boolean)) {
    const [old, neu, ref] = line.split(' ')
    if (!isProtected(ref)) continue
    // Git sends zeros as old for an update that names no old value, so read what the branch holds now.
    const base = ZERO.test(old) ? current(ref) : old
    const faults = OID.test(old) && OID.test(neu)
      ? checkRange(base, neu)
      : [`${ref} can only be updated to a commit, not ${neu}`]
    if (faults.length) out.push(`spec-lock: refused ${ref} ${short(base)}..${short(neu)}`, ...faults.map((f) => `- ${f}`))
  }
  return out
}

function current(ref) {
  try { return git('rev-parse', '--verify', '--quiet', ref).trim() } catch { return null }
}

// Adds the shared hook to a git config file. Git names it HOOK, so a single command can switch it
// off with: git -c hook.spec-lock-reference-transaction.enabled=false <command>
export function register(configFile, binDir = BIN) {
  const quoted = `'${join(binDir, 'spec-lock-hook').replace(/'/g, `'\\''`)}'`
  execFileSync('git', ['config', '--file', configFile, `hook.${HOOK}.command`, `${quoted} reference-transaction`])
  execFileSync('git', ['config', '--file', configFile, `hook.${HOOK}.event`, 'reference-transaction'])
}
