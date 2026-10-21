// Exercises currently unconfigured features in an isolated copy, never in the
// owner's preview. No requests are sent to an actual form/analytics service.
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=process.cwd(),exec=promisify(execFile);
mkdirSync('.local/features',{recursive:true});
const dir=mkdtempSync(resolve('.local/features/run-'));
for(const path of ['src','public','scripts','.pages.yml','astro.config.mjs','tsconfig.json','package.json','yandex_64f199e3e08207c6.html'])
  cpSync(resolve(root,path),resolve(dir,path),{recursive:true});
const read=path=>JSON.parse(readFileSync(resolve(dir,path),'utf8'));
const write=(path,value)=>{mkdirSync(resolve(dir,path,'..'),{recursive:true});writeFileSync(resolve(dir,path),JSON.stringify(value,null,2)+'\n')};
const site=read('src/data/site.json');
site.formEndpoint='https://formspree.io/f/testsite';site.cloudflareToken='00000000000000000000000000000000';
write('src/data/site.json',site);
const chapter=read('src/content/theses/mathematics.json');
Object.assign(chapter,{editorialStatus:'final',body_ru:'## Проверка единого источника\n\nFIXTURE_CHAPTER_RU\n\n$x^2+y^2$',body_en:'## Single-source check\n\nFIXTURE_CHAPTER_EN\n\n$x^2+y^2$'});
write('src/content/theses/mathematics.json',chapter);
const note=read('src/content/journal/unpublished-example.json');
Object.assign(note,{id:'fixture-note',slug:'fixture-note',publish:true,ready_ru:true,ready_en:true,title_ru:'Проверка тематической ленты',title_en:'Thematic feed fixture',
  summary_ru:'Тестовые данные только для автоматической проверки.',summary_en:'Test data only for automated verification.',
  body_ru:'FIXTURE_PUBLIC_JOURNAL_RU',body_en:'FIXTURE_PUBLIC_JOURNAL_EN',date:'2026-10-20',type:'experiment',researchAreas:['mathematics'],relatedProjects:['mathematical-parser']});
write('src/content/journal/fixture-note.json',note);
write('src/content/journal/fixture-incomplete.json',{...note,id:'fixture-incomplete',slug:'fixture-incomplete',ready_en:false,title_ru:'PRIVATE_TRANSLATION_SENTINEL',title_en:'PRIVATE_TRANSLATION_SENTINEL'});
const project=read('src/content/projects/papanda.json');
write('src/content/projects/papanda.json',{...project,ready_en:false,title_ru:'PRIVATE_PROJECT_REVISION_SENTINEL',body_ru:'PRIVATE_PROJECT_REVISION_SENTINEL'});
const sourceNode=(id,status,predecessors=[])=>({id,originalKey:`PRIVATE_ORIGINAL_${id}`,type:'кризис-разрешение',researchStatus:status,title_ru:`Проверка ${id}`,title_en:`Fixture ${id}`,explanation_ru:`EXPLANATION_${id}`,explanation_en:`EXPLANATION_${id}`,formula:'a+b',predecessors});
const nodes=[sourceNode('fixture-hidden','черновик'),sourceNode('fixture-public','черновик',['fixture-hidden']),sourceNode('fixture-confirmed','подтверждено',['fixture-public']),sourceNode('fixture-unresolved','не выведено',['fixture-confirmed'])];
write('src/data/graph/source.json',{schemaVersion:1,nodes,edges:nodes.flatMap(n=>n.predecessors.map(p=>({id:`${p}-to-${n.id}`,source:p,target:n.id})))});
write('src/data/graph/id-map.json',Object.fromEntries(nodes.map(n=>[n.originalKey,n.id])));
for(const n of nodes.filter(n=>n.id!=='fixture-hidden'))write(`src/content/graph-overrides/${n.id}.json`,{id:n.id,approvedForPublication:true,annotation_ru:'Одобренный тестовый узел',annotation_en:'Approved fixture node'});
const run=async args=>{
  const result=await exec(process.execPath,args,{cwd:dir,windowsHide:true,maxBuffer:4*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
  writeFileSync(resolve(dir,'build.log'),result.stdout+result.stderr,{flag:'a'});
};
await run([resolve(root,'scripts/validate-content.mjs')]);
await run([resolve(root,'node_modules/astro/bin/astro.mjs'),'build']);
const pagefind=JSON.parse(readFileSync('node_modules/pagefind/package.json','utf8'));
await run([resolve(root,'node_modules/pagefind',typeof pagefind.bin==='string'?pagefind.bin:pagefind.bin.pagefind),'--site','dist']);
await run([resolve(root,'scripts/verify-build.mjs')]);
const fixtureDist=resolve(dir,'dist');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.xml':'application/xml','.json':'application/json','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let path=resolve(fixtureDist,'.'+pathname);
  if(!path.startsWith(fixtureDist))return res.writeHead(403).end();
  if(existsSync(path)&&statSync(path).isDirectory())path=join(path,'index.html');
  if(!existsSync(path))return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(readFileSync(path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
  const page=await browser.newPage();
  let formCalls=0,success=false;
  await page.route('https://formspree.io/**',route=>{formCalls++;return route.fulfill({status:success?200:500,contentType:'application/json',body:success?'{"ok":true}':'{"error":"fixture"}'})});
  await page.route('https://static.cloudflareinsights.com/**',route=>route.fulfill({status:200,body:''}));
  await page.goto(base+'/ru/about/');
  await page.locator('input[name=name]').fill('Local test');
  await page.locator('input[name=email]').fill('test@example.com');
  await page.locator('textarea[name=message]').fill('A local test message, never sent to an external service.');
  await page.locator('input[name=consent]').check();
  await page.locator('.contact-form button').click();
  await page.getByText('Не удалось отправить сообщение.',{exact:false}).waitFor();
  success=true;await page.locator('.contact-form button').click();
  await page.getByText('Сообщение отправлено. Спасибо.',{exact:true}).waitFor();
  assert.equal(formCalls,2);
  assert.equal(await page.locator('script[src*="cloudflareinsights"]').count(),1);
  for(const lang of ['ru','en']){
    await page.goto(`${base}/${lang}/publications/theses-2020-2026/chapters/mathematics/`);
    assert.ok((await page.locator('.prose').innerText()).includes(`FIXTURE_CHAPTER_${lang.toUpperCase()}`));
    assert.ok(await page.locator('.katex').count()>0);
    await page.goto(`${base}/${lang}/publications/theses-2020-2026/full/`);
    assert.ok((await page.locator('.prose').innerText()).includes(`FIXTURE_CHAPTER_${lang.toUpperCase()}`));
    const feed=await (await fetch(`${base}/${lang}/research/mathematics/rss.xml`)).text();
    assert.ok(feed.includes('fixture-note'));assert.ok(!feed.includes('PRIVATE_TRANSLATION_SENTINEL'));
    assert.ok(!(await(await fetch(`${base}/${lang}/research/physics/rss.xml`)).text()).includes('fixture-note'));
    await page.goto(`${base}/${lang}/timeline/`);
    assert.ok(await page.locator('a[href*="/journal/fixture-note/"]').count()>0);
    await page.goto(`${base}/${lang}/projects/mathematical-parser/`);
    assert.ok(await page.locator('a[href*="/journal/fixture-note/"]').count()>0);
    await page.goto(`${base}/${lang}/projects/papanda/`);
    assert.equal(await page.locator('h1').innerText(),read('src/data/published.json').projects.find(p=>p.id==='papanda')[`title_${lang}`]);
  }
  await page.goto(base+'/ru/projects/mathematical-parser/graph/');
  await page.locator('.react-flow__node').first().waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),3);
  assert.equal(await page.locator('.react-flow__edge-path').count(),2);
  await page.locator('.graph-text-list button').filter({hasText:'fixture-public'}).click();
  await page.getByText('Часть структуры пока не опубликована.',{exact:true}).waitFor();
  assert.ok(!(await page.content()).includes('fixture-hidden'));
  assert.ok(!(await page.content()).includes('PRIVATE_ORIGINAL'));
  await page.goto(base+'/en/search/');
  await page.locator('.pagefind-ui__search-input').fill('PRIVATE_TRANSLATION_SENTINEL');
  await page.getByText('No results for',{exact:false}).waitFor();
  console.log('Feature fixtures passed: configured form failure/success (mocked), analytics opt-in, final bilingual chapters/full text, thematic RSS, timeline/project links, previous revision fallback, private graph boundary, searchable draft exclusion.');
  console.log('The owner’s source data and preview were not modified.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
