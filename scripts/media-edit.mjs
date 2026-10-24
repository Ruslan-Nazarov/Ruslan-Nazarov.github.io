// Local photo tools. Originals stay outside public/ and are never deployed.
import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';
import {mediaId} from '../src/lib/media.mjs';
import {listLibrary,localMediaPath,validateUpload,uploadMedia} from './media-library.mjs';

const mimeFor=extension=>({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[extension]);
const revision=bytes=>createHash('sha256').update(bytes).digest('hex');
const backupPath=(root,item)=>resolve(root,'.local/media-originals',item.id+extname(item.path));
export async function mediaSource(root,payload){
  if(payload.id){
    mediaId.parse(payload.id);
    const item=listLibrary(root).items.find(x=>x.id===payload.id);
    if(!item)throw new Error('Изображение не найдено.');
    const path=localMediaPath(root,item.path),bytes=readFileSync(path);
    return {bytes,extension:extname(path),name:path.split(/[\\/]/).pop(),item};
  }
  return {...await validateUpload(payload),name:payload.name,item:null};
}
async function photoSource(root,payload){
  const source=await mediaSource(root,payload);
  if(!mimeFor(source.extension))throw new Error('Обрезка и коррекция доступны для PNG, JPEG и WebP.');
  const meta=await sharp(source.bytes,{limitInputPixels:40_000_000}).metadata();
  if((meta.pages||1)>1)throw new Error('Анимированные изображения нельзя редактировать как фото.');
  return source;
}
export async function photoInfo(root,payload){
  const source=await photoSource(root,payload);
  const oriented=await sharp(source.bytes,{limitInputPixels:40_000_000}).autoOrient().toBuffer();
  const meta=await sharp(oriented).metadata();
  const preview=await sharp(oriented).resize({width:1400,height:1000,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  return {width:meta.width,height:meta.height,preview:'data:image/png;base64,'+preview.toString('base64'),revision:revision(source.bytes),canRestore:!!source.item&&existsSync(backupPath(root,source.item))};
}
const editSchema=z.object({
  rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]).default(0),
  flipX:z.boolean().default(false),flipY:z.boolean().default(false),
  brightness:z.number().min(.5).max(1.5).default(1),contrast:z.number().min(.5).max(1.5).default(1),
  crop:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().gt(0).max(1),height:z.number().gt(0).max(1)}).refine(c=>c.x+c.width<=1.000001&&c.y+c.height<=1.000001,'Обрезка выходит за границы фото.').optional()
}).strict();
export async function transformPhoto(bytes,options,extension){
  const edit=editSchema.parse(options);
  // Explicit stages keep EXIF, rotation, reflection and crop order identical to the UI.
  const oriented=await sharp(bytes,{limitInputPixels:40_000_000}).autoOrient().toBuffer();
  const rotated=await sharp(oriented).rotate(edit.rotation).toBuffer();
  const reflected=await sharp(rotated).flop(edit.flipX).flip(edit.flipY).toBuffer();
  const meta=await sharp(reflected).metadata();
  let pipeline=sharp(reflected);
  if(edit.crop){
    const c=edit.crop,left=Math.min(meta.width-1,Math.round(c.x*meta.width)),top=Math.min(meta.height-1,Math.round(c.y*meta.height));
    const width=Math.max(1,Math.min(meta.width-left,Math.round(c.width*meta.width))),height=Math.max(1,Math.min(meta.height-top,Math.round(c.height*meta.height)));
    pipeline=pipeline.extract({left,top,width,height});
  }
  if(edit.brightness!==1||edit.contrast!==1)pipeline=pipeline.linear(edit.brightness*edit.contrast,128*(1-edit.contrast));
  if(extension==='.png')pipeline=pipeline.png();
  else if(extension==='.webp')pipeline=pipeline.webp({quality:95});
  else pipeline=pipeline.jpeg({quality:95,mozjpeg:true});
  const result=await pipeline.toBuffer();
  if(result.length>8*1024*1024)throw new Error('Результат больше 8 MiB. Выберите меньшую область.');
  return result;
}
function checkRevision(source,expected){if(expected!==revision(source.bytes))throw new Error('Фото изменилось. Закройте редактор фото и откройте его заново.');}
function atomicWrite(path,bytes){writeFileSync(path+'.tmp',bytes);renameSync(path+'.tmp',path);}
export async function editPhoto(root,payload){
  const source=await photoSource(root,payload);checkRevision(source,payload.revision);
  if(!['draft','copy','replace'].includes(payload.mode)||!source.item&&payload.mode!=='draft'||source.item&&payload.mode==='draft')throw new Error('Некорректный способ сохранения фото.');
  const bytes=await transformPhoto(source.bytes,payload.edit,source.extension);
  const file={name:source.name,mime:mimeFor(source.extension),base64:bytes.toString('base64')};
  if(payload.mode==='draft')return {file};
  if(payload.mode==='copy')return {item:await uploadMedia(root,{...source.item,...file,title:source.item.title+' — копия'})};
  const backup=backupPath(root,source.item);mkdirSync(resolve(backup,'..'),{recursive:true});
  if(!existsSync(backup))writeFileSync(backup,source.bytes,{flag:'wx'});
  atomicWrite(localMediaPath(root,source.item.path),bytes);
  return {item:source.item};
}
export async function restorePhoto(root,payload){
  const source=await photoSource(root,payload);checkRevision(source,payload.revision);
  if(!source.item)throw new Error('Сначала сохраните фото в библиотеку.');
  const backup=backupPath(root,source.item);
  if(!existsSync(backup))throw new Error('Исходник не найден.');
  atomicWrite(localMediaPath(root,source.item.path),readFileSync(backup));
  return {item:source.item};
}
