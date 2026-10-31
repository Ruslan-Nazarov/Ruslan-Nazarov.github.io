import test from 'node:test';
import assert from 'node:assert/strict';
import {assetSchema,readLibrary,resolveMedia,mediaForPath} from '../src/lib/media.mjs';

test('language pages select the translated screenshot and retain Russian-only examples',()=>{
  assert.equal(resolveMedia('time-management-overview',undefined,'ru').path,'/media/time-management/overview-ru.png');
  assert.equal(resolveMedia('time-management-overview',undefined,'en').path,'/media/time-management/overview-en.png');
  assert.equal(resolveMedia('papanda-editor',undefined,'en').path,'/media/papanda/transformers-editor-ru.png');
  assert.equal(mediaForPath('/media/time-management/overview-en.png').id,'time-management-demo-overview');
});

test('translated asset paths obey the same local-image boundary as originals',()=>{
  const asset=readLibrary().items.find(item=>item.path_en);
  for(const path_en of ['https://example.com/image.png','/media/../secret.png','/media/image.html'])
    assert.equal(assetSchema.safeParse({...asset,path_en}).success,false);
});
