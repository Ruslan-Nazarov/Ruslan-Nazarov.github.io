// Development helper only. Never copied into dist or deployed to GitHub Pages.
import http from 'node:http';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,extname,basename} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parse} from 'yaml';
import {entrySchema} from '../src/lib/content.mjs';
import {overrideSchema} from '../src/lib/graph.mjs';
const exec=promisify(execFile),root=process.cwd(),port=4322,origin=`http://127.0.0.1:${port}`,token=randomBytes(24).toString('hex');
const config=parse(readFileSync('.pages.yml','utf8'));
let busy=false;
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
const run=async(args)=>{const result=await exec(process.execPath,args,{cwd:root,windowsHide:true,maxBuffer:4*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});return result.stdout+result.stderr};
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
http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return json(res,403,{error:'Local host only'});
    const url=new URL(req.url,origin);
    if(req.method==='GET'&&url.pathname==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});
      return res.end(readFileSync('scripts/editor.html','utf8').replaceAll('__CSRF_TOKEN__',token));
    }
    if(req.method==='GET'&&url.pathname==='/api/index'){
      return json(res,200,{collections:config.content.map(c=>({...c,files:c.type==='file'?['settings']:existsSync(c.path)?readdirSync(c.path).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)):[]}))});
    }
    if(req.method==='GET'&&url.pathname==='/api/document'){
      const {path}=documentPath(url.searchParams.get('collection'),url.searchParams.get('name'));
      return json(res,200,JSON.parse(readFileSync(path,'utf8')));
    }
    if(req.method!=='POST')return json(res,404,{error:'Not found'});
    if(req.headers['x-editor-token']!==token||(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin)))return json(res,403,{error:'Invalid local editor request'});
    if(busy)return json(res,409,{error:'Дождитесь завершения текущей операции.'});
    const payload=await body(req);
    if(url.pathname==='/api/save'){
      const {schema,path}=documentPath(payload.collection,payload.name);
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
        return json(res,200,{message:'Сохранено локально. Нажмите «Пересобрать сайт», чтобы обновить предпросмотр и поиск.'});
      }finally{busy=false}
    }
    if(url.pathname==='/api/build'){
      busy=true;
      try{
        let output=await run(['scripts/validate-content.mjs']);
        output+=await run(['scripts/astro.mjs','build']);
        const pagefind=JSON.parse(readFileSync('node_modules/pagefind/package.json','utf8'));
        output+=await run([resolve('node_modules/pagefind',typeof pagefind.bin==='string'?pagefind.bin:pagefind.bin.pagefind),'--site','dist']);
        output+=await run(['scripts/verify-build.mjs']);
        output+=await run(['scripts/release-content.mjs']);
        return json(res,200,{message:'Сайт и поиск обновлены. Можно открыть предпросмотр.',output});
      }finally{busy=false}
    }
    if(url.pathname==='/api/upload'){
      const extension=extname(payload.name||'').toLowerCase();
      if(!['.png','.jpg','.jpeg','.webp','.gif','.pdf'].includes(extension))throw new Error('Supported uploads: PNG, JPEG, WebP, GIF, PDF.');
      const bytes=Buffer.from(payload.base64||'','base64');
      if(!bytes.length||bytes.length>8*1024*1024)throw new Error('Upload limit: 8 MiB.');
      const folder=extension==='.pdf'?'files':'images';
      const safeName=basename(payload.name,extension).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)||'upload';
      const filename=`${safeName}-${randomBytes(4).toString('hex')}${extension}`;
      mkdirSync(`public/${folder}`,{recursive:true});writeFileSync(`public/${folder}/${filename}`,bytes);
      return json(res,200,{url:`/${folder}/${filename}`});
    }
    return json(res,404,{error:'Not found'});
  }catch(error){json(res,400,{error:error.stderr||error.stdout||error.message})}
}).listen(port,'127.0.0.1',()=>console.log(`Local content editor: ${origin}\nLocal files only. No GitHub writes. Stop with Ctrl+C.`));
