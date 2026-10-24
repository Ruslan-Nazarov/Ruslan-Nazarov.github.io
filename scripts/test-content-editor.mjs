import {cpSync,mkdirSync,mkdtempSync,readFileSync,symlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const root=process.cwd();mkdirSync('.local/content-editor',{recursive:true});const dir=mkdtempSync(resolve('.local/content-editor/run-'));
for(const path of ['src','public','scripts','.pages.yml','package.json','astro.config.mjs','tsconfig.json','yandex_64f199e3e08207c6.html'])cpSync(resolve(root,path),resolve(dir,path),{recursive:true});
symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let logs='',browser;editor.stdout.on('data',x=>logs+=x);editor.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===79)throw new Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await expect(page.locator('[data-create=pages]')).toBeVisible();
  await expect(page.locator('#collections [data-page-id=search],#collections [data-page-id="404"],#collections [data-key="interface/settings"]')).toHaveCount(0);
  await page.locator('[data-page-id=publications]').click();await expect(page.locator('#document [data-field=title_ru]')).toBeVisible();await expect(page.locator('#document [data-field=body_ru]')).toBeAttached();
  const removed=page.locator('.material-row').filter({hasText:'Где проходит граница рассуждений ИИ'});await removed.getByRole('button',{name:'Убрать',exact:true}).click();await expect(removed).toHaveCount(0);
  await page.locator('#document [data-field=summary_ru]').fill('Новое описание каталога');
  await page.locator('[data-edit-language=en]').click();await page.locator('#document [data-field=summary_en]').fill('New catalogue introduction');
  await page.locator('[data-page-id=projects]').click();await expect(page.locator('#title')).toHaveText('Проекты');
  await page.locator('[data-page-id=publications]').click();await expect(page.locator('#document [data-field=summary_en]')).toHaveValue('New catalogue introduction');
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await expect(page.locator('#page-open')).toHaveAttribute('href','/ru/publications/');
  await page.locator('[data-key="projects/papanda"]').click();
  const indexData=await (await page.request.get(base+'/api/index')).json();
  for(const id of ['edge-ai-reasoning','language-handbook']){
    const entry=indexData.collections.find(c=>c.name==='publications').entries.find(r=>r.id===id);
    const row=page.locator('.material-row').filter({has:page.getByRole('button',{name:entry.title,exact:true})});
    await expect(row).toHaveCount(1);await row.getByRole('button',{name:'Убрать',exact:true}).click();await expect(row).toHaveCount(0);
  }
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await page.locator('[data-create=pages]').click();await page.getByLabel('Название нового материала').fill('Новая страница');await expect(page.getByLabel('Адрес новой страницы')).toHaveValue('novaya-stranitsa');await page.getByRole('button',{name:'Создать',exact:true}).click();
  await page.locator('[data-edit-language=both]').click();
  await page.locator('[data-field=title_en]').fill('New page');await page.locator('[data-field=summary_ru]').fill('Коротко о странице');await page.locator('[data-field=summary_en]').fill('A short introduction');
  await page.locator('.content-details > summary').filter({hasText:'Добавить текст страницы'}).click();
  await page.locator('.rich-editor').filter({has:page.locator('[data-field=body_ru]')}).locator('.rich-surface').fill('Текст новой страницы.');
  await page.locator('.rich-editor').filter({has:page.locator('[data-field=body_en]')}).locator('.rich-surface').fill('New page text.');
  await page.getByLabel('Выбрать материал',{exact:true}).selectOption('publications/explaining-mathematics-ai');await page.getByRole('button',{name:'Добавить материал',exact:true}).click();
  await expect(page.getByLabel('Статус документа',{exact:true})).toHaveValue('draft');
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await page.reload();await page.locator('[data-key="pages/novaya-stranitsa"]').click();await expect(page.locator('[data-field=title_ru]')).toHaveValue('Новая страница');await expect(page.locator('.material-list')).toContainText('Как объяснять математику');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No overflow at '+width)}
  await page.setViewportSize({width:1440,height:960});await page.screenshot({path:resolve(dir,'content-editor.png'),fullPage:true});
  await page.locator('[data-create=publications]').click();await page.getByLabel('Что создать').selectOption('external');await page.getByLabel('Название нового материала').fill('Внешняя статья');await page.getByRole('button',{name:'Создать',exact:true}).click();await expect(page.locator('.document-body')).toBeHidden();
  await page.locator('[data-edit-language=both]').click();await page.locator('[data-field=title_en]').fill('External article');await page.locator('[data-field=summary_ru]').fill('Описание ссылки');await page.locator('[data-field=summary_en]').fill('Link description');
  await page.locator('.document-links').getByRole('button',{name:'+ Добавить',exact:true}).click();
  await page.locator('.document-links [data-field=label_ru]').fill('Читать статью');await page.locator('.document-links [data-field=label_en]').fill('Read article');await page.locator('.document-links [data-field=url]').fill('https://example.org/article');
  await page.getByLabel('Статус документа',{exact:true}).selectOption('ready');
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  await page.locator('[data-create=publications]').click();await page.getByLabel('Название нового материала').fill('Готовая статья');await page.getByRole('button',{name:'Создать',exact:true}).click();
  await page.locator('[data-edit-language=both]').click();
  for(const [key,text] of Object.entries({title_en:'Ready article',summary_ru:'Описание статьи',summary_en:'Article introduction'}))await page.locator('[data-field='+key+']').fill(text);
  for(const [lang,text] of [['ru','Полный текст статьи.'],['en','Full article text.']])await page.locator('.rich-editor').filter({has:page.locator('[data-field=body_'+lang+']')}).locator('.rich-surface').fill(text);
  await page.getByLabel('Статус документа',{exact:true}).selectOption('ready');
  await page.locator('.content-details > summary').filter({hasText:'Параметры страницы'}).click();await page.locator('[data-field=featured]').check();
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  const article=JSON.parse(readFileSync(resolve(dir,'src/content/publications/gotovaya-statya.json'),'utf8'));assert.equal(article.editorialStatus,'final');
  const saved=JSON.parse(readFileSync(resolve(dir,'src/content/pages/novaya-stranitsa.json'),'utf8'));assert.equal(saved.showInMenu,true);assert.deepEqual(saved.materials,[{collection:'publications',id:'explaining-mathematics-ai'}]);
  await page.locator('#build').click();await expect(page.locator('#status')).toContainText('Предпросмотр обновлён',{timeout:120000});
  const preview=await page.request.get(base+'/ru/novaya-stranitsa/');assert.equal(preview.status(),200);assert.ok((await preview.text()).includes('Текст новой страницы.'));
  const external=JSON.parse(readFileSync(resolve(dir,'src/content/publications/vneshnyaya-statya.json'),'utf8'));assert.equal(external.editorialStatus,'external_publication');assert.equal(external.ready_ru,true);assert.equal(external.ready_en,true);
  for(const lang of ['ru','en']){
    const html=readFileSync(resolve(dir,'.local/editor-preview',lang,'novaya-stranitsa/index.html'),'utf8');assert.ok(html.includes(lang==='ru'?'Текст новой страницы.':'New page text.'));assert.ok(html.includes('/'+lang+'/publications/explaining-mathematics-ai/'));
    const catalogue=readFileSync(resolve(dir,'.local/editor-preview',lang,'publications/index.html'),'utf8');assert.ok(catalogue.includes(lang==='ru'?'Новое описание каталога':'New catalogue introduction'));assert.ok(catalogue.includes('https://example.org/article'));
    assert.ok(!catalogue.includes('/'+lang+'/publications/edge-ai-reasoning/'),'Removed item is absent from the catalogue');
  }
  execFileSync(process.execPath,['scripts/astro.mjs','build'],{cwd:dir,windowsHide:true,stdio:'pipe',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',SITE_EDITOR_PREVIEW:''}});
  for(const lang of ['ru','en']){
    assert.equal(existsSync(resolve(dir,'dist',lang,'novaya-stranitsa/index.html')),false,'Draft is excluded from publication');
    const home=readFileSync(resolve(dir,'dist',lang,'index.html'),'utf8');assert.ok(home.includes('/'+lang+'/publications/gotovaya-statya/'),'Ready article is shown on home');
    const html=readFileSync(resolve(dir,'dist',lang,'projects/papanda/index.html'),'utf8');
    assert.ok(!html.includes('/'+lang+'/publications/edge-ai-reasoning/'),'Reverse link was removed');
    const handbook=JSON.parse(readFileSync(resolve(dir,'src/content/publications/language-handbook.json'),'utf8'));assert.ok(!html.includes(handbook.links[0].url),'Removed language handbook link is absent');
  }
  assert.deepEqual(errors,[]);console.log('Content editor: create, translate, attach, save, reload, external link, mobile and bilingual build passed. '+dir);
}finally{await browser?.close();editor.kill()}
