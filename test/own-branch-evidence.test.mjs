// docs/specs/2026-10-23-own-branch-evidence.md: version 2 evidence recorded on the job's own commit C
// stands on a landed commit P while every file the approvals recorded on C bind is unchanged.
// Every repository is synthetic and HOME is the fixture's temp directory.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chmodSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {semanticFixture,prepare,semanticExport,attachSemantic} from './semantic-fixture.mjs'
import {fixture,attach,capture,exported,SPEC} from './portable-fixture.mjs'
import {register} from '../lib/lock.mjs'

const f=semanticFixture()
// The job's commit C also adds a file it changed but no approval binds.
f.C=f.commit({'src/notes.mjs':'export const notes = []\n'})
const central=join(f.dir,'.config/spec-lock/config');mkdirSync(dirname(central),{recursive:true})
const common=f.ok('rev-parse','--path-format=absolute','--git-common-dir')
writeFileSync(central,`mode selected\nevidence semantic-v2\nselect ${common}\n`)
f.ok('switch','-q','-c','own',f.C)
const e=semanticExport(f,prepare(f),'valid');assert.equal(e.result.code,0,e.result.err)
const valid=attachSemantic(f,e,'complete')
const manifest=`${e.path}/manifest.json`
const where=`docs/proof/t1.md: evidence ${manifest}: reviewed: `
const BOUND=(path,P)=>`- ${where}${path} is bound by the evidence recorded on ${f.C} and changed before the landed commit ${P}; capture it on the landed tip`
const CHANGED=(path)=>new RegExp(`${path.replace(/[.*]/g,'\\$&')} changed after the reviewed commit`)
const check=(tip,old=f.B,command='check',g=f)=>g.run('node',[g.cli,command,old,tip])
const faults=(r)=>r.out.split('\n').filter(l=>l.startsWith('- '))
const ok=(r,label='')=>{assert.equal(r.code,0,`${label}${r.out}${r.err}`);assert.match(r.out,/spec-lock: ok/)}
// Commits on top of the valid landing, as later batch commits would be.
const after=(name,files,prep)=>{f.ok('switch','-q','-C',name,valid);return f.commit(files,prep)}
// The valid manifest after edit(m), committed on top of the valid landing, as a proof edit.
const edited=(name,edit)=>{const m=structuredClone(e.manifest);edit(m);return after(name,{[manifest]:JSON.stringify(m,null,2)+'\n'})}

test('AC1: files no approval on C binds may change after it; exact identity holds elsewhere',()=>{
 ok(check(valid),'valid: ')
 f.ok('switch','-q','-C','other',f.B);f.commit({'src/other.ts':'export const other = 1\n'})
 f.ok('switch','-q','-C','merged',valid);f.ok('merge','-q','--no-ff','-m','test: merge another lane','other')
 const merged=f.ok('rev-parse','HEAD')
 const notes=after('notes',{'src/notes.mjs':'export const notes = [1]\n'})
 const proof=after('proof-edit',{'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${manifest}\n---\nAC1 AC2\n\nEdited after export.\n`})
 for(const [name,tip] of [['merged',merged],['notes',notes],['proof-edit',proof]]) ok(check(tip),`${name}: `)
 // The same landing through the registered reference-transaction hook.
 register(f.env.GIT_CONFIG_GLOBAL,dirname(f.cli),'selected')
 f.ok('-c','hook.spec-lock-reference-transaction.enabled=false','update-ref','refs/heads/main',f.B)
 const hooked=f.run('git',['update-ref','refs/heads/main',merged]);assert.equal(hooked.code,0,hooked.out+hooked.err)
 assert.equal(f.ok('rev-parse','main'),merged)

 // A version 1 manifest keeps exact identity, even when it carries an approvals list.
 const v1=attach(f,'v1',{edit:m=>{m.approvals=[{revision:f.C,inputs:[{path:'src/value.mjs'}]}]}})
 ok(check(v1,f.C),'v1: ')
 const v1later=f.commit({'docs/notes/later.md':'A later note.\n'})
 const r1=check(v1later,f.C);assert.equal(r1.code,1,r1.out+r1.err);assert.match(r1.out,CHANGED('docs/notes/later.md'))
 // The candidate binding-only check keeps exact identity.
 const g=fixture(),c=capture(g),x=exported(g,c,'candidate');assert.equal(x.result.code,0,x.result.err)
 const candidate=g.commit({'docs/proof/t1.md':`---\nspec: ${SPEC}\nevidence: ${x.path}/manifest.json\n---\nAC1 AC2\n`})
 ok(check(candidate,g.B,'check-candidate',g),'candidate: ')
 const r2=check(g.commit({'src/other.ts':'export const other = 1\n'}),g.B,'check-candidate',g);assert.equal(r2.code,1,r2.out+r2.err);assert.match(r2.out,CHANGED('src/other.ts'))
 // Approvals that bind nothing on C, or only files under docs/proof/, keep exact identity.
 for(const [name,edit] of [['unbound',m=>{m.approvals[0].revision=f.R}],['proof-only',m=>{m.approvals[0].inputs=[{path:'docs/proof/t1.md',sha256:'0'.repeat(64)}]}]]) {
  edited(name,edit)
  const r3=check(f.commit({'src/other.ts':'export const other = 1\n'}));assert.equal(r3.code,1,`${name}: ${r3.out}${r3.err}`);assert.match(r3.out,CHANGED('src/other.ts'))
 }
})

test('AC2: a bound file that differs between C and P refuses, naming it; proof and ancestry rules hold',()=>{
 for(const [path,files] of [['test/expected.txt',{'test/expected.txt':'15\n'}],['requirements.txt',{'requirements.txt':null}]]) {
  const tip=after(`bound-${path}`,files),r=check(tip)
  assert.equal(r.code,1,r.out+r.err);assert.deepEqual(faults(r),[BOUND(path,tip)])
 }
 // A bound file stays bound when the owner lists it for a bot, and when only its mode changes.
 const owner=join(f.dir,'.config/spec-lock/after-review');writeFileSync(owner,`after-review ${common} test/expected.txt\n`)
 const listed=after('bound-listed',{'test/expected.txt':'15\n'}),l=check(listed);rmSync(owner)
 assert.equal(l.code,1,l.out+l.err);assert.deepEqual(faults(l),[BOUND('test/expected.txt',listed)])
 const exec=after('bound-exec',{},repo=>chmodSync(join(repo,'requirements.txt'),0o755)),x=check(exec)
 assert.equal(f.ok('ls-tree',exec,'--','requirements.txt').split(' ')[0],'100755')
 assert.equal(x.code,1,x.out+x.err);assert.deepEqual(faults(x),[BOUND('requirements.txt',exec)])
 // A second approval recorded on C binds a file C does not hold; adding it later refuses.
 ok(check(edited('later',m=>{m.approvals.push({...m.approvals[0],id:'reproducer-approval',role:'reproducer',inputs:[{path:'src/later.mjs',sha256:'0'.repeat(64)}]})})),'later before: ')
 const added=f.commit({'src/later.mjs':'export const later = 1\n'}),r=check(added)
 assert.equal(r.code,1,r.out+r.err);assert.deepEqual(faults(r),[BOUND('src/later.mjs',added)])
 // A bound folder: one that holds a changed file, and one absent at C and added after it.
 for(const [path,name,files] of [['src','folder-child',{'src/notes.mjs':'export const notes = [2]\n'}],['src/later','folder-added',{'src/later/x.mjs':'export const x = 1\n'}]]) {
  ok(check(edited(name,m=>{m.approvals.push({...m.approvals[0],id:`${name}-approval`,role:'reproducer',inputs:[{path,sha256:'0'.repeat(64)}]})})),`${name} before: `)
  const tip=f.commit(files),r=check(tip)
  assert.equal(r.code,1,r.out+r.err);assert.deepEqual(faults(r),[BOUND(path,tip)])
 }
 const link=check(after('link',{},repo=>symlinkSync('t1.md',join(repo,'docs/proof/t1.link'))))
 assert.equal(link.code,1,link.out+link.err);assert.match(link.out,CHANGED('docs/proof/t1.link'))
 const copy=f.ok('commit-tree',`${valid}^{tree}`,'-p',f.B,'-m','test: the valid tree without C')
 const lost=check(copy);assert.equal(lost.code,1,lost.out+lost.err);assert.match(lost.out,new RegExp(`reviewed: ${f.C} is not the landed commit ${copy} or an ancestor of it`))
})

test('AC3: an approval recorded on another revision binds nothing',()=>{
 edited('red-binds',m=>{m.approvals.push({...m.approvals[0],id:'red-elsewhere',role:'red',revision:f.R,inputs:[{path:'src/red.ts',sha256:'0'.repeat(64)}]})})
 ok(check(f.commit({'src/red.ts':'export const red = 1\n'})))
})

test('AC4: the README states the rule',()=>{
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8')
 const rules=/\n## Evidence bindings\n([\s\S]*?)\n### /.exec(readme)?.[1] ?? ''
 assert.match(rules,/is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip/)
 assert.match(rules,/`approvals\[\]` whose `revision` is `reviewed`/)
 assert.match(rules,/Version 1 manifests and the candidate binding-only check keep exact identity/)
})
