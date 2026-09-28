import {test} from 'node:test'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {cpSync,existsSync,mkdirSync,readFileSync,renameSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {dirname,join,relative} from 'node:path'
import {fixture} from './portable-fixture.mjs'

function setup() {
 const f=fixture(), rollout=join(f.dir,'rollout'), central=join(f.dir,'.config/spec-lock/config')
 const common=f.ok('rev-parse','--path-format=absolute','--git-common-dir')
 const other=join(f.dir,'inventory'), remote=join(f.dir,'remote.git'), linked=join(f.dir,'linked')
 f.ok('clone','-q',f.repo,other);f.ok('init','-q','--bare',remote)
 f.ok('-C',remote,'config','hook.spec-lock-reference-transaction.enabled','false')
 f.ok('worktree','add','-q','-b','candidate',linked,f.B)
 f.ok('switch','-q','main')
 f.ok('-C',other,'switch','-q','main')
 f.ok('-C',remote,'fetch','-q',f.repo,`${f.B}:refs/heads/main`)
 writeFileSync(rollout,`mode selected\nevidence semantic-v2\nrepo ${other}\nselect ${linked}\n`)
 const cli=join(dirname(f.cli),'spec-lock-rollout')
 const activate=()=>f.run('node',[cli,'activate',rollout])
 const run=(...args)=>f.run('node',[cli,...args])
 const bad=(repo=f.repo)=>{
  const before=f.ok('-C',repo,'rev-parse','main')
  const r=f.git('-C',repo,'update-ref','refs/heads/main',f.C)
  refused(r);assert.equal(f.ok('-C',repo,'rev-parse','main'),before)
  return r
 }
 const push=(repo,pass)=>{
  const before=f.ok('-C',remote,'rev-parse','main')
  const r=f.git('-C',repo,'push',remote,`${f.C}:refs/heads/main`)
  assert.ok(Number.isInteger(r.code),r.out+r.err);assert.equal(r.code===0,pass,r.out+r.err)
  assert.equal(f.ok('-C',remote,'rev-parse','main'),pass?f.C:before)
 }
 const unaffected=()=>{
  writeFileSync(join(other,'unproved.js'),'unproved change\n');f.ok('-C',other,'add','.')
  f.ok('-C',other,'commit','-q','-m','test: unrelated commit')
  push(other,true)
 }
 return {...f,runRaw:f.run,rollout,central,common,other,remote,linked,activate,run,bad,push,unaffected}
}
const success=r=>assert.equal(r.code,0,r.out+r.err)
function refused(r){assert.ok(Number.isInteger(r.code),`process did not complete: ${r.out} ${r.err}`);assert.notEqual(r.code,0,r.out+r.err)}
const hooks=f=>f.ok('hook','list','reference-transaction')
function noHooks(f,repo=f.repo){const r=f.git('-C',repo,'hook','list','reference-transaction');assert.equal(r.code,1,r.err);assert.equal(r.out,'')}

test('AC1 preview is read-only, selected activation changes only common config and is idempotent',()=>{
 const f=setup(), global=readFileSync(f.env.GIT_CONFIG_GLOBAL), other=readFileSync(join(f.other,'.git/config'))
 const local=readFileSync(join(f.common,'config'))
 const preview=f.run('preview',f.rollout);success(preview)
 assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),global);assert.deepEqual(readFileSync(join(f.common,'config')),local)
 assert.equal(existsSync(f.central),false)
 success(f.activate());assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),global)
 assert.equal(JSON.parse(preview.out).registration.method,'common-repository-config')
 assert.deepEqual(JSON.parse(preview.out).registration.files,[join(f.common,'config')])
 assert.deepEqual(readFileSync(join(f.other,'.git/config')),other)
 assert.match(hooks(f),/spec-lock-reference-transaction/)
 noHooks(f,f.other)
 const registered=readFileSync(join(f.common,'config'));success(f.activate())
 assert.deepEqual(readFileSync(join(f.common,'config')),registered)
})

for(const failure of ['missing','malformed'])test(`AC2 ${failure} owner policy refuses selected Git and CLI but unrelated commit and push succeed`,()=>{
 const f=setup();success(f.activate())
 if(failure==='missing')rmSync(f.central);else writeFileSync(f.central,'mode selected\nevidence invalid\n')
 f.bad();f.bad(f.linked);f.push(f.repo,false)
 const cli=f.check(f.C);refused(cli);assert.match(cli.out+cli.err,/required policy/)
 f.unaffected()
})

test('AC3 deleted registered adapter blocks selected only',()=>{
 const f=setup(),copy=join(f.dir,'checker copy')
 mkdirSync(copy)
 for(const name of ['bin','lib','package.json'])cpSync(join(dirname(dirname(f.cli)),name),join(copy,name),{recursive:true})
 // Invoke the real rollout from a disposable installation, then remove its registered executable.
 success(f.runRaw('node',[join(copy,'bin/spec-lock-rollout'),'activate',f.rollout]))
 rmSync(join(copy,'bin/spec-lock-hook'));f.bad();f.push(f.repo,false);f.unaffected()
})

test('AC4 common config covers future worktrees, bare, aliases and literal path characters',t=>{
 const f=setup(),special=join(f.dir,"selected [x]*? it's space"),alias=join(f.dir,'alias'),bare=join(f.dir,'selected.git')
 f.ok('clone','-q',f.repo,special);f.ok('clone','-q','--bare',f.repo,bare)
 symlinkSync(special,alias)
 const common=f.ok('-C',special,'rev-parse','--path-format=absolute','--git-common-dir')
 writeFileSync(f.rollout,`mode selected\nevidence semantic-v2\nselect ${alias}\nselect ${bare}\n`)
 success(f.activate())
 const future=join(f.dir,'future');f.ok('-C',special,'worktree','add','-q','-b','future',future,f.B)
 f.ok('-C',special,'config','extensions.worktreeConfig','true')
 for(const repo of [special,alias,future,bare]){f.bad(repo);success(f.run('doctor',repo))}
 const caseAlias=special.replace('selected','SELECTED')
 t.diagnostic(`case alias available: ${existsSync(caseAlias)}`)
 if(existsSync(caseAlias))f.bad(caseAlias)
 const nested=join(special,'nested');f.ok('clone','-q',f.repo,nested)
 const similar=join(f.dir,'selected x space');f.ok('clone','-q',f.repo,similar)
 rmSync(f.central)
 for(const repo of [nested,similar,f.other]) {
  noHooks(f,repo)
  f.ok('-C',repo,'update-ref','refs/heads/main',f.C)
 }
 assert.match(readFileSync(join(common,'config'),'utf8'),/--selected/)
})

for(const conflict of ['global','local','included','worktree','disabled','duplicate','pending'])test(`AC5 ${conflict} conflict refuses before writes`,()=>{
 const f=setup()
 if(conflict==='global')f.ok('config','--global','hook.spec-lock-pre-push.command','false')
 if(conflict==='local')f.ok('config','hook.spec-lock-pre-push.command','false')
 if(conflict==='included'){
  const included=join(f.dir,'included');writeFileSync(included,'[hook "spec-lock-pre-push"]\n command = false\n')
  f.ok('config','include.path',included)
 }
 if(conflict==='worktree'){
  f.ok('config','extensions.worktreeConfig','true')
  f.ok('-C',f.linked,'config','--worktree','hook.spec-lock-pre-push.enabled','false')
 }
 if(conflict==='disabled'||conflict==='duplicate'){
  success(f.activate());rmSync(f.central)
  if(conflict==='disabled')f.ok('config','hook.spec-lock-pre-push.enabled','false')
  else f.ok('config','--add','hook.spec-lock-pre-push.event','pre-push')
 }
 if(conflict==='pending')writeFileSync(f.rollout,readFileSync(f.rollout,'utf8')+'lane worker pending\n')
 const global=readFileSync(f.env.GIT_CONFIG_GLOBAL), local=readFileSync(join(f.common,'config'))
 const r=f.activate();refused(r)
 assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),global);assert.deepEqual(readFileSync(join(f.common,'config')),local)
 assert.equal(existsSync(f.central),false)
})

test('AC5 doctor accepts exact registration and detects later worktree override',()=>{
 const f=setup();success(f.activate());success(f.run('doctor',f.repo,f.linked))
 f.ok('config','extensions.worktreeConfig','true')
 f.ok('-C',f.linked,'config','--worktree','hook.spec-lock-pre-push.command','true')
 const r=f.run('doctor',f.repo);refused(r);assert.match(r.out+r.err,/worktree|override/)
})

test('AC6 rollback removes only owned keys and retains pre-existing hooksPath',()=>{
 const f=setup();f.ok('config','core.hooksPath','.hooks');f.ok('config','task.preserve','keep')
 success(f.activate())
 for(const name of ['spec-lock-reference-transaction','spec-lock-pre-push'])for(const key of ['command','event'])f.ok('config','--file',join(f.common,'config'),'--unset-all',`hook.${name}.${key}`)
 rmSync(f.central)
 assert.equal(f.ok('config','core.hooksPath'),'.hooks');assert.equal(f.ok('config','task.preserve'),'keep')
 noHooks(f);f.ok('update-ref','refs/heads/main',f.C)
})

test('AC6 existing pre-push hook still runs alongside scoped hooks',()=>{
 const f=setup(),hooksDir=join(f.repo,'.hooks'),marker=join(f.dir,'existing-ran')
 mkdirSync(hooksDir);writeFileSync(join(hooksDir,'pre-push'),`#!/bin/sh\nprintf ran > '${marker}'\n`,{mode:0o755})
 f.ok('config','core.hooksPath','.hooks');success(f.activate())
 f.ok('push',f.remote,`${f.B}:refs/heads/feature`)
 assert.equal(readFileSync(marker,'utf8'),'ran')
})

test('AC5 all selected repositories are checked before the first write',()=>{
 const f=setup();writeFileSync(f.rollout,readFileSync(f.rollout,'utf8')+`select ${f.other}\n`)
 f.ok('-C',f.other,'config','hook.spec-lock-pre-push.command','false')
 const paths=[f.env.GIT_CONFIG_GLOBAL,join(f.common,'config'),join(f.other,'.git/config')]
 const before=paths.map(path=>readFileSync(path))
 const r=f.activate();refused(r)
 paths.forEach((path,i)=>assert.deepEqual(readFileSync(path),before[i]));assert.equal(existsSync(f.central),false)
})

test('AC5 doctor detects an included override added after registration',()=>{
 const f=setup();success(f.activate())
 const included=join(f.dir,'included config');writeFileSync(included,'[hook "spec-lock-pre-push"]\n command = true\n')
 f.ok('config','include.path',included)
 const r=f.run('doctor',f.repo);refused(r);assert.match(r.out+r.err,/conflicts/)
})

test('AC1 AC5 a common config symlink to global config refuses before any write',()=>{
 const f=setup(),config=join(f.common,'config')
 writeFileSync(f.env.GIT_CONFIG_GLOBAL,readFileSync(config));rmSync(config);symlinkSync(f.env.GIT_CONFIG_GLOBAL,config)
 const before=readFileSync(f.env.GIT_CONFIG_GLOBAL)
 const r=f.activate();refused(r)
 assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),before);assert.equal(existsSync(f.central),false)
})

test('AC1 AC5 a common config included globally refuses before any write',()=>{
 const f=setup(),config=join(f.common,'config')
 f.ok('config','--global','include.path',config)
 const before=readFileSync(config),global=readFileSync(f.env.GIT_CONFIG_GLOBAL)
 const r=f.activate();refused(r)
 assert.deepEqual(readFileSync(config),before);assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),global)
 assert.equal(existsSync(f.central),false)
})

test('AC4 AC5 missing prunable worktrees do not block accessible repository activation or doctor',()=>{
 const f=setup();writeFileSync(f.rollout,`mode selected\nevidence semantic-v2\nselect ${f.repo}\n`)
 rmSync(f.linked,{recursive:true})
 success(f.activate());success(f.run('doctor',f.repo));f.bad()
})

test('AC5 a valueless conflict reports its complete key before any write',()=>{
 const f=setup(),config=join(f.common,'config')
 writeFileSync(config,readFileSync(config,'utf8')+'\n[hook "spec-lock-pre-push"]\n enabled\n')
 const before=readFileSync(config),r=f.activate();refused(r)
 assert.match(r.err,/hook\.spec-lock-pre-push\.enabled in local/)
 assert.deepEqual(readFileSync(config),before);assert.equal(existsSync(f.central),false)
})

for(const kind of ['conditional','empty','nested'])test(`AC1 AC2 AC5 ${kind} global include refuses before writing selected config`,()=>{
 const f=setup(),config=join(f.common,'config')
 if(kind==='empty')writeFileSync(config,'')
 const key=kind==='conditional'?`includeIf.gitdir:${f.other}/.git.path`:'include.path'
 if(kind==='nested'){
  const parent=join(f.dir,'include folder');mkdirSync(parent)
  const file=join(parent,'settings');writeFileSync(file,`[includeIf \"gitdir:${f.other}/.git\"]\n path = ${relative(parent,config)}\n`)
  f.ok('config','--global','include.path',file)
 }else f.ok('config','--global',key,config)
 const before=readFileSync(config),global=readFileSync(f.env.GIT_CONFIG_GLOBAL)
 const r=f.activate();refused(r)
 assert.deepEqual(readFileSync(config),before);assert.deepEqual(readFileSync(f.env.GIT_CONFIG_GLOBAL),global)
 assert.equal(existsSync(f.central),false)
})

test('AC2 AC3 inherited local registration checks repository identity before policy or executable',()=>{
 const f=setup(),copy=join(f.dir,'checker copy')
 mkdirSync(copy);for(const name of ['bin','lib','package.json'])cpSync(join(dirname(dirname(f.cli)),name),join(copy,name),{recursive:true})
 success(f.runRaw('node',[join(copy,'bin/spec-lock-rollout'),'activate',f.rollout]))
 // A later owner include can inherit hook commands. Their repository binding must still isolate them.
 f.ok('-C',f.other,'config','include.path',join(f.common,'config'))
 rmSync(f.central);rmSync(join(copy,'bin/spec-lock-hook'))
 f.bad();f.push(f.repo,false);f.unaffected()
})

test('AC2 a moved selected repository refuses branch updates and pushes until owner migration',()=>{
 const f=setup();success(f.activate())
 const moved=join(f.dir,'moved repository');renameSync(f.repo,moved)
 // fixture.run has the former repo as cwd, so execute from a surviving scratch folder instead.
 const invoke=(args)=>spawnSync('git',['-C',moved,...args],{cwd:f.dir,env:f.env,encoding:'utf8',timeout:30000})
 const before=invoke(['rev-parse','main']).stdout.trim()
 const update=invoke(['update-ref','refs/heads/main',f.C]);assert.ifError(update.error);assert.ok(Number.isInteger(update.status),update.stderr);assert.notEqual(update.status,0,update.stdout+update.stderr)
 assert.equal(invoke(['rev-parse','main']).stdout.trim(),before)
 const push=invoke(['push',f.remote,`${f.C}:refs/heads/main`]);assert.ifError(push.error);assert.ok(Number.isInteger(push.status),push.stderr);assert.notEqual(push.status,0,push.stdout+push.stderr)
 const remote=spawnSync('git',['-C',f.remote,'rev-parse','main'],{cwd:f.dir,env:f.env,encoding:'utf8'})
 assert.equal(remote.status,0,remote.stderr);assert.equal(remote.stdout.trim(),f.B)
})
