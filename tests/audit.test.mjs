import test from 'node:test';
import assert from 'node:assert/strict';
import {entrySchema,isReady,allContent,routes} from '../src/lib/content.mjs';
import {markdown} from '../src/lib/markdown.mjs';

test('retired sections and their entries have no public routes',()=>{
  assert.ok(routes().every(path=>! /^(research|journal|timeline)(\/|$)/.test(path)));
});
test('content dates reject impossible dates before the build',()=>{
  const row=allContent().projects[0];
  for(const key of ['date','targetDate','startedDate']){
    for(const date of ['2026-02-30','2026-13-01','2025-02-29'])assert.equal(entrySchema.safeParse({...row,[key]:date}).success,false);
    assert.equal(entrySchema.safeParse({...row,[key]:'2024-02-29'}).success,true);
  }
});
test('contents links use actual unique heading IDs across media segments and chapters',async()=>{
  const headings=[];
  const first=await markdown('## Проверка\n\n### A *second* heading',{headings});
  const second=await markdown('## Проверка',{headings});
  assert.equal(headings.length,3);assert.equal(new Set(headings.map(h=>h.id)).size,3);
  for(const h of headings)assert.ok((first+second).includes(`id="${h.id}"`));
  assert.match(await markdown('## Проверка',{headings:[],headingPrefix:'chapter-physics-'}),/id="chapter-physics-проверка"/);
});
test('reading labels cannot publish missing full texts and links must be usable',()=>{
  const row=allContent().publications.find(r=>r.readingMode==='full');
  assert.equal(isReady({...row,body_en:''}),false);
  for(const url of ['', 'https://', '/\\example.com', 'javascript:alert(1)'])assert.equal(entrySchema.safeParse({...row,links:[{label_ru:'Читать',label_en:'Read',url}]}).success,false);
});
