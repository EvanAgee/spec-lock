// node test/after-review-walk.mjs <old commit> [new commit, default HEAD]
// The end-to-end walk of docs/specs/after-review-allowlist.md, on a scratch HOME and repository:
// install the old checker copy and register the selected hooks to it, show it refuses a landing with a
// later bot commit, run README.md's refresh block to move the hooks to the new copy, and land the
// same commit. Nothing outside the temp directory is touched.
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {policyFixture} from './policy-fixture.mjs'
import {register} from '../lib/lock.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const f=policyFixture()
const [old,neu='HEAD']=process.argv.slice(2).map(rev=>execFileSync('git',['-C',root,'rev-parse','--verify',`${rev}^{commit}`],{encoding:'utf8',env:f.env}).trim())
if(!old){process.stderr.write('usage: node test/after-review-walk.mjs <old commit> [new commit]\n');process.exit(2)}
const say=(text)=>process.stdout.write(`${text}\n`)
// Real paths, as a copy under the owner's HOME has: macOS puts temp directories behind a symlink.
const copies=join(realpathSync(f.dir),'.local/share/spec-lock-selected')
const common=realpathSync(f.common)
// The old copy, installed as the README installs one, with the selected hooks registered to it.
mkdirSync(join(copies,old),{recursive:true})
execFileSync('sh',['-c','git -C "$1" archive "$2" bin lib package.json | tar -x -C "$3"','archive',root,old,join(copies,old)],{env:f.env})
register(join(common,'config'),join(copies,old,'bin'),'selected',common)
const owner=join(f.dir,'.config/spec-lock/after-review')
mkdirSync(dirname(owner),{recursive:true})
writeFileSync(owner,`after-review ${common} data/changelog.json\n`)
f.ok('switch','-q','-C','bot',f.tips.valid)
const bot=f.commit({'data/changelog.json':'[1]\n'})
const land=(label)=>{
 const r=f.attempt('merge',bot)
 say(`${label}: git merge --ff-only ${bot.slice(0,12)} exit ${r.code}; main ${r.after===bot?'moved to the bot commit':'did not move'}`)
 for(const line of (r.out+r.err).split('\n').filter(l=>/^spec-lock|^- /.test(l)))say(`  ${line}`)
 return r
}
const before=land(`old copy ${old.slice(0,12)}`)
assert.notEqual(before.code,0);assert.equal(before.after,before.before);assert.match(before.err,/data\/changelog\.json changed after the reviewed commit/)
// The refresh block exactly as README.md has it.
const readme=readFileSync(join(root,'README.md'),'utf8')
const block=/#### Refreshing the selected copy\n[\s\S]*?```sh\n([\s\S]*?)```/.exec(readme)?.[1]
assert.ok(block,'README.md has the refresh block')
const refresh=spawnSync('sh',['-c',block],{env:{...f.env,COPIES:copies,OLD:old,NEW:neu,CHECKOUT:root,REPO:f.repo},encoding:'utf8'})
say(`README refresh block exit ${refresh.status}:\n${(refresh.stdout+refresh.stderr).trim()}`)
assert.equal(refresh.status,0)
assert.match(refresh.stdout,/: ok\nspec-lock checker /)
const after=land(`new copy ${neu.slice(0,12)}`)
assert.equal(after.code,0);assert.equal(after.after,bot)
say('walk: ok')
