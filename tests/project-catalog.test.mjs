import test from 'node:test';
import assert from 'node:assert/strict';
import {allContent} from '../src/lib/content.mjs';
import {projectCatalog} from '../src/lib/project-catalog.mjs';

test('AI contains three projects; every other application appears once in vibe coding',()=>{
  const rows=allContent().projects;
  const {ai,categories,prompts}=projectCatalog(rows);
  assert.deepEqual(ai.map(row=>row.id),['dialectic-ai','papanda','ai-algorithm']);
  assert.equal(prompts.id,'useful-prompts');
  assert.equal(prompts.links[0].url,'https://github.com/Ruslan-Nazarov/useful_prompts');
  const listed=[...ai,...categories.flatMap(group=>group.rows)].map(row=>row.id);
  assert.equal(new Set(listed).size,listed.length);
  assert.deepEqual(listed.slice().sort(),rows.filter(row=>row.id!==prompts.id).map(row=>row.id).sort());
  assert.equal(categories.length,4);
  for(const lang of ['ru','en'])assert.doesNotMatch(ai.find(row=>row.id==='ai-algorithm')[`title_${lang}`],/10/);
});

test('catalogue omits missing entries and keeps new applications in vibe coding',()=>{
  const rows=allContent().projects.filter(row=>!['papanda','reader','useful-prompts'].includes(row.id));
  const extra={id:'new-app'};
  const {ai,categories,prompts}=projectCatalog([...rows,extra]);
  assert.deepEqual(ai.map(row=>row.id),['dialectic-ai','ai-algorithm']);
  assert.equal(prompts,undefined);
  assert.deepEqual(categories.at(-1).rows,[extra]);
  assert.ok(categories.every(group=>group.rows.length>0));
});

test('application descriptions have the same bilingual structure',()=>{
  const {categories}=projectCatalog(allContent().projects);
  for(const row of categories.flatMap(group=>group.rows)){
    assert.deepEqual([...row.body_ru.matchAll(/^## (.+)$/gm)].map(match=>match[1]),['Назначение','Возможности','Доступ'],row.id);
    assert.deepEqual([...row.body_en.matchAll(/^## (.+)$/gm)].map(match=>match[1]),['Purpose','Features','Availability'],row.id);
  }
});
