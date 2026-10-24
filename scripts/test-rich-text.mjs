import {openEditorItem} from './editor-test-navigation.mjs';
// User journeys against disposable content; never touches the owner's text.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const root=process.cwd();mkdirSync('.local/rich-text',{recursive:true});const dir=mkdtempSync(resolve('.local/rich-text/run-'));
for(const file of ['src','public','scripts','.pages.yml','package.json'])cpSync(resolve(root,file),resolve(dir,file),{recursive:true});
symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const fixture=`Первый абзац с **жирным** и *курсивом*.\n\n## История исследования\n\nОбычный текст со [ссылкой](https://example.org "Пример").\n\n- Первый\n- Второй\n\n> Цитата\n\nФормула $a^2 + b^2 = c^2$ и \`код\`.\n\n$$\nE = mc^2\n$$\n\n[[media:papanda-method-architecture]]\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] Задача\n\n<script>window.UNSAFE=true</script>\n`;
const sitePath=resolve(dir,'src/data/site.json'),site=JSON.parse(readFileSync(sitePath,'utf8'));site.ru.aboutBody=fixture;writeFileSync(sitePath,JSON.stringify(site,null,2));
const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let browser,logs='';editor.stdout.on('data',x=>logs+=x);editor.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===79)throw Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/publish',()=>{throw Error('Unexpected publication')});
  await page.goto(base);await openEditorItem(page,'#collections [data-site-view=about]');
  const language=page.locator('[data-site-panel=about] [data-object=ru]');
  const rich=language.locator('.rich-editor'),surface=rich.locator('.rich-surface'),source=rich.locator('textarea');
  await expect(surface.locator('h2')).toHaveText('История исследования');await expect(surface.locator('strong')).toHaveText('жирным');
  await expect(source).toBeHidden();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  assert.equal(await page.evaluate(()=>window.UNSAFE),undefined);
  // A rotated server token is renewed without reloading or discarding a draft.
  assert.equal(await page.evaluate(async()=>{token='expired-token';return (await api('/api/editor/parse',{text:'Проверка сессии'})).children[0].children[0].value}),'Проверка сессии');
  assert.ok(await surface.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=17));
  // Switching modes or saving without edits must preserve the complete source byte for byte.
  await rich.locator('.rich-source-button').click();await expect(source).toHaveValue(fixture);
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();await expect(surface.locator('h2')).toBeVisible();
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  assert.equal(JSON.parse(readFileSync(sitePath,'utf8')).ru.aboutBody,fixture);
  async function selectText(selector,text){await surface.locator(selector).filter({hasText:text}).first().evaluate((node,text)=>{
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let leaf;while(leaf=walker.nextNode()){
      const offset=leaf.textContent.indexOf(text);if(offset<0)continue;const range=document.createRange();range.setStart(leaf,offset);range.setEnd(leaf,offset+text.length);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);node.closest('[contenteditable]').focus();break;
    }
    node.closest('[contenteditable]').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  },text)}
  await selectText('p','Первый');await rich.getByRole('button',{name:'Полужирный (Ctrl+B)',exact:true}).click();
  await expect(surface.locator('b,strong').first()).toHaveText('Первый');assert.match(await source.inputValue(),/\*\*Первый\*\*/);
  await rich.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click();await expect(source).toHaveValue(fixture);
  await rich.getByRole('button',{name:'Повторить (Ctrl+Shift+Z)',exact:true}).click();assert.match(await source.inputValue(),/\*\*Первый\*\*/);
  await selectText('p','абзац');await rich.getByRole('button',{name:'Курсив (Ctrl+I)',exact:true}).click();assert.match(await source.inputValue(),/\*абзац\*/);
  await selectText('p','Обычный');await rich.getByRole('combobox',{name:'Стиль абзаца'}).selectOption('h3');await expect(surface.locator('h3')).toContainText('Обычный');
  // Modal link insertion rejects unsafe schemes and retains the selection.
  await selectText('p','абзац');await rich.getByRole('button',{name:'Вставить или изменить ссылку',exact:true}).click();
  const dialog=page.locator('.rich-dialog');await dialog.getByLabel('Адрес ссылки').fill('javascript:alert(1)');await dialog.getByRole('button',{name:'Вставить',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Укажите');
  await dialog.getByLabel('Адрес ссылки').fill('https://example.com/research');await dialog.getByRole('button',{name:'Вставить',exact:true}).click();await expect(surface.locator('a[href="https://example.com/research"]')).toHaveText('абзац');
  await selectText('a','абзац');await rich.getByRole('button',{name:'Вставить или изменить ссылку',exact:true}).click();
  await dialog.getByLabel('Адрес ссылки').fill('https://example.com/updated');await dialog.getByRole('button',{name:'Вставить',exact:true}).click();
  await expect(surface.locator('a[href="https://example.com/updated"]')).toHaveText('абзац');await expect(surface.locator('a a')).toHaveCount(0);
  await rich.getByRole('button',{name:'Вставить формулу',exact:true}).click();await dialog.getByLabel('Формула LaTeX').fill('x^2');await dialog.getByRole('button',{name:'Вставить',exact:true}).click();assert.ok((await source.inputValue()).includes('$x^2$'));
  // Existing mathematical, table, task-list, HTML and media blocks survive edits to prose.
  for(const exact of ['$a^2 + b^2 = c^2$','$$\nE = mc^2\n$$','[[media:papanda-method-architecture]]','| A | B |\n| - | - |\n| 1 | 2 |','- [x] Задача','<script>window.UNSAFE=true</script>'])assert.ok((await source.inputValue()).includes(exact),exact);
  // Editing a nested list retains its hierarchy and ordered-list start.
  await rich.locator('.rich-source-button').click();await source.fill('3. Родитель\n   - Вложенный\n   - Второй\n4. Сосед');
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();await expect(surface.locator('ol')).toHaveAttribute('start','3');
  await selectText('li','Вложенный');await rich.getByRole('button',{name:'Полужирный (Ctrl+B)',exact:true}).click();
  const nested=await page.evaluate(text=>api('/api/editor/parse',{text}),await source.inputValue());
  assert.equal(nested.children[0].start,3);assert.equal(nested.children[0].children.length,2);
  assert.equal(nested.children[0].children[0].children[1].type,'list');
  assert.equal(nested.children[0].children[0].children[1].children.length,2);
  // Source edits are reflected in visual mode and never race an older parse request.
  await rich.locator('.rich-source-button').click();await source.fill('## Новый заголовок\n\nТекст для списка.');
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();await expect(surface.locator('h2')).toHaveText('Новый заголовок');
  await selectText('p','Текст');await rich.getByRole('button',{name:'Маркированный список',exact:true}).click();await expect(surface.locator('ul li')).toContainText('Текст для списка.');
  assert.match(await source.inputValue(),/- Текст для списка\./);assert.ok(!(await source.inputValue()).includes('- - '));
  // Insertion from the real media picker goes to the selected visual editor.
  await rich.getByRole('button',{name:'Вставить изображение',exact:true}).click();await page.locator('.media-tile').first().click();
  const mediaId=await page.locator('.media-tile').first().getAttribute('data-media-id');
  await page.locator('#media-edit [name=alt_ru]').fill('Изображение');await page.locator('#media-edit [name=alt_en]').fill('Image');
  await page.locator('#media-insert').click();await expect(page.locator('#media-panel')).toBeHidden();assert.ok((await source.inputValue()).includes('[[media:'+mediaId+']]'));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await surface.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'document width '+width);
    for(const node of await rich.locator('button,select,.rich-surface').all()){
      const bounds=await node.boundingBox();if(bounds)assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'control fits at '+width);
    }
    if(width===390)await page.screenshot({path:resolve(dir,'visual-mobile.png')});
  }
  await rich.getByRole('button',{name:'Развернуть редактор',exact:true}).click();await expect(rich).toHaveClass(/rich-expanded/);await surface.press('Escape');await expect(rich).not.toHaveClass(/rich-expanded/);
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  const saved=await source.inputValue();assert.equal(JSON.parse(readFileSync(sitePath,'utf8')).ru.aboutBody,saved);
  await page.reload();await openEditorItem(page,'#collections [data-site-view=about]');await expect(surface.locator('h2')).toHaveText('Новый заголовок');await expect(source).toHaveValue(saved);
  await page.setViewportSize({width:1440,height:1000});await surface.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'visual-desktop.png')});
  // A parser outage still leaves the source editable and never erases the draft.
  await rich.locator('.rich-source-button').click(); await source.fill('Первый блок\n\nВторой блок');
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click(); await expect(surface.locator('p')).toHaveCount(2);
  await selectText('p','Второй'); await rich.getByRole('button',{name:'По центру',exact:true}).click();
  assert.match(await source.inputValue(),/<!-- editor-align:center -->\n\nВторой блок/);
  await rich.getByRole('button',{name:'Переместить блок вверх',exact:true}).click(); await expect(surface.locator('p').first()).toHaveText('Второй блок');
  await rich.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click(); await expect(surface.locator('p').first()).toHaveText('Первый блок');
  await rich.getByRole('button',{name:'Повторить (Ctrl+Shift+Z)',exact:true}).click(); await expect(surface.locator('p').first()).toHaveText('Второй блок');
  await rich.locator('.rich-source-button').click(); await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();
  await expect(surface.locator('p').first()).toHaveAttribute('align','center');
  await expect(surface).toHaveAttribute('contenteditable','true');
  await selectText('p','Первый'); await rich.getByRole('button',{name:'Вставить таблицу',exact:true}).click();
  await dialog.getByLabel('Строк данных').fill('0'); await dialog.getByRole('button',{name:'Вставить',exact:true}).click(); await expect(dialog.getByRole('alert')).toContainText('от 1 до 30');
  await dialog.getByLabel('Строк данных').fill('2'); await dialog.getByRole('button',{name:'Вставить',exact:true}).click();
  await expect(surface.locator('table tr')).toHaveCount(3);
  await surface.locator('td').first().fill('Ячейка | **текст**');
  const tableSource = await source.inputValue(); assert.match(tableSource,/Ячейка \\\| \\\*\\\*текст/);
  await rich.locator('.rich-source-button').click(); await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();
  await expect(surface.locator('td').first()).toHaveText('Ячейка | **текст**');
  await expect(surface).toHaveAttribute('contenteditable','true');
  await selectText('p','Первый'); await rich.getByRole('button',{name:'Оформить цитату',exact:true}).click(); await expect(surface.locator('blockquote')).toContainText('Первый');
  await rich.getByRole('button',{name:'Вставить дату',exact:true}).click(); await dialog.getByLabel('Дата (ГГГГ-ММ-ДД)').fill('2026-10-24');
  await dialog.getByRole('button',{name:'Вставить',exact:true}).click(); assert.match(await source.inputValue(),/24\.10\.2026/);
  await page.locator('#save').click(); await expect(page.locator('#status')).toContainText('Сохранено локально');
  await page.reload(); await openEditorItem(page,'#collections [data-site-view=about]');
  await expect(surface.locator('p').first()).toHaveAttribute('align','center');
  await expect(surface.locator('td').first()).toHaveText('Ячейка | **текст**');
  await expect(surface.locator('blockquote')).toContainText('24.10.2026');
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:1000});
    await rich.getByRole('button',{name:'Настройки автозамены',exact:true}).click();
    const bounds=await rich.locator('.rich-settings-panel').boundingBox(); assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
    if(width===1440)await page.screenshot({path:resolve(dir,'formatting-settings.png')});
    await rich.getByRole('button',{name:'Настройки автозамены',exact:true}).click();
  }
  await rich.locator('.rich-source-button').click(); await source.fill('Проверка');
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click(); await expect(surface.locator('p')).toHaveText('Проверка');
  await surface.click(); await surface.press('Control+End'); await page.keyboard.type('  '); await page.keyboard.insertText('слово'); await page.keyboard.type(' - ');
  await page.keyboard.insertText('ее'); await page.keyboard.insertText('е');
  await expect(surface).toHaveText('Проверка. слово — ё');
  await rich.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click(); await expect(surface).toHaveText('Проверка. слово — ее');
  await rich.getByRole('button',{name:'Настройки автозамены',exact:true}).click();
  await rich.getByRole('switch',{name:'Двойной пробел → точка',exact:true}).uncheck();
  await rich.getByRole('switch',{name:'Подсказка: дефис → тире',exact:true}).uncheck();
  await rich.getByRole('switch',{name:'еее → ё',exact:true}).uncheck();
  await surface.click(); await surface.press('Control+End'); await page.keyboard.type('  - '); await page.keyboard.insertText('еее');
  await expect(surface).toHaveText('Проверка. слово — ее  - еее');
  await page.reload(); await openEditorItem(page,'#collections [data-site-view=about]');
  await rich.getByRole('button',{name:'Настройки автозамены',exact:true}).click();
  await expect(rich.getByRole('switch',{name:'еее → ё',exact:true})).not.toBeChecked();
  await rich.getByRole('button',{name:'Настройки автозамены',exact:true}).press('Escape');
  await expect(rich.locator('.rich-settings-panel')).toBeHidden();
  await rich.locator('.rich-source-button').click();await source.fill('Несохранённый текст');
  await page.route('**/api/editor/parse',route=>route.fulfill({status:500,json:{error:'Тестовая ошибка'}}));
  await rich.getByRole('button',{name:'Визуальный редактор',exact:true}).click();await expect(source).toBeVisible();await expect(source).toHaveValue('Несохранённый текст');
  assert.deepEqual(errors,[]);console.log('Visual editor passed: source preservation, history, headings, lists, links, formulas, media, editable tables, alignment, block movement, quotes, dates, typing preferences, session renewal, save/reopen, parser outage, 320–1440px. Screenshots: '+dir);
}finally{await browser?.close();editor.kill();writeFileSync(resolve(dir,'editor.log'),logs)}
