import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {publishContent} from '../scripts/publish-content.mjs';
function fixture(){
  mkdirSync('.local/tests',{recursive:true});
  const dir=mkdtempSync(resolve('.local/tests/publish-')),remote=join(dir,'remote.git'),root=join(dir,'working');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  mkdirSync(root);execFileSync('git',['init','--bare',remote],{stdio:'pipe'});
  git('init','-b','main');git('config','user.name','Publish test');git('config','user.email','test@example.invalid');git('remote','add','origin',remote);
  mkdirSync(join(root,'src/data'),{recursive:true});writeFileSync(join(root,'src/data/site.json'),'{}\n');
  git('add','.');git('commit','-m','Initial');git('push','-u','origin','main');
  return {root,remote,git,options:{root,expectedRemote:remote},write:(path,text)=>{mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(join(root,path),text)}};
}
test('editor publication commits content and pushes main only after successful build',async()=>{
  const f=fixture();f.write('src/data/site.json','{"name":"Updated"}\n');
  let built=false;
  const result=await publishContent({...f.options,build:async()=>{built=true;f.write('src/data/published.json','{"snapshot":true}\n')}});
  assert.equal(built,true);assert.match(result.message,/отправлены/);
  assert.equal(f.git('rev-parse','HEAD').trim(),f.git('rev-parse','origin/main').trim());
  assert.match(f.git('show','origin/main:src/data/published.json'),/snapshot/);
  const again=await publishContent({...f.options,build:async()=>{}});
  assert.match(again.message,/Новых изменений нет/);
});
test('publisher rejects protected verification files and staged code before building',async()=>{
  for(const path of ['yandex_64f199e3e08207c6.html','scripts/changed-code.mjs']){
    const f=fixture();f.write(path,'protected');f.git('add',path);
    await assert.rejects(publishContent({...f.options,build:async()=>assert.fail('Build must not run')}),/вне материалов/);
  }
});
test('failed build does not create or push a content commit',async()=>{
  const f=fixture(),before=f.git('rev-parse','HEAD').trim();f.write('src/data/site.json','{"name":"Draft"}\n');
  await assert.rejects(publishContent({...f.options,build:async()=>{throw new Error('Broken translation')}}),/Broken translation/);
  assert.equal(f.git('rev-parse','HEAD').trim(),before);assert.equal(f.git('rev-parse','origin/main').trim(),before);
  assert.match(readFileSync(join(f.root,'src/data/site.json'),'utf8'),/Draft/);
});
test('new upstream commits stop publication without overwriting local edits',async()=>{
  const f=fixture(),before=f.git('rev-parse','HEAD').trim();
  f.write('src/data/ui.json','{}\n');f.git('add','.');f.git('commit','-m','Remote edit');f.git('push','origin','main');
  f.git('reset','--hard',before);f.write('src/data/site.json','{"local":true}\n');
  await assert.rejects(publishContent({...f.options,build:async()=>assert.fail('Build must not run')}),/На GitHub есть новые изменения/);
  assert.match(readFileSync(join(f.root,'src/data/site.json'),'utf8'),/local/);
  assert.notEqual(f.git('rev-parse','origin/main').trim(),before);
});
