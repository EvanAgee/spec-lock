// node test/own-branch-replay.mjs <repository> <batches.json> [<spec-lock CLI>]
// The real-batch replay of docs/specs/2026-10-23-own-branch-evidence.md (AC5). The batch file lists
// lanes, each with its frozen batch `tip`, its proof's `walked` commit, the `inputs` its batch approval
// bound, and `blobs`: each input's blob id at the walked commit and at the tip, null when absent.
// For each lane, a shared clone in a temp directory gets one commit on the tip that adds a synthetic
// spec, a proof and a version 2 manifest whose approval is recorded on the walked commit and binds the
// lane's inputs. `spec-lock check-semantic <tip> <commit>` judges it, and the walk reads only its
// `reviewed:` lines; the rest of the manifest is a stand-in. A lane should stand exactly when the batch
// file records no bound input outside docs/proof/ with another blob at the tip. Exits 0 when every lane
// matches. Nothing in <repository> is written; HOME and the global git config are scratch.
import {execFileSync,spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const [repo,batches,cli=join(dirname(fileURLToPath(import.meta.url)),'..','bin','spec-lock')]=process.argv.slice(2)
if(!repo||!batches){process.stderr.write('usage: node test/own-branch-replay.mjs <repository> <batches.json> [<spec-lock CLI>]\n');process.exit(2)}
const identity=Object.fromEntries(['name','email'].map(k=>[k,spawnSync('git',['config',`user.${k}`],{encoding:'utf8'}).stdout.trim()]))
const dir=mkdtempSync(join(tmpdir(),'spec-lock-replay-'))
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}))
writeFileSync(join(dir,'global.gitconfig'),'')
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(GIT_|FM_|SPEC_LOCK_|NODE_TEST_CONTEXT$)/.test(k)))
Object.assign(env,{HOME:dir,GIT_CONFIG_GLOBAL:join(dir,'global.gitconfig'),GIT_CONFIG_NOSYSTEM:'1',SPEC_LOCK_LOG:join(dir,'landings.log'),
 GIT_AUTHOR_NAME:identity.name,GIT_AUTHOR_EMAIL:identity.email,GIT_COMMITTER_NAME:identity.name,GIT_COMMITTER_EMAIL:identity.email})
const clone=join(dir,'clone')
execFileSync('git',['clone','-q','--shared','--no-checkout',resolve(repo),clone],{env})
const git=(args,input,extra={})=>execFileSync('git',args,{cwd:clone,env:{...env,...extra},input,encoding:'utf8',maxBuffer:256<<20}).trim()
const say=(text)=>process.stdout.write(`${text}\n`)

const SPEC='docs/proof/replay/spec.md',MANIFEST='docs/proof/replay/manifest.json'
const spec=['# Replay','## Problem Statement','Text.','## Seams','Text.','## Acceptance Criteria',
 '| AC | Requirement (EARS) | Red test | Observable | Judge |\n|---|---|---|---|---|\n| AC1 | When the lane lands, the system shall keep its evidence. | a red test | its output | the walk |',
 '## End-to-end verification','Text.','## Non-goals','Text.','## Open questions','Text.'].join('\n\n')+'\n'
const lanes=JSON.parse(readFileSync(batches,'utf8')).lanes
let failed=Array.isArray(lanes)&&lanes.length?0:1
if(failed)say('no lanes in the batch file')
for(const lane of failed?[]:lanes) {
 const expected=lane.inputs.filter(p=>!p.startsWith('docs/proof/')&&lane.blobs[p].walked!==lane.blobs[p].tip).sort()
 const manifest={version:2,task:`replay-${lane.issue}`,reviewed:lane.walked,base:git(['rev-parse',`${lane.walked}^`]),
  approvals:[{id:'replay',role:'green',revision:lane.walked,inputs:lane.inputs.map(path=>({path}))}],claims:[],runs:[],judges:[]}
 const files={[SPEC]:spec,[MANIFEST]:JSON.stringify(manifest,null,2)+'\n','docs/proof/replay.md':`---\nspec: ${SPEC}\nevidence: ${MANIFEST}\n---\nAC1\n`}
 const index={GIT_INDEX_FILE:join(dir,`index-${lane.issue}`)}
 git(['read-tree',lane.tip],undefined,index)
 for(const [path,text] of Object.entries(files)) git(['update-index','--add','--cacheinfo',`100644,${git(['hash-object','-w','--stdin'],text)},${path}`],undefined,index)
 const P=git(['commit-tree',git(['write-tree'],undefined,index),'-p',lane.tip,'-m','replay: evidence on the walked commit'])
 const r=spawnSync('node',[cli,'check-semantic',lane.tip,P],{cwd:clone,env,encoding:'utf8',maxBuffer:256<<20})
 // The stand-in manifest always refuses on its other fields, so a checker that judged exits 1 with a verdict.
 if(r.error||r.signal||r.status!==1||!/^spec-lock: refused /m.test(r.stdout)){failed++;say(`lane ${lane.issue}: the checker did not judge (exit ${r.status}, signal ${r.signal}): ${(r.stderr||String(r.error??'')).trim().split('\n')[0]}`);continue}
 const reviewed=r.stdout.split('\n').filter(l=>l.startsWith('- ')&&l.includes(': reviewed: ')).map(l=>l.split(': reviewed: ')[1])
 const refused=reviewed.map(l=>/^(.*) is bound by the evidence recorded on [0-9a-f]+ and changed before the landed commit [0-9a-f]+; capture it on the landed tip$/.exec(l)?.[1] ?? `other: ${l}`).sort()
 const match=JSON.stringify(refused)===JSON.stringify(expected)
 if(!match)failed++
 say(`lane ${lane.issue} (batch ${lane.batch}, walked ${lane.walked.slice(0,12)}, tip ${lane.tip.slice(0,12)}): ${refused.length?`refused, ${refused.length} reviewed lines`:'stands'}; expected ${expected.length?`refused for ${expected.join(', ')}`:'stands'}; ${match?'match':'MISMATCH'}`)
 for(const line of refused.slice(0,5))say(`  ${line}`)
 if(refused.length>5)say(`  ... ${refused.length-5} more`)
}
say(failed?`replay: failed (${failed} lanes)`:'replay: ok')
process.exit(failed?1:0)
