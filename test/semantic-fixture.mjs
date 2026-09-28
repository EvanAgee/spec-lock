import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, approval, capture, exported, judgments, sha256, SPEC } from './portable-fixture.mjs'
import { runDigest } from '../lib/portable.mjs'
export const expectedPath='test/expected.txt'
export const sourcePath='requirements.txt'
export const goldenPath='test/golden.txt'
const testCode=`import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {value} from '../src/value.mjs'
const expected=Number(readFileSync('test/expected.txt','utf8'))
try {assert.equal(value(7),expected,'double seven')} catch {console.error('double seven expected 14 observed '+value(7));process.exit(1)}
console.log('value='+value(7))
`
export function semanticFixture(cli) {
  const f=fixture(cli)
  const spec=f.ok('show',`${f.C}:${SPEC}`)
  f.ok('switch','-q','-C','semantic',f.B)
  f.B=f.commit({[goldenPath]:'0\n',[expectedPath]:'14\n',[sourcePath]:'Requirement: doubling seven must yield fourteen.\n'})
  f.R=f.commit({[SPEC]:spec,'test/value.mjs':testCode,[goldenPath]:'14\n'})
  f.C=f.commit({'src/value.mjs':'export const value = x => x * 2\n'})
  f.blob=f.ok('rev-parse',`${f.C}:${SPEC}`)
  const inputs=['src/value.mjs','test/value.mjs',expectedPath,sourcePath,goldenPath,SPEC]
  f.approve=(revision,role='green')=>{
    const a=approval(f);a.revision=revision;a.role=role;a.id=`${role}-approval`;a.limits.output_bytes=4096
    a.inputs=inputs.map(path=>({path,sha256:sha256(f.run('git',['show',`${revision}:${path}`]).out)}))
    a.expected={exit:role==='red'?1:0,stdout:role==='red'?'':'value=14\n'}
    a.semantic={version:1,tests:['test/value.mjs'],criteria:['AC1','AC2'].map(ac=>({ac,red_required:true,oracle:{id:`oracle-${ac}`,ac,reviewer:'v1',verdict:'supported',reason:'The requirement states seven doubled is fourteen, independent of the implementation.',expected:'14',expectation:{path:expectedPath,sha256:sha256('14\n')},source:{kind:'requirement',path:sourcePath,sha256:sha256('Requirement: doubling seven must yield fourteen.\n')}}})),goldens:[goldenPath],golden_reviews:['AC1','AC2'].map(ac=>({id:`golden-${ac}`,ac,path:goldenPath,before_sha256:sha256('0\n'),after_sha256:sha256('14\n'),reviewer:'v1',verdict:'supported',reason:'Replace the incorrect zero with the required fourteen.',approved_at:new Date(Date.now()-1000).toISOString()}))}
    if(role==='red')a.control={baseline:f.B,overlay:[SPEC,'test/value.mjs',goldenPath].map(path=>({path,sha256:a.inputs.find(i=>i.path===path).sha256}))}
    return a
  }
  return f
}
export function prepare(f) {
  const red=capture(f,f.approve(f.R,'red'),'red')
  assert.equal(red.result.code,1,red.result.err)
  assert.equal(red.record.run.exit,1)
  const green=capture(f,f.approve(f.C),'green')
  assert.equal(green.result.code,0,green.result.err)
  return {red,green}
}
export function reviews(f,{red,green}) {
  return ['AC1','AC2'].map(ac=>({id:`red-${ac}`,ac,oracle:`oracle-${ac}`,red:red.record.run.id,red_sha256:runDigest(red.record.run),green:green.record.run.id,green_sha256:runDigest(green.record.run),reviewer:'v1',verdict:'supported',failure_kind:'assertion',expected_symptom:'double seven expected 14 observed 0',observed_symptom:'double seven expected 14 observed 0',reason:'The same assertion fails with zero and passes with fourteen after the repair.'}))
}
// Baseline adapter assembles the proposed semantic records from actual legacy exports.
// Candidate uses the production export bundle. Both retain the exact same logical obligations.
export function semanticExport(f,p,suffix,baseline=false) {
  if(!baseline) return exported(f,p.green,suffix,{judges:judgments(f,p.green),red_captures:[{scratch:p.red.scratch,reviews:reviews(f,p)}]})
  const r=exported(f,p.red,`${suffix}-red`,[]),g=exported(f,p.green,suffix)
  assert.equal(r.result.code,0,r.result.err);assert.equal(g.result.code,0,g.result.err)
  const m=g.manifest,plan=p.green.record.approval.semantic
  m.oracle_reviews=plan.criteria.map(c=>c.oracle);m.golden_reviews=plan.golden_reviews
  m.red_evidence=reviews(f,p).map(review=>({...review,capture:{approval:r.manifest.approvals[0],run:r.manifest.runs[0],sessions:r.manifest.sessions,recorder:r.manifest.recorder}}))
  for(const c of m.claims){c.oracle=`oracle-${c.ac}`;c.red=`red-${c.ac}`;c.golden=[`golden-${c.ac}`]}
  return g
}
export function editSemantic(m,id) {
  if(id==='missing-red')m.red_evidence=[]
  if(id==='unlinked-red')m.red_evidence[0].green='other-run'
  if(id==='rejected-red')m.red_evidence[0].verdict='unsupported'
  if(id==='syntax-error'||id==='missing-dependency'){m.red_evidence[0].failure_kind=id;m.red_evidence[0].verdict='unsupported'}
  if(id==='absent-oracle')m.oracle_reviews=[]
  if(id==='rejected-oracle'){m.oracle_reviews[0].verdict='unsupported';m.oracle_reviews[0].source.kind='code-derived'}
  if(id==='stale-oracle')m.oracle_reviews[0].expectation.sha256=sha256('13\n')
  if(id==='missing-golden')m.golden_reviews=[]
  if(id==='wrong-golden')m.golden_reviews[0].after_sha256=sha256('13\n')
  if(id==='late-golden')m.golden_reviews[0].approved_at='2999-01-01T00:00:00Z'
  if(id==='altered-red')m.red_evidence[0].capture.run.stderr.sha256=sha256('forged')
}
export function attachSemantic(f,e,id) {
  editSemantic(e.manifest,id)
  return f.commit({[`${e.path}/manifest.json`]:JSON.stringify(e.manifest,null,2)+'\n','docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`})
}
export function snapshot(f,revision) {
  return Object.fromEntries(f.ok('ls-tree','-r','--name-only',revision).split('\n').map(path=>[path,Buffer.from(f.run('git',['show',`${revision}:${path}`]).out).toString('base64')]))
}
