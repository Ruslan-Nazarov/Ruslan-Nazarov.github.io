import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { readJSON } from '../src/lib/content.mjs';
import { validateGraph, readOverrides } from '../src/lib/graph.mjs';
const filename=process.argv[2];
if(!filename) throw new Error('Usage: npm run graph:import -- path/to/export.json');
const next=validateGraph(readJSON(filename));
const previous=validateGraph(readJSON('src/data/graph/source.json'));
const idMap=readJSON('src/data/graph/id-map.json');
const overrides=readOverrides();
for(const n of next.nodes){
  if(idMap[n.originalKey] && idMap[n.originalKey]!==n.id) throw new Error(`ID changed for ${n.originalKey}. Resolve the mapping manually.`);
  const conflictingKey=Object.keys(idMap).find(k=>idMap[k]===n.id && k!==n.originalKey);
  if(conflictingKey) throw new Error(`Renamed/conflicting originalKey ${conflictingKey} -> ${n.originalKey}. Reconcile explicitly.`);
}
const nextIds=new Set(next.nodes.map(n=>n.id));
const oldIds=new Set(previous.nodes.map(n=>n.id));
const report={
  added:next.nodes.filter(n=>!oldIds.has(n.id)).map(n=>n.id),
  changed:next.nodes.filter(n=>oldIds.has(n.id)&&JSON.stringify(n)!==JSON.stringify(previous.nodes.find(p=>p.id===n.id))).map(n=>n.id),
  removed:previous.nodes.filter(n=>!nextIds.has(n.id)).map(n=>n.id),
  orphaned:overrides.filter(o=>!nextIds.has(o.id)).map(o=>o.id)
};
mkdirSync('.local',{recursive:true});
writeFileSync('.local/graph-import-report.json',JSON.stringify(report,null,2));
if(report.removed.length) throw new Error('Removed nodes require explicit reconciliation; source unchanged. See .local/graph-import-report.json');
// Complete validation precedes any source mutation. Existing annotations are never rewritten.
mkdirSync('src/content/graph-overrides',{recursive:true});
for(const n of next.nodes){
  const existingOverride=overrides.find(o=>o.id===n.id);
  if(!existingOverride||!oldIds.has(n.id)){
    // An orphan override must never silently approve a new/reintroduced node.
    const metadata=existingOverride||{id:n.id,annotation_ru:'',annotation_en:'',extra_ru:'',extra_en:'',order:0,featured:false,tags:[],image:'',links:[]};
    writeFileSync(`src/content/graph-overrides/${n.id}.json`,JSON.stringify({...metadata,approvedForPublication:false},null,2)+'\n');
  }
  idMap[n.originalKey]=n.id;
}
writeFileSync('src/data/graph/id-map.json',JSON.stringify(idMap,null,2)+'\n');
writeFileSync('src/data/graph/source.json.tmp',JSON.stringify(next,null,2)+'\n');
renameSync('src/data/graph/source.json.tmp','src/data/graph/source.json');
console.log(JSON.stringify(report,null,2));
