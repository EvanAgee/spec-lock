// Recompute from raw CLI observations, independently of the walk's outcome counters.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
const cases=JSON.parse(readFileSync(new URL('./portable-evidence-cases.json',import.meta.url)))
export function receipt(raw){
  assert.deepEqual(raw.case_list,cases,'frozen case list changed')
  assert.equal(raw.runs.length,cases.cases.length*cases.repeats,'denominator changed')
  const count={invalid_accepted:0,invalid_attempted:0,valid_refused:0,valid_attempted:0}
  const times={}
  for(const c of cases.cases){
    const rows=raw.runs.filter(r=>r.case===c.id)
    assert.equal(rows.length,3,`${c.id} missing repeats`)
    assert.deepEqual(rows.map(r=>r.repeat),[0,1,2])
    for(const r of rows){
      assert.equal(r.valid,c.valid)
      assert.ok([0,1].includes(r.code),'unexecuted/capability gap is not an acceptance')
      assert.equal(r.code===0,/^spec-lock: ok$/m.test(r.out),'exit disagrees with raw observation')
      assert.equal(r.code===1,/^spec-lock: refused /m.test(r.out),'refusal missing')
      assert.ok(Number.isFinite(r.milliseconds)&&r.milliseconds>0)
      count[c.valid?'valid_attempted':'invalid_attempted']++
      if(c.valid && r.code!==0)count.valid_refused++
      if(!c.valid && r.code===0)count.invalid_accepted++
    }
    const t=rows.map(r=>r.milliseconds).sort((a,b)=>a-b)
    times[c.id]={median_ms:t[1],min_ms:t[0],max_ms:t[2],warm_repeats:[1,2]}
  }
  const automatically_captured=(raw.captures??[]).filter(c=>c.record).length
  assert.equal(raw.automatically_captured,automatically_captured)
  assert.equal(raw.tokens,null);assert.equal(raw.cost,null)
  return {...count,automatically_captured,times,tokens:'unavailable',cost:'unavailable'}
}
export function paired(before,after){
  const baseline=receipt(before),candidate=receipt(after)
  const overhead=Object.fromEntries(cases.cases.map(c=>[c.id,candidate.times[c.id].median_ms-baseline.times[c.id].median_ms]))
  return {baseline,candidate,median_added_ms_by_case:overhead}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  const [a,b,summary,mode]=process.argv.slice(2), result=paired(JSON.parse(readFileSync(a)),JSON.parse(readFileSync(b)))
  if(mode==='write')writeFileSync(summary,JSON.stringify(result,null,2)+'\n')
  else assert.deepEqual(JSON.parse(readFileSync(summary)),result,'summary differs from raw runs')
  console.log(JSON.stringify({baseline:result.baseline.invalid_accepted,candidate:result.candidate.invalid_accepted,invalid_attempted:result.candidate.invalid_attempted,valid_refused:result.candidate.valid_refused,valid_attempted:result.candidate.valid_attempted,automatically_captured:result.candidate.automatically_captured}))
}
