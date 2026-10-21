import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {uploadMedia,listLibrary,updateMetadata,bindSlot,deleteMedia,localMediaPath,validateUpload,mediaUsage} from '../scripts/media-library.mjs';
import {readLibrary} from '../src/lib/media.mjs';
import {isEditablePath} from '../scripts/publish-content.mjs';
function fixture(){
  mkdirSync('.local/tests',{recursive:true});const root=mkdtempSync(resolve('.local/tests/media-'));
  for(const dir of ['src/data','src/content/projects','public'])mkdirSync(resolve(root,dir),{recursive:true});
  writeFileSync(resolve(root,'src/data/media.json'),JSON.stringify({items:[],slots:readLibrary().slots}));return root;
}
const png=await sharp({create:{width:20,height:12,channels:4,background:'#a04010'}}).png().toBuffer();
const payload={name:'../снимок ECG.png',mime:'image/png',base64:png.toString('base64'),title:'ECG example',project:'papanda',tags:['ecg','notes'],alt_ru:'Проверка изображения',alt_en:'Image test',caption_ru:'Подпись',caption_en:'Caption'};
test('media upload, discovery, metadata, binding, replacement, persistence and safe deletion',async()=>{
  const root=fixture(),asset=await uploadMedia(root,payload);
  assert.equal(listLibrary(root).items.length,1);assert.match(asset.path,/^\/media\/papanda\/[a-zA-Z0-9_-]+\.png$/);
  assert.equal(readFileSync(localMediaPath(root,asset.path)).equals(png),true);
  const changed=updateMetadata(root,{...asset,title:'Renamed screenshot',alt_en:'Updated alt'});
  assert.equal(readLibrary(root).items[0].alt_en,'Updated alt');
  bindSlot(root,{slotId:'ecg-final',mediaId:asset.id});assert.equal(readLibrary(root).slots.find(x=>x.id==='ecg-final').status,'ready');
  const replacement=await uploadMedia(root,{...payload,replaceId:asset.id});assert.equal(replacement.id,asset.id);assert.equal(replacement.path,asset.path);assert.equal(replacement.title,changed.title);
  const warning=deleteMedia(root,{id:asset.id});assert.equal(warning.confirmationRequired,true);assert.deepEqual(warning.usage.slots,['ecg-final']);assert.ok(existsSync(localMediaPath(root,asset.path)));
  deleteMedia(root,{id:asset.id,confirm:true});assert.equal(readLibrary(root).items.length,0);assert.equal(readLibrary(root).slots.find(x=>x.id==='ecg-final').mediaId,'');assert.ok(!existsSync(localMediaPath(root,asset.path)));
});
test('used files and saved published versions cannot be deleted; file references are retained',async()=>{
  const root=fixture(),asset=await uploadMedia(root,payload);
  for(const path of ['src/content/projects/example.json','src/data/published.json']){
    writeFileSync(resolve(root,path),JSON.stringify({body_ru:`[[media:${asset.id}]]`,heroImage:asset.path}));
    assert.ok(mediaUsage(root,asset).documents.includes(path));
    assert.throws(()=>deleteMedia(root,{id:asset.id,confirm:true}),/Удаление запрещено/);
  }
  assert.ok(existsSync(localMediaPath(root,asset.path)));
});
test('reject MIME/extension spoofing, corrupt bytes, oversized files, unsafe SVG and path traversal',async()=>{
  for(const bad of [{...payload,mime:'text/html'},{...payload,name:'attack.svg'},{...payload,base64:Buffer.from('not a PNG').toString('base64')},{...payload,base64:'a'.repeat(12*1024*1024+4)}])await assert.rejects(validateUpload(bad));
  for(const svg of ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>','<svg width="10" height="10" onload="alert(1)"></svg>','<svg width="10" height="10"><image href="https://example.com/a"/></svg>','<!DOCTYPE svg><svg width="10" height="10"></svg>','<svg width="10" height="10"><rect fill="url(https://example.com)"/></svg>'])await assert.rejects(validateUpload({name:'bad.svg',mime:'image/svg+xml',base64:Buffer.from(svg).toString('base64')}));
  const safe='<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="1" y="1" width="8" height="8" fill="#f00"/></svg>';
  assert.equal((await validateUpload({name:'safe.svg',mime:'image/svg+xml',base64:Buffer.from(safe).toString('base64')})).extension,'.svg');
  const root=fixture();for(const path of ['/media/../../secret.png','//media/a.png','/files/a.pdf'])assert.throws(()=>localMediaPath(root,path));
  await assert.rejects(uploadMedia(root,{...payload,project:'../../outside'}));
});
test('replacement preserves URLs and format; editorial Git allowlist includes media without code',async()=>{
  const root=fixture(),asset=await uploadMedia(root,payload);
  await assert.rejects(uploadMedia(root,{...payload,name:'different.jpg',mime:'image/jpeg',base64:(await sharp(png).jpeg().toBuffer()).toString('base64'),replaceId:asset.id}),/того же формата/);
  assert.equal(isEditablePath('src/data/media.json'),true);assert.equal(isEditablePath('public/media/papanda/example.png'),true);
  for(const path of ['public/media/../secret','src/data/secret.json','scripts/media-library.mjs'])assert.equal(isEditablePath(path),false);
});
test('papanda uses the same seven ordered media IDs in both languages without unconfirmed live/download links',()=>{
  const row=JSON.parse(readFileSync('src/content/projects/papanda.json','utf8'));
  const ids=lang=>[...row['body_'+lang].matchAll(/\[\[media:([a-z0-9-]+)\]\]/g)].map(x=>x[1]);
  assert.deepEqual(ids('ru'),ids('en'));assert.equal(ids('ru').length,7);assert.deepEqual(ids('ru'),readLibrary().slots.map(x=>x.id));
  assert.deepEqual(row.links.map(x=>x.url),['https://github.com/Ruslan-Nazarov/papanda']);
  assert.ok(row.exampleLinks.every(x=>!x.url_ru&&!x.url_en));
  assert.match(row.body_ru,/эксперименты, подтверждающие образовательный эффект papanda на других людях, пока не проводились/);
  assert.match(row.body_en,/studies demonstrating the educational effectiveness of papanda with other participants have not yet been conducted/);
});
