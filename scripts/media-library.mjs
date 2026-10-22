// Local editor only. No credentials and no network writes.
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,statSync,unlinkSync,renameSync,lstatSync} from 'node:fs';
import {resolve,extname,relative,sep} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {assetSchema,mediaPath,readLibrary,librarySchema} from '../src/lib/media.mjs';
const require=createRequire(import.meta.url);
// Astro already uses sharp; declare it directly as well for a stable dependency.
const sharp=require('sharp');
const id=()=>`media-${randomBytes(8).toString('hex')}`;
const extensions={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'};
export function localMediaPath(root,path){
  mediaPath.parse(path);
  const base=resolve(root,'public'),target=resolve(base,'.'+path);
  if(!target.startsWith(base+sep))throw new Error('Invalid media path');
  // Do not follow symlinks/junctions into another directory, even for reads.
  let cursor=base;
  for(const segment of relative(base,target).split(sep)){
    cursor=resolve(cursor,segment);
    if(existsSync(cursor)&&lstatSync(cursor).isSymbolicLink())throw new Error('Symlink media paths are not supported');
  }
  return target;
}
export function saveLibrary(root,lib){
  librarySchema.parse(lib);
  const file=resolve(root,'src/data/media.json'),temp=file+'.tmp';
  writeFileSync(temp,JSON.stringify(lib,null,2)+'\n');renameSync(temp,file);
}
export function listLibrary(root){
  const lib=readLibrary(root);
  for(const folder of ['images','media']){
    const walk=dir=>{
      if(!existsSync(dir))return;
      for(const entry of readdirSync(dir,{withFileTypes:true})){
        const file=resolve(dir,entry.name);
        if(entry.isSymbolicLink())continue;
        if(entry.isDirectory()){walk(file);continue}
        const path='/'+relative(resolve(root,'public'),file).split(sep).join('/');
        if(!mediaPath.safeParse(path).success||lib.items.some(x=>x.path===path))continue;
        lib.items.push({id:'media-'+createHash('sha256').update(path).digest('hex').slice(0,16),path,title:entry.name,alt_ru:'',alt_en:'',caption_ru:'',caption_en:'',tags:[],project:'',uploadedAt:statSync(file).birthtime.toISOString()});
      }
    };walk(resolve(root,'public',folder));
  }
  return lib;
}
export async function validateUpload({name,mime,base64}){
  const extension=extname(name||'').toLowerCase();
  if(!extensions[extension]||mime!==extensions[extension])throw new Error('Расширение и MIME должны соответствовать PNG, JPEG, WebP, GIF или безопасному SVG.');
  if(typeof base64!=='string'||!base64.length||base64.length>12*1024*1024)throw new Error('Некорректные данные файла.');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.toString('base64')!==base64)throw new Error('Некорректная кодировка файла.');
  if(!bytes.length||bytes.length>8*1024*1024)throw new Error('Максимальный размер изображения — 8 MiB.');
  if(extension==='.svg'){
    const svg=bytes.toString('utf8').trim();
    // Deliberately small SVG subset: no entities, CSS, href, links, scripts,
    // foreignObject, animation, event attributes, embedded/external resources.
    const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc']);
    const attrs=new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','opacity','fill-opacity','stroke-opacity','transform','font-size','font-family','font-weight','text-anchor','dx','dy','role','aria-label']);
    if(!/^<svg\s/.test(svg)||!/<\/svg>\s*$/.test(svg)||/[&\u0000-\u0008]|<!|<\?|url\s*\(/i.test(svg))throw new Error('SVG содержит запрещённое активное содержимое или неподдерживаемую разметку.');
    let rest=svg.replace(/<\/?([A-Za-z][\w:-]*)([^<>]*)>/g,(whole,tag,attributes)=>{
      if(!tags.has(tag))throw new Error('SVG: запрещённый элемент '+tag);
      let extra=attributes.replace(/\s+([\w:-]+)\s*=\s*("[^"]*"|'[^']*')/g,(_,key,quoted)=>{
        const value=quoted.slice(1,-1);
        if(!attrs.has(key)||/[<>\\]|(?:https?:|data:|javascript:)/i.test(value)&&!(key==='xmlns'&&value==='http://www.w3.org/2000/svg'))throw new Error('SVG: запрещённый атрибут '+key);
        return '';
      });
      if(!/^\s*\/?\s*$/.test(extra))throw new Error('SVG: некорректные атрибуты');
      return '';
    });
    if(/[<>]/.test(rest))throw new Error('SVG: некорректная разметка');
  }
  const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
  const expected={'.jpg':'jpeg','.jpeg':'jpeg','.png':'png','.webp':'webp','.gif':'gif','.svg':'svg'}[extension];
  if(meta.format!==expected||!meta.width||!meta.height||meta.width*meta.height*(meta.pages||1)>40_000_000)throw new Error('Фактический тип или размеры изображения недопустимы.');
  // Full raster decode detects truncated/corrupt files. Keep the original bytes;
  // never recompress formula/text screenshots unconditionally.
  if(extension!=='.svg')await sharp(bytes,{limitInputPixels:40_000_000}).stats();
  return {bytes,extension};
}
export async function uploadMedia(root,payload){
  const {bytes,extension}=await validateUpload(payload),lib=listLibrary(root);
  const previous=payload.replaceId?lib.items.find(x=>x.id===payload.replaceId):null;
  if(payload.replaceId&&!previous)throw new Error('Изображение для замены не найдено.');
  if(previous&&extname(previous.path).replace('.jpeg','.jpg')!==extension.replace('.jpeg','.jpg'))throw new Error('Для сохранения ссылок заменяйте файлом того же формата.');
  const project=payload.project||'';
  const safeName=(String(payload.name).slice(0,-extension.length).replace(/[^a-zA-Z0-9_-]/g,'-').replace(/-+/g,'-').slice(0,60)||'image');
  const asset=previous||assetSchema.parse({_authorship:payload._authorship,id:id(),path:`/media/${project||'shared'}/${safeName}-${randomBytes(4).toString('hex')}${extension}`,title:payload.title||payload.name,alt_ru:payload.alt_ru||'',alt_en:payload.alt_en||'',caption_ru:payload.caption_ru||'',caption_en:payload.caption_en||'',tags:payload.tags||[],project,uploadedAt:new Date().toISOString()});
  assetSchema.parse(asset);
  const path=localMediaPath(root,asset.path);mkdirSync(resolve(path,'..'),{recursive:true});
  writeFileSync(path+'.tmp',bytes);renameSync(path+'.tmp',path);
  if(!previous)lib.items.push(asset);
  saveLibrary(root,lib);return asset;
}
export function updateMetadata(root,data){
  const lib=listLibrary(root),index=lib.items.findIndex(x=>x.id===data.id);
  if(index<0)throw new Error('Media not found');
  const old=lib.items[index];
  lib.items[index]=assetSchema.parse({...data,id:old.id,path:old.path,uploadedAt:old.uploadedAt});
  saveLibrary(root,lib);return lib.items[index];
}
export function bindSlot(root,{slotId,mediaId}){
  const lib=listLibrary(root),slot=lib.slots.find(x=>x.id===slotId),asset=lib.items.find(x=>x.id===mediaId);
  if(!slot||mediaId&&!asset)throw new Error('Unknown slot or media ID');
  if(asset&&(!existsSync(localMediaPath(root,asset.path))||!asset.alt_ru.trim()||!asset.alt_en.trim()))throw new Error('Заполните alt RU и EN перед привязкой существующего файла.');
  slot.mediaId=mediaId;slot.status=mediaId?'ready':'placeholder';saveLibrary(root,lib);return slot;
}
export function updateSlot(root,data){
  const lib=listLibrary(root),slot=lib.slots.find(s=>s.id===data.id);
  if(!slot)throw new Error('Unknown slot');
  for(const key of ['_authorship','title','alt_ru','alt_en','caption_ru','caption_en'])slot[key]=data[key];
  saveLibrary(root,lib);return slot;
}
export function mediaUsage(root,asset){
  const lib=readLibrary(root),slotIds=lib.slots.filter(s=>s.mediaId===asset.id).map(s=>s.id),usages=[];
  const scan=file=>{
    const text=readFileSync(file,'utf8');
    if(text.includes(asset.path)||text.includes(`[[media:${asset.id}]]`))usages.push(relative(root,file).split(sep).join('/'));
  };
  const walk=dir=>{if(existsSync(dir))for(const ent of readdirSync(dir,{withFileTypes:true})){if(ent.isSymbolicLink())continue;const file=resolve(dir,ent.name);if(ent.isDirectory())walk(file);else if(ent.name.endsWith('.json'))scan(file)}};
  walk(resolve(root,'src/content'));
  for(const file of ['site','published'])if(existsSync(resolve(root,`src/data/${file}.json`)))scan(resolve(root,`src/data/${file}.json`));
  // Retain code-owned assets (e.g. social card) used outside editorial JSON.
  const codeWalk=dir=>{for(const ent of readdirSync(dir,{withFileTypes:true})){if(ent.isSymbolicLink())continue;const file=resolve(dir,ent.name);if(ent.isDirectory())codeWalk(file);else if(/\.(astro|css|mjs|tsx)$/.test(file))scan(file)}};
  codeWalk(resolve(root,'src'));
  return {slots:slotIds,documents:[...new Set(usages)]};
}
export function deleteMedia(root,{id:assetId,confirm=false}){
  const lib=listLibrary(root),asset=lib.items.find(x=>x.id===assetId);
  if(!asset)throw new Error('Media not found');
  const usage=mediaUsage(root,asset);
  if(usage.documents.length)throw new Error('Удаление запрещено: файл используется в '+usage.documents.join(', ')+'. Сначала удалите ссылки, включая сохранённую опубликованную версию.');
  if(!confirm)return {confirmationRequired:true,usage};
  // Bound slots safely return to placeholders; documents never lose a URL.
  for(const slot of lib.slots.filter(s=>s.mediaId===assetId)){slot.mediaId='';slot.status='placeholder'}
  lib.items=lib.items.filter(x=>x.id!==assetId);saveLibrary(root,lib);
  const path=localMediaPath(root,asset.path);if(existsSync(path))unlinkSync(path);
  return {deleted:true,usage};
}
