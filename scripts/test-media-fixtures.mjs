// End-to-end media editing in an isolated copy. No remote, no GitHub requests.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from '@playwright/test';
const root=process.cwd(),exec=promisify(execFile);
mkdirSync('.local/media-fixtures',{recursive:true});
const dir=mkdtempSync(resolve('.local/media-fixtures/run-'));
for(const path of ['src','public','scripts','.pages.yml','astro.config.mjs','tsconfig.json','package.json','yandex_64f199e3e08207c6.html'])cpSync(resolve(root,path),resolve(dir,path),{recursive:true});
const read=path=>JSON.parse(readFileSync(resolve(dir,path),'utf8'));
const run=async(binary,args)=>{const result=await exec(binary,args,{cwd:dir,windowsHide:true,maxBuffer:6*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});writeFileSync(resolve(dir,'test.log'),result.stdout+result.stderr,{flag:'a'});return result.stdout};
await run('git',['init']);await run('git',['add','src/data/media.json']);
const portProbe=http.createServer();await new Promise(r=>portProbe.listen(0,'127.0.0.1',r));const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
const editor=spawn(process.execPath,[resolve(dir,'scripts/local-editor.mjs')],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port)}});
let logs='';editor.stdout.on('data',data=>logs+=data);editor.stderr.on('data',data=>logs+=data);
const editorBase=`http://127.0.0.1:${port}`;
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=resolve(dir,'dist');
  let file=resolve(base,'.'+pathname);if(!file.startsWith(base+sep))return res.writeHead(403).end();
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  if(!existsSync(file))return res.writeHead(404).end();
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(editorBase)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===59)throw new Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack)});
  let publishCalls=0;await page.route('**/api/publish',route=>{publishCalls++;return route.abort()});
  await page.goto(editorBase);await page.locator('#media-open').click();const chooserEvent=page.waitForEvent('filechooser');await page.locator('#media-new').click();await chooserEvent;
  const png=await sharp({create:{width:1600,height:600,channels:4,background:'#bd774d'}}).png().toBuffer();
  const form=page.locator('#media-edit form');
  await form.locator('input[type=file]').setInputFiles({name:'fixture-ecg.png',mimeType:'image/png',buffer:png});
  for(const [name,value] of Object.entries({title:'Проверка ЭКГ — fixture',project:'papanda',tags:'ecg, test',alt_ru:'Тестовый снимок ЭКГ',alt_en:'ECG test image',caption_ru:'Тестовая подпись',caption_en:'Test caption'}))await form.locator(`[name=${name}]`).fill(value);
  await form.getByLabel('Авторство: caption_ru',{exact:true}).selectOption('ai');
  await page.getByRole('button',{name:'Загрузить и сохранить локально',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Изображение сохранено локально'}).waitFor();
  let asset=read('src/data/media.json').items.find(x=>x.title.includes('fixture'));assert.ok(asset);assert.equal(asset._authorship.caption_ru,'ai');
  await page.locator('#media-search').fill('Проверка ЭКГ');assert.equal(await page.locator('.media-tile').count(),1);
  await page.locator('#media-project').selectOption('papanda');await page.locator('#media-tag').fill('ecg');assert.equal(await page.locator('.media-tile').count(),1);
  await page.locator('#media-search').fill('not-present');assert.equal(await page.locator('.media-tile').count(),0);await page.locator('#media-search').fill('');
  await page.locator('#media-slots-tab').click();const slot=page.locator('[data-slot-id="ecg-final"]');
  await slot.getByLabel('Изображение ecg-final',{exact:true}).selectOption(asset.id);await slot.getByRole('button',{name:'Сохранить привязку',exact:true}).click();
  await page.locator('#media-status').filter({hasText:'Привязка сохранена'}).waitFor();
  await page.reload();await page.locator('#media-open').click();await page.locator('#media-slots-tab').click();assert.equal(await slot.getByLabel('Изображение ecg-final',{exact:true}).inputValue(),asset.id);
  await page.screenshot({path:resolve(dir,'editor-media-slots.png'),fullPage:false});
  const gitStatus=await run('git',['status','--porcelain','--untracked-files=all','--','public/media','src/data/media.json']);assert.match(gitStatus,/src\/data\/media\.json/);assert.match(gitStatus,/public\/media\/papanda/);
  assert.match(await run('git',['diff','--','src/data/media.json']),/ecg-final|mediaId/);
  // CSRF, spoofed uploads and traversal are rejected through the actual API.
  assert.equal((await fetch(editorBase+'/api/media/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slotId:'ecg-final',mediaId:''})})).status,403);
  const token=(await(await fetch(editorBase)).text()).match(/const token='([^']+)'/)[1];
  const post=async(path,data)=>{const response=await fetch(editorBase+path,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(data)});return {status:response.status,data:await response.json()}};
  assert.equal((await post('/api/media/upload',{name:'bad.png',mime:'text/html',base64:png.toString('base64')})).status,400);
  assert.equal((await fetch(editorBase+'/api/media/file?path='+encodeURIComponent('/media/../secret.png'))).status,400);
  // A photo can be stored first; alt is still required before inserting it.
  await page.locator('#media-assets-tab').click();await page.locator('#media-new').click();
  await form.locator('input[type=file]').setInputFiles({name:'unannotated.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Загрузить и сохранить локально',exact:true}).click();
  await page.locator('#media-status').filter({hasText:'Изображение сохранено локально'}).waitFor();
  assert.equal(read('src/data/media.json').items.find(x=>x.title==='unannotated.png').alt_ru,'');
  await page.locator('#media-close').click();
  // Save and reload real content switches, including independent languages.
  await page.getByRole('button',{name:'papanda',exact:true}).click();
  for(const field of ['title_ru','summary_ru','body_ru'])await page.locator('[data-authorship-field="'+field+'"]').selectOption('ai');
  await page.locator('[data-authorship-field="body_en"]').selectOption('human');
  await page.locator('#save').click();await page.locator('#status').filter({hasText:'Сохранено локально'}).waitFor();
  await page.reload();await page.getByRole('button',{name:'papanda',exact:true}).click();
  assert.equal(await page.locator('[data-authorship-field="body_ru"]').inputValue(),'ai');
  assert.equal(await page.locator('[data-authorship-field="body_en"]').inputValue(),'human');
  const settings=read('src/data/site.json');settings.ru._authorship={heroTitle:'ai',aboutBody:'human'};
  const saved=await post('/api/save',{collection:'site',name:'settings',data:settings});assert.equal(saved.status,200,JSON.stringify(saved));
  await run(process.execPath,[resolve(root,'node_modules/astro/bin/astro.mjs'),'build']);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const media=read('src/data/media.json'),expected=media.slots.find(x=>x.id==='ecg-final');
  for(const lang of ['ru','en']){
    await page.goto(`${base}/${lang}/projects/papanda/`);
    const mark=page.locator('article .prose [data-authorship]').first();
    assert.equal(await mark.getAttribute('data-authorship'),lang==='ru'?'ai':'human');
    await mark.hover();await page.locator('#authorship-help:not([hidden])').waitFor();
    assert.equal(await page.locator('#authorship-help a').getAttribute('href'),'/' + lang + '/about/#contact');
    await page.keyboard.press('Escape');
    await mark.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#authorship-help a').evaluate(a=>a===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-media-id]').count(),7);assert.equal(await page.locator('[data-media-id] img').count(),1);
    const figure=page.locator('[data-media-id="ecg-final"]');assert.equal(await figure.locator('img').getAttribute('alt'),expected['alt_'+lang]);assert.equal(await figure.locator('figcaption').innerText(),expected['caption_'+lang]);
    await figure.scrollIntoViewIfNeeded();await figure.locator('img').evaluate(img=>img.decode());
    assert.equal(await figure.locator('img').evaluate(img=>img.complete&&img.naturalWidth===1600),true);
    await figure.locator('a').click();assert.equal(await page.locator('#media-viewer').evaluate(dialog=>dialog.open),true);await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});await mark.click();
    await page.locator('#authorship-help:not([hidden])').waitFor();
    const box=await page.locator('#authorship-help').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
    await page.screenshot({path:resolve(dir,'authorship-'+lang+'-mobile.png'),fullPage:false});
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await figure.locator('a').click();assert.equal(await page.locator('.media-viewer-scroll').evaluate(node=>node.scrollWidth>node.clientWidth),true);await page.keyboard.press('Escape');
    await page.screenshot({path:resolve(dir,`papanda-${lang}-mobile.png`),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  }
  await page.goto(base+'/ru/');assert.equal(await page.locator('h1 [data-authorship]').getAttribute('data-authorship'),'ai');
  await page.goto(base+'/ru/about/');assert.equal(await page.locator('.prose [data-authorship]').getAttribute('data-authorship'),'human');
  // Replace in place via UI; captions can be changed without changing bytes.
  await page.goto(editorBase);await page.locator('#media-open').click();await page.locator(`[data-media-id="${asset.id}"]`).click();
  await page.locator('#media-edit [name=caption_en]').fill('Updated caption');await page.getByRole('button',{name:'Сохранить метаданные',exact:true}).click();await page.locator('#media-status').filter({hasText:'Метаданные сохранены'}).waitFor();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#media-edit [name=replacement]').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});await page.locator('#media-status').filter({hasText:'Файл заменён'}).waitFor();
  assert.equal(read('src/data/media.json').items.find(x=>x.id===asset.id).path,asset.path);assert.equal(read('src/data/media.json').items.find(x=>x.id===asset.id).caption_en,'Updated caption');
  // Reuse in an article without another upload; save goes through the existing editor.
  await page.locator('#media-close').click();await page.getByRole('button',{name:'papanda',exact:true}).click();
  await page.locator('textarea[data-field=body_en]').focus();await page.getByRole('button',{name:'Вставить изображение',exact:true}).nth(1).click();await page.locator(`[data-media-id="${asset.id}"]`).click();await page.getByRole('button',{name:'Вставить в материал',exact:true}).click();
  assert.ok((await page.locator('textarea[data-field=body_en]').inputValue()).includes(`[[media:${asset.id}]]`));
  // Do not save this temporary insertion: direct reference blocking is tested separately.
  page.once('dialog',dialog=>dialog.accept());await page.reload();await page.locator('#media-open').click();await page.locator(`[data-media-id="${asset.id}"]`).click();
  const deleteDialog=page.waitForEvent('dialog');await page.getByRole('button',{name:'Где используется / удалить',exact:true}).click();
  const warning=await deleteDialog;assert.match(warning.message(),/ecg-final/);await warning.dismiss();assert.ok(existsSync(resolve(dir,'public'+asset.path)));
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Где используется / удалить',exact:true}).click();await page.locator('#media-status').filter({hasText:'Удалено.'}).waitFor();
  assert.equal(read('src/data/media.json').slots.find(x=>x.id==='ecg-final').status,'placeholder');assert.ok(!existsSync(resolve(dir,'public'+asset.path)));
  assert.equal(publishCalls,0);assert.deepEqual(errors,[]);
  console.log('Media fixture passed: real PNG upload/search/filter, slot binding, reload persistence, Git diff, RU/EN/mobile viewer, metadata, replacement, reuse, deletion cancel/confirm, CSRF and type/path rejection. No GitHub calls.');
  console.log('Screenshots and logs: '+dir);
}finally{await browser?.close();editor.kill();if(server.listening)await new Promise(r=>server.close(r));writeFileSync(resolve(dir,'editor.log'),logs)}
