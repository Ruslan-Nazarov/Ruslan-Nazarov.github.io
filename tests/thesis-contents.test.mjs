import test from 'node:test';
import assert from 'node:assert/strict';
import {allContent} from '../src/lib/content.mjs';
import {markdown} from '../src/lib/markdown.mjs';
import {thesisContents} from '../src/lib/thesis-contents.mjs';

test('thesis contents follow all nine manuscript sections, with original numbering in both languages',async()=>{
  const chapters=allContent().theses;
  const expected={
    ru:['Введение','Раздел 1. Диалектика','Подраздел 1.1 Математика','Подраздел 1.2 Восстановление до диалектики','Раздел 2 История физики','Подраздел 2.1 Эйнштейн','Раздел 3. Диалектическая физика','Раздел 4. Образование','Раздел 5. Искусственный интеллект'],
    en:['Introduction','Section 1. Dialectics','Subsection 1.1 Mathematics','Subsection 1.2 Dialectical reconstruction','Section 2 History of physics','Subsection 2.1 Einstein','Section 3. Dialectical physics','Section 4. Education','Section 5. Artificial intelligence']
  };
  for(const lang of ['ru','en']){
    const contents=await thesisContents(chapters,lang);
    assert.deepEqual(contents.map(h=>h.title),expected[lang]);
    assert.deepEqual(contents.flatMap((h,i)=>h.subsection?[i]:[]),[2,3,5]);
    const html=(await Promise.all(chapters.map(c=>markdown(c[`body_${lang}`],{headings:[],headingPrefix:`chapter-${c.id}-`})))).join('');
    for(const h of contents)assert.ok(html.includes(`id="${h.id}"`),`Missing destination ${lang}: ${h.title}`);
    assert.equal(new Set(contents.map(h=>h.id)).size,9);
  }
});
