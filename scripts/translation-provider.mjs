// Server-only translation settings. Reuse credentials without copying their values.
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
export function translationConfig(root,env=process.env){
  if(env.MEDIA_AI_DISABLED==='1')return {provider:'openai',model:'gpt-5-mini',key:''};
  const file=resolve(root,'.local/translation-ai.json'),fallback=resolve(root,'.local/media-ai.json');
  const local=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):existsSync(fallback)?JSON.parse(readFileSync(fallback,'utf8')):{};
  const credentialFile=resolve(root,local.credentialFile||'.env'),credentials=existsSync(credentialFile)?parseEnv(readFileSync(credentialFile,'utf8')):{};
  const provider=env.TRANSLATION_AI_PROVIDER||local.provider||'openai';
  if(!['gigachat','openai'].includes(provider))throw new Error('Неизвестный провайдер перевода.');
  if(provider==='openai')return {provider,key:env.OPENAI_API_KEY||credentials.OPENAI_API_KEY||'',model:env.TRANSLATION_AI_MODEL||local.model||credentials.DIALECTIC_OPENAI_MODEL||'gpt-5-mini'};
  const ca=env.GIGACHAT_CA_BUNDLE||local.caBundle||credentials.GIGACHAT_CA_BUNDLE;
  return {provider,key:(env.GIGACHAT_CREDENTIALS||env.GIGACHAT_AUTH_KEY||credentials.GIGACHAT_CREDENTIALS||credentials.GIGACHAT_AUTH_KEY||'').replace(/^Basic\s+/i,'').trim(),model:env.TRANSLATION_AI_MODEL||local.model||'GigaChat-3-Ultra',scope:env.GIGACHAT_SCOPE||local.scope||credentials.GIGACHAT_SCOPE||'GIGACHAT_API_PERS',caBundle:ca?resolve(dirname(credentialFile),ca):null};
}
export const translationProviderName=config=>config.provider==='gigachat'?'GigaChat':'OpenAI';
export function translationStatus(root){const config=translationConfig(root);return {configured:!!config.key,provider:translationProviderName(config),model:config.model}}
