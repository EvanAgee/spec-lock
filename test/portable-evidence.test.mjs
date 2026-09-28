import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, lstatSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, SPEC, sha256, approval, capture, judgments, exported } from './portable-fixture.mjs'
test('capture: AC3 exact command records real stdout, empty stderr and clean revision',()=>{
  const f=fixture(); const c=capture(f)
  assert.equal(c.result.code,0,c.result.out+c.result.err)
  assert.equal(readFileSync(join(c.scratch,'stdout'),'utf8'),'value=14\n')
  assert.equal(readFileSync(join(c.scratch,'stderr')).length,0)
  assert.equal(c.record.run.revision,f.C)
  assert.equal(c.record.run.outcome,'exited')
  assert.equal(c.record.run.exit,0)
  assert.deepEqual(c.record.run.before,c.record.run.after)
})

test('capture: AC3 bounded failures retain records and changed approvals never execute',()=>{
  const f=fixture()
  const variants=[['exit-3','process.exit(3)','exited',3],['timeout','setInterval(()=>{},1000)','timeout',null],['overflow',"process.stdout.write('x'.repeat(2000))",'output-over-bound',null],['input',"require('node:fs').writeFileSync('test/value.mjs','changed')",'tracked-files-changed',0],['interrupt',"process.kill(process.pid,'SIGTERM')",'interrupted',null]]
  for(const [name,code,outcome,exit] of variants){
    const a=approval(f,['node','-e',code]); if(name==='timeout') a.limits.timeout_ms=100
    const c=capture(f,a,name)
    assert.equal(c.result.code,1,c.result.out+c.result.err);assert.equal(c.record.run.outcome,outcome)
    if(name!=='overflow')assert.equal(c.record.run.exit,exit)
    assert.ok(c.record.run.stdout.bytes+c.record.run.stderr.bytes<=1024)
  }
  const missing=capture(f,approval(f,['missing-fixture-command']),'missing');assert.equal(missing.record.run.outcome,'spawn-error');assert.equal(missing.result.code,1)
  const mismatch=capture(f,approval(f),'mismatch',['--','node','-e','process.exit(0)']);assert.equal(mismatch.result.code,2);assert.match(mismatch.result.err,/differs from approval/)
  const a=approval(f);a.inputs[0].sha256='0'.repeat(64);const dirty=capture(f,a,'dirty');assert.equal(dirty.result.code,2);assert.match(dirty.result.err,/input differs/)
})
test('v2-bindings: AC2 AC4 AC8 real capture exports and complete proof checks with disclosure',()=>{
  const f=fixture(),c=capture(f),e=exported(f,c)
  assert.equal(e.result.code,0,e.result.out+e.result.err)
  const tip=f.commit({'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2 observed.\n`})
  const r=f.run('node',[f.cli,'check-candidate',f.B,tip])
  assert.equal(r.code,0,r.out+r.err);assert.match(r.out,/actor provenance unauthenticated/);assert.match(r.out,/candidate binding records checked/)
  assert.equal(f.check(tip).code,1,'production checker must refuse candidate v2')
})

test('complete-claims and judgment-limit: AC2 AC8 omitted duplicate extra wrong spec and invalid observations refuse',async()=>{
  const {editCase}=await import('./portable-evidence-walk.mjs')
  const f=fixture(),c=capture(f)
  for(const id of ['complete','incomplete','duplicate','extra','wrong-spec','same-session','absent-identity','zero-test','skipped-test','unsupported']){
    f.ok('switch','-q','-C',`case-${id}`,f.C)
    const e=exported(f,c,id);assert.equal(e.result.code,0,e.result.err)
    editCase(e.manifest,id,f)
    writeFileSync(join(f.repo,e.path,'manifest.json'),JSON.stringify(e.manifest))
    const tip=f.commit({'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`})
    const r=f.run('node',[f.cli,'check-candidate',f.B,tip])
    assert.equal(r.code,id==='complete'?0:1,`${id}: ${r.out}${r.err}`)
    if(id==='wrong-spec')assert.match(r.out,/wrong spec/)
    if(id==='incomplete'||id==='duplicate')assert.match(r.out,/omitted or duplicated/)
    if(id==='same-session'||id==='absent-identity')assert.match(r.out,/identity|session/)
    if(id==='zero-test'||id==='skipped-test')assert.match(r.out,/observation/)
  }
})
test('v2-bindings: AC4 changed bytes revisions runs judges inputs and sessions refuse; proof follow-up passes',()=>{
  const f=fixture(),c=capture(f)
  const variants=[
    ['output',m=>{}, {'stdout':'value=15\n'},/sha256/],
    ['digest',m=>m.runs[0].stdout.sha256='0'.repeat(64),{},/sha256|evidence/],
    ['run',m=>m.claims[0].run='other',{},/run/],
    ['judge',m=>m.judges[0].run='other',{},/run/],
    ['judge-spec',m=>m.judges[0].spec='docs/specs/s2.md',{},/spec/],
    ['input',m=>m.runs[0].after[0].sha256='0'.repeat(64),{},/inputs/],
    ['session',m=>{}, {'session-1.json':'{"session_id":"other"}'},/session/],
    ['code',m=>{}, {},/changed after/],
    ['rebase',m=>{}, {},/reviewed/],
    ['follow-up',m=>{}, {},null],
  ]
  for(const [id,edit,files,reason] of variants){
    f.ok('switch','-q','-C',`binding-${id}`,f.C)
    if(id==='rebase')f.ok('commit','--amend','-q','-m','test: rewritten review')
    const e=exported(f,c,id);assert.equal(e.result.code,0,e.result.err);edit(e.manifest)
    const changes={[`${e.path}/manifest.json`]:JSON.stringify(e.manifest),'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`}
    for(const [file,bytes] of Object.entries(files))changes[`${e.path}/${file}`]=bytes
    let tip=f.commit(changes)
    if(id==='code')tip=f.commit({'src/value.mjs':'export const value=x=>x*3\n'})
    if(id==='follow-up')tip=f.commit({'docs/proof/note.txt':'follow-up\n'})
    const r=f.run('node',[f.cli,'check-candidate',f.B,tip]);assert.equal(r.code,reason?1:0,`${id}: ${r.out}${r.err}`)
    if(reason)assert.match(r.out,reason)
  }
})
test('capture: AC3 failed export stays unsupported and altered scratch bytes refuse export',()=>{
  const f=fixture(),c=capture(f,approval(f,['node','-e','process.exit(3)']))
  const e=exported(f,c);assert.equal(e.result.code,0,e.result.err);assert.equal(e.manifest.runs[0].exit,3);assert.equal(e.manifest.claims[0].state,'unsupported')
  const tip=f.commit({'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`})
  const refused=f.run('node',[f.cli,'check-candidate',f.B,tip]);assert.equal(refused.code,1);assert.match(refused.out,/exit: .* exited 3|state: .*unsupported/)
  writeFileSync(join(c.scratch,'stdout'),'forged');assert.equal(exported(f,c,'altered').result.code,2)
})

test('impact receipt: AC12 changed case outcomes and omitted denominators refuse',async()=>{
  const {paired}=await import('./portable-evidence-receipt.mjs')
  const frozen=JSON.parse(readFileSync(new URL('./portable-evidence-cases.json',import.meta.url)))
  const accepted=new Set(['incomplete','duplicate','wrong-spec','same-session','absent-identity','zero-test','skipped-test'])
  const raw=baseline=>({case_list:frozen,runs:frozen.cases.flatMap(c=>[0,1,2].map(repeat=>{const code=c.valid || (baseline && accepted.has(c.id)) ? 0:1;return {case:c.id,valid:c.valid,repeat,code,out:code?'spec-lock: refused base..tip\n':'spec-lock: ok\n',milliseconds:10+repeat}})),automatically_captured:0,tokens:null,cost:null})
  const before=raw(true),after=raw(false)
  const good=paired(before,after)
  assert.equal(good.baseline.invalid_accepted,21);assert.equal(good.candidate.invalid_accepted,0)
  const broken=structuredClone(after);broken.runs.find(r=>r.case==='incomplete').code=0
  assert.throws(()=>paired(before,broken),/exit disagrees/)
  // The actual missing-denominator refusal is also exercised through the receipt CLI.
  const f=fixture(),summary=structuredClone(good);delete summary.candidate.invalid_attempted
  for(const [name,value] of Object.entries({before,after,summary}))writeFileSync(join(f.dir,`${name}.json`),JSON.stringify(value))
  const r=f.run('node',[new URL('./portable-evidence-receipt.mjs',import.meta.url).pathname,join(f.dir,'before.json'),join(f.dir,'after.json'),join(f.dir,'summary.json')])
  assert.equal(r.code,1);assert.match(r.err,/summary differs from raw runs/)
})

test('capture review regressions: AC3 metadata damage preserves failure bytes',()=>{
  const f=fixture(),a=approval(f,['node','-e',"process.stdout.write('before damage\\n');require('node:fs').unlinkSync('.git');process.exit(3)"])
  const c=capture(f,a,'damaged-metadata')
  assert.equal(c.result.code,1,c.result.out+c.result.err)
  assert.equal(c.record.run.exit,3)
  assert.equal(c.record.run.outcome,'inspection-failed')
  assert.equal(readFileSync(join(c.scratch,'stdout'),'utf8'),'before damage\n')
  assert.equal(readFileSync(join(c.scratch,'stderr')).length,0)
  assert.equal(f.ok('worktree','list','--porcelain').split('\n').filter(l=>l.startsWith('worktree ')).length,1)
})
test('capture review regressions: AC3 large selected inputs and two-dot-prefixed directories are valid',()=>{
  const f=fixture()
  f.C=f.commit({'..fixtures/input.txt':'x'.repeat(1100000)})
  const a=approval(f,['node','-e',"console.log('value=14')"])
  a.inputs.push({path:'..fixtures/input.txt',sha256:sha256('x'.repeat(1100000))});a.cwd='..fixtures'
  const c=capture(f,a,'large-dot-input')
  assert.equal(c.result.code,0,c.result.out+c.result.err)
  assert.deepEqual(c.record.run.before,c.record.run.after)
})
test('judgment-limit: AC8 real zero-test execution remains unsupported',()=>{
  const f=fixture(),a=approval(f,['node','-e',"console.log('tests=0')"]);a.expected.stdout='tests=0\n'
  const c=capture(f,a)
  assert.equal(c.result.code,0,c.result.err)
  const js=judgments(f,c);js[0].observation={kind:'test',tests:[],executed:0,skipped:0,assertion:'double(7) equals 14',expected:'14',observed:'tests=0'}
  const e=exported(f,c,'zero-run',js)
  const tip=f.commit({'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`})
  const r=f.run('node',[f.cli,'check-candidate',f.B,tip]);assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/judgment.observation/)
})

test('capture review two: only green runs support claims',()=>{
  const f=fixture()
  for(const role of ['red','reproducer']){
    const a=approval(f);a.role=role
    const c=capture(f,a,role),e=exported(f,c,role)
    assert.equal(e.manifest.claims[0].state,'unsupported',role)
    const forged=e.manifest;forged.claims.forEach(c=>c.state='supported')
    const tip=f.commit({[`${e.path}/manifest.json`]:JSON.stringify(forged),'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${e.path}/manifest.json\n---\nAC1 AC2\n`})
    const r=f.run('node',[f.cli,'check-candidate',f.B,tip]);assert.equal(r.code,1,r.out+r.err);assert.match(r.out,/role/)
    f.ok('switch','-q','-C',`next-${role}`,f.C)
  }
})
test('capture review two: expected output must match the approved bytes',()=>{
  const f=fixture(),a=approval(f);a.expected.stdout='value=99\n'
  const c=capture(f,a,'wrong-expected')
  assert.equal(c.result.code,1,c.result.out+c.result.err)
  assert.equal(c.record.run.exit,0)
  assert.equal(c.record.run.expected_match,false)
  assert.equal(exported(f,c,'wrong-expected').manifest.claims[0].state,'unsupported')
})
test('capture review two: an escaped output pipe cannot extend the command deadline',()=>{
  const f=fixture(),a=approval(f,['node','-e',"const c=require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{detached:true,stdio:['ignore','inherit','inherit']});console.log(c.pid);setInterval(()=>{},1000)"])
  a.limits.timeout_ms=200
  const c=capture(f,a,'escaped-pipe')
  try {
    assert.equal(c.result.code,1,c.result.err);assert.equal(c.record.run.outcome,'timeout')
    assert.ok(c.record.run.duration_ms<1500,`deadline exceeded: ${c.record.run.duration_ms}ms`)
  } finally {
    const pid=Number(readFileSync(join(c.scratch,'stdout'),'utf8').trim())
    if(Number.isSafeInteger(pid)&&pid>1){try{process.kill(pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}}
  }
})
test('capture review two: a deleted checkout leaves no registration',()=>{
  const f=fixture(),c=capture(f,approval(f,['node','-e',"process.stdout.write('kept');process.chdir('..');require('node:fs').rmSync('checkout',{recursive:true,force:true})"]),'removed-checkout')
  assert.equal(c.result.code,1,c.result.err);assert.equal(readFileSync(join(c.scratch,'stdout'),'utf8'),'kept')
  assert.equal(f.ok('worktree','list','--porcelain').split('\n').filter(l=>l.startsWith('worktree ')).length,1)
})

test('capture review two: session JSON bytes and reordered input keys survive',()=>{
  const f=fixture(),a=approval(f)
  a.sessions.forEach(s=>s.source_raw=JSON.stringify(s.source,null,2)+'\n')
  const c=capture(f,a,'source-bytes');assert.equal(c.result.code,0,c.result.err)
  const e=exported(f,c,'source-bytes');assert.equal(e.result.code,0,e.result.err)
  assert.equal(readFileSync(join(f.repo,e.path,'session-1.json'),'utf8'),a.sessions[1].source_raw)
})

test('capture review two: input object key order does not change approval',()=>{
  const f=fixture(),a=approval(f);a.inputs=a.inputs.map(({path,sha256})=>({sha256,path}))
  const c=capture(f,a,'key-order');assert.equal(c.result.code,0,c.result.err)
})

test('capture review two: cleanup never follows a replacement checkout symlink',()=>{
  const f=fixture(),program=`const fs=require('node:fs');process.chdir('..');fs.rmSync('checkout',{recursive:true,force:true});fs.symlinkSync(${JSON.stringify(f.repo)},'checkout','dir')`
  const c=capture(f,approval(f,['node','-e',program]),'replacement-checkout')
  assert.equal(c.result.code,1,c.result.err)
  assert.ok(lstatSync(join(f.repo,'.git')).isDirectory(),'source repository .git preserved')
  assert.equal(f.ok('worktree','list','--porcelain').split('\n').filter(l=>l.startsWith('worktree ')).length,1)
})
test('capture review two: invalid cwd leaves no output directory; an empty tracked input is allowed',()=>{
  const f=fixture(),a=approval(f);a.cwd='missing-directory'
  const bad=capture(f,a,'bad-cwd');assert.equal(bad.result.code,2);assert.equal(existsSync(bad.scratch),false)
  f.C=f.commit({'empty.txt':''});const approved=approval(f);approved.inputs.push({path:'empty.txt',sha256:sha256('')})
  const good=capture(f,approved,'empty-input');assert.equal(good.result.code,0,good.result.err)
})
