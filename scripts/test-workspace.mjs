import {openEditorItem} from './editor-test-navigation.mjs';
// User journeys in an isolated editor; no production writes or external services.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const root=process.cwd();mkdirSync('.local/editor-ui',{recursive:true});const dir=mkdtempSync(resolve('.local/editor-ui/run-'));
for(const path of ['src','public','scripts','.pages.yml','package.json','astro.config.mjs','tsconfig.json','yandex_64f199e3e08207c6.html'])cpSync(resolve(root,path),resolve(dir,path),{recursive:true});
symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let logs='',browser;editor.stdout.on('data',x=>logs+=x);editor.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`;
try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let published=0;await page.route('**/api/publish',route=>{published++;return route.abort()});
  await page.goto(base);await expect(page.locator('#collections [data-page-id=about]')).toBeVisible();
  await expect(page.locator('#page-picker,#collection-filter,#library-summary,#start-about,#start-settings,#start-media,#upload')).toHaveCount(0);
  await expect(page.locator('#collections button').filter({hasText:/^Страницы сайта$/})).toHaveCount(0);
  await expect(page.locator('#save')).toBeHidden();await expect(page.locator('.build-log')).toBeHidden();
  // The home editor follows the actual page and keeps each block's sources beside it.
  {
    await openEditorItem(page,'#collections [data-site-view=home]');
    const home=page.locator('[data-site-panel=home]'),homeBefore=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
    const index=await (await fetch(base+'/api/index')).json(),blocks=index.pages.find(item=>item.id==='home').blocks;
    assert.deepEqual(await home.locator('[data-home-block]').evaluateAll(nodes=>nodes.map(node=>node.dataset.homeBlock)),blocks.map(block=>block.id));
    await expect(page.locator('.workspace-tabs')).toBeHidden();
    for(const block of blocks){
      const section=home.locator('[data-home-block="'+block.id+'"]');
      await expect(section.locator('.home-block-title')).toHaveText(homeBefore.ru[block.title]);
      await expect(section.locator('[data-home-preview]')).toHaveAttribute('href','http://127.0.0.1:4321/ru/#home-'+block.id);
      for(const field of block.fields)await expect(section.locator('[data-object=ru] [data-field="'+field+'"]')).toHaveValue(homeBefore.ru[field]);
    }
    await expect(home.locator('[data-field=journalEmpty]')).toHaveCount(0);
    await expect(home.locator('[data-field=featuredProject]')).toBeVisible();
    await home.locator('[data-home-block=research] [data-object=ru] [data-field=intro]').fill('Проверка блока исследований');
    await home.locator('[data-home-block=research] [data-authorship-field=researchBody]').first().selectOption('human');
    await page.locator('[data-edit-language=en]').click();
    await expect(home.locator('[data-home-block=research] .home-block-title')).toHaveText(homeBefore.en.intro);
    await home.locator('[data-home-block=research] [data-object=en] [data-field=intro]').fill('Research block check');
    await page.locator('[data-edit-language=ru]').click();
    await expect(home.locator('[data-home-block=research] [data-object=ru] [data-field=intro]')).toHaveValue('Проверка блока исследований');
    await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
    const saved=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
    assert.equal(saved.ru.intro,'Проверка блока исследований');assert.equal(saved.en.intro,'Research block check');assert.equal(saved.ru._authorship.researchBody,'human');
    saved.ru.intro=homeBefore.ru.intro;saved.en.intro=homeBefore.en.intro;
    if(homeBefore.ru._authorship)saved.ru._authorship=homeBefore.ru._authorship;else delete saved.ru._authorship;
    assert.deepEqual(saved,homeBefore);
    await page.reload();await openEditorItem(page,'#collections [data-site-view=home]');
    await expect(home.locator('[data-home-block=research] .home-block-title')).toHaveText('Проверка блока исследований');
    for(const width of [320,768,1440]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'home blocks / '+width)}
    await home.locator('[data-home-jump=research]').click();await expect(home.locator('[data-home-block=research]')).toBeFocused();
    await page.screenshot({path:resolve(dir,'home-research-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(dir,'home-research-mobile.png')});
    await page.setViewportSize({width:1440,height:960});
    await home.locator('[data-home-block=featured] .home-block-related > summary').click();
    await home.locator('[data-home-block=featured] [data-edit-target="projects/'+homeBefore.featuredProject+'"]').click();
    await expect(page.locator('#collections [data-key="projects/'+homeBefore.featuredProject+'"]')).toHaveClass(/active/);
    await openEditorItem(page,'#collections [data-site-view=home]');
    await home.locator('[data-home-block=research] .home-block-copy button').click();
    await expect(page.locator('#document [data-object=ru] [data-field=research]')).toBeVisible();
    await expect(page.locator('#document [data-object=ru] [data-field=contact]')).toBeHidden();
  }
  await openEditorItem(page,'#collections [data-site-view=about]');
  await expect(page.locator('[data-site-panel=about] [data-object=ru]')).toBeVisible();
  await expect(page.locator('[data-site-panel=about] [data-object=en]')).toBeHidden();
  const about=page.locator('[data-site-panel=about]');
  const before=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
  await about.locator('[data-object=ru] [data-field=aboutTitle]').fill('Проверка мастерской');
  await page.locator('[data-edit-language=en]').click();
  await about.locator('[data-object=en] [data-field=aboutTitle]').fill('Workspace check');
  await page.locator('[data-workspace-tab=media]').click();await expect(about.locator('[data-field=portrait]')).toBeVisible();
  await page.locator('[data-workspace-tab=content]').click();await page.locator('[data-edit-language=both]').click();
  await expect(about.locator('[data-object=ru] [data-field=aboutTitle]')).toHaveValue('Проверка мастерской');
  await expect(about.locator('[data-object=en] [data-field=aboutTitle]')).toHaveValue('Workspace check');
  page.once('dialog',d=>d.dismiss());await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  await expect(page.locator('#title')).toHaveText('Об авторе и контакты');
  await expect(page.locator('#collections [aria-current=page]')).toHaveCount(1);
  await expect(page.locator('#collections [data-site-view=about]')).toHaveClass(/active/);
  await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  const saved=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
  assert.equal(saved.ru.aboutTitle,'Проверка мастерской');assert.equal(saved.en.aboutTitle,'Workspace check');
  saved.ru.aboutTitle=before.ru.aboutTitle;saved.en.aboutTitle=before.en.aboutTitle;assert.deepEqual(saved,before);
  await page.reload();await openEditorItem(page,'#collections [data-site-view=about]');await expect(about.locator('[data-object=ru] [data-field=aboutTitle]')).toHaveValue('Проверка мастерской');
  await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  await expect(page.locator('[data-field=title_ru]')).toBeVisible();await expect(page.locator('[data-field-path=id]')).toBeHidden();
  await page.locator('[data-workspace-tab=publication]').click();await expect(page.locator('[data-field=publish]')).toBeVisible();await expect(page.locator('[data-field=ready_en]')).toBeVisible();
  await page.locator('[data-workspace-tab=settings]').click();await expect(page.locator('[data-field-path=id]')).toBeVisible();
  await expect(page.locator('[data-key="publications/data-science-handbook"]')).toBeHidden();
  await page.locator('#collection-search').fill('handbook');await expect(page.locator('[data-key="publications/data-science-handbook"]')).toBeVisible();
  await page.locator('#collection-search').fill('');await expect(page.locator('[data-key="publications/data-science-handbook"]')).toBeHidden();
  await page.locator('#collection-search').fill('nothing-matches-this-query');await expect(page.locator('#navigation-empty')).toBeVisible();
  await page.locator('#collection-search').fill('');await expect(page.locator('#navigation-empty')).toBeHidden();
  const keys=await page.locator('#collections [data-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.key));
  for(const key of keys){
    await openEditorItem(page,'[data-key="'+key+'"]');await expect(page.locator('[data-key="'+key+'"]')).toHaveClass(/active/);
    const tabs=await page.locator('[data-workspace-tab]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.workspaceTab));
    for(const tab of tabs.length?tabs:[null]){
      if(tab)await page.locator('[data-workspace-tab="'+tab+'"]').click();
      for(const width of [320,768,1440]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,key+' / '+tab+' / '+width)}
    }
  }
  // Every public page is still reachable through this one navigation.
  const index=await (await fetch(base+'/api/index')).json();
  for(const item of index.pages){
    const selector=['site','interface'].includes(item.target.collection)?'[data-page-id="'+item.id+'"]':'[data-key="'+item.target.collection+'/'+item.target.name+'"]';
    await openEditorItem(page,'#collections '+selector);
    await expect(page.locator('#collections [aria-current=page]')).toHaveCount(1);
    await expect(page.locator('#page-open')).toHaveAttribute('href',item.absolute?'http://127.0.0.1:4321'+item.path:'http://127.0.0.1:4321/ru/'+(item.path?item.path+'/':''));
    if(item.target.fields){await expect(page.locator('.workspace-tabs')).toBeHidden();for(const field of item.target.fields)await expect(page.locator('#document [data-object=ru] [data-field="'+field+'"]').first()).toBeVisible()}
  }
  await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  await page.locator('.page-sources > summary').click();
  await page.getByRole('button',{name:'Подписи и описания этой страницы',exact:true}).click();
  await expect(page.locator('#collections [aria-current=page]')).toHaveAttribute('data-key','projects/papanda');
  await expect(page.locator('.workspace-tabs')).toBeHidden();
  await page.locator('.page-sources > summary').click();await page.getByRole('button',{name:'Все подписи интерфейса',exact:true}).click();
  await expect(page.locator('#collections [aria-current=page]')).toHaveAttribute('data-key','interface/settings');
  await openEditorItem(page,'#collections [data-key="publications/data-science-handbook"]');
  await page.locator('[data-workspace-tab=relations]').click();
  const pdf=page.locator('.field:has(> label > [data-field=pdf_ru])');
  await expect(pdf.getByRole('button',{name:'Загрузить PDF',exact:true})).toBeVisible();
  await pdf.locator('input[type=file]').setInputFiles({name:'editor-check.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\neditor attachment test\n%%EOF')});
  await expect(page.locator('#status')).toContainText('PDF добавлен');
  const pdfPath=await pdf.locator('[data-field=pdf_ru]').inputValue();assert.match(pdfPath,/^\/files\/editor-check-[a-f0-9]+\.pdf$/);
  await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('Изменения сохранены локально');
  assert.equal(JSON.parse(readFileSync(resolve(dir,'src/content/publications/data-science-handbook.json'),'utf8')).pdf_ru,pdfPath);
  await openEditorItem(page,'#collections [data-site-view=about]');
  await page.locator('[data-workspace-tab=content]').click();await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(dir,'workspace-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(dir,'workspace-mobile.png')});
  assert.deepEqual(errors,[]);assert.equal(published,0);
  console.log('Workspace passed: '+index.pages.length+' public pages, all '+keys.length+' documents and sections at 320/768/1440 px; one active navigation item, restored groups after search, empty results, RU/EN switching, isolated save/reopen, unrelated data preservation and cancelled navigation. Screenshots: '+dir);
}finally{await browser?.close();editor.kill();writeFileSync(resolve(dir,'editor.log'),logs)}
