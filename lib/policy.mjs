// Owner policy is outside the candidate tree. Local labels and settings are not authenticated.
import {execFileSync} from 'node:child_process'
import {readFileSync,realpathSync,statSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
export const centralFile=()=>join(homedir(),'.config/spec-lock/config')
export const commonRepository=(repo='.')=>realpathSync(git('-C',repo,'rev-parse','--path-format=absolute','--git-common-dir'))
export const directoryId=path=>{const s=statSync(path,{bigint:true});return `${s.dev}:${s.ino}`}
export function selectedPolicy(bytes) {
 const text=typeof bytes==='string'?bytes:bytes.toString('utf8')
 const values={mode:[],evidence:[],select:[],integration:[]}
 if(text.includes('\0'))throw Error('required policy contains NUL bytes')
 if(text.includes('\r'))throw Error('required policy must use LF line endings')
 for(const line of text.split('\n').map(l=>l.replace(/^[ \t]+|[ \t]+$/g,'')).filter(l=>l&&!l.startsWith('#'))) {
  const m=/^([^ \t]+)[ \t]+(.+)$/s.exec(line)
  if(!m||!Object.hasOwn(values,m[1]))throw Error('required policy has an unknown or malformed entry')
  values[m[1]].push(m[2])
 }
 if(values.mode.length!==1||values.mode[0]!=='selected'||values.evidence.length!==1||!['legacy','semantic-v2'].includes(values.evidence[0]))throw Error('required policy needs mode selected and one evidence requirement')
 for(const key of ['select','integration'])if(new Set(values[key]).size!==values[key].length)throw Error(`required policy has duplicate ${key}`)
 for(const path of values.select) {
  try {
   const env={...process.env};delete env.GIT_COMMON_DIR;delete env.GIT_WORK_TREE
   const common=execFileSync('git',['--git-dir',path,'rev-parse','--path-format=absolute','--git-common-dir'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
   if(!isAbsolute(path)||realpathSync(path)!==path||realpathSync(common)!==path)throw Error('not a common Git directory')
  } catch {throw Error('required policy selection must be a canonical common Git directory')}
 }
 if(new Set(values.select.map(directoryId)).size!==values.select.length)throw Error('required policy has duplicate select')
 for(const branch of values.integration)git('check-ref-format',`refs/heads/${branch}`)
 const id='selected-v1:'+createHash('sha256').update(bytes).digest('hex')
 return {mode:'selected',evidence:values.evidence[0],selected:values.select,integration:values.integration,id}
}
// Exact paths the owner lets a bot change in this repository after a proof's reviewed commit, from
// "after-review <canonical common git dir> <path>" lines in a HOME file of its own, so the policy id
// and its parser stay as they are. Missing means none; anything malformed refuses.
export function afterReview(repo='.') {
 const file=join(homedir(),'.config/spec-lock/after-review')
 let text
 try{text=readFileSync(file,'utf8')}catch(e){if(e.code==='ENOENT')return [];throw Error(`cannot read ${file}`)}
 if(text.includes('\r'))throw Error(`${file} must use LF line endings`)
 const common=commonRepository(repo)
 return text.split('\n').map(l=>l.replace(/^[ \t]+|[ \t]+$/g,'')).filter(l=>l&&!l.startsWith('#')).flatMap(line=>{
  const m=/^after-review[ \t]+(\/.*?)[ \t]+([^ \t]+)$/.exec(line)
  if(!m||!m[2].split('/').every(s=>s&&s!=='.'&&s!=='..'))throw Error(`${file} has a malformed entry: ${line}`)
  return m[1]===common?[m[2]]:[]
 })
}
export const plainFile=()=>join(homedir(),'.config/spec-lock/plain')
// Common Git directories the owner gives the plain proof rule, from "plain <common git dir>" lines in a
// HOME file of its own, so the central file and its policy id stay as they are. A missing file is an
// empty list unless a plain registration needs it; anything malformed refuses.
export function plainCoverage(required=false) {
 const file=plainFile()
 let text
 try{text=readFileSync(file)}catch(e){if(e.code==='ENOENT'&&!required)return [];throw Error(`required plain coverage ${file} is missing or unreadable`)}
 // Decoding must not replace a byte: a path Node could not match while the shell's -ef does would let code through.
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(text)}catch{throw Error(`required plain coverage ${file} is not UTF-8 text`)}
 if(text.includes('\0')||text.includes('\r'))throw Error(`required plain coverage ${file} must be LF text without NUL bytes`)
 return text.split('\n').map(l=>l.replace(/^[ \t]+|[ \t]+$/g,'')).filter(l=>l&&!l.startsWith('#')).map(line=>{
  const m=/^plain[ \t]+(\/.*)$/s.exec(line)
  if(!m)throw Error(`required plain coverage ${file} has a malformed entry: ${line}`)
  return m[1]
 })
}
// The same directory, by identity; a path that does not exist is never the same.
export const sameDirectory=(a,b)=>{try{return directoryId(a)===directoryId(b)}catch{return false}}
export function ownerPolicy() {
 let registered=false,plain=false
 for(const name of ['spec-lock-reference-transaction','spec-lock-pre-push']) {
  try{
   const command=git('config','--includes','--get-all',`hook.${name}.command`)
   if(/(?:^|\s)--selected(?:\s|$)/.test(command))registered=true
   if(/(?:^|\s)--plain(?:\s|$)/.test(command))registered=plain=true
  }catch{/* Missing legacy registration is not selected mode. */}
 }
 let bytes=Buffer.alloc(0)
 try{bytes=readFileSync(centralFile())}catch(e){if(e.code!=='ENOENT'||registered)throw Error('required policy is missing or unreadable')}
 const text=bytes.toString('utf8')
 if(text.includes('\0'))throw Error('required policy contains NUL bytes')
 const selected=registered||text.split('\n').some(line=>/^[ \t]*(?:mode|select|evidence)(?:[ \t]|$)/.test(line))
 if(!selected)return {mode:'legacy',active:true,required:false,id:'legacy-v1'}
 const p=selectedPolicy(bytes),common=commonRepository(),active=p.selected.some(path=>sameDirectory(path,common))
 // A selected repository keeps its own rule; a listed one registered with --plain gets the plain proof
 // rule, as the shell hook does. A listed but unregistered repository is not checked by any hook.
 if(!active&&plain&&plainCoverage(true).some(path=>sameDirectory(path,common)))return {...p,active:true,required:false,evidence:'plain'}
 return {...p,active,required:active&&p.evidence==='semantic-v2'}
}
