// Owner policy is outside the candidate tree. Local labels and settings are not authenticated.
import {execFileSync} from 'node:child_process'
import {readFileSync,realpathSync,statSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
export const centralFile=()=>join(homedir(),'.config/spec-lock/config')
export const commonRepository=(repo='.')=>realpathSync(git('-C',repo,'rev-parse','--path-format=absolute','--git-common-dir'))
const directoryId=path=>{const s=statSync(path,{bigint:true});return `${s.dev}:${s.ino}`}
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
export function ownerPolicy() {
 let registered=false
 for(const name of ['spec-lock-reference-transaction','spec-lock-pre-push']) {
  try{if(/(?:^|\s)--selected(?:\s|$)/.test(git('config','--includes','--get-all',`hook.${name}.command`)))registered=true}catch{/* Missing legacy registration is not selected mode. */}
 }
 let bytes=Buffer.alloc(0)
 try{bytes=readFileSync(centralFile())}catch(e){if(e.code!=='ENOENT'||registered)throw Error('required policy is missing or unreadable')}
 const text=bytes.toString('utf8')
 if(text.includes('\0'))throw Error('required policy contains NUL bytes')
 const selected=registered||text.split('\n').some(line=>/^[ \t]*(?:mode|select|evidence)(?:[ \t]|$)/.test(line))
 if(!selected)return {mode:'legacy',active:true,required:false,id:'legacy-v1'}
 const p=selectedPolicy(bytes),active=p.selected.some(path=>directoryId(path)===directoryId(commonRepository()))
 return {...p,active,required:active&&p.evidence==='semantic-v2'}
}
