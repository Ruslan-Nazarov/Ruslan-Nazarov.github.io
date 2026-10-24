import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText} from '../scripts/editor-language-ai.mjs';
const config={key:'test-key-not-for-output',model:'gpt-5-mini'};
const response=value=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]})});

test('translation sends only the selected field and keeps credentials server-side',async()=>{
  const result=await translateText('.', {text:'Привет, {name}!',label:'Заголовок',format:'text'},{config,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer '+config.key);
    const request=JSON.parse(options.body);assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
    assert.ok(!options.body.includes(config.key));assert.ok(!options.body.includes('unrelated-document'));
    const input=JSON.parse(request.input);assert.deepEqual(Object.keys(input),['field','segments']);
    return response({translations:input.segments.map(segment=>segment.replace('Привет','Hello'))});
  }});
  assert.equal(result.translation,'Hello, {name}!');assert.ok(!JSON.stringify(result).includes(config.key));
});

test('missing configuration, invalid input, partial results and provider failures never replace text',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return response({translations:[]})};
  await assert.rejects(translateText('.',{text:' '},{config,fetchImpl}),/русский текст/);
  await assert.rejects(translateText('.',{text:'Привет',other:'not selected'},{config,fetchImpl}),/русский текст/);
  await assert.rejects(translateText('.',{text:'Привет'},{config:{key:'',model:config.model},fetchImpl}),/не подключён/);assert.equal(calls,0);
  await assert.rejects(translateText('.',{text:'Привет'},{config,fetchImpl}),/неполный/);
  await assert.rejects(translateText('.',{text:'Привет {name}'},{config,fetchImpl:async()=>response({translations:['Hello']})}),/защищённые/);
  await assert.rejects(translateText('.',{text:'Привет'},{config,fetchImpl:async()=>({ok:false,status:401})}),error=>error.message.includes('недействителен')&&!error.message.includes(config.key));
  await assert.rejects(translateText('.',{text:'Привет'},{config,fetchImpl:async()=>{throw Error(config.key)}}),error=>!error.message.includes(config.key));
  await assert.rejects(translateText('.',{text:'Привет'},{config,fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/неполный/);
});

test('long fields use bounded sequential requests and produce a complete result',async()=>{
  const text='Текст статьи. '.repeat(2200);let calls=0;
  const result=await translateText('.',{text},{config,fetchImpl:async(url,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).input);assert.ok(input.segments.join('').length<16000);return response({translations:input.segments})}});
  assert.ok(calls>1);assert.equal(result.translation,text);
});
