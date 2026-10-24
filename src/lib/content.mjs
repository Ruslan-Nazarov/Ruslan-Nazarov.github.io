import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {authorshipSchema,validateAuthorship} from './authorship.mjs';

export const collections = ['research','projects','publications','journal','theses','pages'];
export const languages = ['ru','en'];
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const date=new Date(s+'T12:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===s},'Use a real calendar date');
const optionalDate=z.preprocess(v=>v===''||v===null?undefined:v,calendarDate.optional());
const safeUrl = z.string().refine(s => {
  if(s==='')return true;
  if(s.trim()!==s||s.includes('\\'))return false;
  try{const url=new URL(s,'https://site.invalid');return /^https:\/\//.test(s)&&url.protocol==='https:'||/^\/(?!\/)/.test(s)&&url.origin==='https://site.invalid'}catch{return false}
}, 'Use a valid HTTPS URL or a root-relative path');
const link = z.object({_authorship:authorshipSchema,label_ru:z.string().trim().min(1),label_en:z.string().trim().min(1),url:safeUrl.refine(Boolean,'A link needs a URL')});
export const entrySchema = z.object({
  _authorship:authorshipSchema,
  id, slug:id, publish:z.boolean().default(false),
  ready_ru:z.boolean().default(false), ready_en:z.boolean().default(false),
  title_ru:z.string(),title_en:z.string(),summary_ru:z.string(),summary_en:z.string(),
  body_ru:z.string().default(''),body_en:z.string().default(''),
  pagePath:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/).optional(),
  showInMenu:z.boolean().default(false),
  materials:z.array(z.object({collection:z.enum(['research','projects','publications','journal','theses','pages']),id})).default([]),
  excludedMaterials:z.array(id).default([]),
  hiddenMaterials:z.array(z.object({collection:z.enum(['research','projects','publications','journal','theses','pages']),id})).default([]),
  researchAreas:z.array(id).default([]),relatedProjects:z.array(id).default([]),
  relatedPublications:z.array(id).default([]),relatedJournal:z.array(id).default([]),
  featured:z.boolean().default(false),tags:z.array(z.string()).default([]),
  heroImage:safeUrl.default(''),gallery:z.array(z.object({_authorship:authorshipSchema,src:safeUrl,alt_ru:z.string().min(1),alt_en:z.string().min(1)})).default([]),
  links:z.array(link).default([]),timeline:z.array(z.object({
    _authorship:authorshipSchema,date:calendarDate,title_ru:z.string().min(1),title_en:z.string().min(1)
  })).default([]),
  exampleLinks:z.array(z.object({_authorship:authorshipSchema,id,label_ru:z.string(),label_en:z.string(),url_ru:safeUrl,url_en:safeUrl})).default([]),
  editorialStatus:z.enum(['awaiting_content','editorial_summary','final','external_publication']).default('awaiting_content'),
  status:z.enum(['active','completed','paused']).optional(),
  type:z.enum(['book','theses','article','technical-note','news','research-note','experiment','result']).optional(),
  date:optionalDate,targetDate:optionalDate,startedDate:optionalDate,
  readingMode:z.enum(['full','external','forthcoming']).optional(),
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
    (row.editorialStatus !== 'final' && row.readingMode !== 'full' || ['body_ru','body_en'].every(k=>row[k]?.trim()));
}
export function resolvePublication(candidate, previous) {
  if (!candidate.publish) return null;
  if (isReady(candidate)) return candidate;
  return previous && isReady(previous) ? previous : null;
}
export function getCollection(name) {
  if(process.env.SITE_EDITOR_PREVIEW==='1')return rawCollection(name).sort((a,b)=>(a.order??100)-(b.order??100));
  const previous = existsSync('src/data/published.json') ? readJSON('src/data/published.json')[name] || [] : [];
  return rawCollection(name).map(row=>resolvePublication(row, previous.find(p=>p.id===row.id))).filter(Boolean).sort((a,b)=>(a.order??100)-(b.order??100));
}
export function allContent() { return Object.fromEntries(collections.map(name=>[name,getCollection(name)])); }
export const site = readJSON('src/data/site.json');
export const localize=(row,key,lang)=>row[`${key}_${lang}`] || '';
export const pathFor=(collection,row,lang)=>collection==='theses'
  ? `/${lang}/publications/theses-2020-2026/chapters/${row.slug}/`
  : collection==='pages' ? `/${lang}/${row.pagePath||(row.id==='dialectical-notes'?'projects/papanda/'+row.slug:row.slug)}/` : `/${lang}/${collection}/${row.slug}/`;
export function events(data=allContent()) {
  const result=[];
  for(const name of ['projects','publications','journal']) for(const row of data[name]){
    if(row.date) result.push({date:row.date,title_ru:row.title_ru,title_en:row.title_en,_authorship:row._authorship,collection:name,row});
    for(const event of row.timeline||[]) result.push({...event,collection:name,row});
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date));
}
export function timelineRows(data=allContent()) {
  return events(data).filter(e=>e.date>='2026-01-01').map(e=>({...e.row,date:e.date,title_ru:e.title_ru,title_en:e.title_en,_authorship:{...e.row._authorship,title_ru:e._authorship?.title_ru,title_en:e._authorship?.title_en},eventCollection:e.collection}));
}
export function routes() {
  const data=allContent();
  const result=['','articles','research','projects','publications','journal','timeline','about','search','legal','privacy'];
  const hasTheses=data.publications.some(p=>p.id==='theses-2020-2026');
  if(data.projects.some(p=>p.id==='mathematical-parser'))result.push('projects/mathematical-parser/graph');
  if(hasTheses)result.push('publications/theses-2020-2026/full');
  for(const name of collections){
    if(name==='theses'&&!hasTheses)continue;
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
      if(name==='publications'&&isReady(row)&&row.readingMode==='external'&&!row.links.length)
        throw new Error(`An external publication needs a reading link: ${row.id}`);
      if(name==='projects'&&isReady(row)&&!row.status)throw new Error(`Project status required: ${row.id}`);
      for(const [field,target] of Object.entries({researchAreas:'research',relatedProjects:'projects',relatedPublications:'publications',relatedJournal:'journal'}))
        for(const value of row[field]) if(!raw[target].some(p=>p.id===value)) throw new Error(`Unknown ${field} ${value} in ${row.id}`);
      for(const material of row.materials)if(!raw[material.collection].some(p=>p.id===material.id))throw new Error(`Unknown material ${material.collection}/${material.id} in ${row.id}`);
    }
  }
  const pagePaths=new Set(['','articles','research','projects','publications','journal','timeline','about','search','legal','privacy']);
  for(const [collection,rows] of Object.entries(raw))for(const row of rows){
    const path=pathFor(collection,row,'ru').replace(/^\/ru\/|\/$/g,'');
    if(pagePaths.has(path)||['projects/mathematical-parser/graph','publications/theses-2020-2026/full'].includes(path))throw new Error(`Page address already exists: ${path}`);
    pagePaths.add(path);
  }
  const sections=readJSON('src/data/sections.json');
  for(const key of ['research','projects','publications','journal']){
    const section=entrySchema.parse(sections[key]);
    if(['title_ru','title_en','summary_ru','summary_en'].some(field=>!section[field].trim()))throw new Error(`Incomplete section: ${key}`);
    validateAuthorship(section);
    for(const material of section.materials)if(!raw[material.collection].some(p=>p.id===material.id))throw new Error(`Unknown material in section ${key}`);
  }
  validateAuthorship(site);validateAuthorship(raw);validateAuthorship(readJSON('src/data/ui.json'));
  for(const l of languages) if(!site[l]||Object.entries(site[l]).some(([key,v])=>key!=='_authorship'&&(typeof v!=='string'||!v.trim()))) throw new Error(`Incomplete site language: ${l}`);
  if(site.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) throw new Error('Invalid email');
  if(site.formEndpoint&&!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(site.formEndpoint)) throw new Error('Use a Formspree /f/ endpoint');
  if(site.cloudflareToken&&!/^[a-f0-9]{32}$/i.test(site.cloudflareToken)) throw new Error('Invalid Cloudflare analytics token');
  for(const p of site.profiles) safeUrl.parse(p.url);
  safeUrl.parse(site.portrait);
  for(const key of ['favicon','socialImage','footerGithubUrl','textLicenseUrl'])safeUrl.refine(Boolean).parse(site[key]);
  if(!raw.projects.some(project=>project.id===site.featuredProject))throw new Error('Unknown featured project');
  for(const lang of languages)for(const [key,value] of Object.entries(readJSON('src/data/ui.json')[lang]))if(key!=='_authorship'&&(typeof value!=='string'||!value.trim()))throw new Error(`Invalid interface text: ${lang}.${key}`);
  return raw;
}
