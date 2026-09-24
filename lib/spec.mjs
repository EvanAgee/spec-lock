// The hardened spec shape, as pure text functions: text in, faults and live AC ids out.
// Extracted from the spec-lint CLI so the early spec check and the landing lock share one parser.

const REQUIRED = ['Problem Statement', 'Seams', 'Acceptance Criteria', 'End-to-end verification', 'Non-goals', 'Open questions']
const COLUMNS = ['AC', 'Requirement', 'Red test', 'Observable', 'Judge']
const EARS = /^(The|While|When|Where|If)\b[\s\S]*\bshall\b/

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function headings(text) {
  return text.split('\n')
    .filter((l) => /^#{1,4}\s/.test(l))
    .map((l) => norm(l.replace(/^#+\s*/, '').replace(/^\d+(\.\d+)*\.?\s*/, '').replace(/★/g, '')))
}

// Split a table row on unescaped pipes only; "\|" is a literal pipe inside a cell.
function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

// The acceptance table: the first markdown table whose header names every required column.
// GFM tables: outer pipes are optional; the delimiter row has exactly as many cells as the header.
const hasPipe = (l) => /(?<!\\)\|/.test(l) && l.trim() !== ''
function table(text) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (!hasPipe(lines[i])) continue
    const head = cells(lines[i]).map(norm)
    const idx = COLUMNS.map((c) => head.findIndex((h) => h.startsWith(norm(c))))
    const delim = cells(lines[i + 1])
    if (idx.some((x) => x < 0) || !hasPipe(lines[i + 1]) || delim.length !== head.length || !delim.every((d) => /^:?-+:?$/.test(d))) continue
    const rows = []
    for (let j = i + 2; j < lines.length && hasPipe(lines[j]); j++) {
      const c = cells(lines[j])
      rows.push(Object.fromEntries(COLUMNS.map((name, k) => [name, c[idx[k]] ?? ''])))
    }
    return rows
  }
  return null
}

// Drop fenced code blocks: a spec quoted inside a fence is an example, not the spec.
function unfenced(text) {
  const out = []
  let fence = null // { ch, len } of the open fence
  for (const line of text.split('\n')) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (m && !fence) { fence = { ch: m[1][0], len: m[1].length }; continue }
    // A closing fence uses the same character, is at least as long, and carries nothing else.
    if (m && fence && m[1][0] === fence.ch && m[1].length >= fence.len && m[2].trim() === '') { fence = null; continue }
    if (!fence) out.push(line)
  }
  return out.join('\n')
}

export function lintSpec(fullText) {
  const text = unfenced(fullText)
  const faults = []
  const have = headings(text)
  for (const s of REQUIRED) if (!have.some((h) => h.startsWith(norm(s)))) faults.push(`missing section: ${s}`)
  const rows = table(text)
  const ids = []
  if (!rows) {
    faults.push(`no acceptance criteria table with columns: ${COLUMNS.join(', ')}`)
  } else {
    const live = rows.filter((r) => !/^~~.*~~$/.test(r.AC))
    if (live.length === 0) faults.push('no acceptance criteria rows')
    for (const r of live) {
      const id = r.AC || '(no id)'
      if (!/^AC\d+$/.test(r.AC)) faults.push(`${id}: id must look like AC<n>`)
      else if (ids.includes(r.AC)) faults.push(`${id}: duplicate id`)
      else ids.push(r.AC)
      for (const col of COLUMNS.slice(1)) if (!r[col]) faults.push(`${id}: empty cell: ${col}`)
      if (r.Requirement && !EARS.test(r.Requirement)) faults.push(`${id}: requirement is not EARS (start with The/While/When/Where/If and say "shall")`)
      if (/implementer/i.test(r.Judge)) faults.push(`${id}: judge cannot be the implementer`)
    }
  }
  return { faults, ids }
}

// The ids a proof does not name, compared on word boundaries so AC20 never stands in for AC2.
export const missingIds = (ids, proof) => ids.filter((id) => !new RegExp(`\\b${id}\\b`).test(proof))
