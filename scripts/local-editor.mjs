// Development helper only. Never copied into dist or deployed to GitHub Pages.
import http from 'node:http';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync,renameSync,statSync} from 'node:fs';
import {resolve,extname,basename,relative,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parse} from 'yaml';
import {validateAuthorship} from '../src/lib/authorship.mjs';
import {entrySchema,rawCollection} from '../src/lib/content.mjs';
import {overrideSchema} from '../src/lib/graph.mjs';
import {publishContent} from './publish-content.mjs';
import {listLibrary,localMediaPath,uploadMedia,updateMetadata,bindSlot,updateSlot,deleteMedia,mediaUsage} from './media-library.mjs';
import {photoInfo,editPhoto,restorePhoto} from './media-edit.mjs';
import {aiStatus,describeMedia} from './media-ai.mjs';
import {translateText} from './editor-language-ai.mjs';
import {translationStatus} from './translation-provider.mjs';
import {getLanguageState,saveLanguageState} from './editor-language-state.mjs';
import {editorPages} from './editor-pages.mjs';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import editorAlign from '../src/lib/remark-editor-align.mjs';
const editorParser=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(editorAlign);
const exec=promisify(execFile),root=process.cwd(),port=Number(process.env.EDITOR_PORT||4322),origin=`http://127.0.0.1:${port}`,token=randomBytes(24).toString('hex');
const config=parse(readFileSync('.pages.yml','utf8'));
let busy=false;
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
const run=async(args,env={})=>{const result=await exec(process.execPath,args,{cwd:root,windowsHide:true,maxBuffer:4*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',...env}});return result.stdout+result.stderr};
const body=async(req)=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>12*1024*1024)throw new Error('Request too large')}return JSON.parse(text||'{}')};
function documentPath(collection,name){
  const schema=config.content.find(c=>c.name===collection);
  if(!schema)throw new Error('Unknown collection');
  if(schema.type==='file')return {schema,path:resolve(root,schema.path)};
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name||''))throw new Error('Invalid document ID');
  const path=resolve(root,schema.path,`${name}.json`);
  if(!path.startsWith(resolve(root,'src')+'\\')&&process.platform==='win32')throw new Error('Invalid path');
  return {schema,path};
}
async function buildSite(){
        await run(['scripts/release-content.mjs']);
        let output=await run(['scripts/validate-content.mjs']);
        output+=await run(['scripts/astro.mjs','build']);
        const pagefind=JSON.parse(readFileSync('node_modules/pagefind/package.json','utf8'));
        output+=await run([resolve('node_modules/pagefind',typeof pagefind.bin==='string'?pagefind.bin:pagefind.bin.pagefind),'--site','dist']);
        output+=await run(['scripts/verify-build.mjs']);
        output+=await run(['scripts/release-content.mjs']);
        return output;
}
http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return json(res,403,{error:'Local host only'});
    const url=new URL(req.url,origin);
    if(req.method==='GET'&&url.pathname==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});
      return res.end(readFileSync('scripts/editor.html','utf8').replaceAll('__CSRF_TOKEN__',token));
    }
    if(req.method==='GET'&&['/editor-content.js','/editor-content.css','/editor-media.js','/editor-media.css','/editor-photo.js','/editor-media-ai.js','/editor-rich-text.js','/editor-rich-text.css','/editor-translation.js'].includes(url.pathname)){
      res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(readFileSync(resolve(root,'scripts'+url.pathname)));
    }
    if(req.method==='GET'&&url.pathname==='/page-materials.mjs'){
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(readFileSync('src/lib/page-materials.mjs'));
    }
    if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
      const previewRoot=resolve(root,'.local/editor-preview'),path=resolve(previewRoot,'.'+decodeURIComponent(url.pathname),url.pathname.endsWith('/')?'index.html':'');
      const rel=relative(previewRoot,path);
      if(!rel.startsWith('..')&&!isAbsolute(rel)&&existsSync(path)&&statSync(path).isFile()){
        const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.xml':'application/xml'};
        res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'});return res.end(readFileSync(path));
      }
      if(url.pathname.startsWith('/ru/')||url.pathname.startsWith('/en/')){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});return res.end('<p>Предпросмотр ещё не собран. Сохраните документ и нажмите «Обновить предпросмотр».</p>');}
    }
    if(req.method==='GET'&&url.pathname==='/api/index'){

      return json(res,200,{pages:editorPages(),collections:config.content.map(c=>({...c,files:c.type==='file'?['settings']:existsSync(c.path)?readdirSync(c.path).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)):[],...(c.type==='collection'&&c.name!=='graph-overrides'?{entries:rawCollection(c.name).map(row=>({id:row.id,title:row.title_ru||row.title_en||row.id,publish:row.publish,researchAreas:row.researchAreas,relatedProjects:row.relatedProjects}))}:{})}))});
    }
    if(req.method==='GET'&&url.pathname==='/api/editor/session'){
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Local editor session only'});
      return json(res,200,{token});
    }
    if(req.method==='GET'&&url.pathname==='/api/document'){
      const {path}=documentPath(url.searchParams.get('collection'),url.searchParams.get('name'));
      return json(res,200,JSON.parse(readFileSync(path,'utf8')));
    }
    if(req.method==='GET'&&url.pathname==='/api/editor/language-state')return json(res,200,getLanguageState(root,url.searchParams.get('scope')));
    if(req.method==='GET'&&url.pathname==='/api/media'){
      const lib=listLibrary(root);
      return json(res,200,{...lib,items:lib.items.map(item=>({...item,missing:!existsSync(localMediaPath(root,item.path))}))});
    }
    if(req.method==='GET'&&url.pathname==='/api/media/ai-status')return json(res,200,aiStatus(root));
    if(req.method==='GET'&&url.pathname==='/api/editor/translation-status')return json(res,200,translationStatus(root));
    if(req.method==='GET'&&url.pathname==='/api/media/usage'){
      const asset=listLibrary(root).items.find(x=>x.id===url.searchParams.get('id'));
      if(!asset)throw new Error('Media not found');
      return json(res,200,mediaUsage(root,asset));
    }
    if(req.method==='GET'&&url.pathname==='/api/media/file'){
      const path=localMediaPath(root,url.searchParams.get('path'));
      const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
      return res.end(readFileSync(path));
    }
    if(req.method!=='POST')return json(res,404,{error:'Not found'});
    if(req.headers['x-editor-token']!==token||(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin)))return json(res,403,{error:'Invalid local editor request'});
    const payload=await body(req);
    if(url.pathname==='/api/editor/language-state')return json(res,200,saveLanguageState(root,payload));
    if(url.pathname==='/api/editor/parse'){
      if(typeof payload.text!=='string'||payload.text.length>1024*1024)throw new Error('Текст слишком большой для визуального редактора.');
      return json(res,200,editorParser.runSync(editorParser.parse(payload.text)));
    }
    if(busy)return json(res,409,{error:'Дождитесь завершения текущей операции.'});
    if(url.pathname==='/api/editor/translate'){
      busy=true;
      try{return json(res,200,await translateText(root,payload))}
      finally{busy=false}
    }
    if(url.pathname.startsWith('/api/media/')){
      busy=true;
      try{
        if(url.pathname==='/api/media/edit-info')return json(res,200,await photoInfo(root,payload));
        if(url.pathname==='/api/media/edit')return json(res,200,await editPhoto(root,payload));
        if(url.pathname==='/api/media/restore')return json(res,200,await restorePhoto(root,payload));
        if(url.pathname==='/api/media/describe')return json(res,200,await describeMedia(root,payload));
        if(url.pathname==='/api/media/upload')return json(res,200,await uploadMedia(root,payload));
        if(url.pathname==='/api/media/metadata')return json(res,200,updateMetadata(root,payload));
        if(url.pathname==='/api/media/bind')return json(res,200,bindSlot(root,payload));
        if(url.pathname==='/api/media/slot')return json(res,200,updateSlot(root,payload));
        if(url.pathname==='/api/media/delete')return json(res,200,deleteMedia(root,payload));
        return json(res,404,{error:'Not found'});
      }finally{busy=false}
    }
    if(url.pathname==='/api/save'){
      const {schema,path}=documentPath(payload.collection,payload.name);
      validateAuthorship(payload.data);
      if(schema.name==='graph-overrides'&&!existsSync(path))throw new Error('Import graph nodes before editing their annotations.');
      if(schema.type==='collection'){
        if(payload.data.id!==payload.name)throw new Error('ID must match filename. Existing IDs cannot be renamed in this editor.');
        (schema.name==='graph-overrides'?overrideSchema:entrySchema).parse(payload.data);
      }
      busy=true;
      try{
        // Snapshot the previous complete bilingual revision before changing a draft.
        await run(['scripts/release-content.mjs']);
        const previous=existsSync(path)?readFileSync(path):null;
        mkdirSync(resolve(path,'..'),{recursive:true});
        writeFileSync(path,JSON.stringify(payload.data,null,2)+'\n');
        try{await run(['scripts/validate-content.mjs'])}
        catch(error){
          if(previous)writeFileSync(path,previous);
          else {
            // Keep a failed new draft for recovery, outside the content collection.
            mkdirSync('.local/rejected',{recursive:true});
            renameSync(path,resolve('.local/rejected',`${payload.name}-${Date.now()}.json`));
          }
          throw error;
        }
        return json(res,200,{message:'Сохранено локально. Нажмите «Обновить предпросмотр», чтобы обновить предпросмотр и поиск.'});
      }finally{busy=false}
    }
    if(url.pathname==='/api/build'){
      busy=true;
      try{
        let output=await run(['scripts/astro.mjs','build','--outDir','.local/editor-preview'],{SITE_EDITOR_PREVIEW:'1'});
        const pagefind=JSON.parse(readFileSync('node_modules/pagefind/package.json','utf8'));
        output+=await run([resolve('node_modules/pagefind',typeof pagefind.bin==='string'?pagefind.bin:pagefind.bin.pagefind),'--site','.local/editor-preview']);
        return json(res,200,{message:'Предпросмотр обновлён, включая черновики. На публичном сайте ничего не изменено.',output});
      }finally{busy=false}
    }
    if(url.pathname==='/api/publish'){
      if(payload.confirmPublish!==true)throw new Error('Подтвердите публикацию в редакторе перед commit/push.');
      busy=true;
      try{return json(res,200,await publishContent({root,build:buildSite}))}
      finally{busy=false}
    }
    if(url.pathname==='/api/upload'){
      const extension=extname(payload.name||'').toLowerCase();
      if(extension!=='.pdf'){
        const asset=await uploadMedia(root,payload);return json(res,200,{...asset,url:asset.path});
      }
      const bytes=Buffer.from(payload.base64||'','base64');
      if(!bytes.length||bytes.length>8*1024*1024)throw new Error('Upload limit: 8 MiB.');
      if(payload.mime!=='application/pdf'||bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid PDF type');
      const folder=extension==='.pdf'?'files':'images';
      const safeName=basename(payload.name,extension).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)||'upload';
      const filename=`${safeName}-${randomBytes(4).toString('hex')}${extension}`;
      mkdirSync(`public/${folder}`,{recursive:true});writeFileSync(`public/${folder}/${filename}`,bytes);
      return json(res,200,{url:`/${folder}/${filename}`});
    }
    return json(res,404,{error:'Not found'});
  }catch(error){json(res,400,{error:error.stderr||error.stdout||error.message})}
}).listen(port,'127.0.0.1',()=>console.log(`Local content editor: ${origin}\nSave and preview locally; publish to GitHub only with the dedicated button. Stop with Ctrl+C.`));
