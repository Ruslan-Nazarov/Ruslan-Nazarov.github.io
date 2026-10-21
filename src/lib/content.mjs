import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const collections = ['research','projects','publications','journal','theses','pages'];
export const languages = ['ru','en'];
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const safeUrl = z.string().refine(s => s === '' || /^https:\/\//.test(s) || /^\/(?!\/)/.test(s), 'Use HTTPS or a root-relative path');
const link = z.object({label_ru:z.string(),label_en:z.string(),url:safeUrl});
export const entrySchema = z.object({
  id, slug:id, publish:z.boolean().default(false),
  ready_ru:z.boolean().default(false), ready_en:z.boolean().default(false),
  title_ru:z.string(),title_en:z.string(),summary_ru:z.string(),summary_en:z.string(),
  body_ru:z.string().default(''),body_en:z.string().default(''),
  researchAreas:z.array(id).default([]),relatedProjects:z.array(id).default([]),
  relatedPublications:z.array(id).default([]),relatedJournal:z.array(id).default([]),
  featured:z.boolean().default(false),tags:z.array(z.string()).default([]),
  heroImage:safeUrl.default(''),gallery:z.array(z.object({src:safeUrl,alt_ru:z.string().min(1),alt_en:z.string().min(1)})).default([]),
  links:z.array(link).default([]),timeline:z.array(z.object({
    date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),title_ru:z.string().min(1),title_en:z.string().min(1)
  })).default([]),
  exampleLinks:z.array(z.object({id,label_ru:z.string(),label_en:z.string(),url_ru:safeUrl,url_en:safeUrl})).default([]),
  editorialStatus:z.enum(['awaiting_content','editorial_summary','final','external_publication']).default('awaiting_content'),
  status:z.enum(['active','completed','paused']).optional(),
  type:z.enum(['book','theses','article','technical-note','news','research-note','experiment','result']).optional(),
  date:z.preprocess(v=>v===''||v===null?undefined:v,z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  order:z.number().optional(), pdf_ru:safeUrl.optional(),pdf_en:safeUrl.optional()
}).passthrough();
export function readJSON(path) { return JSON.parse(readFileSync(resolve(path),'utf8')); }
export function rawCollection(name, root='src/content') {
  const path=resolve(root,name);
  return existsSync(path) ? readdirSync(path).filter(x=>x.endsWith('.json')).sort().map(file=>entrySchema.parse(readJSON(`${path}/${file}`))) : [];
}
export function isReady(row) {
  return row.publish === true && row.ready_ru === true && row.ready_en === true &&
    ['title_ru','title_en','summary_ru','summary_en'].every(k=>typeof row[k]==='string' && row[k].trim()) &&
    (row.editorialStatus !== 'final' || ['body_ru','body_en'].every(k=>row[k]?.trim()));
}
export function resolvePublication(candidate, previous) {
  if (!candidate.publish) return null;
  if (isReady(candidate)) return candidate;
  return previous && isReady(previous) ? previous : null;
}
export function getCollection(name) {
  const previous = existsSync('src/data/published.json') ? readJSON('src/data/published.json')[name] || [] : [];
  return rawCollection(name).map(row=>resolvePublication(row, previous.find(p=>p.id===row.id))).filter(Boolean).sort((a,b)=>(a.order??100)-(b.order??100));
}
export function allContent() { return Object.fromEntries(collections.map(name=>[name,getCollection(name)])); }
export const site = readJSON('src/data/site.json');
export const localize=(row,key,lang)=>row[`${key}_${lang}`] || '';
export const pathFor=(collection,row,lang)=>collection==='theses'
  ? `/${lang}/publications/theses-2020-2026/chapters/${row.slug}/`
  : collection==='pages' ? `/${lang}/projects/papanda/${row.slug}/` : `/${lang}/${collection}/${row.slug}/`;
export function events(data=allContent()) {
  const result=[];
  for(const name of ['projects','publications','journal']) for(const row of data[name]){
    if(row.date) result.push({date:row.date,title_ru:row.title_ru,title_en:row.title_en,collection:name,row});
    for(const event of row.timeline||[]) result.push({...event,collection:name,row});
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date));
}
export function routes() {
  const data=allContent();
  const result=['','research','projects','publications','journal','timeline','about','search','legal','privacy'];
  const hasTheses=data.publications.some(p=>p.id==='theses-2020-2026');
  const hasPapanda=data.projects.some(p=>p.id==='papanda');
  if(data.projects.some(p=>p.id==='mathematical-parser'))result.push('projects/mathematical-parser/graph');
  if(hasTheses)result.push('publications/theses-2020-2026/full');
  for(const name of collections){
    if(name==='theses'&&!hasTheses||name==='pages'&&!hasPapanda)continue;
    for(const row of data[name]) result.push(pathFor(name,row,'ru').replace(/^\/ru\/|\/$/g,''));
  }
  return [...new Set(result)];
}
export function validateAll() {
  const raw=Object.fromEntries(collections.map(n=>[n,rawCollection(n)]));
  for(const [name,rows] of Object.entries(raw)){
    const ids=new Set(),slugs=new Set();
    for(const row of rows){
      if(ids.has(row.id)||slugs.has(row.slug)) throw new Error(`Duplicate ID/slug in ${name}: ${row.id}`);
      ids.add(row.id);slugs.add(row.slug);
      if(name==='journal'&&isReady(row)&&(!row.date||row.date<'2026-01-01'||!['news','research-note','experiment','result'].includes(row.type)))
        throw new Error(`Journal entry needs a real date from 2026 and an entry type: ${row.id}`);
      if(name==='publications'&&isReady(row)&&!['book','theses','article','technical-note'].includes(row.type))
        throw new Error(`Publication type required: ${row.id}`);
      if(name==='projects'&&isReady(row)&&!row.status)throw new Error(`Project status required: ${row.id}`);
      for(const [field,target] of Object.entries({researchAreas:'research',relatedProjects:'projects',relatedPublications:'publications',relatedJournal:'journal'}))
        for(const value of row[field]) if(!raw[target].some(p=>p.id===value)) throw new Error(`Unknown ${field} ${value} in ${row.id}`);
    }
  }
  for(const l of languages) if(!site[l]||Object.values(site[l]).some(v=>typeof v!=='string'||!v.trim())) throw new Error(`Incomplete site language: ${l}`);
  if(site.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) throw new Error('Invalid email');
  if(site.formEndpoint&&!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(site.formEndpoint)) throw new Error('Use a Formspree /f/ endpoint');
  if(site.cloudflareToken&&!/^[a-f0-9]{32}$/i.test(site.cloudflareToken)) throw new Error('Invalid Cloudflare analytics token');
  for(const p of site.profiles) safeUrl.parse(p.url);
  safeUrl.parse(site.portrait);
  return raw;
}
