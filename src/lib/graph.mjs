import { readdirSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { readJSON } from './content.mjs';
import {authorshipSchema} from './authorship.mjs';
export const nodeTypes=['кризис-разрешение','противоречие','частный_случай','качество'];
export const researchStatuses=['подтверждено','черновик','не выведено'];
const id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const graphSchema=z.object({
  schemaVersion:z.literal(1),
  nodes:z.array(z.object({
    id,originalKey:z.string().min(1),type:z.enum(nodeTypes),researchStatus:z.enum(researchStatuses),
    title_ru:z.string().min(1),title_en:z.string().min(1),
    explanation_ru:z.string(),explanation_en:z.string(), formula:z.string().default(''),
    predecessors:z.array(id), position:z.object({x:z.number(),y:z.number()}).optional()
  }).strict()),
  edges:z.array(z.object({id,source:id,target:id}).strict())
}).strict();
export const overrideSchema=z.object({
  _authorship:authorshipSchema,
  id,approvedForPublication:z.boolean().default(false),
  annotation_ru:z.string().default(''),annotation_en:z.string().default(''),
  extra_ru:z.string().default(''),extra_en:z.string().default(''),
  order:z.number().default(0),featured:z.boolean().default(false),
  tags:z.array(z.string()).default([]),image:z.string().default(''),
  links:z.array(z.object({_authorship:authorshipSchema,url:z.string().url().refine(x=>x.startsWith('https://')),label_ru:z.string(),label_en:z.string()})).default([])
}).strict();
export function validateGraph(input){
  const graph=graphSchema.parse(input),ids=new Set(),keys=new Set(),edgeIds=new Set();
  for(const n of graph.nodes){
    if(ids.has(n.id)||keys.has(n.originalKey)) throw new Error(`Duplicate graph ID/key: ${n.id}`);
    ids.add(n.id);keys.add(n.originalKey);
  }
  for(const n of graph.nodes) for(const p of n.predecessors) if(!ids.has(p)||p===n.id) throw new Error(`Orphan/self predecessor: ${n.id}`);
  for(const e of graph.edges){
    if(!ids.has(e.source)||!ids.has(e.target)||e.source===e.target||edgeIds.has(e.id)) throw new Error(`Invalid edge: ${e.id}`);
    edgeIds.add(e.id);
    if(!graph.nodes.find(n=>n.id===e.target).predecessors.includes(e.source)) throw new Error(`Edge missing from predecessors: ${e.id}`);
  }
  for(const n of graph.nodes) for(const p of n.predecessors)
    if(!graph.edges.some(e=>e.source===p&&e.target===n.id)) throw new Error(`Predecessor missing edge: ${n.id}`);
  const visited=new Set(),active=new Set();
  function visit(n){if(active.has(n.id))throw new Error('Cycle in predecessor graph');if(visited.has(n.id))return;active.add(n.id);for(const p of n.predecessors)visit(graph.nodes.find(x=>x.id===p));active.delete(n.id);visited.add(n.id);}
  graph.nodes.forEach(visit);
  return graph;
}
export function readOverrides(){
  const path='src/content/graph-overrides';
  return existsSync(path)?readdirSync(path).filter(f=>f.endsWith('.json')).map(f=>{
    const override=overrideSchema.parse(readJSON(`${path}/${f}`));
    if(f!==`${override.id}.json`)throw new Error(`Override ID must match its filename: ${f}`);
    return override;
  }):[];
}
export function publicGraph(input, overrides){
  const graph=validateGraph(input),map=new Map(overrides.map(x=>[x.id,overrideSchema.parse(x)]));
  const approved=graph.nodes.filter(n=>map.get(n.id)?.approvedForPublication===true);
  const ids=new Set(approved.map(n=>n.id));
  return {
    demo:false,
    nodes:approved.map((n,i)=>{
      const o=map.get(n.id);
      // Explicit allowlist: original keys and hidden predecessor IDs never cross the build boundary.
      return {id:n.id,type:n.type,researchStatus:n.researchStatus,title_ru:n.title_ru,title_en:n.title_en,
        explanation_ru:o.annotation_ru||n.explanation_ru,explanation_en:o.annotation_en||n.explanation_en,
        extra_ru:o.extra_ru,extra_en:o.extra_en,formula:n.formula,
        predecessors:n.predecessors.filter(p=>ids.has(p)),hasUnpublishedStructure:n.predecessors.some(p=>!ids.has(p)),
        position:n.position||{x:(i%4)*270,y:Math.floor(i/4)*180},tags:o.tags,image:o.image,order:o.order,featured:o.featured,links:o.links.map(({url,label_ru,label_en})=>({url,label_ru,label_en}))};
    }).sort((a,b)=>a.order-b.order),
    edges:graph.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))
  };
}
export function getPublicGraph(){
  const source=readJSON('src/data/graph/source.json'),mapping=readJSON('src/data/graph/id-map.json');
  for(const node of source.nodes)if(mapping[node.originalKey]!==node.id)throw new Error(`Source ID mapping mismatch: ${node.id}. Use the validated importer.`);
  return publicGraph(source,readOverrides());
}
export function getDemoGraph(){
  const demo=readJSON('src/data/graph/demo.json');
  const ui=readJSON('src/data/ui.json');
  return {...demo,nodes:demo.nodes.map(({originalKey,...node})=>({...node,
    ...Object.fromEntries(['ru','en'].flatMap(lang=>[['title_'+lang,ui[lang]['demoTitle:'+node.id]??node['title_'+lang]],['explanation_'+lang,ui[lang]['demoExplanation:'+node.id]??node['explanation_'+lang]]]))
  }))};
}
