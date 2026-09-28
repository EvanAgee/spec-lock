import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {policyFixture} from './policy-fixture.mjs'
const [mode='candidate',output,cli]=process.argv.slice(2)
const cases=JSON.parse(readFileSync(new URL('./policy-cases.json',import.meta.url)))
const f=policyFixture(cli&&resolve(cli));f.enable(mode!=='baseline')
const runs=[]
for(const scope of ['selected','unselected']) {
 writeFileSync(f.central,scope==='selected'?f.policy:f.policy.replace(`select ${f.common}\n`,''))
 for(const c of scope==='selected'?cases.cases:[{id:'unproved',valid:true}])for(const adapter of scope==='selected'?cases.adapters:cases.unselected)for(let repeat=0;repeat<cases.repeats;repeat++) {
  const r=f.attempt(adapter,f.tips[c.id]);runs.push({scope,case:c.id,valid:c.valid,adapter,repeat,warm:repeat>0,...r})
 }
}
const raw={case_list:cases,mode,runs,inputs:f.inputs,captures:f.captures,tokens:null,cost:null}
// Scratch paths are stable aliases in public observations; actual synthetic source bytes stay exact.
const text=JSON.stringify(raw,null,2).split(f.dir).join('<scratch>').split(resolve(f.cli,'..','..')).join('<checker>')
writeFileSync(output,text+'\n');console.log(`saved ${runs.length} policy observations`)
