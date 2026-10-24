import test from 'node:test';
import assert from 'node:assert/strict';
import {pageMaterials,materialHref} from '../src/lib/page-materials.mjs';
import {allContent} from '../src/lib/content.mjs';

test('Papanda materials include reverse links once and can exclude or restore them locally',()=>{
  const data=allContent(),record=structuredClone(data.projects.find(row=>row.id==='papanda'));
  const options={collection:'projects'};
  const has=id=>pageMaterials(record,data,options).some(ref=>ref.id===id);
  assert.ok(has('edge-ai-reasoning'));assert.ok(has('language-handbook'));assert.ok(has('dialectical-notes'));
  record.materials.push({collection:'publications',id:'language-handbook'});
  assert.equal(pageMaterials(record,data,options).filter(ref=>ref.id==='language-handbook').length,1);
  record.hiddenMaterials=[{collection:'publications',id:'language-handbook'}];
  assert.equal(has('language-handbook'),false);
  record.hiddenMaterials=[];assert.ok(has('language-handbook'));
});

test('identity is collection and ID, so equal IDs in different collections remain distinct',()=>{
  const record={id:'same',relatedPublications:['same'],materials:[{collection:'projects',id:'same'}]};
  const data={projects:[record],publications:[{id:'same',relatedProjects:['same']}]};
  assert.deepEqual(pageMaterials(record,data,{collection:'projects'}),[{collection:'publications',id:'same'}]);
});

test('external materials use their external address and pages retain their public route',()=>{
  assert.equal(materialHref('publications',{readingMode:'external',links:[{url:'https://example.org/read'}]},'ru'),'https://example.org/read');
  assert.equal(materialHref('pages',{id:'dialectical-notes',slug:'dialectical-notes'},'en'),'/en/projects/papanda/dialectical-notes/');
});
