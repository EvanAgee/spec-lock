// docs/specs/after-review-allowlist.md: exact paths the owner lets a bot change after a proof's
// reviewed commit. Every repository is synthetic and HOME is the fixture's temp directory.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chmodSync,mkdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {policyFixture} from './policy-fixture.mjs'

const f=policyFixture()
f.enable()
const owner=join(f.dir,'.config/spec-lock/after-review')
const allow=(text)=>{mkdirSync(dirname(owner),{recursive:true});writeFileSync(owner,text)}
const BOT='data/changelog.json'
const CHANGED=(path)=>new RegExp(`${path.replace(/[.*]/g,'\\$&')} changed after the reviewed commit`)
// Commits on top of the valid evidence landing, as a bot would after the proofs were exported.
const after=(name,files,prep)=>{f.ok('switch','-q','-C',name,f.tips.valid);return f.commit(files,prep)}
const added=after('bot-add',{[BOT]:'[]\n'})
const edited=f.commit({[BOT]:'[1]\n'})

test('AC1: a listed bot file changed after the reviewed commit keeps the proof',()=>{
 allow(`after-review ${f.common} ${BOT}\n`)
 for(const tip of [added,edited]) {
  const r=f.attempt('cli',tip);assert.equal(r.code,0,r.out+r.err);assert.match(r.out,/spec-lock: ok/)
 }
 for(const adapter of ['merge','push']){const r=f.attempt(adapter,edited);assert.equal(r.code,0,`${adapter}: ${r.out}${r.err}`);assert.equal(r.after,edited)}
})

test('AC2: an unlisted path, a glob or a folder entry is refused as before',()=>{
 const other=after('bot-other',{'data/other.json':'[]\n'})
 allow(`after-review ${f.common} ${BOT}\n`)
 const r=f.attempt('cli',other);assert.equal(r.code,1,r.out+r.err);assert.match(r.out,CHANGED('data/other.json'))
 for(const entry of ['data/*.json','data']) {
  allow(`after-review ${f.common} ${entry}\n`)
  const g=f.attempt('cli',edited);assert.equal(g.code,1,`${entry}: ${g.out}${g.err}`);assert.match(g.out,CHANGED(BOT))
 }
})

test('AC3: an entry for another repository is refused',()=>{
 const elsewhere=join(f.dir,'elsewhere');f.ok('init','-q','-b','main',elsewhere)
 allow(`after-review ${f.ok('-C',elsewhere,'rev-parse','--path-format=absolute','--git-common-dir')} ${BOT}\n`)
 const r=f.attempt('cli',edited);assert.equal(r.code,1,r.out+r.err);assert.match(r.out,CHANGED(BOT))
})

test('AC4: a listed path as a symbolic link, an executable or a deletion is refused',()=>{
 allow(`after-review ${f.common} ${BOT}\n`)
 const link=after('bot-link',{},(repo)=>{mkdirSync(join(repo,'data'),{recursive:true});symlinkSync('../test/golden.txt',join(repo,BOT))})
 const exec=after('bot-exec',{[BOT]:'[]\n'},(repo)=>chmodSync(join(repo,BOT),0o755))
 assert.equal(f.ok('ls-tree',link,'--',BOT).split(' ')[0],'120000')
 assert.equal(f.ok('ls-tree',exec,'--',BOT).split(' ')[0],'100755')
 for(const [name,tip] of [['link',link],['exec',exec]]) {
  const r=f.attempt('cli',tip);assert.equal(r.code,1,`${name}: ${r.out}${r.err}`);assert.match(r.out,CHANGED(BOT))
 }
 // A deletion needs a path C holds.
 allow(`after-review ${f.common} test/golden.txt\n`)
 const removed=after('bot-remove',{'test/golden.txt':null})
 const r=f.attempt('cli',removed);assert.equal(r.code,1,r.out+r.err);assert.match(r.out,CHANGED('test/golden.txt'))
})

test('AC5: a missing, empty or comment-only owner file judges as before',()=>{
 for(const text of [null,'','# no bots yet\n\n']) {
  if(text===null)rmSync(owner,{force:true});else allow(text)
  const r=f.attempt('cli',edited);assert.equal(r.code,1,`${JSON.stringify(text)}: ${r.out}${r.err}`);assert.match(r.out,CHANGED(BOT))
 }
})

test('AC6: a malformed or unreadable owner file refuses with exit 2, even when no entry is needed',()=>{
 for(const text of [`after-review ${f.common} data/../x.json`,`after-review ${f.common} /etc/x.json`,`after-review ${f.common}`,`allow ${f.common} ${BOT}`,'garbage',`after-review ${f.common} ${BOT}\r`]) {
  allow(text+'\n')
  for(const tip of [edited,f.tips.valid]) {
   const r=f.attempt('cli',tip);assert.equal(r.code,2,`${text}: ${r.out}${r.err}`);assert.match(r.err,/after-review/)
  }
 }
 rmSync(owner);mkdirSync(owner)
 const r=f.attempt('cli',f.tips.valid);assert.equal(r.code,2,r.out+r.err);assert.match(r.err,/after-review/)
 rmSync(owner,{recursive:true})
})
