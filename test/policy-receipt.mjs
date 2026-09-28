import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {readFileSync,writeFileSync} from 'node:fs'
const cases=JSON.parse(readFileSync(new URL('./policy-cases.json',import.meta.url)))
export function summarize(raw) {
 assert.deepEqual(raw.case_list,cases);assert.equal(raw.tokens,null);assert.equal(raw.cost,null)
 const expected=[]
 for(const scope of ['selected','unselected'])for(const c of scope==='selected'?cases.cases:[{id:'unproved',valid:true}])for(const adapter of scope==='selected'?cases.adapters:cases.unselected)for(let repeat=0;repeat<3;repeat++)expected.push([scope,c.id,adapter,repeat,c.valid])
 assert.deepEqual(raw.runs.map(r=>[r.scope,r.case,r.adapter,r.repeat,r.valid]),expected)
 const counts={invalid_accepted:0,invalid_attempted:0,valid_refused:0,valid_attempted:0,unselected_blocked:0,unselected_attempted:0,unsupported:0},groups={}
 for(const r of raw.runs) {
  assert.ok(Number.isInteger(r.code));assert.ok(r.milliseconds>0)
  assert.match(r.before,/^[a-f0-9]{40}$/);assert.match(r.target,/^[a-f0-9]{40}$/)
  if(r.adapter==='cli')assert.equal(r.after,r.before)
  else assert.equal(r.after,r.code===0?r.target:r.before,'observed branch movement disagrees with exit')
  const output=r.out+r.err
  if(r.adapter==='cli'){assert.equal(/^spec-lock: ok$/m.test(output),r.code===0);if(r.code!==0)assert.match(output,/spec-lock:/)}
  else if(r.code!==0)assert.match(output,/spec-lock:/)
  const unsupported=raw.mode==='baseline'&&r.scope==='selected'&&['invalid','valid'].includes(r.case)
  if(unsupported){assert.notEqual(r.code,0);assert.match(output,/version: 2 is not 1/);counts.unsupported++}
  else if(r.scope==='unselected'){counts.unselected_attempted++;counts.unselected_blocked+=Number(r.code!==0)}
  else {counts[r.valid?'valid_attempted':'invalid_attempted']++;counts[r.valid?'valid_refused':'invalid_accepted']+=Number(r.valid?r.code!==0:r.code===0)}
  const key=`${r.scope}/${r.case}/${r.adapter}`;(groups[key]??=[]).push(r.milliseconds)
 }
 const times=Object.fromEntries(Object.entries(groups).map(([k,values])=>{const v=[...values].sort((a,b)=>a-b);return[k,{median_ms:v[1],min_ms:v[0],max_ms:v[2],warm_repeats:[1,2]}]}))
 return {...counts,times,tokens:null,cost:null}
}
const [before,after,destination,mode]=process.argv.slice(2)
if(process.argv[1]===fileURLToPath(import.meta.url)&&before) {
 const baseline=summarize(JSON.parse(readFileSync(before))),candidate=summarize(JSON.parse(readFileSync(after)))
 const result={baseline,candidate,added_median_ms:Object.fromEntries(Object.keys(candidate.times).map(k=>[k,candidate.times[k].median_ms-baseline.times[k].median_ms])),limit:'Version-2 baseline verdicts are unsupported, not accepted invalid evidence or valid false refusals. Their timings measure the unsupported route, not a full valid check.'}
 if(mode==='write')writeFileSync(destination,JSON.stringify(result,null,2)+'\n')
 else assert.deepEqual(JSON.parse(readFileSync(destination)),result,'receipt differs from raw observations')
 console.log(JSON.stringify({baseline_invalid_accepted:baseline.invalid_accepted,candidate_invalid_accepted:candidate.invalid_accepted,unselected_blocked:candidate.unselected_blocked,valid_refused:candidate.valid_refused}))
}
