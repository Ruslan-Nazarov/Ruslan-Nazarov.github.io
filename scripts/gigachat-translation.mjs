// Text only. Official endpoints, verified TLS, memory-only OAuth, no paid fallback.
import https from 'node:https';
import {rootCertificates} from 'node:tls';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {gigaTranslationBody,parseGigaTranslation} from './gigachat-format.mjs';
const oauth='https://ngw.devices.sberbank.ru:9443/api/v2/oauth',base='https://api.giga.chat/v1';
const tokens=new Map();
function transport(config,fetchImpl){
  if(fetchImpl&&fetchImpl!==fetch)return fetchImpl;
  const ca=config.caBundle?[...rootCertificates,readFileSync(config.caBundle,'utf8')]:undefined;
  return (url,options={})=>new Promise((resolve,reject)=>{
    if(url!==oauth&&!url.startsWith(base+'/'))return reject(new Error('Unexpected GigaChat endpoint'));
    const req=https.request(url,{method:options.method||'GET',headers:options.headers,ca,signal:AbortSignal.timeout(120000)},res=>{
      const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){res.destroy();reject(new Error('Response too large'))}else chunks.push(chunk)});
      res.on('error',reject);res.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:async()=>JSON.parse(bytes.toString('utf8'))})});
    });
    req.on('error',reject);req.end(options.body);
  });
}
function checkedError(status){
  const messages={400:'GigaChat отклонил формат запроса.',401:'Ключ GigaChat недействителен или срок доступа истёк.',403:'Нет доступа к выбранной модели GigaChat.',402:'Бесплатная квота GigaChat исчерпана.',429:'GigaChat: превышен лимит запросов или токенов.',422:'GigaChat не смог обработать запрос: проверьте модель и объём текста.'};
  const error=new Error(messages[status]||`GigaChat не обработал запрос (HTTP ${status}).`);error.gigaSafe=true;return error;
}
function safeError(error){
  if(error.gigaSafe)return error;
  if(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','CERT_HAS_EXPIRED','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error?.code))return new Error('Не удалось проверить сертификат GigaChat. Проверьте доверенный GIGACHAT_CA_BUNDLE.');
  return new Error('Не удалось связаться с GigaChat или получить полный ответ. Текущие тексты сохранены.');
}
function identity(config){return createHash('sha256').update(config.key+'|'+config.scope+'|'+(config.caBundle||'')).digest('hex')}
async function token(config,send){
  const id=identity(config),cached=tokens.get(id);if(cached&&cached.expires>Date.now()+60000)return cached.token;
  const response=await send(oauth,{method:'POST',headers:{Authorization:'Basic '+config.key,RqUID:randomUUID(),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({scope:config.scope||'GIGACHAT_API_PERS'}).toString()});
  if(!response.ok)throw checkedError(response.status);
  const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token||/[\s\x00-\x1f]/.test(data.access_token))throw new Error('Invalid OAuth response');
  let expires=Number(data.expires_at);expires=expires<1e11?expires*1000:expires;
  tokens.set(id,{token:data.access_token,expires:Number.isFinite(expires)?expires:Date.now()+25*60000});return data.access_token;
}
async function api(config,path,options,send){
  for(let attempt=0;attempt<2;attempt++){
    const access=await token(config,send),response=await send(base+path,{...options,headers:{...options.headers,Authorization:'Bearer '+access,Accept:'application/json'}});
    if(response.status===401&&attempt===0){tokens.delete(identity(config));continue}
    if(!response.ok)throw checkedError(response.status);return response.json();
  }
}
export async function gigaTranslationJSON(config,request,{fetchImpl}={}){
  try{
    const send=transport(config,fetchImpl),data=await api(config,'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(gigaTranslationBody({...request,model:config.model}))},send);
    return parseGigaTranslation(data);
  }catch(error){throw safeError(error)}
}
export async function gigaAccount(config,{fetchImpl}={}){
  try{const send=transport(config,fetchImpl);return {models:await api(config,'/models',{},send),balance:await api(config,'/balance',{},send)}}catch(error){throw safeError(error)}
}
