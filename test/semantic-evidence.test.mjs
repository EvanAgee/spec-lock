import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {semanticFixture,prepare,semanticExport,attachSemantic} from './semantic-fixture.mjs'

test('red-green AC5: missing intended symptom review refuses while complete evidence passes',()=>{
 const f=semanticFixture(),p=prepare(f)
 for(const id of ['complete','missing-red']) {
  f.ok('switch','-q','-C',`test-${id}`,f.C)
  const e=semanticExport(f,p,id),tip=attachSemantic(f,e,id)
  const r=f.run('node',[f.cli,'check-semantic',f.B,tip])
  assert.equal(r.code,id==='complete'?0:1,`${id}: ${r.out} ${r.err}`)
 }
})

for(const [title,ids] of [
 ['oracle AC6: missing rejected and stale expected-answer reviews refuse',['complete','absent-oracle','rejected-oracle','stale-oracle']],
 ['golden AC7: missing wrong and later approvals refuse',['complete','missing-golden','wrong-golden','late-golden']],
 ['red-green AC5: rejected unlinked and altered red records refuse',['complete','unlinked-red','rejected-red','syntax-error','missing-dependency','altered-red']]
])test(title,()=>{
 const f=semanticFixture(),p=prepare(f)
 for(const id of ids){
  f.ok('switch','-q','-C',`test-${id}`,f.C)
  const e=semanticExport(f,p,id);assert.equal(e.result.code,0,e.result.err)
  const tip=attachSemantic(f,e,id),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
  assert.equal(r.code,id==='complete'?0:1,`${id}: ${r.out} ${r.err}`)
  if(id!=='complete')assert.match(r.out,/semantic\./)
 }
})

test('red-green AC5: actual syntax and dependency captures cannot replace the assertion failure',async()=>{
 const {capture}=await import('./portable-fixture.mjs')
 const f=semanticFixture(),p=prepare(f)
 for(const [id,argv,printed] of [
  ['syntax-error',['node','-e','{'],/SyntaxError/],
  ['missing-dependency',['node','-e',"require('missing-fixture-package')"],/MODULE_NOT_FOUND/]
 ]){
  const a=f.approve(f.R,'red');a.argv=argv
  const red=capture(f,a,id);assert.equal(red.result.code,1,red.result.err)
  const {readFileSync}=await import('node:fs')
  assert.match(readFileSync(`${red.scratch}/stderr`,'utf8'),printed)
  f.ok('switch','-q','-C',`actual-${id}`,f.C)
  const e=semanticExport(f,{...p,red},id);assert.equal(e.result.code,0,e.result.err)
  const tip=attachSemantic(f,e,id),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
  assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/intended assertion review required|symptom absent/)
 }
})

test('golden AC7: capture rejects absent or wrong approval before executing; later edits refuse',async()=>{
 const {capture}=await import('./portable-fixture.mjs')
 const {sha256}=await import('./portable-fixture.mjs')
 const f=semanticFixture()
 for(const [id,change] of [['missing',a=>a.semantic.golden_reviews=[]],['wrong',a=>a.semantic.golden_reviews[0].after_sha256=sha256('13\n')]]){
  const a=f.approve(f.C);change(a)
  const r=capture(f,a,id);assert.equal(r.result.code,2);assert.match(r.result.err,/golden/);assert.equal(r.record,null)
 }
 const p=prepare(f),e=semanticExport(f,p,'valid')
 const tip=attachSemantic(f,e,'complete')
 assert.equal(f.run('node',[f.cli,'check-semantic',f.B,tip]).code,0)
 const later=f.commit({'test/golden.txt':'13\n'})
 const r=f.run('node',[f.cli,'check-semantic',f.B,later]);assert.equal(r.code,1);assert.match(r.out,/test\/golden\.txt is bound by the evidence recorded on/)
})

test('impact AC13: altered unrelated-failure result and missing denominator refuse the receipt CLI',async()=>{
 const {readFileSync,writeFileSync}=await import('node:fs')
 const {resolve,join}=await import('node:path')
 const f=semanticFixture(),cases=JSON.parse(readFileSync(new URL('./semantic-cases.json',import.meta.url)))
 const raw={case_list:cases,tokens:null,cost:null,captures:[],automatically_captured:0,runs:cases.cases.flatMap(c=>[0,1,2].map(repeat=>({case:c.id,valid:c.valid,repeat,code:c.valid?0:1,out:c.valid?'spec-lock: ok\n':'spec-lock: refused fixture\n',milliseconds:10+repeat})))}
 const before=join(f.dir,'before.json'),after=join(f.dir,'after.json'),summary=join(f.dir,'summary.json')
 writeFileSync(before,JSON.stringify(raw));writeFileSync(after,JSON.stringify(raw))
 const cli=fileURLToPath(new URL('./semantic-receipt.mjs',import.meta.url)),args=[cli,before,after,summary]
 assert.equal(f.run('node',[...args,'write']).code,0)
 const changed=structuredClone(raw);changed.runs.find(r=>r.case==='syntax-error').code=0
 writeFileSync(after,JSON.stringify(changed))
 const altered=f.run('node',args);assert.notEqual(altered.code,0);assert.match(altered.err,/exit disagrees with raw output/)
 writeFileSync(after,JSON.stringify(raw))
 const saved=JSON.parse(readFileSync(summary));delete saved.candidate.invalid_attempted;writeFileSync(summary,JSON.stringify(saved))
 const denominator=f.run('node',args);assert.notEqual(denominator.code,0);assert.match(denominator.err,/saved summary differs/)
})

test('review regression: semantic command refuses a version-one downgrade',async()=>{
 const {fixture,attach}=await import('./portable-fixture.mjs')
 const f=fixture(),tip=attach(f,'legacy')
 const r=f.run('node',[f.cli,'check-semantic',f.B,tip]);assert.equal(r.code,1,r.out+r.err)
 assert.match(r.out,/version|semantic/)
})

test('review regression: substituted red test without control refuses',async()=>{
 const {capture}=await import('./portable-fixture.mjs')
 const f=semanticFixture();f.ok('switch','-q','-C','substituted',f.R)
 f.R=f.commit({'test/value.mjs':"console.error('double seven expected 14 observed 0');process.exit(1)\n"})
 const a=f.approve(f.R,'red');delete a.control
 const red=capture(f,a,'replaced-red'),green=capture(f,f.approve(f.C),'green')
 assert.equal(red.result.code,1);assert.equal(green.result.code,0)
 f.ok('switch','-q','-C','proof',f.C)
 const e=semanticExport(f,{red,green},'replaced');assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/test inputs|control/)
})

test('review regression: correctly approved large golden captures and exports',async()=>{
 const {capture,sha256}=await import('./portable-fixture.mjs')
 const f=semanticFixture(),large='14\n'+' '.repeat(2*1024*1024)
 f.C=f.commit({'test/golden.txt':large})
 const a=f.approve(f.C);a.inputs.find(i=>i.path==='test/golden.txt').sha256=sha256(large)
 for(const g of a.semantic.golden_reviews)g.after_sha256=sha256(large)
 for(const c of a.semantic.criteria){c.red_required=false;c.red_reason='Approved expectation-only change with no regression claim.'}
 const green=capture(f,a,'large');assert.equal(green.result.code,0,green.result.err)
 const {exported,judgments}=await import('./portable-fixture.mjs')
 const e=exported(f,green,'large',{judges:judgments(f,green),red_captures:[]})
 assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.equal(r.code,0,r.out+r.err)
})

test('review two: red command substitution refuses despite identical selected tests',async()=>{
 const {capture}=await import('./portable-fixture.mjs')
 const f=semanticFixture(),a=f.approve(f.R,'red')
 a.argv=['node','-e',"console.error('double seven expected 14 observed 0');process.exit(1)"]
 const red=capture(f,a,'command-red'),green=capture(f,f.approve(f.C),'green')
 const e=semanticExport(f,{red,green},'command-substitution');assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/red\/green command/)
})

test('review two: test equality is enforced when the spec already exists at base',async()=>{
 const {capture}=await import('./portable-fixture.mjs')
 const f=semanticFixture();f.B=f.R;f.ok('switch','-q','-C','changed-test',f.R)
 f.R=f.commit({'test/value.mjs':"console.error('double seven expected 14 observed 0');process.exit(1)\n"})
 const redApproval=f.approve(f.R,'red');delete redApproval.control;redApproval.semantic.golden_reviews=[]
 const greenApproval=f.approve(f.C);greenApproval.semantic.golden_reviews=[]
 const red=capture(f,redApproval,'red'),green=capture(f,greenApproval,'green')
 assert.equal(red.result.code,1);assert.equal(green.result.code,0)
 f.ok('switch','-q','-C','proof',f.C)
 const e=semanticExport(f,{red,green},'changed-test');assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/test inputs differ/);assert.doesNotMatch(r.out,/requires a declared control/)
})

test('review two: unchanged goldens reject duplicate or stale approval',async()=>{
 const {capture,sha256}=await import('./portable-fixture.mjs')
 const f=semanticFixture()
 for(const id of ['duplicate','stale']){
  const a=f.approve(f.C);a.semantic.goldens.push('test/expected.txt')
  const g={...a.semantic.golden_reviews[0],id:'unchanged',path:'test/expected.txt',before_sha256:sha256('14\n'),after_sha256:sha256(id==='stale'?'99\n':'14\n')}
  a.semantic.golden_reviews.push(g)
  if(id==='duplicate')a.semantic.golden_reviews.push({...g,id:'duplicate'})
  const c=capture(f,a,id);assert.equal(c.result.code,2,c.result.out+c.result.err);assert.match(c.result.err,/golden/)
 }
})

test('review two: absent optional evidence reports that no semantic records were checked',async()=>{
 const {fixture,attach,PROOF,SPEC}=await import('./portable-fixture.mjs')
 const f=fixture(),tip=attach(f,'no-evidence',{files:{[PROOF]:`---\nspec: ${SPEC}\n---\nAC1 AC2\n`}})
 const r=f.run('node',[f.cli,'check-semantic',f.B,tip]);assert.equal(r.code,0,r.out+r.err)
 assert.match(r.out,/no semantic review records checked/)
})

for(const selected of ['test/café.mjs','test/line\nbreak.mjs'])test(`review three: valid quoted control path ${JSON.stringify(selected)} passes`,async()=>{
 const {capture,sha256}=await import('./portable-fixture.mjs')
 const f=semanticFixture(),body=f.run('git',['show',`${f.C}:test/value.mjs`]).out
 f.C=f.commit({[selected]:body})
 f.ok('switch','-q','-C','red-path',f.R);f.R=f.commit({[selected]:body})
 f.ok('switch','-q','-C','green-path',f.C)
 const a=f.approve(f.R,'red'),g=f.approve(f.C)
 for(const approval of [a,g]){approval.argv=['node',selected];approval.inputs.push({path:selected,sha256:sha256(body)});approval.semantic.tests=[selected]}
 a.control.overlay.push({path:selected,sha256:sha256(body)})
 const red=capture(f,a,'red'),green=capture(f,g,'green')
 assert.equal(red.result.code,1,red.result.err);assert.equal(green.result.code,0,green.result.err)
 const e=semanticExport(f,{red,green},'quoted');assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.equal(r.code,0,r.out+r.err)
})

test('review four: a malformed control baseline refuses without writing a file',async()=>{
 const {readFileSync,writeFileSync,existsSync}=await import('node:fs')
 const {join}=await import('node:path')
 const {sha256}=await import('./portable-fixture.mjs')
 const f=semanticFixture(),p=prepare(f),e=semanticExport(f,p,'malformed')
 assert.equal(e.result.code,0,e.result.err)
 const target=join(f.dir,'must-not-exist')
 // Forge a committed record directly so the checker must defend itself even if capture is bypassed.
 for(const red of e.manifest.red_evidence){
  red.capture.approval.control.baseline=`--output=${target}`
  const a=red.capture.approval,{raw,...record}=a,bytes=JSON.stringify(record)
  writeFileSync(join(f.repo,raw.path),bytes);raw.bytes=Buffer.byteLength(bytes);raw.sha256=sha256(bytes)
 }
 assert.equal(existsSync(target),false)
 const tip=attachSemantic(f,e,'complete'),r=f.run('node',[f.cli,'check-semantic',f.B,tip])
 assert.notEqual(r.code,0,r.out+r.err)
 assert.equal(existsSync(target),false,'refused evidence must not create the requested output file')
 writeFileSync(target,'keep this exact sentinel')
 assert.notEqual(f.run('node',[f.cli,'check-semantic',f.B,tip]).code,0)
 assert.equal(readFileSync(target,'utf8'),'keep this exact sentinel','refused evidence must not overwrite an existing file')
})
