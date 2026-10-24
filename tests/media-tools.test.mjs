import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {uploadMedia,localMediaPath} from '../scripts/media-library.mjs';
import {photoInfo,editPhoto,restorePhoto,transformPhoto} from '../scripts/media-edit.mjs';
import {aiConfig,aiStatus,describeMedia} from '../scripts/media-ai.mjs';
const rootFor=()=>{mkdirSync('.local/tests',{recursive:true});const root=mkdtempSync(resolve('.local/tests/photo-'));mkdirSync(resolve(root,'src/data'),{recursive:true});mkdirSync(resolve(root,'.local'));writeFileSync(resolve(root,'src/data/media.json'),' {"items":[],"slots":[]}');return root;};
// Four quadrants allow us to check order and direction, not just output dimensions.
const pixels=Buffer.alloc(80*40*3);for(let y=0;y<40;y++)for(let x=0;x<80;x++){const i=(y*80+x)*3;pixels[i]=x<40?220:20;pixels[i+1]=y<20?50:210;pixels[i+2]=30;}
const bytes=await sharp(pixels,{raw:{width:80,height:40,channels:3}}).png().toBuffer();
const file={name:'quadrants.png',mime:'image/png',base64:bytes.toString('base64')};
test('photo editing rotates, reflects and then crops the same coordinates as the preview',async()=>{
  const edited=await transformPhoto(bytes,{rotation:90,flipX:true,crop:{x:0,y:0,width:.5,height:.5}},'.png');
  const {data,info}=await sharp(edited).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,20);assert.equal(info.height,40);
  assert.deepEqual([...data.subarray(0,3)],[220,50,30]);
  const brighter=await transformPhoto(bytes,{brightness:1.2,contrast:1},'.png');
  assert.ok((await sharp(brighter).stats()).channels[1].mean>(await sharp(bytes).stats()).channels[1].mean);
  await assert.rejects(transformPhoto(bytes,{crop:{x:.9,y:0,width:.5,height:1}},'.png'));
  await assert.rejects(transformPhoto(bytes,{rotation:45},'.png'));
});
test('copy, replacement, original recovery and stale-revision rejection preserve user data',async()=>{
  const root=rootFor(),item=await uploadMedia(root,{...file,title:'Original',_authorship:{caption_ru:'ai'}});
  const before=await photoInfo(root,{id:item.id});assert.equal(before.canRestore,false);
  const request={id:item.id,revision:before.revision,edit:{crop:{x:0,y:0,width:.5,height:1}},mode:'copy'};
  const copy=await editPhoto(root,request);assert.notEqual(copy.item.id,item.id);assert.equal(copy.item._authorship.caption_ru,'ai');
  assert.ok(readFileSync(localMediaPath(root,item.path)).equals(bytes));
  const replacement=await editPhoto(root,{...request,mode:'replace'});assert.equal(replacement.item.path,item.path);
  assert.equal((await sharp(readFileSync(localMediaPath(root,item.path))).metadata()).width,40);
  assert.ok(existsSync(resolve(root,'.local/media-originals',item.id+'.png')));
  await assert.rejects(editPhoto(root,{...request,mode:'replace'}),/изменилось/);
  const current=await photoInfo(root,{id:item.id});assert.equal(current.canRestore,true);
  await restorePhoto(root,{id:item.id,revision:current.revision});assert.ok(readFileSync(localMediaPath(root,item.path)).equals(bytes));
  const draft=await photoInfo(root,file);const changed=await editPhoto(root,{...file,revision:draft.revision,mode:'draft',edit:{rotation:90}});
  assert.equal((await sharp(Buffer.from(changed.file.base64,'base64')).metadata()).width,40);
});
test('EXIF orientation is normalized before crop; SVG and animation are not silently rasterized for editing',async()=>{
  const jpeg=await sharp(bytes).jpeg().withMetadata({orientation:6}).toBuffer(),root=rootFor();
  const info=await photoInfo(root,{name:'camera.jpg',mime:'image/jpeg',base64:jpeg.toString('base64')});
  assert.equal(info.width,40);assert.equal(info.height,80);
  await assert.rejects(photoInfo(root,{name:'vector.svg',mime:'image/svg+xml',base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>').toString('base64')}),/PNG, JPEG/);
});
const generated={title:'Цветные квадранты',alt_ru:'Четыре цветных прямоугольника.',alt_en:'Four coloured rectangles.',caption_ru:'Цветовая схема.',caption_en:'Colour diagram.',tags:['схема','цвет']};
test('AI requests use server credentials and validated structured fields; credentials never enter results',async()=>{
  const root=rootFor();writeFileSync(resolve(root,'.env'),'OPENAI_API_KEY=test-secret-never-display\n');
  const config=aiConfig(root,{});assert.equal(config.key,'test-secret-never-display');assert.equal(aiConfig(root,{MEDIA_AI_DISABLED:'1'}).key,'');
  assert.ok(!JSON.stringify(aiStatus(root)).includes('test-secret'));
  let called=false;
  const result=await describeMedia(root,{...file,context:{note:'Test diagram'}},{config,fetchImpl:async(url,options)=>{
    called=true;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-secret-never-display');
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.match(body.input[0].content[1].image_url,/^data:image\/jpeg;base64,/);
    assert.ok(!options.body.includes(config.key));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(generated)}]}]})};
  }});
  assert.ok(called);assert.deepEqual(result.metadata,generated);assert.ok(!JSON.stringify(result).includes(config.key));
  await assert.rejects(describeMedia(root,file,{config,fetchImpl:async()=>({ok:false,status:401,text:async()=>config.key})}),error=>error.message.includes('недействителен')&&!error.message.includes(config.key));
  await assert.rejects(describeMedia(root,file,{config,fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/полный набор/);
});
