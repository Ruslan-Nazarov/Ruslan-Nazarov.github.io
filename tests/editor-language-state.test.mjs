import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getLanguageState,saveLanguageState} from '../scripts/editor-language-state.mjs';
import {parse} from 'yaml';
import vm from 'node:vm';

const sample={ru:'1:12345678:12345678',en:'2:12345678:87654321',seenRu:'1:12345678:12345678',seenEn:'2:12345678:87654321',ruEditedAt:null,enEditedAt:null,syncedAt:null,method:'translation'};
function testRoot(){mkdirSync('.local/tests',{recursive:true});return mkdtempSync(resolve('.local/tests/language-'))}
function clientStore(request){
  const context={window:{},fetch:async()=>({ok:true,json:async()=>({})}),setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(readFileSync('scripts/editor-translation.js','utf8'),context);
  return context.window.createLanguageStateStore('interface/settings',request);
}
test('local edit dates and synchronization marks survive reload without storing prose',()=>{
  mkdirSync('.local/tests',{recursive:true});const root=mkdtempSync(resolve('.local/tests/language-'));
  const state={ru:'1:12345678:12345678',en:'2:12345678:87654321',seenRu:'3:12345678:12345678',seenEn:'2:12345678:87654321',ruEditedAt:'2026-10-24T12:00:00.000Z',enEditedAt:null,syncedAt:null,method:'unverified'};
  const key=JSON.stringify(['ru','heroTitle']);saveLanguageState(root,{scope:'site/settings',fields:{[key]:state}});
  assert.deepEqual(getLanguageState(root,'site/settings'),{fields:{[key]:state}});
  assert.deepEqual(getLanguageState(root,'projects/papanda'),{fields:{}});
  assert.ok(!readFileSync(resolve(root,'.local/editor-language-state.json'),'utf8').includes('Русский текст'));
  assert.throws(()=>getLanguageState(root,'../../outside'));
  assert.throws(()=>saveLanguageState(root,{scope:'site/settings',fields:{[key]:{...state,text:'private prose'}}}));
});

test('all configured bilingual field paths survive metadata save and reload',()=>{
  const root=testRoot(),config=parse(readFileSync('.pages.yml','utf8'));let count=0;
  for(const collection of config.content){
    const fields={};
    function visit(schema,path=[]){for(const field of schema){
      const next=[...path,field.name];
      if(field.fields)visit(field.fields,field.list?[...next,0]:next);
      else if(!field.readonly&&['string','text','rich-text'].includes(field.type)&&(path[0]==='ru'||field.name.endsWith('_ru'))){fields[JSON.stringify(next)]=sample;count++}
    }}
    visit(collection.fields);const scope=collection.name+'/settings';
    saveLanguageState(root,{scope,fields});assert.deepEqual(getLanguageState(root,scope).fields,fields);
  }
  assert.ok(count>0,'At least one editorial translation pair was exercised');
  for(const path of [[],['ru',''],['ru','__proto__'],['constructor'],['prototype'],['ru','line\nbreak'],['gallery',-1],['gallery',0.5]]){
    assert.throws(()=>saveLanguageState(root,{scope:'interface/settings',fields:{[JSON.stringify(path)]:sample}}));
  }
});

test('a temporary metadata read failure can be retried without resetting previous marks',async()=>{
  const key=JSON.stringify(['ru','не выведено']);let reads=0;
  const store=clientStore(async()=>{if(++reads===1)throw Error('temporary');return {fields:{[key]:sample}}});
  await assert.rejects(store.ready,/temporary/);assert.equal(store.loaded,false);
  await Promise.all([store.ready,store.ready]);assert.equal(reads,2);
  assert.equal(store.fields[key].method,'translation');assert.equal(store.loaded,true);
});

test('failed writes retain the newest edit and report unsaved marks until a successful retry',async()=>{
  const key=JSON.stringify(['ru','tag:Personal tool']);let fail=true,release;const sent=[];
  const store=clientStore(async(path,payload)=>{
    if(!payload)return {fields:{}};
    sent.push(payload);if(fail){await new Promise(done=>{release=done});throw Error('temporary')}
    return {saved:true};
  });
  await store.ready;store.save(key,sample);
  const writing=store.flush();while(!release)await new Promise(done=>setImmediate(done));
  assert.equal(store.persistence(key),'pending');
  store.save(key,{...sample,method:'manual'});release();await assert.rejects(writing,/temporary/);
  assert.equal(store.persistence(key),'error');fail=false;await store.flush();
  assert.equal(sent.at(-1).fields[key].method,'manual');assert.equal(store.persistence(key),'saved');
});
