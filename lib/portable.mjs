import {ownerPolicy} from './policy.mjs'
import { semanticApproval } from './semantic.mjs'
// Candidate local records. These bindings do not authenticate actors or judge semantics.
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, lstatSync, realpathSync, readdirSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { tmpdir } from 'node:os'
import { join, resolve, relative, dirname } from 'node:path'

export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export const runDigest = run => digest(JSON.stringify({...run,stdout:{bytes:run.stdout?.bytes,sha256:run.stdout?.sha256},stderr:{bytes:run.stderr?.bytes,sha256:run.stderr?.sha256}},(_key,value)=>value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value))
export const same = isDeepStrictEqual
export const repoPath = p => typeof p === 'string' && p.split('/').every(s=>s && s!=='.' && s!=='..') && !p.includes('\\')
const requireThat = (yes,message) => { if (!yes) throw Error(message) }
const inside = (root,path) => {const rel=relative(root,path);return rel!=='..' && !rel.startsWith('../')}
const text = v => typeof v === 'string' && v.trim().length > 0
const oid = v => typeof v === 'string' && /^[a-f0-9]{40}([a-f0-9]{24})?$/.test(v)
const git = (cwd,...args) => execFileSync('git',['--literal-pathspecs',...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
export function identity() {
  const root = new URL('../',import.meta.url)
  const paths=['bin/spec-lock','bin/spec-lock-hook',...readdirSync(new URL('lib/',root)).filter(p=>p.endsWith('.mjs')).sort().map(p=>`lib/${p}`)]
  const hash=createHash('sha256')
  for(const path of paths) hash.update(path).update('\0').update(readFileSync(new URL(path,root)))
  const {version}=JSON.parse(readFileSync(new URL('package.json',root)))
  return `${version}+${hash.digest('hex').slice(0,12)}`
}
export function approvalFault(a) {
  requireThat(a?.version===2,'approval version must be 2')
  for(const k of ['id','task','author','verifier','approved_by','authorization']) requireThat(text(a[k]),`approval ${k} required`)
  requireThat(a.author!==a.verifier && a.approved_by===a.verifier,'approval requires distinct author/verifier and approving verifier session')
  requireThat(repoPath(a.spec) && oid(a.spec_blob) && oid(a.base) && oid(a.revision),'approval spec/blob/base/revision invalid')
  if(a.control!==undefined) {
    requireThat(oid(a.control?.baseline) && a.control.baseline===a.base,'control baseline must equal the approved base commit')
    requireThat(Array.isArray(a.control.overlay) && a.control.overlay.every(i=>repoPath(i?.path) && /^[a-f0-9]{64}$/.test(i.sha256)) && new Set(a.control.overlay.map(i=>i.path)).size===a.control.overlay.length,'control overlay paths or digests invalid')
  }
  requireThat(Array.isArray(a.criteria) && a.criteria.length>0 && a.criteria.every(c=>/^AC\d+$/.test(c)) && new Set(a.criteria).size===a.criteria.length,'approval criteria invalid')
  requireThat(Array.isArray(a.argv) && a.argv.length>0 && a.argv.every(x=>typeof x==='string' && !x.includes('\0')) && text(a.argv[0]),'approval argv invalid')
  requireThat(a.cwd==='.' || repoPath(a.cwd),'approval cwd invalid')
  requireThat(['green','red','reproducer'].includes(a.role),'approval role invalid')
  requireThat(Number.isInteger(a.expected?.exit) && typeof a.expected?.stdout==='string','approval expected outcome required')
  requireThat(Number.isInteger(a.limits?.timeout_ms) && a.limits.timeout_ms>=1 && a.limits.timeout_ms<=3600000,'approval timeout bound invalid')
  requireThat(Number.isInteger(a.limits?.output_bytes) && a.limits.output_bytes>=1 && a.limits.output_bytes<=16777216,'approval output bound invalid')
  requireThat(Array.isArray(a.inputs) && a.inputs.length>0 && a.inputs.every(x=>repoPath(x?.path) && /^[a-f0-9]{64}$/.test(x.sha256)) && new Set(a.inputs.map(x=>x.path)).size===a.inputs.length,'approval selected inputs invalid')
  requireThat(Array.isArray(a.sessions) && a.sessions.every(s=>text(s?.id) && s.source?.session_id===s.id) && new Set(a.sessions.map(s=>s.id)).size===a.sessions.length,'approval session source records invalid')
  for(const session of a.sessions) {
    requireThat(text(session.source_raw),'approval raw session JSON required')
    requireThat(same(JSON.parse(session.source_raw),session.source),'approval raw session source differs')
  }
  for(const id of [a.author,a.verifier]) requireThat(a.sessions.some(s=>s.id===id),'approval session source absent')
}
function semanticBytes(root,revision,path) {
  const item=git(root,'ls-tree',revision,'--',path)
  if(!item)return null
  requireThat(/^100(644|755) blob /.test(item),'semantic input must be a tracked regular file')
  return execFileSync('git',['cat-file','blob',`${revision}:${path}`],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:256<<20})
}
function inputBytes(tree,inputs) {
  return inputs.map(({path})=>{
    try {
      const file=join(tree,path)
      requireThat(inside(tree,realpathSync(file)) && lstatSync(file).isFile(),'input is not regular')
      return {path,sha256:digest(readFileSync(file))}
    } catch { return {path,sha256:null} }
  })
}
export async function capture(approvalFile,destination,explicit) {
  requireThat(process.platform!=='win32','capture requires POSIX process groups')
  const approvalBytes=readFileSync(approvalFile), a=JSON.parse(approvalBytes)
  approvalFault(a)
  if(explicit) requireThat(same(explicit,a.argv),'command differs from approval')
  const root=git(process.cwd(),'rev-parse','--show-toplevel')
  requireThat(git(root,'rev-parse',`${a.revision}^{commit}`)===a.revision,'approved revision is not a commit')
  requireThat(git(root,'rev-parse',`${a.revision}:${a.spec}`)===a.spec_blob,'approved spec blob differs')
  git(root,'merge-base','--is-ancestor',a.base,a.revision)
  for(const input of a.inputs) {
    const entry=git(root,'ls-tree',a.revision,'--',input.path)
    requireThat(/^100(644|755) blob /.test(entry),'selected input must be tracked regular file')
    requireThat(await committedDigest(root,`${a.revision}:${input.path}`)===input.sha256,'selected input differs from approval')
  }
  if(a.semantic) semanticApproval(a,(rev,path)=>semanticBytes(root,rev,path),Date.now())
  const output=resolve(destination)
  const temp=realpathSync(mkdtempSync(join(tmpdir(),'spec-lock-capture-'))), tree=join(temp,'checkout')
  let added=false, saved=null, checkoutLink=null
  try {
    git(root,'-c','core.hooksPath=/dev/null','worktree','add','--detach',tree,a.revision); added=true
    checkoutLink=readFileSync(join(tree,'.git'))
    requireThat(!git(tree,'status','--porcelain','--untracked-files=all'),'verification checkout is dirty')
    const cwd=realpathSync(join(tree,a.cwd))
    requireThat(inside(tree,cwd) && lstatSync(cwd).isDirectory(),'cwd escapes verification checkout')
    const before=inputBytes(tree,a.inputs)
    requireThat(same(before,a.inputs),'selected input differs before execution')
    mkdirSync(output) // All approval checks passed; refuse existing capture destinations.
    const started=new Date().toISOString(), start=performance.now()
    const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(GIT_|FM_|SPEC_LOCK_|NODE_TEST_CONTEXT$|NODE_OPTIONS$)/.test(k)))
    // Keep caller scratch Git configuration; do not expose inherited repository selectors.
    for(const key of ['HOME','GIT_CONFIG_GLOBAL','GIT_CONFIG_NOSYSTEM']) if(process.env[key]) env[key]=process.env[key]
    const result=await execute(a.argv,cwd,env,a.limits)
    const after=inputBytes(tree,a.inputs)
    let dirty=null, actualRevision=null, inspectionError=null
    try {requireThat(lstatSync(join(tree,'.git')).isFile() && readFileSync(join(tree,'.git')).equals(checkoutLink),'checkout metadata changed');dirty=git(tree,'status','--porcelain','--untracked-files=all');actualRevision=git(tree,'rev-parse','HEAD')}
    catch {inspectionError='verification checkout could not be inspected';result.outcome='inspection-failed'}
    if(!inspectionError && (!same(before,after) || dirty || actualRevision!==a.revision)) result.outcome='tracked-files-changed'
    const expectedMatch=result.outcome==='exited' && result.exit===a.expected.exit && result.stdout.equals(Buffer.from(a.expected.stdout))
    const run={expected_match:expectedMatch,id:randomUUID(),approval:a.id,executor:a.verifier,role:a.role,revision:a.revision,argv:a.argv,cwd:a.cwd,before,after,checkout_before:a.revision,checkout_after:actualRevision,status_before:'',status_after:dirty,started,ended:new Date().toISOString(),duration_ms:performance.now()-start,limits:a.limits,outcome:result.outcome,exit:result.exit,signal:result.signal}
    for(const stream of ['stdout','stderr']) {
      writeFileSync(join(output,stream),result[stream])
      run[stream]={path:stream,bytes:result[stream].length,sha256:digest(result[stream])}
    }
    const record={version:2,inspection_error:inspectionError,recorder:identity(),approval:a,approval_sha256:digest(approvalBytes),approval_raw:approvalBytes.toString('utf8'),run}
    writeFileSync(join(output,'capture.json'),JSON.stringify(record,null,2)+'\n')
    saved={record,success:run.outcome==='exited' && run.exit===0 && run.expected_match}
    return saved
  } finally {
    if(added) {
      try {
        // Recreate our own deleted directories without following replacement symlinks.
        for(const path of [temp,tree]) {
          try {if(!lstatSync(path).isDirectory())rmSync(path,{recursive:true,force:true})} catch(e){if(e.code!=='ENOENT')throw e}
          mkdirSync(path,{recursive:true})
        }
        // Restore only the metadata link created for this temporary checkout.
        if(checkoutLink){rmSync(join(tree,'.git'),{recursive:true,force:true});writeFileSync(join(tree,'.git'),checkoutLink)}
        git(root,'-c','core.hooksPath=/dev/null','worktree','remove','--force',tree)
      } catch {
        if(saved){saved.success=false;if(saved.record.run.outcome==='exited')saved.record.run.outcome='cleanup-failed';saved.record.cleanup_error='capture worktree cleanup failed';writeFileSync(join(output,'capture.json'),JSON.stringify(saved.record,null,2)+'\n')}
        else throw Error('capture worktree cleanup failed')
      }
    }
    rmSync(temp,{recursive:true,force:true})
  }
}
async function committedDigest(cwd,object) {
  return new Promise((resolveHash,reject)=>{
    const hash=createHash('sha256'),child=spawn('git',['cat-file','blob',object],{cwd,stdio:['ignore','pipe','ignore']})
    child.stdout.on('data',bytes=>hash.update(bytes));child.on('error',reject)
    child.on('close',code=>code===0?resolveHash(hash.digest('hex')):reject(Error('selected input blob unreadable')))
  })
}
async function execute(argv,cwd,env,limits) {
  return new Promise(resolveRun=>{
    const chunks={stdout:[],stderr:[]}; let length=0,outcome='exited',timer
    const child=spawn(argv[0],argv.slice(1),{cwd,env,detached:true,stdio:['ignore','pipe','pipe']})
    const stop=(why)=>{ if(outcome==='exited') outcome=why; if(child.pid) {try {process.kill(-child.pid,'SIGKILL')} catch(e) {if(e.code!=='ESRCH') throw e}}; child.stdout.destroy();child.stderr.destroy() }
    const interrupt=()=>stop('interrupted')
    process.on('SIGINT',interrupt); process.on('SIGTERM',interrupt)
    for(const stream of ['stdout','stderr']) child[stream].on('data',bytes=>{
      const kept=bytes.subarray(0,Math.max(0,limits.output_bytes-length));chunks[stream].push(kept);length+=kept.length
      if(kept.length!==bytes.length) stop('output-over-bound')
    })
    child.on('error',()=>{outcome='spawn-error'})
    timer=setTimeout(()=>stop('timeout'),limits.timeout_ms)
    child.on('close',(exit,signal)=>{
      clearTimeout(timer); process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt)
      // Clean up descendants started in this capture's process group, including closed pipes.
      if(child.pid) {try {process.kill(-child.pid,'SIGKILL')} catch(e) {if(e.code!=='ESRCH') throw e}}
      resolveRun({outcome:signal && outcome==='exited'?'interrupted':outcome,exit,signal,stdout:Buffer.concat(chunks.stdout),stderr:Buffer.concat(chunks.stderr)})
    })
  })
}

export function exportCapture(scratch,judgmentFile,directory,policy=ownerPolicy()) {
  requireThat(repoPath(directory) && directory.startsWith('docs/proof/'),'export destination must be under docs/proof/')
  const root=git(process.cwd(),'rev-parse','--show-toplevel'), dest=join(root,directory)
  // Resolve parent components before writing so a symlink cannot export outside the repository.
  let parent=dirname(dest)
  while(parent!==root) {try {requireThat(realpathSync(parent)===parent,'export parent is a symlink');break} catch(e){if(e.code!=='ENOENT') throw e;parent=dirname(parent)}}
  const c=JSON.parse(readFileSync(join(scratch,'capture.json'))), a=c.approval, run=c.run
  approvalFault(a)
  if(a.semantic)semanticApproval(a,(rev,path)=>semanticBytes(root,rev,path),Date.parse(run.started))
  requireThat(digest(c.approval_raw)===c.approval_sha256 && same(JSON.parse(c.approval_raw),a),'capture approval changed')
  const bundle=JSON.parse(readFileSync(judgmentFile)), judges=Array.isArray(bundle)?bundle:bundle.judges;requireThat(Array.isArray(judges),'judgments must be a list')
  const bytes={stdout:readFileSync(join(scratch,'stdout')),stderr:readFileSync(join(scratch,'stderr'))}
  for(const s of ['stdout','stderr']) requireThat(digest(bytes[s])===run[s]?.sha256 && bytes[s].length===run[s]?.bytes,`capture ${s} changed`)
  mkdirSync(dirname(dest),{recursive:true});mkdirSync(dest)
  const artifact=(name,bytes)=>{writeFileSync(join(dest,name),bytes);return {path:`${directory}/${name}`,bytes:Buffer.byteLength(bytes),sha256:digest(bytes)}}
  const exportedRun={...run,stdout:artifact('stdout',bytes.stdout),stderr:artifact('stderr',bytes.stderr)}
  const approved={...a,raw:artifact('approval.json',c.approval_raw)}
  const sessions=a.sessions.map((s,i)=>({id:s.id,source:artifact(`session-${i}.json`,s.source_raw)}))
  const supported=run.outcome==='exited' && run.exit===0 && run.role==='green' && run.expected_match===true
  const m={version:2,task:a.task,spec:a.spec,spec_blob:a.spec_blob,base:a.base,reviewed:a.revision,policy:policy.required ? policy.id : 'candidate-bindings-v2',recorder:c.recorder,checker:identity(),provenance:'unauthenticated',approvals:[approved],sessions,runs:[exportedRun],judges,
    claims:a.criteria.map(ac=>({spec:a.spec,spec_blob:a.spec_blob,ac,state:supported?'supported':'unsupported',run:run.id,judge:judges.find(j=>j.ac===ac)?.id ?? null,oracle:null,red:null,golden:[]})),oracle_reviews:[],red_evidence:[],golden_reviews:[]}
  if(a.semantic) {
    m.oracle_reviews=a.semantic.criteria.map(c=>c.oracle)
    m.golden_reviews=a.semantic.golden_reviews
    requireThat(Array.isArray(bundle.red_captures??[]),'red captures must be a list')
    for(const [i,r] of (bundle.red_captures??[]).entries()) {
      requireThat(Array.isArray(r.reviews),'red reviews must be a list')
      const file=join(dest,`red-${i}-judgments.json`);writeFileSync(file,'[]')
      const red=exportCapture(r.scratch,file,`${directory}/red-${i}`,policy)
      for(const review of r.reviews)m.red_evidence.push({...review,capture:{approval:red.approvals[0],run:red.runs[0],sessions:red.sessions,recorder:red.recorder}})
    }
    for(const c of m.claims){c.oracle=m.oracle_reviews.find(o=>o.ac===c.ac)?.id??null;c.red=m.red_evidence.find(r=>r.ac===c.ac)?.id??null;c.golden=m.golden_reviews.filter(g=>g.ac===c.ac).map(g=>g.id)}
  }
  writeFileSync(join(dest,'manifest.json'),JSON.stringify(m,null,2)+'\n')
  return m
}

// Additional v2 rules share the committed-object access used by the v1 checker.
export function portableFaults(m,{spec,ids,entry,blob,C,P,bad,policy='candidate-bindings-v2'}) {
  const need=(ok,field,message)=>{if(!ok)bad(field,message)}
  const artifact=(o,at)=>{
    const e=repoPath(o?.path) && o.path.startsWith('docs/proof/') && entry(P,o.path)
    if(!e || e.mode!=='100644'){bad(at,'not a committed regular proof artifact');return null}
    const bytes=blob(e.oid)
    if(bytes.length!==o.bytes || digest(bytes)!==o.sha256){bad(at,'artifact bytes or digest changed');return null}
    return bytes
  }
  const one=(list,id,at)=>{
    const matches=Array.isArray(list)?list.filter(x=>x?.id===id):[]
    if(!text(id) || matches.length!==1){bad(at,'record does not resolve exactly once');return null}
    return matches[0]
  }
  if(!Array.isArray(m.claims) || !Array.isArray(m.runs) || !Array.isArray(m.judges)){bad('records','claims/runs/judges must be lists');return}
  need(m.spec===spec,'spec','manifest names the wrong proof spec')
  need(m.spec_blob===entry(C,spec)?.oid,'spec_blob','manifest spec blob differs')
  need(text(m.task),'task','task required')
  need(m.policy===policy,'policy','manifest differs from the effective evidence policy')
  need(m.provenance==='unauthenticated','provenance','local provenance must be unauthenticated')
  for(const field of ['recorder','checker'])need(text(m[field]),field,'code identity required')
  for(const field of ['oracle_reviews','red_evidence','golden_reviews','approvals','sessions'])need(Array.isArray(m[field]),field,'must be a list')
  for(const id of ids)need(m.claims.filter(c=>c?.ac===id).length===1,'claims',`${id} omitted or duplicated; require exactly one claim`)
  for(const c of m.claims){
    if(!c || typeof c!=='object')continue
    need(ids.includes(c.ac),'claims',`extra criterion ${c.ac}`)
    need(c.spec===spec && c.spec_blob===m.spec_blob,'claims','claim names wrong spec or blob')
    need('oracle' in c && 'red' in c && Array.isArray(c.golden),'claims','semantic evidence references absent')
    const run=one(m.runs,c.run,'run'),j=one(m.judges,c.judge,'judgment')
    if(!run || !j)continue
    const a=one(m.approvals,run.approval,'approval')
    if(!a)continue
    try{approvalFault(a)}catch(e){bad('approval',e.message)}
    const raw=artifact(a.raw,'approval.raw')
    if(raw){try{const {raw:_,...record}=a;need(same(JSON.parse(raw),record),'approval','raw approval differs')}catch{bad('approval','invalid raw JSON')}}
    need(a.revision===C && a.base===m.base && a.task===m.task && a.spec===spec && a.spec_blob===m.spec_blob && a.criteria?.includes(c.ac),'approval','approval bindings differ')
    need(same(run.argv,a.argv) && run.cwd===a.cwd && same(run.limits,a.limits),'run','command or limits differ from approval')
    need(same(run.before,a.inputs) && same(run.after,a.inputs),'run.inputs','selected inputs differ from approval')
    for(const input of Array.isArray(a.inputs)?a.inputs:[]){const e=repoPath(input?.path) && entry(C,input.path);need(e && /^100(644|755)$/.test(e.mode) && digest(blob(e.oid))===input.sha256,'run.inputs','selected input differs from reviewed bytes')}
    need(run.checkout_before===C && run.checkout_after===C && run.status_before==='' && run.status_after==='','run.checkout','verification checkout revision or status changed')
    need(j.run_sha256===runDigest(run),'judgment.run_sha256','execution record differs from judgment')
    need(run.role==='green','run.role','only green executions support claims')
    need(run.expected_match===true && a.expected?.exit===0 && run.stdout?.sha256===digest(a.expected?.stdout??''),'run.expected','execution differs from approved expected output')
    need(run.executor===a.verifier && run.role===a.role,'run','executor or role differs from approval')
    need(text(run.started) && text(run.ended) && Number.isFinite(Date.parse(run.started)) && Date.parse(run.ended)>=Date.parse(run.started) && Number.isFinite(run.duration_ms) && run.duration_ms>=0,'run.timing','invalid timing')
    need((run.stdout?.bytes+run.stderr?.bytes)<=a.limits?.output_bytes,'run.output','output exceeds bound')
    need(j.spec===spec && j.spec_blob===m.spec_blob,'judgment.spec','judgment names wrong spec or blob')
    need(j.author===a.author && j.verifier===a.verifier && j.author!==j.verifier,'judgment.identity','author/verifier must match approval and be distinct')
    for(const id of [j.author,j.verifier]){
      const session=one(m.sessions,id,'session');if(!session)continue
      const bytes=artifact(session.source,'session.source');if(!bytes)continue
      try{const source=JSON.parse(bytes);need(source.session_id===id && same(source,a.sessions?.find(s=>s.id===id)?.source) && bytes.toString('utf8')===a.sessions?.find(s=>s.id===id)?.source_raw,'session.source','session source does not resolve identity')}catch{bad('session.source','invalid source JSON')}
    }
    const o=j.observation
    need(text(j.reason) && o?.kind==='test' && Array.isArray(o.tests) && o.tests.length>0 && o.tests.every(text) && Number.isInteger(o.executed) && o.executed>=o.tests.length && o.skipped===0 && text(o.assertion) && text(o.expected) && text(o.observed),'judgment.observation','requires executed named tests, no skips and a concrete assertion/expected/observed result')
  }
}
