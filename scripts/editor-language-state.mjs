// Local editor metadata only: fingerprints and edit dates, never the field texts.
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
const scopeSchema=z.string().regex(/^[a-z][a-z-]{0,40}\/[a-z0-9][a-z0-9-]{0,99}$/);
const hash=z.string().regex(/^[a-f0-9]{1,8}:[a-f0-9]{8}:[a-f0-9]{8}$/),date=z.string().datetime().nullable();
const state=z.object({ru:hash,en:hash,seenRu:hash,seenEn:hash,ruEditedAt:date,enEditedAt:date,syncedAt:date,method:z.enum(['unverified','manual','translation'])}).strict();
// These are JSON property names, not filesystem paths. Match the editor's
// Cyrillic names, spaces and namespaced labels while excluding unsafe properties.
const fieldKey=z.string().max(500).refine(key=>{try{const path=JSON.parse(key);return Array.isArray(path)&&path.length>0&&path.length<30&&path.every(part=>typeof part==='string'?part.length>0&&!/[\u0000-\u001f\u007f]/.test(part)&&!['__proto__','prototype','constructor'].includes(part):Number.isSafeInteger(part)&&part>=0)}catch{return false}});
const fieldsSchema=z.record(fieldKey,state).refine(fields=>Object.keys(fields).length<=2000);
function read(root){const file=resolve(root,'.local/editor-language-state.json');return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{}}
export function getLanguageState(root,scope){scopeSchema.parse(scope);const data=read(root);return {fields:Object.hasOwn(data,scope)?fieldsSchema.parse(data[scope]):{}}}
export function saveLanguageState(root,payload){
  const {scope,fields}=z.object({scope:scopeSchema,fields:fieldsSchema}).strict().parse(payload);
  const data=read(root),previous=Object.hasOwn(data,scope)?data[scope]:{};
  data[scope]={...previous,...fields};fieldsSchema.parse(data[scope]);mkdirSync(resolve(root,'.local'),{recursive:true});
  const file=resolve(root,'.local/editor-language-state.json');writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');renameSync(file+'.tmp',file);return {saved:true};
}
