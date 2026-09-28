// Frozen logical cases; baseline uses comparable v1 records, never a fabricated capture.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fixture, attach, SPEC, OUT, capture, approval, exported } from './portable-fixture.mjs'
const cases = JSON.parse(readFileSync(new URL('./portable-evidence-cases.json', import.meta.url)))
export function editCase(m, id, f) {
  if (id === 'incomplete') m.claims.pop()
  if (id === 'duplicate') m.claims.push({...m.claims[0]})
  if (id === 'extra') m.claims.push({...m.claims[0], ac:'AC3'})
  if (id === 'wrong-spec') { m.claims[0].spec = 'docs/specs/s2.md'; m.claims[0].spec_blob = f.ok('rev-parse', `${f.C}:docs/specs/s2.md`) }
  if (id === 'same-session') { m.judges[0].author = 'v1'; m.judges[0].verifier = 'v1' }
  if (id === 'absent-identity') { m.judges[0].author = ''; m.judges[0].verifier = '' }
  if (id === 'zero-test' || id === 'skipped-test') m.judges[0].observation = {kind:'test', tests:[], executed:0, skipped:id === 'skipped-test' ? 1 : 0, assertion:'double(7) equals 14', expected:'14', observed:'no tests'}
  if (id === 'unsupported') m.judges[0].verdict = 'unsupported'
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [mode = 'candidate', output = 'docs/proof/portable-evidence-capture/candidate.json', cli] = process.argv.slice(2)
  if (!['baseline','candidate'].includes(mode)) throw Error('mode must be baseline or candidate')
  const f = fixture(cli && resolve(cli), mode === 'candidate')
  const runs = [], captures = [], artifacts = []
  const captureStart=performance.now()
  const recorded = mode === 'candidate' ? capture(f) : null
  if(recorded){if(recorded.result.code!==0)throw Error(recorded.result.err); captures.push({case:'success',command:['node','<candidate>/bin/spec-lock','capture','<scratch>/capture.approval.json','<scratch>/capture'],milliseconds:performance.now()-captureStart,...recorded.result,record:recorded.record,stdout:readFileSync(resolve(recorded.scratch,'stdout')).toString('base64'),stderr:readFileSync(resolve(recorded.scratch,'stderr')).toString('base64')})}
  for (const c of cases.cases) {
    let tip
    if(mode === 'baseline') tip = attach(f, c.id, {edit:m=>editCase(m,c.id,f), files:c.id === 'altered-output' ? {[OUT]:'value=15\n'} : {}, later:c.id === 'code-after-review' ? [{'src/value.mjs':'export const value = x => x * 3\n'}] : []})
    else {
      f.ok('switch','-q','-C',`walk-${c.id}`,f.C)
      const exportStart=performance.now()
      const e=exported(f,recorded,c.id);if(e.result.code!==0)throw Error(e.result.err)
      editCase(e.manifest,c.id,f)
      artifacts.push({case:c.id,export_ms:performance.now()-exportStart,manifest:e.manifest})
      const changes={[`${e.path}/manifest.json`]:JSON.stringify(e.manifest),'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`}
      if(c.id==='altered-output')changes[`${e.path}/stdout`]='value=15\n'
      tip=f.commit(changes)
      if(c.id==='code-after-review')tip=f.commit({'src/value.mjs':'export const value=x=>x*3\n'})
    }
    for (let repeat=0; repeat<cases.repeats; repeat++) {
      const started = performance.now(); const r = mode === 'baseline' ? f.check(tip) : f.run('node',[f.cli,'check-candidate',f.B,tip])
      runs.push({case:c.id, valid:c.valid, repeat, warm:repeat>0, command:['node',`<${mode}>/bin/spec-lock`,mode==='baseline'?'check':'check-candidate',f.B,tip], ...r, milliseconds:performance.now()-started})
    }
  }
  let capability_gap=null
  if(mode==='baseline'){
    const start=performance.now(), gap=f.run('node',[f.cli,'capture'])
    capability_gap={command:['node','<baseline>/bin/spec-lock','capture'],...gap,milliseconds:performance.now()-start}
  } else {
    f.ok('switch','-q','-C','capture-variants',f.C)
    for(const [name,argv,timeout,extra] of [
      ['exit-3',['node','-e','process.exit(3)']],
      ['timeout-100ms',['node','-e','setInterval(()=>{},1000)'],100],
      ['overflow-1024',['node','-e',"process.stdout.write('x'.repeat(2000))"]],
      ['changed-input',['node','-e',"require('node:fs').writeFileSync('test/value.mjs','changed')"]],
      ['different-command',['node','test/value.mjs'],null,['--','node','-e','process.exit(0)']],
      ['missing-command',['missing-fixture-command']],
      ['interrupted',['node','-e',"process.kill(process.pid,'SIGTERM')"]],
    ]) {
      const a=approval(f,argv);if(timeout)a.limits.timeout_ms=timeout
      const started=performance.now(), c=capture(f,a,name,extra)
      captures.push({case:name,command:['node','<candidate>/bin/spec-lock','capture',`<scratch>/${name}.approval.json`,`<scratch>/${name}`,...(extra??[])],approval:a,...c.result,milliseconds:performance.now()-started,record:c.record,stdout:c.record?readFileSync(resolve(c.scratch,'stdout')).toString('base64'):null,stderr:c.record?readFileSync(resolve(c.scratch,'stderr')).toString('base64'):null})
    }
  }
  const report={stage:'capture',mode,baseline:cases.baseline,format:mode==='baseline'?1:2,case_list:cases,runs,captures,artifacts,capability_gap,automatically_captured:captures.filter(c=>c.record).length,tokens:null,cost:null}
  writeFileSync(output,JSON.stringify(report,null,2)+'\n')
  console.log(`saved ${runs.length} ${mode} checks and ${report.automatically_captured} capture records`)
}
