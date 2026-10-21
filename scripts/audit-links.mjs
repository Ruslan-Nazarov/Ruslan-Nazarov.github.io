import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const urls=new Map();
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
  const file=join(dir,item.name);if(item.isDirectory()){walk(file);continue}if(!file.endsWith('.html'))continue;
  for(const [,raw] of readFileSync(file,'utf8').matchAll(/href="(https?:[^"<>]+)"/g)){
    const url=new URL(raw.replaceAll('&amp;','&'));url.hash='';
    if(url.hostname==='ruslan-nazarov.github.io'&&!/^\/(handbook_|$|yandex_)/.test(url.pathname))continue;
    const key=url.href;if(!urls.has(key))urls.set(key,new Set());urls.get(key).add(file.replaceAll('\\','/'));
  }
}}
walk('dist');
const queue=[...urls],results=[];
await Promise.all(Array.from({length:4},async()=>{
  while(queue.length){const [url,files]=queue.shift();let result;
    try{const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (compatible; WebsiteLinkAudit/1.0)'}});
      result={status:response.status,finalUrl:response.url,result:response.ok?'ok':[401,403,429].includes(response.status)?'access-limited':'http-error'};
      await response.body?.cancel();
    }catch(error){result={result:'unverified',error:error.cause?.code||error.message}}
    results.push({url,...result,pages:[...files]});console.log(result.result,result.status||'',url);
  }
}));
writeFileSync('docs/LINK-AUDIT.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'External hrefs in built public pages; GET requests; restricted responses do not prove a broken link.',results:results.sort((a,b)=>a.url.localeCompare(b.url))},null,2)+'\n');
