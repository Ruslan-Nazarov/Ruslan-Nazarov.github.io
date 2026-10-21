import test from 'node:test';
import assert from 'node:assert/strict';
import {entrySchema,isReady,allContent,timelineRows} from '../src/lib/content.mjs';
import {markdown} from '../src/lib/markdown.mjs';

test('timeline cards use the event date, including events on an undated project',()=>{
  const project=allContent().projects[0];
  const data={projects:[{...project,date:'2026-02-01',timeline:[{date:'2026-10-21',title_ru:'Обновление',title_en:'Update'}]},{...project,id:'undated',date:undefined,timeline:[{date:'2026-10-20',title_ru:'Опыт',title_en:'Experiment'}]}],publications:[],journal:[]};
  const rows=timelineRows(data);
  assert.deepEqual(rows.map(r=>r.date),['2026-10-21','2026-10-20','2026-02-01']);
  assert.equal(rows[0].title_en,'Update');assert.equal(rows[1].eventCollection,'projects');
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
