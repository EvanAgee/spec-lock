import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
const cases=JSON.parse(readFileSync(new URL('./semantic-cases.json',import.meta.url)))
function receipt(raw){
 assert.deepEqual(raw.case_list,cases);assert.equal(raw.runs.length,cases.cases.length*cases.repeats)
 assert.equal(raw.tokens,null);assert.equal(raw.cost,null)
 const counts={invalid_accepted:0,invalid_attempted:0,valid_refused:0,valid_attempted:0},times={}
 for(const c of cases.cases){
  const rows=raw.runs.filter(r=>r.case===c.id);assert.deepEqual(rows.map(r=>r.repeat),[0,1,2])
  for(const r of rows){
   assert.equal(r.valid,c.valid);assert.ok([0,1].includes(r.code))
   assert.equal(r.code===0,/^spec-lock: ok$/m.test(r.out),'exit disagrees with raw output')
   assert.equal(r.code===1,/^spec-lock: refused /m.test(r.out))
   assert.ok(Number.isFinite(r.milliseconds)&&r.milliseconds>0)
   counts[c.valid?'valid_attempted':'invalid_attempted']++
   if(c.valid&&r.code!==0)counts.valid_refused++
   if(!c.valid&&r.code===0)counts.invalid_accepted++
  }
  const values=rows.map(r=>r.milliseconds).sort((a,b)=>a-b)
  times[c.id]={median_ms:values[1],min_ms:values[0],max_ms:values[2],warm_repeats:[1,2]}
 }
 assert.equal(raw.automatically_captured,raw.captures.length)
 return {...counts,times,automatically_captured:raw.captures.length,tokens:null,cost:null}
}
const [before,after,destination,mode]=process.argv.slice(2)
const baseline=receipt(JSON.parse(readFileSync(before))),candidate=receipt(JSON.parse(readFileSync(after)))
const result={baseline,candidate,median_added_ms_by_case:Object.fromEntries(cases.cases.map(c=>[c.id,candidate.times[c.id].median_ms-baseline.times[c.id].median_ms]))}
if(mode==='write')writeFileSync(destination,JSON.stringify(result,null,2)+'\n')
else assert.deepEqual(JSON.parse(readFileSync(destination)),result,'saved summary differs from raw observations')
console.log(JSON.stringify({baseline:baseline.invalid_accepted,candidate:candidate.invalid_accepted,invalid_attempted:candidate.invalid_attempted,valid_refused:candidate.valid_refused,valid_attempted:candidate.valid_attempted}))
