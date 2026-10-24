import {openEditorItem} from './editor-test-navigation.mjs';
// Verify editor -> saved files -> every rendered route in an isolated copy. No publication.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,symlinkSync,existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const root=process.cwd();mkdirSync('.local/editor-pages',{recursive:true});const dir=mkdtempSync(resolve('.local/editor-pages/run-'));
for(const path of ['src','public','scripts','.pages.yml','package.json','astro.config.mjs','tsconfig.json','yandex_64f199e3e08207c6.html'])cpSync(resolve(root,path),resolve(dir,path),{recursive:true});
symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const read=path=>JSON.parse(readFileSync(resolve(dir,path),'utf8'));
const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const editor=spawn(process.execPath,['scripts/local-editor.mjs'],{cwd:dir,windowsHide:true,env:{...process.env,EDITOR_PORT:String(port),MEDIA_AI_DISABLED:'1'}});
let logs='',browser,staticServer;editor.stdout.on('data',x=>logs+=x);editor.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`;
const marker=(prefix,...parts)=>'AUDIT_'+[prefix,...parts].join('_').replace(/[^a-z0-9_]/gi,'_');
try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw new Error(logs)}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000},userAgent:'EditorAuditBot'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let publishCalls=0;await page.route('**/api/publish',route=>{publishCalls++;return route.abort()});
  await page.goto(base);const index=await (await fetch(base+'/api/index')).json();
  await expect(page.locator('.page-picker')).toHaveCount(0);
  const editableRows=index.pages.filter(p=>!['site','interface'].includes(p.target.collection)),edited=[];
  for(const item of editableRows){
    const {collection,name}=item.target,record=read(`src/content/${collection}/${name}.json`);
    await openEditorItem(page,`#collections [data-key="${collection}/${name}"]`);
    await expect(page.locator('#page-open')).toHaveAttribute('href',`http://127.0.0.1:4321/ru/${item.path}/`);
    for(const lang of ['ru','en'])for(const field of ['title','summary','body']){
      const input=page.locator(`[data-field="${field}_${lang}"]`);await expect(input).toHaveValue(record[`${field}_${lang}`]);
      if(field==='body')await input.locator('..').locator('.rich-source-button').click();
      await input.fill(record[`${field}_${lang}`]+(field==='body'?'\n\n':' ')+marker(field,collection,name,lang));
    }
    await page.locator('#save').click();await expect(page.locator('#status')).toContainText('Сохранено локально');
    for(const lang of ['ru','en'])assert.ok(read(`src/content/${collection}/${name}.json`)[`body_${lang}`].includes(marker('body',collection,name,lang)));
    edited.push(item);
  }
  console.log(`Saved title, description and body through the editor for ${edited.length} public materials in both languages.`);
  // Verify every special page selects its actual fields; interface filters must leave them visible.
  for(const item of index.pages.filter(p=>!editableRows.includes(p))){
    await page.evaluate(item=>openPageSource(item.target,item),item);
    if(item.target.fields)for(const key of item.target.fields)await expect(page.locator('#document [data-object=ru] [data-field="'+key+'"]').first()).toBeVisible();
    for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,item.id+' overflow at '+width)}
  }
  await page.setViewportSize({width:1440,height:1000});
  // Set markers in shared/site copy through the editor API. Metadata and mathematical source are retained.
  const site=read('src/data/site.json'),ui=read('src/data/ui.json'),library=read('src/data/media.json'),slot=library.slots[0].id;
  for(const lang of ['ru','en']){
    for(const [key,value] of Object.entries(site[lang]))if(typeof value==='string')site[lang][key]=value+'\n\n'+marker('site',lang,key)+(key.endsWith('Body')?'\n\n[[media:'+slot+']]':'');
    for(const [key,value] of Object.entries(ui[lang]))if(typeof value==='string')ui[lang][key]=value+' '+marker('ui',lang,key);
  }
  site.footerGithubUrl='/ru/about/#contact';site.textLicenseUrl='/ru/legal/';
  const save=async(collection,data)=>{const result=await page.evaluate(async payload=>api('/api/save',payload),{collection,name:'settings',data});assert.ok(result.message.includes('Сохранено'))};
  await save('site',site);await save('interface',ui);
  // Gallery descriptions belong to the placement; they must not be masked by asset metadata.
  const project=edited.find(p=>p.target.collection==='projects'),record=read(`src/content/projects/${project.target.name}.json`),asset=library.items[0];
  record.gallery=[{src:asset.path,alt_ru:'AUDIT_GALLERY_RU',alt_en:'AUDIT_GALLERY_EN'}];
  record._authorship={...record._authorship,body_ru:'human',body_en:'human'};
  await page.evaluate(async payload=>api('/api/save',payload),{collection:'projects',name:project.target.name,data:record});
  await page.reload();await expect(page.locator('#collections button').first()).toBeVisible();
  await page.evaluate(()=>{const item=pageIndex.find(item=>item.id==='search');return openPageSource(item.target,item)});
  await expect(page.locator('#document [data-object=ru] [data-field=searchPlaceholder]')).toHaveValue(ui.ru.searchPlaceholder);
  await page.locator('#build').click();await expect(page.locator('#status')).toContainText('Сайт и поиск обновлены',{timeout:120000});
  console.log('Fixture built, including search indexes and link/anchor verification.');
  const built=(path,lang)=>readFileSync(resolve(dir,'dist',lang,path,'index.html'),'utf8');
  const report=[];
  for(const item of index.pages){
    for(const lang of item.absolute?['en']:['ru','en']){
      const html=item.absolute?readFileSync(resolve(dir,'dist',item.id==='landing'?'index.html':'404.html'),'utf8'):built(item.path,lang);
      assert.ok(html.includes('<html'),item.id+': rendered HTML');
      if(edited.includes(item))for(const field of ['title','summary','body'])assert.ok(html.includes(marker(field,item.target.collection,item.target.name,lang)),item.id+': '+field+' '+lang);
      else if(item.id==='home')for(const field of ['heroTitle','heroText','researchBody','featuredBody','publicationsBody'])assert.ok(html.includes(marker('site',lang,field)),item.id+': '+field);
      else if(item.id==='about')assert.ok(html.includes(marker('site',lang,'aboutBody')));
      else if(item.id==='timeline')assert.ok(html.includes(marker('site',lang,'history'))&&html.includes(marker('ui',lang,'historicalRange')));
      else if(item.id==='legal')assert.ok(html.includes(marker('site',lang,'rights')));
      else if(item.id==='privacy')assert.ok(html.includes(marker('site',lang,'privacy')));
      else if(item.id==='404')assert.ok(html.includes(marker('ui','ru','notFound'))&&html.includes(marker('ui','en','notFound')));
      else if(item.id==='landing')assert.ok(html.includes(marker('ui','ru','languageName'))&&html.includes(marker('ui','en','languageName')));
      else if(item.path.endsWith('/full'))for(const chapter of edited.filter(p=>p.target.collection==='theses'))assert.ok(html.includes(marker('body','theses',chapter.target.name,lang)),item.id+': aggregated chapter');
      else if(item.path.endsWith('/graph'))assert.ok(html.includes(marker('ui',lang,'graph'))&&html.includes(marker('ui',lang,'demoTitle:demo-addition')));
      else assert.ok(html.includes(marker('ui',lang,item.path)),item.id+': catalogue/search heading');
      report.push({url:item.absolute?item.path:`/${lang}/${item.path?item.path+'/':''}`,editor:item.target,verified:true});
    }
  }
  for(const lang of ['ru','en']){
    assert.ok(built('',lang).includes('data-media-id="'+slot+'"'),'Home body media renders');
    assert.ok(built('about',lang).includes('data-media-id="'+slot+'"'),'About body media renders');
    assert.ok(built(project.path,lang).includes('alt="AUDIT_GALLERY_'+lang.toUpperCase()+'"'),'gallery placement alt wins');
    assert.ok(!built(project.path,lang).includes('data-authorship='),'authorship stays in the editor');
    const journal=edited.filter(p=>p.target.collection==='journal');for(const item of journal)assert.ok(readFileSync(resolve(dir,'dist',lang,'rss.xml'),'utf8').includes(marker('title','journal',item.target.name,lang)),'RSS reflects editor');
  }
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml'};
  staticServer=http.createServer((req,res)=>{
    let path=resolve(dir,'dist','.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
    if(!path.startsWith(resolve(dir,'dist')+'/')&&!path.startsWith(resolve(dir,'dist')+'\\'))return res.writeHead(403).end();
    if(existsSync(path)&&statSync(path).isDirectory())path=resolve(path,'index.html');if(!existsSync(path))return res.writeHead(404).end();
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(readFileSync(path));
  });await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));const preview=`http://127.0.0.1:${staticServer.address().port}`;
  await page.goto(preview+'/ru/search/');await expect(page.locator('.pagefind-ui__search-input')).toHaveAttribute('placeholder',ui.ru.searchPlaceholder);
  await page.goto(preview+'/en/projects/mathematical-parser/graph/');await expect(page.locator('.react-flow__node').first()).toContainText(ui.en['demoTitle:demo-addition']);
  await page.locator('.react-flow__node').first().click();await expect(page.locator('.graph-detail')).toContainText(ui.en['demoExplanation:demo-addition']);
  assert.deepEqual(errors,[]);assert.equal(publishCalls,0);
  writeFileSync(resolve(dir,'audit.json'),JSON.stringify({pages:report,materials:edited.length,media:true,galleryAlt:true,search:true,graphDemo:true,rss:true,publishCalls},null,2));
  console.log(`Passed: ${report.length} HTML URLs, ${edited.length} materials RU/EN, all special page destinations, composite theses, RSS, search and graph text, site-body media, gallery descriptions. No publication.`);
  console.log('Audit: '+resolve(dir,'audit.json'));
}finally{await browser?.close();editor.kill();if(staticServer?.listening)await new Promise(r=>staticServer.close(r));writeFileSync(resolve(dir,'editor.log'),logs)}
