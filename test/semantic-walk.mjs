import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {semanticFixture,prepare,semanticExport,attachSemantic,snapshot} from './semantic-fixture.mjs'
const [mode,output,cli]=process.argv.slice(2)
assert.ok(['baseline','candidate'].includes(mode))
const cases=JSON.parse(readFileSync(new URL('./semantic-cases.json',import.meta.url)))
const f=semanticFixture(cli&&resolve(cli)), p=prepare(f),runs=[],artifacts=[]
const inputs={base:snapshot(f,f.B),red:snapshot(f,f.R),green:snapshot(f,f.C)}
for(const c of cases.cases){
 f.ok('switch','-q','-C',`semantic-${c.id}`,f.C)
 const e=semanticExport(f,p,c.id,mode==='baseline');assert.equal(e.result.code,0,e.result.err)
 const tip=attachSemantic(f,e,c.id)
 artifacts.push({case:c.id,revision:tip,files:snapshot(f,tip)})
 for(let repeat=0;repeat<3;repeat++){
  const command=['node',f.cli,mode==='baseline'?'check-candidate':'check-semantic',f.B,tip],started=performance.now(),r=f.run(command[0],command.slice(1))
  runs.push({case:c.id,valid:c.valid,repeat,warm:repeat>0,command:['node','<checker>/bin/spec-lock',...command.slice(2)],...r,milliseconds:performance.now()-started})
 }
}
writeFileSync(output,JSON.stringify({stage:'semantic',mode,case_list:cases,inputs,revisions:{base:f.B,red:f.R,green:f.C},runs,artifacts,captures:[p.red.record,p.green.record],automatically_captured:2,tokens:null,cost:null},null,2)+'\n')
console.log(`saved ${runs.length} semantic checks with exact fixture bytes and two captures`)
