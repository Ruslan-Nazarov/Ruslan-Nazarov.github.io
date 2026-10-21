import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';

export const mediaId=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const mediaPath=z.string().regex(/^\/(?:images|media)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif|svg)$/).refine(p=>!p.includes('..'));
const texts={title:z.string().max(300),alt_ru:z.string().max(1000),alt_en:z.string().max(1000),caption_ru:z.string().max(2000),caption_en:z.string().max(2000)};
export const assetSchema=z.object({id:mediaId,path:mediaPath,...texts,tags:z.array(z.string().max(80)).max(30),project:z.union([mediaId,z.literal('')]),uploadedAt:z.string().datetime()});
export const slotSchema=z.object({id:mediaId,...texts,alt_ru:texts.alt_ru.min(1),alt_en:texts.alt_en.min(1),caption_ru:texts.caption_ru.min(1),caption_en:texts.caption_en.min(1),project:mediaId,mediaId:z.union([mediaId,z.literal('')]),status:z.enum(['placeholder','ready'])});
export const librarySchema=z.object({items:z.array(assetSchema),slots:z.array(slotSchema)}).superRefine((v,ctx)=>{
  for(const key of ['items','slots'])if(new Set(v[key].map(x=>x.id)).size!==v[key].length)ctx.addIssue({code:'custom',message:`Duplicate ${key} ID`});
  if(v.items.some(item=>v.slots.some(slot=>slot.id===item.id)))ctx.addIssue({code:'custom',message:'Asset and placeholder IDs must be distinct'});
  if(new Set(v.items.map(x=>x.path)).size!==v.items.length)ctx.addIssue({code:'custom',message:'Duplicate media path'});
  for(const slot of v.slots)if(slot.status!==(slot.mediaId?'ready':'placeholder')||slot.mediaId&&!v.items.some(x=>x.id===slot.mediaId))ctx.addIssue({code:'custom',message:`Invalid slot binding: ${slot.id}`});
});
export function readLibrary(root=process.cwd()){
  const file=resolve(root,'src/data/media.json');
  return librarySchema.parse(existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{items:[],slots:[]});
}
export function resolveMedia(id,root=process.cwd()){
  const lib=readLibrary(root),slot=lib.slots.find(s=>s.id===id),item=lib.items.find(i=>i.id===(slot?slot.mediaId:id));
  return {...(item||{}),...(slot||{}),path:item&&existsSync(resolve(root,'public'+item.path))?item.path:'',id};
}
export const mediaForPath=path=>readLibrary().items.find(item=>item.path===path);
