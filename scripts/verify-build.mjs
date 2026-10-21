import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {rawCollection,collections,isReady,readJSON} from '../src/lib/content.mjs';
import {readOverrides} from '../src/lib/graph.mjs';
const files=[];
function walk(dir){for(const f of readdirSync(dir)){const p=join(dir,f);statSync(p).isDirectory()?walk(p):files.push(p)}}
walk('dist');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const expected='b3d4e1e9019f2382f049a0f9048833d83a82ef05f194e0236aa981e7881ad65b';
// The pre-existing root working copy may have Git's Windows CRLF conversion.
// Never edit it. The served public/dist copies must match the original raw blob.
const rootCanonical=createHash('sha256').update(readFileSync('yandex_64f199e3e08207c6.html','utf8').replace(/\r\n/g,'\n')).digest('hex');
if(rootCanonical!==expected)throw new Error('Original Yandex verification content changed');
for(const p of ['public/yandex_64f199e3e08207c6.html','dist/yandex_64f199e3e08207c6.html'])
  if(hash(p)!==expected) throw new Error(`Yandex verification bytes changed: ${p}`);
const textFiles=files.filter(p=>/\.(html|json|js|xml|txt|css)$/.test(p));
const output=textFiles.map(p=>readFileSync(p,'utf8')).join('\n');
for(const secret of ['__CSRF_TOKEN__','x-editor-token','/api/publish','/api/media/upload','GCM_INTERACTIVE','github_pat_'])if(output.includes(secret))throw new Error('Local editor/secret leakage: '+secret);
const privateRows=collections.flatMap(c=>rawCollection(c).filter(r=>!r.publish));
for(const row of privateRows) for(const value of [row.id,row.title_ru,row.title_en]){
  if(value.length>8&&output.includes(value))throw new Error(`Draft leakage: ${row.id}`);
}
const source=readJSON('src/data/graph/source.json'),overrides=readOverrides();
const privateNodes=source.nodes.filter(n=>!overrides.some(o=>o.id===n.id&&o.approvedForPublication));
for(const node of privateNodes)for(const value of [node.id,node.originalKey,node.explanation_ru,node.explanation_en].filter(s=>s?.length>12))
  if(output.includes(value))throw new Error(`Private graph data leaked: ${node.id}`);
for(const p of files.filter(p=>p.endsWith('.html'))){
  const html=readFileSync(p,'utf8');
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length)throw new Error(`Duplicate HTML IDs in ${p}`);
  for(const [,href] of html.matchAll(/\shref="((?:\/[^\"]*|#[^\"]*))"/g)){
    if(href.startsWith('//')||!href.includes('#'))continue;
    const [pathname,fragment]=href.replaceAll('&amp;','&').split('#');if(!fragment)continue;
    let target=pathname?resolve('dist','.'+decodeURIComponent(pathname.split('?')[0])):resolve(p);
    if(existsSync(target)&&statSync(target).isDirectory())target=join(target,'index.html');
    if(!target.endsWith('.html')||!existsSync(target))continue;
    const targetIds=[...readFileSync(target,'utf8').matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
    if(!targetIds.includes(decodeURIComponent(fragment)))throw new Error(`Broken anchor ${href} in ${p}`);
  }
  for(const [,url] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)){
    const target=decodeURIComponent(url.split(/[?#]/)[0]);
    if(!target)continue;
    if(target.startsWith('/handbook_ai/')||target.startsWith('/handbook_Languages/'))throw new Error('Use absolute book URLs');
    const destination=resolve('dist','.'+target);
    if(!existsSync(destination)&&!existsSync(join(destination,'index.html')))throw new Error(`Broken local link ${url} in ${p}`);
  }
  if(p.includes(`${join('dist','ru')}`)&&!html.includes('lang="ru"'))throw new Error(`Missing RU language: ${p}`);
  if(p.includes(`${join('dist','en')}`)&&!html.includes('lang="en"'))throw new Error(`Missing EN language: ${p}`);
}
if(!existsSync('dist/pagefind/pagefind.js'))throw new Error('Pagefind index missing');
if(!existsSync('dist/ru/rss.xml')||!existsSync('dist/en/rss.xml'))throw new Error('RSS missing');
console.log(`Verified ${files.filter(p=>p.endsWith('.html')).length} HTML pages: local links and anchors, unique IDs, languages, draft exclusion, private graph boundary, RSS, Pagefind and unchanged Yandex bytes.`);
