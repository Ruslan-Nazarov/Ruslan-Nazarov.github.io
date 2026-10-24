import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {editorPages} from '../scripts/editor-pages.mjs';
import {collections,rawCollection,pathFor,readJSON} from '../src/lib/content.mjs';
import {isEditablePath} from '../scripts/publish-content.mjs';

test('editor contains prose documents and every draft, with existing destinations',()=>{
  const pages=editorPages(),config=parse(readFileSync('.pages.yml','utf8'));
  assert.equal(new Set(pages.map(page=>page.id)).size,pages.length);
  assert.ok(!pages.some(page=>['search','404','landing'].includes(page.id)||page.target.collection==='interface'));
  for(const collection of collections)for(const row of rawCollection(collection))assert.ok(pages.some(page=>page.target.collection===collection&&page.target.name===row.id));
  for(const page of pages){
    const schema=config.content.find(c=>c.name===page.target.collection);assert.ok(schema);
    assert.ok(existsSync(schema.type==='file'?schema.path:schema.path+'/'+page.target.name+'.json'));
    assert.deepEqual(page.sources,[]);
  }
});

test('catalogue descriptions and bodies are editable content while interface copy stays bilingual',()=>{
  const config=parse(readFileSync('.pages.yml','utf8')),sections=readJSON('src/data/sections.json');
  assert.ok(!config.content.some(schema=>schema.name==='interface'));
  const fields=config.content.find(schema=>schema.name==='sections').fields;
  for(const key of ['research','projects','publications','journal']){
    assert.equal(editorPages().find(page=>page.id===key).target.collection,'sections');
    for(const lang of ['ru','en'])for(const field of ['title','summary','body']){
      assert.equal(typeof sections[key][field+'_'+lang],'string');
      assert.ok(fields.find(field=>field.name===key).fields.some(item=>item.name===field+'_'+lang));
    }
  }
  const ui=readJSON('src/data/ui.json');for(const key of Object.keys(ui.ru).filter(key=>key!=='_authorship'))assert.equal(typeof ui.en[key],'string');
  assert.ok(isEditablePath('src/data/sections.json'));
});

test('new pages have independent addresses and existing papanda links keep their address',()=>{
  assert.equal(pathFor('pages',{id:'new-page',slug:'new-page'},'ru'),'/ru/new-page/');
  assert.equal(pathFor('pages',{id:'new-page',slug:'new-page'},'en'),'/en/new-page/');
  assert.equal(pathFor('pages',{id:'dialectical-notes',slug:'dialectical-notes'},'ru'),'/ru/projects/papanda/dialectical-notes/');
  assert.equal(pathFor('pages',{id:'nested',slug:'nested',pagePath:'projects/example/nested'},'en'),'/en/projects/example/nested/');
});
