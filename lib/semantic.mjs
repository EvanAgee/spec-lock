// Semantic decisions belong to the recorded verifier. This module checks their exact bindings.
import { createHash } from 'node:crypto'
import { isDeepStrictEqual as same } from 'node:util'
const hash=b=>createHash('sha256').update(b).digest('hex')
const text=x=>typeof x==='string'&&x.trim().length>0
const path=x=>text(x)&&x.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!x.includes('\\')
const requireThat=(ok,message)=>{if(!ok)throw Error(message)}

// read(revision,path) returns exact tracked regular-file bytes, or null for absence.
export function semanticApproval(a,read,deadline=Infinity) {
 const s=a.semantic
 requireThat(s?.version===1&&Array.isArray(s.criteria)&&Array.isArray(s.goldens)&&Array.isArray(s.golden_reviews),'semantic plan required')
 requireThat(s.criteria.length===a.criteria.length&&a.criteria.every(ac=>s.criteria.filter(c=>c?.ac===ac).length===1),'semantic criterion plan incomplete or duplicated')
 requireThat(Array.isArray(s.tests)&&s.tests.length>0&&s.tests.every(p=>path(p)&&a.inputs.some(i=>i.path===p))&&new Set(s.tests).size===s.tests.length,'selected test inputs required')
 requireThat(s.goldens.every(path)&&new Set(s.goldens).size===s.goldens.length,'selected golden paths invalid')
 const selected=o=>path(o?.path)&&a.inputs.some(i=>i.path===o.path&&i.sha256===o.sha256)&&hash(read(a.revision,o.path)??Buffer.alloc(0))===o.sha256
 for(const c of s.criteria){
  requireThat(typeof c.red_required==='boolean'&&(c.red_required||text(c.red_reason)),'red applicability needs approved reason')
  const o=c.oracle
  requireThat(text(o?.id)&&o.ac===c.ac&&o.reviewer===a.verifier&&o.verdict==='supported'&&text(o.reason)&&text(o.expected),'supported oracle review required')
  requireThat(['requirement','reference','approved-fixture'].includes(o.source?.kind)&&selected(o.source)&&selected(o.expectation),'oracle source or expectation differs from selected bytes')
 }
 for(const g of s.golden_reviews) requireThat(s.goldens.includes(g?.path)&&a.criteria.includes(g.ac),'golden review outside selected scope')
 for(const p of s.goldens){
  const before=read(a.base,p),after=read(a.revision,p),old=before===null?null:hash(before),next=after===null?null:hash(after)
  requireThat(after===null||a.inputs.some(i=>i.path===p&&i.sha256===next),'golden is not a selected input')
  for(const ac of a.criteria){
   const reviews=s.golden_reviews.filter(g=>g.path===p&&g.ac===ac)
   requireThat(old===next?reviews.length<=1:reviews.length===1,'golden requires one approval when changed and no duplicates')
   if(reviews.length===0)continue
   const g=reviews[0]
   requireThat(text(g.id)&&g.before_sha256===old&&g.after_sha256===next&&g.reviewer===a.verifier&&g.verdict==='supported'&&text(g.reason)&&Number.isFinite(Date.parse(g.approved_at))&&Date.parse(g.approved_at)<=deadline,'golden approval bytes, reviewer or time invalid')
  }
 }
}

export function semanticFaults(m,{C,P,entry,blob,bad,approvalFault,runDigest,changed,isCommit,ancestor}) {
 const need=(ok,field,message)=>{if(!ok)bad(`semantic.${field}`,message);return Boolean(ok)}
 const bytesByObject=new Map()
 const read=(rev,p)=>{
  const key=JSON.stringify([rev,p]);if(bytesByObject.has(key))return bytesByObject.get(key)
  const e=path(p)&&entry(rev,p),bytes=e&&/^100(644|755)$/.test(e.mode)?blob(e.oid):null
  bytesByObject.set(key,bytes);return bytes
 }
 const artifact=(o,field)=>{
  const b=path(o?.path)&&o.path.startsWith('docs/proof/')?read(P,o.path):null
  return need(b!==null&&b.length===o.bytes&&hash(b)===o.sha256,field,'artifact bytes differ')?b:null
 }
 const one=(rows,id,field)=>{const found=Array.isArray(rows)?rows.filter(r=>r?.id===id):[];return need(text(id)&&found.length===1,field,'record must resolve exactly once')?found[0]:null}
 if(!need(Array.isArray(m.claims),'claims','claims required'))return
 for(const c of m.claims){
  if(!c)continue
  const green=one(m.runs,c.run,'green'),judge=one(m.judges,c.judge,'judge')
  if(!green||!judge)continue
  const a=one(m.approvals,green.approval,'approval');if(!a)continue
  try{approvalFault(a);semanticApproval(a,read,Date.parse(green.started))}catch(e){bad('semantic.plan',e.message);continue}
  const plan=a.semantic.criteria.find(p=>p.ac===c.ac),o=one(m.oracle_reviews,c.oracle,'oracle')
  if(!plan)continue
  if(o)need(same(o,plan.oracle)&&o.expected===judge.observation?.expected,'oracle','review differs from approved oracle or judged expected answer')
  const goldens=a.semantic.golden_reviews.filter(g=>g.ac===c.ac)
  need(same([...(c.golden??[])].sort(),goldens.map(g=>g.id).sort()),'golden','claim golden references differ')
  for(const g of goldens){const found=one(m.golden_reviews,g.id,'golden');if(found)need(same(g,found)&&Date.parse(found.approved_at)<=Date.parse(green.started),'golden','review changed or followed execution')}
  if(!plan.red_required){need(c.red===null,'red','not-applicable red must be null');continue}
  const r=one(m.red_evidence,c.red,'red');if(!r)continue
  const cap=r.capture,ra=cap?.approval,run=cap?.run
  if(!need(ra&&run,'red','captured red required'))continue
  try{approvalFault(ra);semanticApproval(ra,read,Date.parse(run.started))}catch(e){bad('semantic.red',e.message);continue}
  need(r.ac===c.ac&&r.oracle===c.oracle&&r.reviewer===a.verifier&&r.verdict==='supported'&&r.failure_kind==='assertion'&&text(r.reason),'red','intended assertion review required')
  need(r.green===green.id&&r.green_sha256===runDigest(green)&&r.red===run.id&&r.red_sha256===runDigest(run),'red','red/green review is unlinked or stale')
  need(ra.task===a.task&&ra.spec===a.spec&&ra.spec_blob===a.spec_blob&&ra.author===a.author&&ra.verifier===a.verifier&&ra.criteria.includes(c.ac),'red','approval task, spec or actors differ')
  need(ra.role==='red'&&run.role==='red'&&run.approval===ra.id&&run.executor===ra.verifier,'red','role, approval or executor differs')
  need(run.revision===ra.revision&&run.checkout_before===ra.revision&&run.checkout_after===ra.revision&&run.status_before===''&&run.status_after==='','red','revision or checkout changed')
  need(isCommit(ra.revision)&&isCommit(ra.base)&&ancestor(ra.base,ra.revision),'red','invalid revision or base')
  need(entry(ra.revision,ra.spec)?.oid===ra.spec_blob,'red','red spec bytes differ')
  need(same(ra.argv,a.argv)&&ra.cwd===a.cwd,'red','red/green command differs')
  need(same(run.argv,ra.argv)&&run.cwd===ra.cwd&&same(run.limits,ra.limits)&&same(run.before,ra.inputs)&&same(run.after,ra.inputs),'red','command, limits or inputs changed')
  for(const i of ra.inputs){const b=read(ra.revision,i.path);need(b!==null&&hash(b)===i.sha256,'red','input differs from red revision')}
  const raw=artifact(ra.raw,'red.approval')
  if(raw){try{const {raw:_,...rest}=ra;need(same(JSON.parse(raw),rest),'red','raw approval differs')}catch{bad('semantic.red','invalid raw approval')}}
  for(const id of [ra.author,ra.verifier]){
   const s=one(cap.sessions,id,'red.session');if(!s)continue
   const b=artifact(s.source,'red.session'),source=ra.sessions.find(s=>s.id===id)
   if(b)need(b.toString('utf8')===source?.source_raw,'red.session','source session bytes differ')
  }
  const stdout=artifact(run.stdout,'red.stdout'),stderr=artifact(run.stderr,'red.stderr')
  need(run.outcome==='exited'&&Number.isInteger(run.exit)&&run.exit!==0&&run.exit===ra.expected.exit&&run.signal===null&&run.expected_match===true,'red','red must be the approved nonzero ordinary exit')
  if(stdout)need(stdout.equals(Buffer.from(ra.expected.stdout)),'red','red stdout differs from approval')
  need(Number.isFinite(Date.parse(run.started))&&Date.parse(run.ended)>=Date.parse(run.started)&&Date.parse(run.ended)<=Date.parse(green.started)&&Number.isFinite(run.duration_ms)&&run.duration_ms>=0,'red','invalid or out-of-order execution time')
  need(run.stdout?.bytes+run.stderr?.bytes<=ra.limits.output_bytes,'red','output exceeds bound')
  if(stdout&&stderr)need(text(r.expected_symptom)&&r.expected_symptom===r.observed_symptom&&Buffer.concat([stdout,stderr]).toString('utf8').includes(r.observed_symptom),'red','reviewed symptom absent from captured output')
  need(same(ra.semantic.tests,a.semantic.tests)&&a.semantic.tests.every(p=>ra.inputs.find(i=>i.path===p)?.sha256===a.inputs.find(i=>i.path===p)?.sha256),'red','red/green test inputs differ')
  need(entry(a.base,a.spec)?.oid===a.spec_blob||ra.control,'red.control','new spec on old code requires a declared control overlay')
  const redPlan=ra.semantic.criteria.find(p=>p.ac===c.ac)
  need(same(redPlan?.oracle,plan.oracle),'red','red/green oracle identity differs')
  // The approved control explicitly binds test overlays; it does not permit changing old implementation bytes.
  if(ra.control){
   const control=ra.control
   if(!need(control.baseline===a.base&&Array.isArray(control.overlay),'red.control','control baseline or overlay invalid'))continue
   if(Array.isArray(control.overlay)){
    need(new Set(control.overlay.map(i=>i.path)).size===control.overlay.length&&same([...changed(a.base,ra.revision)].sort(),control.overlay.map(i=>i.path).sort()),'red.control','control contains undeclared changes')
   }
   if(Array.isArray(control.overlay))for(const i of control.overlay){const b=read(ra.revision,i.path),g=read(C,i.path);need(b!==null&&g!==null&&hash(b)===i.sha256&&hash(g)===i.sha256,'red.control','overlay bytes differ from green')}
  }
 }
}
