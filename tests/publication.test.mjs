import test from 'node:test';
import assert from 'node:assert/strict';
import {allContent,collections,isReady,resolvePublication,validateAll,readJSON} from '../src/lib/content.mjs';
import {markdown} from '../src/lib/markdown.mjs';
import {parse} from 'yaml';
import {readFileSync} from 'node:fs';

test('all public objects are complete bilingual pairs; private journal is excluded',()=>{
  validateAll();
  const data=allContent();
  assert.equal(data.research.length,4);assert.equal(data.projects.length,6);assert.equal(data.publications.length,3);
  assert.equal(data.theses.length,5);assert.equal(data.journal.length,0);
  for(const rows of Object.values(data))for(const row of rows)assert.ok(isReady(row));
});
test('incomplete translation retains last complete public revision, including its old slug',()=>{
  const previous=allContent().projects[0],draft={...previous,slug:'new-slug',title_ru:'new draft',ready_en:false};
  assert.deepEqual(resolvePublication(draft,previous),previous);
  assert.equal(resolvePublication(draft,null),null);
  assert.equal(resolvePublication({...draft,publish:false},previous),null);
});
test('explicit bilingual approval is required and final text must exist in both languages',()=>{
  const row=allContent().projects[0];
  for(const changed of [{publish:false},{ready_ru:false},{ready_en:false},{title_en:''},{summary_ru:''},{editorialStatus:'final',body_en:''}])
    assert.equal(isReady({...row,...changed}),false);
});
test('Markdown renders mathematics and strips executable markup and unsafe links',async()=>{
  const html=await markdown('# Test\n\n$x^2 + y^2$\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))');
  assert.match(html,/katex/);assert.match(html,/<math/);
  assert.doesNotMatch(html,/<script|href="javascript:/);
  const unsafeMath=await markdown('$\\href{javascript:alert(1)}{click}$');
  assert.doesNotMatch(unsafeMath,/href="javascript:/);
});
test('CMS covers every editable data field, including all homepage/about strings',()=>{
  const config=parse(readFileSync('.pages.yml','utf8'));
  for(const name of collections){
    const configured=new Set(config.content.find(c=>c.name===name).fields.map(f=>f.name));
    for(const row of validateAll()[name])for(const field of Object.keys(row))assert.ok(configured.has(field),`${name}.${field}`);
  }
  const site=readJSON('src/data/site.json'),siteFields=config.content.find(c=>c.name==='site').fields;
  for(const k of Object.keys(site))assert.ok(siteFields.some(f=>f.name===k));
  for(const lang of ['ru','en'])for(const key of Object.keys(site[lang]))assert.ok(siteFields.find(f=>f.name===lang).fields.some(f=>f.name===key));
  const graphFields=config.content.find(c=>c.name==='graph-overrides').fields.map(f=>f.name);
  for(const logic of ['type','predecessors','edges','researchStatus'])assert.ok(!graphFields.includes(logic));
});
test('book links are absolute, licences remain unchanged, thesis target is not a publication date',()=>{
  const pubs=allContent().publications;
  for(const book of pubs.filter(p=>p.type==='book')){
    assert.equal(book.license,'CC BY-NC-ND 4.0');
    assert.ok(book.links[0].url.startsWith('https://ruslan-nazarov.github.io/handbook_'));
  }
  const thesis=pubs.find(p=>p.type==='theses');assert.equal(thesis.date,undefined);assert.equal(thesis.targetDate,'2026-11-11');
});
