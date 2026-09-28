import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {semanticFixture,prepare,semanticExport,attachSemantic,snapshot} from './semantic-fixture.mjs'
import {attach,SPEC} from './portable-fixture.mjs'
import {register} from '../lib/lock.mjs'
export function policyFixture(cli) {
 const f=semanticFixture(cli)
 f.central=join(f.dir,'.config/spec-lock/config');mkdirSync(dirname(f.central),{recursive:true})
 f.common=f.ok('rev-parse','--path-format=absolute','--git-common-dir')
 f.policy=`mode selected\nevidence semantic-v2\nselect ${f.common}\nintegration integration/candidate\n`
 writeFileSync(f.central,f.policy)
 const p=prepare(f);f.captures=p
 f.tips={unproved:f.C}
 f.tips.missing=attach(f,'missing',{files:{'docs/proof/t1.md':`---\nspec: ${SPEC}\n---\nAC1 AC2\n`}})
 f.tips.legacy=attach(f,'legacy')
 for(const [name,id] of [['invalid','absent-oracle'],['valid','complete']]) {
  f.ok('switch','-q','-C',name,f.C)
  const e=semanticExport(f,p,name);assert.equal(e.result.code,0,e.result.err)
  f.tips[name]=attachSemantic(f,e,id)
 }
 f.inputs=Object.fromEntries(Object.entries(f.tips).map(([k,v])=>[k,snapshot(f,v)]))
 f.bare=join(f.dir,'remote.git');f.ok('init','-q','--bare',f.bare)
 f.ok('-C',f.bare,'config','hook.spec-lock-reference-transaction.enabled','false')
 f.ok('-C',f.bare,'fetch','-q',f.repo,`${f.B}:refs/heads/main`)
 f.ok('remote','add','fixture',f.bare)
 f.linked=join(f.dir,'linked');f.ok('worktree','add','-q','-b','integration/candidate',f.linked,f.B)
 f.enable=(selected=true)=>register(f.env.GIT_CONFIG_GLOBAL,dirname(f.cli),selected?'selected':'legacy')
 f.attempt=(adapter,tip)=>{
  const branch=adapter==='linked'?'integration/candidate':'main'
  const cwd=adapter==='linked'?f.linked:f.repo
  f.ok('-c','hook.spec-lock-reference-transaction.enabled=false','update-ref',`refs/heads/${branch}`,f.B)
  f.ok('-C',f.bare,'update-ref','refs/heads/main',f.B)
  if(adapter==='merge'||adapter==='linked'){
   f.ok('-C',cwd,'switch','-q',branch)
   f.ok('-C',cwd,'-c','hook.spec-lock-reference-transaction.enabled=false','reset','--hard',f.B)
  }
  const args=adapter==='cli'?[f.cli,'check',f.B,tip]:adapter==='push'?['push','fixture',`${tip}:refs/heads/main`]:['-C',cwd,'merge','--ff-only',tip]
  const command=adapter==='cli'?'node':'git'
  const before=adapter==='push'?f.ok('-C',f.bare,'rev-parse','main'):f.ok('rev-parse',branch)
  const started=performance.now(),r=f.run(command,args),milliseconds=performance.now()-started
  const after=adapter==='push'?f.ok('-C',f.bare,'rev-parse','main'):f.ok('rev-parse',branch)
  if(adapter==='merge'||adapter==='linked') f.ok('-C',cwd,'-c','hook.spec-lock-reference-transaction.enabled=false','reset','--hard',f.B)
  return {command:[command,...args],before,after,target:tip,...r,milliseconds}
 }
 return f
}
