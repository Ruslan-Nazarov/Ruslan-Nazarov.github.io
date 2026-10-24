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
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===79)throw new Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let publishCalls=0;await page.route('**/api/publish',route=>{publishCalls++;return route.abort()});
  async function fits(selector){
    const failures=await page.locator(selector).evaluateAll(nodes=>nodes.flatMap(node=>{
      const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return [];
      const badWidth=node.scrollWidth>node.clientWidth+2&&!['SELECT','TEXTAREA','INPUT'].includes(node.tagName);
      return rect.left < -1 || rect.right>innerWidth+1 || badWidth ? [{tag:node.tagName,id:node.id,class:node.className,left:rect.left,right:rect.right,scroll:node.scrollWidth,width:node.clientWidth}] : [];
    }));assert.deepEqual(failures,[],selector);
  }
  async function authorshipSpacing(){
    const issues=await page.locator('.authorship-control').evaluateAll(labels=>labels.flatMap(label=>{
      const caption=label.querySelector('span'),select=label.querySelector('select');if(!caption||!select)return [];
      const a=caption.getBoundingClientRect(),b=select.getBoundingClientRect();if(!a.width||!a.height||!b.width||!b.height)return [];
      const sameLine=Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
      const gap=sameLine?b.left-a.right:b.top-a.bottom;
      return gap<(sameLine?7.5:5.5)?[{field:select.dataset.authorshipField,gap,sameLine}]:[];
    }));assert.deepEqual(issues,[],'authorship label must be separated from its dropdown');
  }
  await page.goto(base);await expect(page.locator('#editor-welcome')).toBeVisible();await expect(page.locator('#collections [data-page-id=about]')).toBeVisible();await expect(page.locator('#media-open')).toBeEnabled();
  await page.screenshot({path:resolve(dir,'editor-desktop.png')});
  // Regression: the first-open media picker must let the user choose a document in-place.
  await page.locator('#media-open').click();await expect(page.locator('#media-edit')).toBeHidden();await expect(page.locator('.media-extra-filters')).not.toHaveAttribute('open','');
  await page.locator('#media-slots-tab').click();await expect(page.locator('.media-placement')).toBeHidden();
  await page.locator('#media-assets-tab').click();await expect(page.locator('.media-placement')).toBeVisible();
  await page.locator('#media-document').selectOption('site/settings');
  await expect(page.locator('#media-destination')).toBeEnabled();await page.locator('#media-destination').selectOption({label:'Портрет'});
  await page.locator('.media-tile').first().click();await expect(page.locator('#media-insert')).toBeEnabled();
  await expect(page.locator('#media-edit [data-authorship-field]')).toHaveCount(0);
  await page.locator('#media-document').selectOption('interface/settings');await expect(page.locator('#media-destination')).toBeDisabled();await expect(page.locator('#media-insert')).toBeDisabled();
  await page.locator('#media-document').selectOption('site/settings');await page.locator('#media-destination').selectOption({label:'Портрет'});await expect(page.locator('#media-insert')).toBeEnabled();
  await page.screenshot({path:resolve(dir,'media-desktop.png')});
  for(const viewport of [{width:1392,height:535},{width:696,height:400}]){
    await page.setViewportSize(viewport);await fits('#media-panel,.media-scroll,.media-heading button,.media-footer button');
    for(const id of ['#media-close','#media-insert']){const rect=await page.locator(id).boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=viewport.height,id+' in short window')}
  }
  await page.setViewportSize({width:1440,height:960});
  const selected=await page.locator('#media-edit [name=title]').inputValue();
  await page.locator('#media-edit [name=title]').fill('Несохранённая подпись');
  page.once('dialog',d=>d.dismiss());await page.locator('#media-close').click();await expect(page.locator('#media-panel')).toBeVisible();
  await expect(page.locator('#media-edit [name=title]')).toHaveValue('Несохранённая подпись');
  page.once('dialog',d=>d.dismiss());await page.locator('.media-tile').nth(1).click();await expect(page.locator('#media-edit [name=title]')).toHaveValue('Несохранённая подпись');
  page.once('dialog',d=>d.accept());await page.locator('#media-close').click();await expect(page.locator('#media-panel')).toBeHidden();
  await page.locator('#media-open').click();await page.locator('.media-tile').first().click();await expect(page.locator('#media-edit [name=title]')).toHaveValue(selected);
  // Every action remains inside its containing surface at phone/tablet/desktop sizes.
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await fits('#media-panel,.media-scroll,.media-placement,.media-filters,.media-layout,.media-edit,.media-edit button,.media-edit input,.media-edit select,.media-edit textarea,.media-tabs button,.media-heading button,.media-footer,.media-footer button');
    await page.locator('#media-edit [name=caption_en]').fill('');await page.locator('#media-edit [name=caption_en]').press('Tab');
    const close=await page.locator('#media-close').boundingBox();assert.ok(close.y>=0&&close.y+close.height<=900,'close remains visible');
    const insert=await page.locator('#media-insert').boundingBox();assert.ok(insert.y>=0&&insert.y+insert.height<=900,'insert remains visible');
    // Authorship dropdown and the AI button used to overlap due to negative margins.
    const overlaps=await page.locator('#media-edit .media-ai-field').evaluateAll(buttons=>buttons.filter(button=>{
      const author=button.parentElement.querySelector('.authorship-control');if(!author)return false;
      const a=author.getBoundingClientRect(),b=button.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    }).length);assert.equal(overlaps,0);
    await authorshipSpacing();
    if(width===390)await page.screenshot({path:resolve(dir,'media-mobile.png')});
  }
  page.once('dialog',d=>d.accept());await page.locator('#media-close').click();
  // Failed navigation retains the active document; stale requests cannot replace it.
  await page.route('**/api/document?collection=projects&name=papanda',route=>route.fulfill({status:500,json:{error:'Тестовая ошибка загрузки'}}));
  await openEditorItem(page,'#collections [data-key="projects/papanda"]');await expect(page.locator('#status')).toContainText('Тестовая ошибка');
  await expect(page.locator('#title')).toHaveText('Об авторе и контакты');await expect(page.locator('#save')).toBeEnabled();
  await page.unroute('**/api/document?collection=projects&name=papanda');
  await page.locator('#collection-search').fill('papanda');await expect(page.locator('#collections [data-key="projects/papanda"]')).toBeVisible();await expect(page.locator('#collections [data-key="projects/ai-algorithm"]')).toBeHidden();await page.locator('#collection-search').fill('');
  const keys=await page.locator('#collections [data-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.key));
  // Open every editable record and check the actual form, including expanded nested fields.
  for(const key of keys){
    await openEditorItem(page,`#collections [data-key="${key}"]`);await expect(page.locator(`#collections [data-key="${key}"]`)).toHaveClass(/active/);
    if(key==='interface/settings')await expect(page.locator('#document .authorship-control')).toHaveCount(0);
    else{
      const technical=['id','slug','name','email','formEndpoint','cloudflareToken','url','url_ru','url_en','license','symbol','label','tagline','heroTitle','title_ru','title_en','summary_ru','summary_en','alt_ru','alt_en','caption_ru','caption_en','label_ru','label_en','statusLabel_ru','statusLabel_en','byline_ru','byline_en','motto_ru','motto_en'];
      const stray=await page.locator('#document .field').evaluateAll((fields,technical)=>fields.flatMap(field=>{const input=field.querySelector('[data-field]');return input&&technical.includes(input.dataset.field)&&field.querySelector('.authorship-control')?[input.dataset.field]:[]}),technical);
      assert.deepEqual(stray,[],key+': no authorship on technical fields');
      await expect(page.locator('#document .array-row > .authorship-control')).toHaveCount(0);
      for(const field of key==='site/settings'?['aboutBody']:key.startsWith('graph-overrides/')?['annotation_ru','annotation_en','extra_ru','extra_en']:['body_ru','body_en'])await expect(page.locator('#document [data-authorship-field="'+field+'"]')).toHaveCount(field==='aboutBody'?2:1);
    }
    for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});await fits('article,#document,#document .field,#document button,#document input,#document textarea,#document select,.toolbar button');await authorshipSpacing();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,key+' at '+width)}
    if(key==='site/settings'){
      for(const view of ['about','home','settings','timeline','legal','privacy']){
        await openEditorItem(page,'#collections [data-site-view="'+view+'"]');
        for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});await fits('article,#document,#page-context,.page-tabs,.page-tabs button,.page-editor-info,#document .field');await authorshipSpacing()}
      }
      await openEditorItem(page,'#collections [data-site-view=settings]');await page.locator('[data-workspace-tab=settings]').click();await page.locator('[data-field=formEndpoint]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'editor-technical-settings.png')});await page.locator('[data-workspace-tab=content]').click();await page.locator('[data-field=name]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'editor-field-spacing.png')});
    }
  }
  await page.setViewportSize({width:390,height:844});await openEditorItem(page,'#collections [data-key="projects/papanda"]');await page.screenshot({path:resolve(dir,'editor-mobile.png')});
  // Unsaved document changes must survive cancellation in the modal material picker.
  await page.locator('[data-field=title_ru]').fill('Несохранённый заголовок');await page.locator('#media-open').click();
  page.once('dialog',d=>d.dismiss());await page.locator('#media-document').selectOption('site/settings');await expect(page.locator('#media-document')).toHaveValue('projects/papanda');
  await page.locator('#media-close').click();await expect(page.locator('[data-field=title_ru]')).toHaveValue('Несохранённый заголовок');
  // Edit the actual About page, retain edits across page switches, save/reopen, rebuild and verify both rendered languages.
  page.once('dialog',d=>d.accept());await openEditorItem(page,'#collections [data-site-view=about]');
  const before=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
  const about=page.locator('[data-site-panel=about]');await page.locator('[data-edit-language=both]').click();
  for(const lang of ['ru','en']){
    const fields=about.locator('[data-object='+lang+']');
    await expect(fields.locator('[data-field=aboutBody]')).toHaveValue(before[lang].aboutBody);
    await fields.locator('.rich-source-button').click();
    await fields.locator('[data-field=aboutBody]').fill(before[lang].aboutBody+'\n\n## ABOUT_EDITOR_'+lang.toUpperCase()+'\n\nИзменение основного текста страницы.');
  }
  await openEditorItem(page,'#collections [data-site-view=home]');await expect(page.locator('[data-site-panel=home] [data-field=heroTitle]').first()).toBeVisible();
  await openEditorItem(page,'#collections [data-site-view=about]');
  assert.ok((await about.locator('[data-object=ru] [data-field=aboutBody]').inputValue()).includes('ABOUT_EDITOR_RU'));
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
  const saved=JSON.parse(readFileSync(resolve(dir,'src/data/site.json'),'utf8'));
  for(const lang of ['ru','en'])assert.equal(saved[lang].aboutBody,before[lang].aboutBody+'\n\n## ABOUT_EDITOR_'+lang.toUpperCase()+'\n\nИзменение основного текста страницы.');
  const unchanged=structuredClone(saved);for(const lang of ['ru','en'])unchanged[lang].aboutBody=before[lang].aboutBody;assert.deepEqual(unchanged,before,'saving About preserves all other pages, settings and authorship');
  await page.reload();await openEditorItem(page,'#collections [data-site-view=about]');await expect(about.locator('[data-object=ru] [data-field=aboutBody]')).toHaveValue(saved.ru.aboutBody);
  await expect(page.locator('#page-open')).toHaveAttribute('href','http://127.0.0.1:4321/ru/about/');
  await page.locator('[aria-label="Язык предпросмотра"]').selectOption('en');await expect(page.locator('#page-open')).toHaveAttribute('href','http://127.0.0.1:4321/en/about/');
  await page.setViewportSize({width:1440,height:960});await page.screenshot({path:resolve(dir,'editor-about-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(dir,'editor-about-mobile.png')});
  await page.locator('#build').click();await expect(page.locator('#status')).toContainText('Сайт и поиск обновлены',{timeout:90000});
  for(const lang of ['ru','en'])assert.ok(readFileSync(resolve(dir,'dist',lang,'about/index.html'),'utf8').includes('ABOUT_EDITOR_'+lang.toUpperCase()),'edited About body renders on the actual page');
  assert.deepEqual(errors,[]);assert.equal(publishCalls,0);
  console.log(`Editor UI passed: ${keys.length} materials, 320/390/768/1024/1440px, first-open destinations, no overflow/AI overlap, reachable close, draft protection, failed loads, collection search. No publishing.`);
  console.log('Screenshots: '+dir);
}finally{await browser?.close();editor.kill();writeFileSync(resolve(dir,'editor.log'),logs)}
