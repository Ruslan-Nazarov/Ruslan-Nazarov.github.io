import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {translationConfig,translationStatus} from '../scripts/translation-provider.mjs';
import {translateText} from '../scripts/editor-language-ai.mjs';
const reply=data=>({ok:true,status:200,json:async()=>data});
const config={provider:'gigachat',key:'fake-giga-secret',scope:'GIGACHAT_API_PERS',model:'GigaChat-3-Ultra'};
test('GigaChat translates only the selected text, caches OAuth and never falls back to OpenAI',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push(url);
    if(url.includes('/oauth')){assert.equal(options.headers.Authorization,'Basic '+config.key);assert.match(options.headers.RqUID,/^[a-f0-9-]{36}$/);return reply({access_token:'fake-access-token',expires_at:Date.now()+1800000})}
    assert.equal(url,'https://api.giga.chat/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer fake-access-token');assert.ok(!options.body.includes(config.key));
    const body=JSON.parse(options.body);assert.equal(body.model,'GigaChat-3-Ultra');assert.equal(body.response_format.strict,true);assert.ok(!body.messages.some(message=>message.attachments));
    const input=JSON.parse(body.messages[1].content);assert.deepEqual(Object.keys(input),['segments']);assert.deepEqual(body.response_format.schema.properties.translations.required,input.segments.map(segment=>segment.id));
    return reply({choices:[{finish_reason:'stop',message:{content:JSON.stringify({translations:Object.fromEntries(input.segments.map(segment=>[segment.id,segment.text.replace('Привет','Hello')]))})}}]});
  };
  for(let i=0;i<2;i++){const result=await translateText('.',{text:'Привет {name}'},{config,fetchImpl});assert.equal(result.translation,'Hello {name}');assert.equal(result.provider,'GigaChat');assert.ok(!JSON.stringify(result).includes('fake-'))}
  assert.equal(calls.filter(url=>url.includes('/oauth')).length,1);assert.equal(calls.length,3);
});
test('GigaChat failures redact secrets, reject incomplete output and refresh an expired token once',async()=>{
  for(const status of [401,403,429])await assert.rejects(translateText('.',{text:'Привет'},{config:{...config,key:'failure-'+status},fetchImpl:async()=>({ok:false,status,json:async()=>({error:'secret'})})}),error=>!error.message.includes('secret')&&/GigaChat/.test(error.message));
  let auth=0,requests=0;
  const result=await translateText('.',{text:'Привет'},{config:{...config,key:'refresh-key'},fetchImpl:async url=>{
    if(url.includes('/oauth'))return reply({access_token:'token-'+(++auth),expires_at:Date.now()+1800000});
    if(++requests===1)return {ok:false,status:401};
    return reply({choices:[{finish_reason:'stop',message:{content:'{"translations":{"s0":"Hello"}}'}}]});
  }});
  assert.equal(result.translation,'Hello');assert.equal(auth,2);assert.equal(requests,2);
  await assert.rejects(translateText('.',{text:'Привет'},{config:{...config,key:'broken-answer'},fetchImpl:async url=>url.includes('/oauth')?reply({access_token:'token',expires_at:Date.now()+1800000}):reply({choices:[{finish_reason:'length',message:{content:'private raw answer'}}]})}),error=>!error.message.includes('private'));
});
test('server configuration reuses a credential file and resolves its CA path without exposing either',()=>{
  mkdirSync('.local/tests',{recursive:true});const root=mkdtempSync(resolve('.local/tests/giga-config-'));mkdirSync(resolve(root,'.local'));
  writeFileSync(resolve(root,'.env'),'GIGACHAT_AUTH_KEY=fake-config-secret\nGIGACHAT_CA_BUNDLE=certs/ca.pem\n');
  writeFileSync(resolve(root,'.local/translation-ai.json'),JSON.stringify({provider:'gigachat',model:'GigaChat-3-Ultra',credentialFile:'.env'}));
  const config=translationConfig(root,{});assert.equal(config.key,'fake-config-secret');assert.equal(config.caBundle,resolve(root,'certs/ca.pem'));assert.equal(config.scope,'GIGACHAT_API_PERS');
  const status=translationStatus(root);assert.deepEqual(Object.keys(status),['configured','provider','model']);assert.ok(!JSON.stringify(status).includes('secret'));assert.equal(translationConfig(root,{MEDIA_AI_DISABLED:'1'}).key,'');
});
test('fragment IDs retain the right heading and link label even when response keys are reordered',async()=>{
  const result=await translateText('.',{text:'## Первый\n\nВторой $x=1$ и [ссылка](https://example.org/).',format:'markdown',label:'Do not translate this label'},{config:{...config,key:'ordering-key'},fetchImpl:async(url,options)=>{
    if(url.includes('/oauth'))return reply({access_token:'ordering-token',expires_at:Date.now()+1800000});
    const input=JSON.parse(JSON.parse(options.body).messages[1].content);assert.ok(!JSON.stringify(input).includes('Do not translate'));
    const dictionary={Первый:'First',Второй:'Second',и:'and',ссылка:'link'};
    return reply({choices:[{finish_reason:'stop',message:{content:JSON.stringify({translations:Object.fromEntries(input.segments.toReversed().map(segment=>[segment.id,dictionary[segment.text]||segment.text]))})}}]});
  }});
  assert.equal(result.translation,'## First\n\nSecond $x=1$ and [link](https://example.org/).');
});
