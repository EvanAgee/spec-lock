import {summarize} from './policy-receipt.mjs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {writeFileSync,readFileSync,existsSync,rmSync,realpathSync,statSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {policyFixture} from './policy-fixture.mjs'
test('required-version AC1: prose and version 1 cannot satisfy selected semantic policy',()=>{
 const f=policyFixture();f.enable()
 for(const name of ['missing','legacy']) {
  const r=f.attempt('cli',f.tips[name]);assert.equal(r.code,1,`${name} was accepted: ${r.out} ${r.err}`)
  assert.match(r.out+r.err,/required|requires/)
 }
 const good=f.attempt('cli',f.tips.valid);assert.equal(good.code,0,good.out+good.err)
})

test('selected-scope AC9 and adapter-policy AC10: bad evidence refuses all adapters and valid evidence lands',()=>{
 const f=policyFixture();f.enable()
 const identity=f.run('node',[f.cli,'policy']);assert.equal(identity.code,0,identity.err)
 const policyId=JSON.parse(identity.out.split('\n')[0]).id,checker=identity.out.match(/spec-lock checker (\S+)/)[1]
 for(const adapter of ['merge','push','linked'])for(const name of ['missing','legacy','invalid','valid']) {
  const r=f.attempt(adapter,f.tips[name]);assert.equal(r.code===0,name==='valid',`${adapter} ${name}: ${r.out} ${r.err}`)
  assert.equal(r.after,name==='valid'?r.target:r.before)
  assert.ok((r.out+r.err).includes(`spec-lock policy ${policyId};`))
  assert.ok((r.out+r.err).includes(`spec-lock checker ${checker}`))
 }
})

test('selected-scope AC9: inventory preview is read-only and unselected Git operations remain untouched',()=>{
 const f=policyFixture(),rollout=join(f.dir,'rollout'),inventory=join(f.dir,'inventory-only')
 f.ok('init','-q','-b','main',inventory)
 writeFileSync(join(inventory,'code.js'),'seed');f.ok('-C',inventory,'add','.');f.ok('-C',inventory,'commit','-q','-m','test: inventory seed')
 // Inventory may contain the same repository without selecting it.
 writeFileSync(rollout,`mode selected\nevidence semantic-v2\nrepo ${inventory}\nselect ${f.linked}\nintegration integration/candidate\n`)
 const before=readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8'),ownerBefore=readFileSync(f.central,'utf8'),ownerStat=statSync(f.central,{bigint:true})
 const preview=f.run('node',[join(dirname(f.cli),'spec-lock-rollout'),'preview',rollout])
 assert.equal(preview.code,0,preview.err)
 const plan=JSON.parse(preview.out);assert.deepEqual(plan.selected,[f.common]);assert.deepEqual(plan.inventory,[f.ok('-C',inventory,'rev-parse','--path-format=absolute','--git-common-dir')])
 assert.equal(readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8'),before)
 assert.equal(readFileSync(f.central,'utf8'),ownerBefore);assert.equal(statSync(f.central,{bigint:true}).mtimeNs,ownerStat.mtimeNs)
 rmSync(f.central)
 assert.equal(f.run('node',[join(dirname(f.cli),'spec-lock-rollout'),'preview',rollout]).code,0)
 assert.equal(existsSync(f.central),false);assert.equal(existsSync(join(f.dir,'activation')),false)
 f.enable();writeFileSync(f.central,f.policy.replace(`select ${f.common}\n`,''))
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.unproved);assert.equal(r.code,0,r.out+r.err);if(adapter!=='cli')assert.equal(r.after,r.target)}
})

test('required policy AC1 AC9: deletion, downgrade, duplicate and malformed settings cannot fall back',()=>{
 const f=policyFixture();f.enable()
 for(const policy of [null,'', 'mode legacy\n',f.policy.replace('semantic-v2','optional'),f.policy+'evidence legacy\n',f.policy+'unknown ignored\n']) {
  if(policy===null)rmSync(f.central);else writeFileSync(f.central,policy)
  for(const adapter of ['cli','merge','push','linked']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0);assert.equal(r.after,r.before);assert.match(r.out+r.err,/required policy/)}
 }
})

test('selected activation AC9: previewed scope is registered with a persistent selected marker',()=>{
 const f=policyFixture(),rollout=join(f.dir,'rollout'),inventory=join(f.dir,'inventory-only')
 f.ok('init','-q','-b','main',inventory)
 writeFileSync(join(inventory,'code.js'),'seed');f.ok('-C',inventory,'add','.');f.ok('-C',inventory,'commit','-q','-m','test: inventory seed')
 writeFileSync(rollout,`mode selected\nevidence semantic-v2\nrepo ${inventory}\nselect ${f.linked}\nintegration integration/candidate\n`)
 rmSync(f.central)
 const r=f.run('node',[join(dirname(f.cli),'spec-lock-rollout'),'activate',rollout]);assert.equal(r.code,0,r.err)
 assert.deepEqual(JSON.parse(r.out).selected,[f.common])
 writeFileSync(join(inventory,'code.js'),'unproved edit');f.ok('-C',inventory,'add','.');f.ok('-C',inventory,'commit','-q','-m','test: inventory stays unselected')
 assert.match(r.out,/"selected"/);assert.match(readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8'),/--selected/)
 const bad=f.attempt('merge',f.tips.missing);assert.notEqual(bad.code,0);assert.equal(bad.after,bad.before)
 rmSync(f.central)
 const missing=f.attempt('push',f.tips.missing);assert.notEqual(missing.code,0);assert.match(missing.err,/required policy/)
})

test('selected-scope AC9: a separate inventory repository is untouched even without Node',()=>{
 const f=policyFixture();f.enable()
 const other=join(f.dir,'other');f.ok('init','-q','-b','main',other)
 writeFileSync(join(other,'code.js'),'unproved code')
 f.ok('-C',other,'add','.')
 const env={...f.env,PATH:'/usr/bin:/bin'}
 const noNode=spawnSync('/bin/sh',['-c','command -v node'],{env});assert.notEqual(noNode.status,0)
 const r=spawnSync('git',['-C',other,'commit','-q','-m','test: unselected commit'],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr)
 assert.equal(existsSync(join(f.dir,'landings.log')),false)
})

test('legacy and exceptions AC10: version 1 and prose remain valid under legacy; selected documentation stays exempt',()=>{
 const f=policyFixture();rmSync(f.central);f.enable(false)
 for(const adapter of ['cli','merge','push','linked'])for(const name of ['missing','legacy'])assert.equal(f.attempt(adapter,f.tips[name]).code,0)
 writeFileSync(f.central,f.policy);f.enable()
 f.ok('switch','-q','-C','docs-only',f.B);const doc=f.commit({'docs/note.md':'Research only\n'})
 for(const adapter of ['cli','merge','push','linked'])assert.equal(f.attempt(adapter,doc).code,0)
})

test('owner policy AC1: candidate commands and repository settings cannot weaken required checks',()=>{
 const f=policyFixture();f.enable();f.ok('config','spec-lock.evidence','legacy')
 for(const command of ['check','check-candidate','check-semantic']){const r=f.run('node',[f.cli,command,f.B,f.tips.missing]);assert.equal(r.code,1);assert.match(r.out,/required version 2/)}
})

test('impact AC14: changed unselected outcome and missing denominator cannot pass receipt validation',()=>{
 const raw=JSON.parse(readFileSync(new URL('./policy-baseline.json',import.meta.url)))
 const r=raw.runs.find(r=>r.scope==='unselected'&&r.adapter==='merge');r.code=0
 assert.throws(()=>summarize(raw),/branch movement/)
 const clean=JSON.parse(readFileSync(new URL('./policy-baseline.json',import.meta.url)));clean.runs.pop()
 assert.throws(()=>summarize(clean))
})

test('impact AC14: actual receipt CLI refuses an edited scope result and a missing count',()=>{
 const dir=mkdtempSync(join(tmpdir(),'policy-receipt-'))
 try {
  const raw=fileURLToPath(new URL('./policy-baseline.json',import.meta.url))
  const cli=fileURLToPath(new URL('./policy-receipt.mjs',import.meta.url)),receipt=join(dir,'receipt.json')
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000})
  assert.equal(run(raw,raw,receipt,'write').status,0)
  const summary=JSON.parse(readFileSync(receipt));delete summary.candidate.unselected_attempted;writeFileSync(receipt,JSON.stringify(summary))
  assert.notEqual(run(raw,raw,receipt).status,0)
  const changed=JSON.parse(readFileSync(raw)),bad=changed.runs.find(r=>r.scope==='unselected'&&r.adapter==='merge');bad.code=0
  const edited=join(dir,'edited.json');writeFileSync(edited,JSON.stringify(changed))
  assert.notEqual(run(raw,edited,receipt,'write').status,0)
 } finally {rmSync(dir,{recursive:true,force:true})}
})

test('policy binding AC1 AC10: candidate manifest cannot substitute the owner policy identity',()=>{
 const f=policyFixture();f.enable();f.ok('switch','-q','-C','forged-policy',f.tips.valid)
 const path='docs/proof/valid/manifest.json',m=JSON.parse(readFileSync(join(f.repo,path)));m.policy='candidate-bindings-v2'
 const tip=f.commit({[path]:JSON.stringify(m)})
 const r=f.attempt('cli',tip);assert.equal(r.code,1);assert.match(r.out,/effective evidence policy/)
})

test('documentation exception AC10: a prose proof for documentation needs no execution manifest',()=>{
 const f=policyFixture();f.enable();f.ok('switch','-q','-C','doc-proof',f.B)
 const spec=f.ok('show',`${f.C}:docs/specs/value.md`)
 const tip=f.commit({'docs/specs/value.md':spec,'docs/proof/note.md':'---\nspec: docs/specs/value.md\n---\nAC1 AC2\n'})
 const r=f.attempt('cli',tip);assert.equal(r.code,0,r.out+r.err)
})

test('review one AC9 AC10: an integration entry without a final newline remains guarded',()=>{
 const f=policyFixture();f.enable();writeFileSync(f.central,f.policy.trimEnd())
 const r=f.attempt('linked',f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)
 f.ok('-C',f.bare,'update-ref','refs/heads/integration/candidate',f.B)
 const push=f.git('push','fixture',`${f.tips.missing}:refs/heads/integration/candidate`);assert.notEqual(push.code,0,push.out+push.err)
 assert.equal(f.ok('-C',f.bare,'rev-parse','integration/candidate'),f.B)
})
test('review one AC1: indented selected settings cannot become legacy policy',()=>{
 const f=policyFixture();f.enable(false);writeFileSync(f.central,f.policy.split('\n').map(l=>l?'  '+l:l).join('\n'))
 for(const adapter of ['cli','merge']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})
test('review one AC9: a checkout path is malformed common-directory selection',()=>{
 const f=policyFixture();f.enable();writeFileSync(f.central,f.policy.replace(f.common,realpathSync(f.repo)))
 for(const adapter of ['cli','merge']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before);assert.match(r.out+r.err,/required policy/)}
})
test('review one AC10: duplicate integration settings refuse equally outside selection',()=>{
 const f=policyFixture();f.enable();writeFileSync(f.central,f.policy.replace(`select ${f.common}\n`,'')+'integration integration/candidate\n')
 for(const adapter of ['cli','merge']){const r=f.attempt(adapter,f.tips.unproved);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})
test('review one AC10: documentation-only version 1 proof preserves legacy validation',()=>{
 const f=policyFixture();f.enable();f.ok('-C',f.bare,'fetch','-q',f.repo,f.C);f.B=f.C
 for(const adapter of ['cli','merge']){const r=f.attempt(adapter,f.tips.legacy);assert.equal(r.code,0,r.out+r.err)}
})

test('selected legacy AC10: scope and evidence requirements remain separate owner choices',()=>{
 const f=policyFixture();f.enable();writeFileSync(f.central,f.policy.replace('evidence semantic-v2','evidence legacy'))
 for(const adapter of ['cli','merge','push','linked']){const r=f.attempt(adapter,f.tips.legacy);assert.equal(r.code,0,r.out+r.err)}
})

test('review two AC9: case aliases keep a selected common directory covered',()=>{
 const f=policyFixture();f.enable();const alias=f.common.replace('/repo/','/REPO/')
 assert.notEqual(alias,f.common)
 writeFileSync(f.central,f.policy.replace(f.common,alias))
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})
for(const sample of ['bare keyword','CR comment'])test(`review two AC10: ${sample} refuses across CLI merge and push`,()=>{
 const f=policyFixture();f.enable(false)
 {
  const policy=sample==='bare keyword'?'mode\n':f.policy.replace(`select ${f.common}\n`,'')+'# comment\r\n'
  writeFileSync(f.central,policy)
  for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
 }
})
test('review two AC1: included selected registration cannot fall back when owner policy is missing',()=>{
 const f=policyFixture();f.enable();const included=join(f.dir,'included.gitconfig')
 writeFileSync(included,readFileSync(f.env.GIT_CONFIG_GLOBAL));writeFileSync(f.env.GIT_CONFIG_GLOBAL,`[include]\n path = ${JSON.stringify(included)}\n`);rmSync(f.central)
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})

test('review two AC1: an owner edit makes an older selected-policy export stale',()=>{
 const f=policyFixture();f.enable();writeFileSync(f.central,f.policy+'# owner revision\n')
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.valid);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before);assert.match(r.out+r.err,/effective evidence policy/)}
})
test('review two AC10: selected first-commit and pulled-content exceptions remain',()=>{
 const f=policyFixture(),empty=join(f.dir,'empty');f.ok('init','-q','-b','main',empty)
 const common=f.ok('-C',empty,'rev-parse','--path-format=absolute','--git-common-dir')
 writeFileSync(f.central,f.policy+`select ${common}\n`);f.enable()
 writeFileSync(join(empty,'code.js'),'first unproved code');f.ok('-C',empty,'add','.')
 const first=f.git('-C',empty,'commit','-q','-m','test: first selected commit');assert.equal(first.code,0,first.err)
 f.ok('-C',f.bare,'fetch','-q',f.repo,`${f.tips.unproved}:refs/heads/main`)
 f.ok('fetch','-q','fixture');f.ok('symbolic-ref','refs/remotes/fixture/HEAD','refs/remotes/fixture/main')
 f.ok('switch','-q','main');f.ok('-c','hook.spec-lock-reference-transaction.enabled=false','reset','--hard',f.B)
 const pulled=f.git('pull','--ff-only','fixture','main');assert.equal(pulled.code,0,pulled.err)
 assert.equal(f.ok('rev-parse','main'),f.tips.unproved)
})

test('review three AC9: legacy activation cannot erase selected registration',()=>{
 const f=policyFixture();f.enable();const rollout=join(f.dir,'legacy-rollout')
 writeFileSync(rollout,`repo ${f.repo}\nintegration integration/candidate\n`)
 const before=readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8')
 const r=f.run('node',[join(dirname(f.cli),'spec-lock-rollout'),'activate',rollout]);assert.notEqual(r.code,0,r.out+r.err)
 assert.equal(readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8'),before)
 rmSync(f.central)
 const absent=f.run('node',[join(dirname(f.cli),'spec-lock-rollout'),'activate',rollout]);assert.notEqual(absent.code,0,absent.out+absent.err)
 assert.equal(readFileSync(f.env.GIT_CONFIG_GLOBAL,'utf8'),before);assert.equal(existsSync(f.central),false)
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})
for(const sample of ['value NUL','line NUL','comment NUL'])test(`review three AC10: ${sample} refuses through all adapters`,()=>{
 const f=policyFixture();f.enable()
 const text=f.policy.replace(`select ${f.common}\n`,'')
 writeFileSync(f.central,sample==='value NUL'?text.replace('mode selected','mode selected\0'):text+(sample==='line NUL'?'\0\n':'# comment\0\n'))
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.notEqual(r.code,0,r.out+r.err);assert.equal(r.after,r.before)}
})


test('review four AC10: Unicode separators in valid branch names preserve adapter agreement',()=>{
 const f=policyFixture();f.enable()
 for(const separator of ['\u2028','\u2029']) {
  writeFileSync(f.central,f.policy.replace(`select ${f.common}\n`,'')+`integration foo${separator}bar\n`)
  for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.equal(r.code,0,r.out+r.err);if(adapter!=='cli')assert.equal(r.after,r.target)}
 }
})
test('review four AC1: policy fingerprint hashes exact undecoded owner bytes',()=>{
 const f=policyFixture();f.enable()
 for(const byte of [0xe9,0xe8]) {
  const bytes=Buffer.concat([Buffer.from(f.policy+'# comment '),Buffer.from([byte]),Buffer.from('\n')]);writeFileSync(f.central,bytes)
  const r=f.run('node',[f.cli,'policy']);assert.equal(r.code,0,r.err)
  assert.equal(JSON.parse(r.out.split('\n')[0]).id,'selected-v1:'+createHash('sha256').update(bytes).digest('hex'))
 }
})
test('review four AC10: only LF starts a selected-setting line',()=>{
 const f=policyFixture();f.enable(false);writeFileSync(f.central,'# comment\u2028mode selected\n')
 for(const adapter of ['cli','merge','push']){const r=f.attempt(adapter,f.tips.missing);assert.equal(r.code,0,r.out+r.err)}
})
