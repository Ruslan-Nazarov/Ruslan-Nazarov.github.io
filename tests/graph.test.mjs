import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {publicGraph,validateGraph} from '../src/lib/graph.mjs';
const node=(id,status='черновик',predecessors=[])=>({
  id,originalKey:`ORIGINAL_PRIVATE_${id}`,title_ru:`Узел ${id}`,title_en:`Node ${id}`,type:'кризис-разрешение',
  researchStatus:status,explanation_ru:`PRIVATE_EXPLANATION_${id}`,explanation_en:`PRIVATE_EXPLANATION_${id}`,
  predecessors,formula:'a+b'
});
const graph={schemaVersion:1,nodes:[node('hidden'),node('draft','черновик',['hidden']),node('confirmed','подтверждено',['draft']),node('unresolved','не выведено',['confirmed'])],
  edges:[{id:'hidden-draft',source:'hidden',target:'draft'},{id:'draft-confirmed',source:'draft',target:'confirmed'},{id:'confirmed-unresolved',source:'confirmed',target:'unresolved'}]};
const approvals=['draft','confirmed','unresolved'].map(id=>({id,approvedForPublication:true}));
test('all research statuses may be public only with independent approval',()=>{
  const result=publicGraph(graph,approvals);
  assert.deepEqual(result.nodes.map(n=>n.id),['draft','confirmed','unresolved']);
  assert.equal(publicGraph(graph,[]).nodes.length,0);
});
test('hidden IDs, explanations and original keys cannot leak through nodes or edges',()=>{
  const result=publicGraph(graph,approvals),serialized=JSON.stringify(result);
  assert.doesNotMatch(serialized,/hidden|ORIGINAL_PRIVATE|PRIVATE_EXPLANATION_hidden/);
  assert.equal(result.nodes[0].hasUnpublishedStructure,true);
  assert.deepEqual(result.nodes[0].predecessors,[]);
  assert.equal(result.edges.length,2);
});
test('dangling edges, missing predecessors, duplicate IDs and cycles fail closed',()=>{
  assert.throws(()=>validateGraph({...graph,edges:[...graph.edges,{id:'bad',source:'absent',target:'draft'}]}));
  assert.throws(()=>validateGraph({...graph,nodes:[...graph.nodes,node('hidden')]}));
  assert.throws(()=>validateGraph({...graph,edges:[]}));
  assert.throws(()=>validateGraph({schemaVersion:1,nodes:[node('a','черновик',['b']),node('b','черновик',['a'])],edges:[{id:'ab',source:'a',target:'b'},{id:'ba',source:'b',target:'a'}]}));
});
test('reimport retains CMS annotations and approval, new nodes default to private, invalid import leaves source unchanged',()=>{
  mkdirSync('.local/tests',{recursive:true});
  const dir=mkdtempSync(resolve('.local/tests/import-'));
  mkdirSync(resolve(dir,'src/data/graph'),{recursive:true});mkdirSync(resolve(dir,'src/content/graph-overrides'),{recursive:true});
  copyFileSync('src/data/site.json',resolve(dir,'src/data/site.json'));
  const save=(path,value)=>writeFileSync(resolve(dir,path),JSON.stringify(value,null,2));
  save('src/data/graph/source.json',{schemaVersion:1,nodes:[node('existing')],edges:[]});
  save('src/data/graph/id-map.json',{'ORIGINAL_PRIVATE_existing':'existing'});
  save('src/content/graph-overrides/existing.json',{id:'existing',approvedForPublication:true,annotation_ru:'Сохранить аннотацию',annotation_en:'Preserve annotation'});
  save('src/content/graph-overrides/new.json',{id:'new',approvedForPublication:true,annotation_ru:'Прежняя аннотация',annotation_en:'Orphan annotation'});
  const originalOverride=readFileSync(resolve(dir,'src/content/graph-overrides/existing.json'),'utf8');
  const next={schemaVersion:1,nodes:[node('existing'),node('new')],edges:[]};save('incoming.json',next);
  const importer=resolve('scripts/import-graph.mjs');
  execFileSync(process.execPath,[importer,'incoming.json'],{cwd:dir});
  assert.equal(readFileSync(resolve(dir,'src/content/graph-overrides/existing.json'),'utf8'),originalOverride);
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/content/graph-overrides/new.json'),'utf8')).approvedForPublication,false);
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/content/graph-overrides/new.json'),'utf8')).annotation_en,'Orphan annotation');
  const previous=readFileSync(resolve(dir,'src/data/graph/source.json'),'utf8');
  save('incoming.json',{...next,edges:[{id:'orphan',source:'missing',target:'new'}]});
  assert.throws(()=>execFileSync(process.execPath,[importer,'incoming.json'],{cwd:dir,stdio:'pipe'}));
  assert.equal(readFileSync(resolve(dir,'src/data/graph/source.json'),'utf8'),previous);
  save('incoming.json',{schemaVersion:1,nodes:[node('existing')],edges:[]});
  assert.throws(()=>execFileSync(process.execPath,[importer,'incoming.json'],{cwd:dir,stdio:'pipe'}));
  assert.equal(readFileSync(resolve(dir,'src/data/graph/source.json'),'utf8'),previous);
  save('incoming.json',{schemaVersion:1,nodes:[{...node('existing'),id:'changed'}],edges:[]});
  assert.throws(()=>execFileSync(process.execPath,[importer,'incoming.json'],{cwd:dir,stdio:'pipe'}));
});
test('Python export keeps IDs stable and fails on missing bilingual source fields',t=>{
  const python=process.env.EXPORT_TEST_PYTHON||(process.platform==='win32'?'python':'python3');
  try{execFileSync(python,['--version'],{stdio:'pipe',timeout:5000})}catch{return t.skip('Python is optional for the site; set EXPORT_TEST_PYTHON to test the offline adapter.')}
  const dir=mkdtempSync(resolve('.local/tests/python-export-'));
  writeFileSync(resolve(dir,'id-map.json'),'{}');
  const module=resolve(dir,'graph_data.py');
  const source={...node('sample'),predecessors:[]};
  delete source.id;delete source.originalKey;
  writeFileSync(module,`import json\nOPERATIONS_GRAPH = json.loads(${JSON.stringify(JSON.stringify({'исходный_ключ':source}))})\n`);
  const output=resolve(dir,'export.json'),mapping=resolve(dir,'id-map.json');
  const args=[resolve('scripts/export-parser-graph.py'),'--module',module,'--id-map',mapping,'--output',output];
  const options={stdio:'pipe',env:{...process.env,PYTHONIOENCODING:'utf-8'}};
  execFileSync(python,args,options);
  const first=readFileSync(output,'utf8');
  execFileSync(python,args,options);
  assert.equal(readFileSync(output,'utf8'),first);
  assert.equal(JSON.parse(first).nodes[0].originalKey,'исходный_ключ');
  delete source.title_en;
  writeFileSync(module,`import json\nOPERATIONS_GRAPH = json.loads(${JSON.stringify(JSON.stringify({'исходный_ключ':source}))})\n`);
  assert.throws(()=>execFileSync(python,args,options));
  assert.equal(readFileSync(output,'utf8'),first);
});
