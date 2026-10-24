import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTranslation} from '../scripts/translation-document.mjs';

test('plain prose keeps formulas, placeholders, URLs, email and code exact',()=>{
  const text='  Привет, {name}! Формула $E = mc^2$, код `x++`, https://example.org/ru/ и mail@example.org.\n\n[[media:photo]]  ';
  const plan=prepareTranslation(text);
  assert.equal(plan.segments.length,1);assert.ok(!plan.segments[0].includes('E = mc^2'));
  const translated=plan.segments.map(part=>part.replace('Привет','Hello').replace('Формула','Formula').replace('код','code').replace(' и ',' and '));
  assert.equal(plan.assemble(translated),text.replace('Привет','Hello').replace('Формула','Formula').replace('код','code').replace(' и ',' and '));
});

test('Markdown structure, code, LaTeX, media and link destinations survive translation',()=>{
  const text='## Заголовок\n\nТекст с **акцентом**, [ссылкой](/ru/about/ "Title") и $a^2+b^2=c^2$.\n\n- Элемент\n- `const x = 1`\n\n$$\nE = mc^2\n$$\n\n```js\nconst text = "Привет";\n```\n\n[[media:photo]]\n\n![Описание](/media/photo.png)\n';
  const plan=prepareTranslation(text,'markdown');
  assert.equal(plan.segments.some(segment=>segment.includes('mc^2')||segment.includes('const text')||segment.includes('/media/')),false);
  const dictionary={'Заголовок':'Heading','Текст с':'Text with','акцентом':'emphasis','ссылкой':'link','и':'and','Элемент':'Item','Описание':'Description'};
  const output=plan.assemble(plan.segments.map(segment=>dictionary[segment]||segment));
  assert.match(output,/^## Heading/);assert.ok(output.includes('**emphasis**'));assert.ok(output.includes('[link](/ru/about/ "Title")'));
  assert.ok(output.includes('$$\nE = mc^2\n$$'));assert.ok(output.includes('```js\nconst text = "Привет";\n```'));
  assert.ok(output.includes('[[media:photo]]'));assert.ok(output.includes('![Description](/media/photo.png)'));
});

test('changed, duplicated, missing or swapped protected content is rejected',()=>{
  const plan=prepareTranslation('Текст {name} и $x=1$.');
  assert.throws(()=>plan.assemble([]),/incomplete/);
  assert.throws(()=>plan.assemble(['Translation']),/Protected/);
  assert.throws(()=>plan.assemble([plan.segments[0]+plan.segments[0]]),/Protected/);
  assert.throws(()=>plan.assemble([plan.segments[0]+' RN_KEEP_0000000000000000_0_END']),/Unexpected/);
  assert.throws(()=>plan.assemble(['']),/invalid/);
});

test('long text is split into bounded segments and assembled in source order',()=>{
  const text=('Первый абзац. '.repeat(1500))+'\n\nКонец.';
  const plan=prepareTranslation(text);assert.ok(plan.segments.length>1);
  assert.ok(plan.segments.every(segment=>segment.length<=6000));assert.equal(plan.assemble(plan.segments),text);
});

test('pure formulas and code need no translation and retain their bytes',()=>{
  const text='$$\nE=mc^2\n$$\n\n```js\nconsole.log("Привет");\n```\n\n[[media:photo]]';
  const plan=prepareTranslation(text,'markdown');assert.deepEqual(plan.segments,[]);assert.equal(plan.assemble([]),text);
});

test('Markdown output cannot accidentally introduce HTML or change inline formatting',()=>{
  const plan=prepareTranslation('Обычный текст','markdown');
  assert.equal(plan.assemble(['<script>alert(1)</script> **bold**']),String.raw`\<script\>alert(1)\</script\> \*\*bold\*\*`);
});
