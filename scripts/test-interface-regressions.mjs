import {openEditorItem} from './editor-test-navigation.mjs';
// Regression scenarios for interface audit 22.10.2026, in an isolated copy.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {chromium,expect} from '@playwright/test';
import sharp from 'sharp';
const root=process.cwd();mkdirSync('.local/interface-audit',{recursive:true});const dir=mkdtempSync(resolve('.local/interface-audit/run-'));
for(const file of ['src','public','scripts','.pages.yml','package.json'])cpSync(resolve(root,file),resolve(dir,file),{recursive:true});
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let logs='',browser;editor.stdout.on('data',x=>logs+=x);editor.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`,findings=[];
try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw new Error(logs)}
  const token=(await (await fetch(base)).text()).match(/const token='([^']+)'/)[1];
  async function post(path,data){const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(data)});const value=await res.json();if(!res.ok)throw Error(JSON.stringify(value));return value}
  const bytes=await sharp({create:{width:100,height:80,channels:3,background:'#f2994a'}}).png().toBuffer();
  const asset=await post('/api/media/upload',{name:'interface-audit.png',mime:'image/png',base64:bytes.toString('base64'),title:'Audit image',alt_ru:'Тест',alt_en:'Test',caption_ru:'Сохранённая подпись',caption_en:'Saved caption',project:'papanda',tags:[]});
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1392,height:900}});
  let dialogs=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
  await page.goto(base);await page.locator('#media-open').click();await page.locator(`[data-media-id="${asset.id}"]`).click();
  await page.locator('#media-edit [name=caption_ru]').fill('НЕСОХРАНЁННЫЙ ТЕКСТ ДО ЗАМЕНЫ');dialogs=[];
  await page.locator('#media-edit [name=replacement]').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:bytes});
  await expect(page.locator('#media-status')).toContainText('Файл заменён');
  const captionAfterReplace=await page.locator('#media-edit [name=caption_ru]').inputValue();
  if(captionAfterReplace!=='НЕСОХРАНЁННЫЙ ТЕКСТ ДО ЗАМЕНЫ')findings.push({id:'UI-01',title:'Замена файла стирает несохранённые подписи',severity:'high',observed:captionAfterReplace,dialogs});
  await page.locator('#media-slots-tab').click();const rows=page.locator('#media-slots .slot-row');
  const first=rows.nth(0),second=rows.nth(1);await first.locator('summary').click();await first.locator('[name=caption_ru]').fill('НЕСОХРАНЁННЫЙ ТЕКСТ ПРИВЯЗКИ');
  dialogs=[];await first.locator('select').first().selectOption(asset.id);await first.getByRole('button',{name:'Сохранить привязку',exact:true}).click();
  await expect(page.locator('#media-status')).toContainText('Привязка сохранена');
  const captionAfterBind=await first.locator('[name=caption_ru]').inputValue();
  let slotFinding;
  if(captionAfterBind!=='НЕСОХРАНЁННЫЙ ТЕКСТ ПРИВЯЗКИ'){slotFinding={id:'UI-02',title:'Обновление заглушек теряет несохранённые тексты',severity:'high',binding:{caption:captionAfterBind,dialogs}};findings.push(slotFinding)}
  if(await first.locator('details').getAttribute('open')===null)await first.locator('summary').click();await first.locator('[name=caption_ru]').fill('ПРАВКА ПЕРВОЙ ЗАГЛУШКИ');await second.locator('summary').click();await second.locator('[name=caption_ru]').fill('ПРАВКА ВТОРОЙ ЗАГЛУШКИ');
  dialogs=[];await second.getByRole('button',{name:'Сохранить тексты заглушки',exact:true}).click();await expect(page.locator('#media-status')).toContainText('Тексты заглушки сохранены');
  const firstAfterSecondSave=await first.locator('[name=caption_ru]').inputValue();if(firstAfterSecondSave!=='ПРАВКА ПЕРВОЙ ЗАГЛУШКИ'){if(!slotFinding){slotFinding={id:'UI-02',title:'Обновление заглушек теряет несохранённые тексты',severity:'high'};findings.push(slotFinding)}slotFinding.otherSlotSave={caption:firstAfterSecondSave,lost:true,dialogs:[...dialogs]}}
  await page.locator('#media-close').click();
  await openEditorItem(page,'#collections [data-key="projects/papanda"]');
  const status=page.locator('[data-field=editorialStatus]');const technicalOptions=await status.locator('option').allTextContents();
  if(technicalOptions.includes('awaiting_content'))findings.push({id:'UI-03',title:'В выпадающих списках показаны служебные коды статусов',severity:'medium',options:technicalOptions});
  // A failure after scrolling to the end must be visible where the user works.
  await page.route('**/api/save',route=>route.fulfill({status:400,json:{error:'AUDIT: исправьте поле материала'}}));
  await page.locator('[data-field=body_en]').locator('..').locator('.rich-source-button').click();await page.locator('[data-field=body_en]').fill('Неполный тестовый текст');
  await page.locator('#document').locator('fieldset').last().scrollIntoViewIfNeeded();
  await page.locator('#save').click();await expect(page.locator('#status')).toContainText('AUDIT:');
  const statusRect=await page.locator('#status').boundingBox();
  if(statusRect.y+statusRect.height<0||statusRect.y>900)findings.push({id:'UI-04',title:'Ошибка сохранения появляется вне видимой области',severity:'medium',bounds:statusRect});
  await page.screenshot({path:resolve(dir,'save-error-offscreen.png')});await page.unroute('**/api/save');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-field=body_ru]').locator('..').locator('.rich-source-button').click();await page.locator('[data-field=body_ru]').fill('Правка далеко в форме');await page.locator('#document').locator('fieldset').last().scrollIntoViewIfNeeded();
  const saveRect=await page.locator('#save').boundingBox();
  if(saveRect.y+saveRect.height<0||saveRect.y>844)findings.push({id:'UI-05',title:'На узком экране кнопка сохранения уезжает далеко за пределы окна',severity:'medium',bounds:saveRect});
  await page.screenshot({path:resolve(dir,'mobile-save-offscreen.png')});
  await page.locator('#media-open').click();await page.locator('#media-destination').selectOption({label:await page.locator('[data-field=body_ru]').getAttribute('data-media-target')});await page.locator(`[data-media-id="${asset.id}"]`).click();
  await page.locator('#media-edit [name=alt_ru]').fill('');await page.locator('#media-edit [name=caption_en]').focus();await page.locator('#media-insert').click();await expect(page.locator('#media-status')).toContainText('Alt RU');
  const errorRect=await page.locator('#media-status').boundingBox();if(errorRect.y+errorRect.height<0||errorRect.y>844){const finding=findings.find(f=>f.id==='UI-04');if(finding)finding.mediaAlso={bounds:errorRect};}
  await page.screenshot({path:resolve(dir,'media-error-offscreen.png')});
  writeFileSync(resolve(dir,'findings.json'),JSON.stringify({count:findings.length,findings},null,2)+'\n');
  if(findings.length)throw new Error(JSON.stringify(findings,null,2));console.log('Interface regressions passed: file replacement retains drafts; slot binding and saving another slot retain drafts; statuses use readable labels; error feedback and mobile Save remain visible.');console.log('Screenshots: '+dir);
}finally{await browser?.close();editor.kill();writeFileSync(resolve(dir,'editor.log'),logs)}
