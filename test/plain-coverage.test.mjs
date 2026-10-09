// docs/specs/plain-proof-coverage.md: the plain proof rule for repositories a selected machine does
// not select. Every repository is synthetic and HOME is the fixture's temp directory.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {policyFixture} from './policy-fixture.mjs'
import {register} from '../lib/lock.mjs'

const f=policyFixture()
// The selected repository is registered in its own common config, as selected activation leaves it.
register(join(f.common,'config'),dirname(f.cli),'selected',f.common)
const ROLLOUT=join(dirname(f.cli),'spec-lock-rollout')
const PLAIN=join(f.dir,'.config/spec-lock/plain')
const RECORD=join(f.dir,'activation')
const run=(cwd,cmd,args)=>{const r=spawnSync(cmd,args,{cwd,env:f.env,encoding:'utf8',timeout:30000});return {code:r.status,out:r.stdout,err:r.stderr}}
const ok=(cwd,...args)=>{const r=run(cwd,'git',args);assert.equal(r.code,0,`git ${args.join(' ')}: ${r.err}`);return r.out.trim()}
const spec=ids=>['# Value','## Problem Statement','Text.','## Seams','Text.','## Acceptance Criteria',
 ['| AC | Requirement (EARS) | Red test | Observable | Judge |','|---|---|---|---|---|',...ids.map(id=>`| ${id} | When the program runs, the program shall print value=14. | a red test | its output | the fixture |`)].join('\n'),
 '## End-to-end verification','Text.','## Non-goals','Text.','## Open questions','Text.'].join('\n\n')+'\n'

// A repository with main at a base commit, an unproved code commit and a proved one, and a bare remote
// whose own lock is off, so a refusal can only come from this side.
function repository(name) {
 const dir=join(f.dir,name),remote=join(f.dir,`${name}-remote.git`)
 mkdirSync(dir);ok(dir,'init','-q','-b','main')
 const commit=(files,message)=>{for(const [p,t] of Object.entries(files)){mkdirSync(dirname(join(dir,p)),{recursive:true});writeFileSync(join(dir,p),t)};ok(dir,'add','-A');ok(dir,'commit','-q','-m',message);return ok(dir,'rev-parse','HEAD')}
 const base=commit({'src/value.mjs':'export const value = x => 0\n'},'test: base')
 ok(dir,'switch','-q','-c','lane')
 const unproved=commit({'src/value.mjs':'export const value = x => x * 2\n'},'test: unproved code')
 const proved=commit({'docs/specs/value.md':spec(['AC1','AC2']),'docs/proof/value.md':'---\nspec: docs/specs/value.md\n---\n# Proof\n\nAC1 and AC2 printed value=14.\n'},'test: spec and proof')
 ok(dir,'switch','-q','main')
 ok(f.dir,'init','-q','--bare',remote);ok(remote,'config','hook.spec-lock-reference-transaction.enabled','false')
 ok(dir,'remote','add','origin',remote);ok(dir,'-c','hook.spec-lock-pre-push.enabled=false','push','-q','origin','main')
 const common=ok(dir,'rev-parse','--path-format=absolute','--git-common-dir')
 // Puts main back at base with the lock off, so each attempt starts from the same tip.
 const reset=()=>{ok(dir,'-c','hook.spec-lock-reference-transaction.enabled=false','reset','-q','--hard',base);ok(remote,'update-ref','refs/heads/main',base)}
 return {dir,remote,common,base,unproved,proved,reset,check:tip=>run(dir,'node',[f.cli,'check',base,tip])}
}
const rollout=(text,name='plain.rollout')=>{const file=join(f.dir,name);writeFileSync(file,text);return file}
const activate=file=>run(f.dir,'node',[ROLLOUT,'activate',file])
const success=r=>assert.equal(r.code,0,r.out+r.err)
const refused=r=>{assert.ok(Number.isInteger(r.code),r.out+r.err);assert.notEqual(r.code,0,r.out+r.err)}

const policyId=()=>{const p=run(f.repo,'node',[f.cli,'policy']);assert.equal(p.code,0,p.err);return JSON.parse(p.out.split('\n')[0]).id}
const selectedConfig=join(f.common,'config')
const before={central:readFileSync(f.central),config:readFileSync(selectedConfig),policy:policyId()}
const covered=repository('covered'),outside=repository('outside')
// Puts the owner files back even when an assertion fails, so one red does not spill into the next test.
const keep=fn=>()=>{
 const saved=[PLAIN,f.central].map(p=>[p,existsSync(p)?readFileSync(p):null])
 try{fn()}finally{for(const [p,bytes] of saved){rmSync(`${p}.away`,{force:true});if(bytes===null)rmSync(p,{force:true});else writeFileSync(p,bytes)}}
}
const r=activate(rollout(`lane fixture-lane landed\nrepo ${outside.dir}\nplain ${covered.dir}\n`))

test('AC1: unproved code is refused on main of a plain repository by merge, linked worktree, update-ref and push',()=>{
 success(r)
 const linked=join(f.dir,'covered-linked')
 ok(covered.dir,'worktree','add','-q','--detach',linked,covered.base)
 for(const [how,args] of [['merge',['merge','--ff-only',covered.unproved]],['update-ref',['update-ref','refs/heads/main',covered.unproved]],['push',['push','origin',`${covered.unproved}:refs/heads/main`]]]) {
  covered.reset()
  const m=run(covered.dir,'git',args);refused(m);assert.match(m.err,/no proof/,how)
  assert.equal(ok(covered.dir,'rev-parse','main'),covered.base,how);assert.equal(ok(covered.remote,'rev-parse','main'),covered.base,how)
 }
 covered.reset()
 // main can be checked out in only one worktree at a time.
 ok(covered.dir,'switch','-q','--detach');ok(linked,'switch','-q','main')
 const l=run(linked,'git',['merge','--ff-only',covered.unproved]);refused(l);assert.match(l.err,/no proof/)
 assert.equal(ok(covered.dir,'rev-parse','main'),covered.base)
 ok(linked,'switch','-q','--detach');ok(covered.dir,'switch','-q','main')
 const c=covered.check(covered.unproved);assert.equal(c.code,1,c.out+c.err)
 assert.match(c.out,/^spec-lock policy selected-v1:[0-9a-f]+; plain; /);assert.match(c.out,/no proof:/)
})

test('AC2: a proof naming its spec and every AC lands without evidence by merge and push',()=>{
 success(r)
 covered.reset()
 const c=covered.check(covered.proved);success(c);assert.match(c.out,/; plain; /);assert.match(c.out,/spec-lock: ok/)
 success(run(covered.dir,'git',['merge','--ff-only',covered.proved]));assert.equal(ok(covered.dir,'rev-parse','main'),covered.proved)
 covered.reset()
 success(run(covered.dir,'git',['push','origin',`${covered.proved}:refs/heads/main`]));assert.equal(ok(covered.remote,'rev-parse','main'),covered.proved)
 covered.reset()
})

test('AC3: the selected repository keeps its central file, policy id, config and verdicts',()=>{
 success(r)
 assert.deepEqual(readFileSync(f.central),before.central)
 assert.deepEqual(readFileSync(selectedConfig),before.config)
 assert.equal(policyId(),before.policy)
 const missing=run(f.repo,'node',[f.cli,'check',f.B,f.tips.missing]);assert.equal(missing.code,1,missing.out+missing.err);assert.match(missing.out,/required version 2 evidence is missing/)
 const valid=run(f.repo,'node',[f.cli,'check',f.B,f.tips.valid]);success(valid);assert.match(valid.out,/; semantic-v2; /)
 const merged=f.attempt('merge',f.tips.valid);success(merged);assert.equal(merged.after,f.tips.valid)
})

test('AC4: a repository neither selected nor listed gets no hook and is not checked',keep(()=>{
 success(r)
 const hooks=run(outside.dir,'git',['hook','list','reference-transaction']);assert.equal(hooks.code,1,hooks.out+hooks.err);assert.equal(hooks.out,'')
 const c=outside.check(outside.unproved);success(c)
 assert.match(c.out,/^spec-lock policy selected-v1:[0-9a-f]+; unselected, not checked; /);assert.match(c.out,/spec-lock: ok/)
 success(run(outside.dir,'git',['merge','--ff-only',outside.unproved]))
 success(run(outside.dir,'git',['push','origin','main']));assert.equal(ok(outside.remote,'rev-parse','main'),outside.unproved)
 outside.reset()
 // Listed by hand but never registered: no hook checks it, and the CLI says so.
 writeFileSync(PLAIN,`${readFileSync(PLAIN,'utf8')}plain ${outside.common}\n`)
 const listed=outside.check(outside.unproved);success(listed);assert.match(listed.out,/; unselected, not checked; /)
}))

test('AC5: a broken plain or central file refuses a plain repository; a stale entry does not',keep(()=>{
 success(r)
 const valid=readFileSync(PLAIN)
 const cases=[['missing',null],['relative','plain relative/.git\n'],['unknown word',`cover ${covered.common}\n`],['no path','plain\n'],['carriage return',`plain ${covered.common}\r\n`],['NUL byte',`plain ${covered.common}\n# \0\n`],['not UTF-8',Buffer.concat([Buffer.from(`plain ${covered.common}\nplain /a`),Buffer.from([0xff]),Buffer.from('b/.git\n')])],['central missing',valid]]
 for(const [name,text] of cases) {
  covered.reset()
  if(text===null)rmSync(PLAIN);else writeFileSync(PLAIN,text)
  if(name==='central missing')renameSync(f.central,`${f.central}.away`)
  const u=run(covered.dir,'git',['update-ref','refs/heads/main',covered.proved])
  refused(u);assert.match(u.err,/required (policy is missing or malformed|plain coverage .* is not UTF-8 text)/,name);assert.equal(ok(covered.dir,'rev-parse','main'),covered.base,name)
  const c=covered.check(covered.proved);assert.equal(c.code,2,`${name}: ${c.out}${c.err}`)
  if(name==='central missing')renameSync(`${f.central}.away`,f.central)
 }
 writeFileSync(PLAIN,`plain /no/such/directory/.git\n${valid}`)
 covered.reset()
 refused(run(covered.dir,'git',['update-ref','refs/heads/main',covered.unproved]))
 success(run(covered.dir,'git',['update-ref','refs/heads/main',covered.proved]))
 covered.reset()
}))

test('AC6: an unsafe plain rollout names its reason and writes nothing',keep(()=>{
 success(r)
 const candidate=repository('candidate'),overridden=repository('overridden')
 ok(overridden.dir,'config','hook.spec-lock-reference-transaction.enabled','false')
 const valid=readFileSync(PLAIN),away=`${PLAIN}.away`
 const configs=[selectedConfig,join(covered.common,'config'),join(outside.common,'config'),join(candidate.common,'config'),join(overridden.common,'config')]
 const snapshot=()=>[f.central,PLAIN,RECORD,...configs].map(p=>existsSync(p)?readFileSync(p).toString('base64'):null)
 const cases=[
  ['lane',`lane other-lane in-flight\nplain ${candidate.dir}\n`,/lane other-lane is in-flight/],
  ['selected',`plain ${f.repo}\n`,/is selected/],
  ['hook key',`plain ${overridden.dir}\n`,/hook\.spec-lock-reference-transaction\.enabled/],
  ...['select','mode','evidence','integration','opt-out'].map(key=>[key,`plain ${candidate.dir}\n${key} x\n`,new RegExp(`not ${key}`)]),
  ['central missing',`plain ${candidate.dir}\n`,/is missing; plain coverage needs a selected owner policy/],
  ['central legacy',`plain ${candidate.dir}\n`,/required policy has an unknown or malformed entry/],
  ['plain file differs',`plain ${candidate.dir}\n`,/differs from the plain plan/],
 ]
 for(const [name,text,reason] of cases) {
  if(name!=='plain file differs')renameSync(PLAIN,away)
  const central=readFileSync(f.central)
  if(name==='central missing')rmSync(f.central)
  if(name==='central legacy')writeFileSync(f.central,'opt-out /nowhere\n')
  const was=snapshot(),a=activate(rollout(text,`unsafe-${name}.rollout`))
  refused(a);assert.match(a.err,reason,`${name}: ${a.err}`);assert.deepEqual(snapshot(),was,name)
  writeFileSync(f.central,central)
  if(name!=='plain file differs')renameSync(away,PLAIN)
 }
 assert.deepEqual(readFileSync(PLAIN),valid)
 // The owner's comments and spacing around the same entry are not a difference.
 const annotated=`# owner note\n\nplain ${covered.common}  \n`
 writeFileSync(PLAIN,annotated)
 success(activate(rollout(`lane fixture-lane landed\nrepo ${outside.dir}\nplain ${covered.dir}\n`,'again.rollout')))
 assert.equal(readFileSync(PLAIN,'utf8'),annotated)
}))

test('AC7: doctor confirms a listed plain registration and reports an unlisted one or a local override',keep(()=>{
 success(r)
 const doctor=()=>run(covered.dir,'node',[ROLLOUT,'doctor',covered.dir])
 const good=doctor();success(good);assert.equal(good.out,`${covered.dir}: ok\n`)
 const valid=readFileSync(PLAIN)
 writeFileSync(PLAIN,'# nothing listed\n')
 const unlisted=doctor();assert.equal(unlisted.code,1,unlisted.out+unlisted.err);assert.match(unlisted.out,/registered for the plain rule but not listed in .*plain/)
 rmSync(PLAIN)
 const gone=doctor();assert.equal(gone.code,1,gone.out+gone.err);assert.match(gone.out,/required plain coverage .*plain is missing/)
 writeFileSync(PLAIN,valid)
 ok(covered.dir,'config','hook.spec-lock-reference-transaction.enabled','false')
 try{const off=doctor();assert.equal(off.code,1,off.out+off.err);assert.match(off.out,/hook\.spec-lock-reference-transaction\.enabled/)}
 finally{run(covered.dir,'git',['config','--unset','hook.spec-lock-reference-transaction.enabled'])}
 success(doctor())
}))

test('AC8: the README rollback block removes plain coverage and leaves the selected repository alone',()=>{
 success(r)
 const readme=readFileSync(join(dirname(dirname(f.cli)),'README.md'),'utf8')
 const block=/^#### Rolling back plain coverage\n[\s\S]*?^```sh\n([\s\S]*?)^```$/m.exec(readme)
 assert.ok(block,'README has no plain rollback block')
 // An owner line naming the selected repository too: the block must still leave its registration.
 // A hand-mixed registration loses only its plain hook.
 const mixed=repository('mixed')
 register(join(mixed.common,'config'),dirname(f.cli),'plain',mixed.common)
 // Its push hook holds a selected command value and then a plain one.
 const selectedPush=ok(f.repo,'config','--get','hook.spec-lock-pre-push.command'),plainPush=ok(mixed.dir,'config','--get','hook.spec-lock-pre-push.command')
 ok(mixed.dir,'config','hook.spec-lock-pre-push.command',selectedPush);ok(mixed.dir,'config','--add','hook.spec-lock-pre-push.command',plainPush)
 writeFileSync(PLAIN,`${readFileSync(PLAIN,'utf8')}plain ${f.common}\nplain ${mixed.common}\n`)
 // Registered for the plain rule but no longer listed, as after the owner drops a line.
 const dropped=repository('dropped')
 register(join(dropped.common,'config'),dirname(f.cli),'plain',dropped.common)
 const b=run(f.dir,'sh',['-c',block[1]]);success(b)
 for(const key of ['command','event'])assert.equal(run(mixed.dir,'git',['config','--get',`hook.spec-lock-reference-transaction.${key}`]).code,1,key)
 assert.equal(ok(mixed.dir,'config','--get-all','hook.spec-lock-pre-push.command'),selectedPush)
 assert.equal(ok(mixed.dir,'config','--get','hook.spec-lock-pre-push.event'),'pre-push')
 assert.equal(readFileSync(PLAIN,'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).length,0)
 success(run(dropped.dir,'git',['branch','feature']))
 const hooks=run(covered.dir,'git',['hook','list','reference-transaction']);assert.equal(hooks.code,1,hooks.out+hooks.err);assert.equal(hooks.out,'')
 covered.reset();success(run(covered.dir,'git',['merge','--ff-only',covered.unproved]));covered.reset()
 assert.deepEqual(readFileSync(selectedConfig),before.config)
 // The rollback can be undone with the same rollout.
 success(activate(rollout(`lane fixture-lane landed\nrepo ${outside.dir}\nplain ${covered.dir}\n`,'after-rollback.rollout')))
 assert.match(ok(covered.dir,'hook','list','reference-transaction'),/spec-lock-reference-transaction/)
})
