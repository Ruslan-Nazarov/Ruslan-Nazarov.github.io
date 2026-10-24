// Browser checks use disposable content and a stub translator, never an external API.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {openEditorItem} from './editor-test-navigation.mjs';

const root=process.cwd();mkdirSync('.local/translation',{recursive:true});
const dir=mkdtempSync(resolve('.local/translation/run-'));
for(const file of ['src','public','scripts','.pages.yml','package.json'])cpSync(resolve(root,file),resolve(dir,file),{recursive:true});
symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const probe=http.createServer();await new Promise(done=>probe.listen(0,'127.0.0.1',done));const port=probe.address().port;await new Promise(done=>probe.close(done));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let browser,logs='';editor.stdout.on('data',value=>logs+=value);editor.stderr.on('data',value=>logs+=value);editor.on('error',error=>logs+=error.message);
const base=`http://127.0.0.1:${port}`;
try{
  for(let attempt=0;attempt<400;attempt++){try{if((await fetch(base)).ok)break}catch{}if(attempt===399)throw Error('Editor did not start: '+logs);await new Promise(done=>setTimeout(done,100))}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  let requests=[],reply='English translation',failure=false,release=null;
  await page.route('**/api/editor/translate',async route=>{
    requests.push(route.request().postDataJSON());
    if(release)await new Promise(done=>{release=done});
    await route.fulfill({status:failure?400:200,contentType:'application/json',body:JSON.stringify(failure?{error:'Сервис перевода временно недоступен.'}:{translation:reply})});
  });
  await page.route('**/api/publish',()=>{throw Error('Unexpected publication')});
  await page.goto(base);await openEditorItem(page,'#collections [data-site-view=home]');
  const hero=page.locator('[data-site-panel=home]'),source=hero.locator('[data-object=ru] [data-field=heroTitle]'),target=hero.locator('[data-object=en] [data-field=heroTitle]');
  const before=await source.inputValue(),englishBefore=await target.inputValue(),siteBytes=readFileSync(resolve(dir,'src/data/site.json'),'utf8');
  const translate=hero.locator('[data-object=ru] [data-translate-field=heroTitle]');
  await expect(translate).toBeVisible();await expect(hero.locator('[data-object=en] .translate-field')).toHaveCount(0);
  const badge=translate.locator('..').locator('.translation-state');
  await expect(badge).toContainText('ещё не подтверждено');
  await translate.locator('..').locator('.compare-fields').click();
  const comparison=page.locator('.language-comparison[open]');
  await expect(comparison.locator('[data-compare-ru]')).toHaveText(before);await expect(comparison.locator('[data-compare-en]')).toHaveText(englishBefore);
  await comparison.locator('.confirm-language-sync').click();await expect(comparison).toBeHidden();await expect(badge).toHaveText('Соответствие подтверждено');assert.equal(requests.length,0,'local comparison must not call the translator');
  await source.fill(before+' Добавление.');await expect(badge).toContainText('Русский текст изменён');
  await source.fill(before);await expect(badge).toHaveText('Соответствие подтверждено');
  reply='How do people come to understand?';release=true;
  await translate.click();await expect(translate).toHaveText('Перевожу…');await expect(page.locator('#save')).toBeDisabled();
  await expect(source).toBeDisabled();while(typeof release!=='function')await new Promise(done=>setTimeout(done,10));release();release=null;
  await expect(target).toBeVisible();await expect(target).toHaveValue(reply);await expect(source).toHaveValue(before);
  await expect(page.locator('#save-state')).toHaveText('Есть несохранённые изменения');
  assert.equal(readFileSync(resolve(dir,'src/data/site.json'),'utf8'),siteBytes,'translation must not auto-save');
  assert.deepEqual(requests[0],{text:before,format:'text',label:'Заголовок'});
  const undo=translate.locator('..').locator('.undo-translation');await undo.click();await expect(target).toHaveValue(englishBefore);
  failure=true;await translate.click();await expect(translate.locator('..').locator('.translation-status')).toContainText('временно недоступен');await expect(target).toHaveValue(englishBefore);failure=false;
  await source.fill('');const requestCount=requests.length;await translate.click();await expect(translate.locator('..')).toContainText('Сначала заполните');assert.equal(requests.length,requestCount);
  await source.fill(before);reply='A new English heading';await translate.click();await expect(target).toHaveValue(reply);
  await target.fill('My manual edit');await undo.click();await expect(target).toHaveValue('My manual edit');await expect(translate.locator('..')).toContainText('уже отредактирован');
  for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'translation controls / '+width)}
  await page.screenshot({path:resolve(dir,'home-translation.png')});

  await page.reload();await openEditorItem(page,'#collections [data-site-view=about]');
  const about=page.locator('[data-site-panel=about]'),english=about.locator('[data-object=en] [data-field=aboutBody]');
  const ruAuthor=about.locator('[data-object=ru] [data-authorship-field=aboutBody]'),enAuthor=about.locator('[data-object=en] [data-authorship-field=aboutBody]');
  await enAuthor.selectOption('ai',{force:true});await ruAuthor.selectOption('human',{force:true});
  await expect(enAuthor).toHaveValue('ai'); // Unverified fields retain independent authorship.
  const richBefore=await english.inputValue();reply='## Understanding\n\nTranslated **research** with $a^2+b^2=c^2$.\n\n[[media:papanda-method-architecture]]';
  await about.locator('[data-object=ru] [data-translate-field=aboutBody]').click();
  await expect(english).toHaveValue(reply);await expect(about.locator('[data-object=en] .rich-surface h2')).toHaveText('Understanding');
  await expect(enAuthor).toHaveValue('human');
  await ruAuthor.selectOption('ai',{force:true});await expect(enAuthor).toHaveValue('ai');
  await ruAuthor.selectOption('human',{force:true});await expect(enAuthor).toHaveValue('human');
  assert.equal(requests.at(-1).format,'markdown');
  await about.locator('[data-object=ru] [data-field=aboutBody]').locator('xpath=ancestor::div[contains(@class,"field")][1]').locator('.undo-translation').click();
  await expect(english).toHaveValue(richBefore);
  await expect(enAuthor).toHaveValue('ai'); // Undo restores the previous authorship too.
  await about.locator('[data-object=ru] [data-translate-field=aboutBody]').click();await expect(enAuthor).toHaveValue('human');
  await english.evaluate(input=>input.richEditor.setValue('Edited English text awaiting comparison'));
  await ruAuthor.selectOption('ai',{force:true});await expect(enAuthor).toHaveValue('human');
  await about.locator('[data-object=ru] [data-translate-field=aboutBody]').locator('..').locator('.compare-fields').click();
  await comparison.locator('.confirm-language-sync').click();await expect(enAuthor).toHaveValue('ai');
  await ruAuthor.selectOption('human',{force:true});await expect(enAuthor).toHaveValue('human');
  await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  await page.reload();await openEditorItem(page,'#collections [data-site-view=about]');await expect(enAuthor).toHaveValue('human');

  await page.reload();await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  reply='Dialectical notes';await page.locator('[data-translate-field=title_ru]').click();
  await expect(page.locator('[data-field=title_en]')).toHaveValue(reply);
  await expect(page.locator('[data-field=title_ru]')).not.toHaveValue(reply);
  const projectBadge=page.locator('[data-translate-field=title_ru]').locator('..').locator('.translation-state');await expect(projectBadge).toHaveText('Перевод обновлён');
  await expect(page.locator('[data-translate-field=pdf_ru],[data-translate-field=ready_ru],[data-translate-field=id]')).toHaveCount(0);
  await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/content/projects/papanda.json'),'utf8')).title_en,reply);

  await page.locator('[data-field=title_ru]').fill('Новая русская версия');await expect(projectBadge).toContainText('Русский текст изменён');
  await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  await page.reload();await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  await expect(projectBadge).toContainText('Русский текст изменён');
  const callsBeforeCompare=requests.length;
  await page.locator('[data-translate-field=title_ru]').locator('..').locator('.compare-fields').click();
  await expect(comparison.locator('[data-compare-ru]')).toHaveText('Новая русская версия');await expect(comparison.locator('[data-compare-en]')).toHaveText(reply);
  await expect(comparison.locator('[data-compare-dates]')).not.toContainText('дата пока не записана');
  await page.screenshot({path:resolve(dir,'comparison-desktop.png')});
  await page.setViewportSize({width:390,height:844});assert.equal(await comparison.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  await page.screenshot({path:resolve(dir,'comparison-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  await comparison.locator('.confirm-language-sync').click();await expect(comparison).toBeHidden();await expect(projectBadge).toHaveText('Соответствие подтверждено');assert.equal(requests.length,callsBeforeCompare);
  await page.reload();await openEditorItem(page,'#collections [data-key="projects/papanda"]');await expect(projectBadge).toHaveText('Соответствие подтверждено');

  // A newly added gallery row must translate into that row's matching field.
  await page.locator('.content-details > summary').filter({hasText:'Изображения и вложения'}).click();
  const gallery=page.locator('#document fieldset').filter({has:page.locator('legend').filter({hasText:/галер/i})}).first();
  await gallery.locator(':scope > button').click();const row=gallery.locator('.array-row').last();
  await row.locator('[data-field=alt_ru]').fill('Русское описание нового изображения');reply='New image description';
  await row.locator('[data-translate-field=alt_ru]').click();await expect(row.locator('[data-field=alt_en]')).toHaveValue(reply);

  await page.locator('#media-open').click();await page.locator('#media-new').click();
  const media=page.locator('#media-edit form');await media.locator('[name=alt_ru]').fill('Описание фотографии');
  reply='Photograph description';await media.locator('[data-translate-field=alt_ru]').click();
  await expect(media.locator('[name=alt_en]')).toHaveValue(reply);await expect(media.locator('[name=caption_en]')).toHaveValue('');
  assert.equal(await media.evaluate(form=>form.authorship._authorship.alt_en),'ai');
  await media.locator('[data-translate-field=alt_ru]').locator('..').locator('.undo-translation').click();await expect(media.locator('[name=alt_en]')).toHaveValue('');
  const denied=await fetch(base+'/api/editor/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Привет'})});assert.equal(denied.status,403);
  // Translation metadata also follows the nested prose on catalogue pages.
  await page.reload();await openEditorItem(page,'#collections [data-page-id=publications]');
  reply='Catalogue introduction';await page.locator('[data-translate-field=summary_ru]').click();
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/data/sections.json'),'utf8')).publications.summary_en,reply);
  await page.reload();await openEditorItem(page,'#collections [data-page-id=publications]');
  const sectionRow=page.locator('[data-translate-field=summary_ru]').locator('..');
  await expect(sectionRow.locator('.translation-state')).toHaveText('Перевод обновлён');

  let failWrites=true,failReads=1;
  await page.route('**/api/editor/language-state**',async route=>{
    if(route.request().method()==='POST'&&failWrites||route.request().method()==='GET'&&failReads-->0){
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary metadata failure'})});
    }else await route.continue();
  });
  reply='Translation kept during metadata failure';await sectionRow.locator('.translate-field').click();
  await expect(sectionRow.locator('.translation-state')).toHaveText('Метка соответствия не сохранена');
  await expect(sectionRow.locator('.translation-state')).toHaveAttribute('data-state','stale');
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Тексты сохранены локально, но метки');
  await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/data/sections.json'),'utf8')).publications.summary_en,reply);
  failWrites=false;await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await expect(sectionRow.locator('.translation-state')).toHaveText('Перевод обновлён');
  await expect(sectionRow.locator('.translation-status')).not.toContainText('не сохранилась');

  await page.reload();await openEditorItem(page,'#collections [data-page-id=publications]');
  await expect(sectionRow.locator('.translation-state')).toContainText('Не удалось загрузить метки');
  reply='Recovered without reloading';await sectionRow.locator('.translate-field').click();
  await expect(sectionRow.locator('.translation-state')).toHaveText('Перевод обновлён');
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await page.reload();await openEditorItem(page,'#collections [data-page-id=publications]');
  await expect(page.locator('[data-field=summary_en]')).toHaveValue(reply);
  await expect(sectionRow.locator('.translation-state')).toHaveText('Перевод обновлён');
  assert.deepEqual(errors,[]);console.log('Translation UI passed: nested catalogue fields, text saving despite metadata failure, truthful badges, retry after failed reads/writes, persistent marks, comparison, rich text, gallery, media, undo, CSRF and responsive layout.');
  console.log('Screenshots: '+dir);
}finally{await browser?.close();editor.kill()}
