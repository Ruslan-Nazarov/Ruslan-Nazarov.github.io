import test from 'node:test';
import assert from 'node:assert/strict';
import {authorshipOf,validateAuthorship} from '../src/lib/authorship.mjs';
import {entrySchema,resolvePublication,readJSON} from '../src/lib/content.mjs';
import {assetSchema,slotSchema,readLibrary} from '../src/lib/media.mjs';
import {publicGraph} from '../src/lib/graph.mjs';

test('authorship is explicit, language-specific and follows the published revision',()=>{
  const row=readJSON('src/content/projects/papanda.json');
  assert.equal(authorshipOf(row,'body_ru'),undefined);
  row._authorship={body_ru:'ai',body_en:'human'};
  row.links[0]._authorship={label_ru:'ai'};
  const parsed=entrySchema.parse(row);
  assert.equal(parsed.links[0]._authorship.label_ru,'ai');
  const draft={...parsed,ready_en:false,_authorship:{body_ru:'human',body_en:'ai'}};
  assert.deepEqual(resolvePublication(draft,parsed)._authorship,row._authorship);
  assert.equal(authorshipOf(resolvePublication({...draft,ready_en:true},parsed),'body_en'),'ai');
  assert.throws(()=>validateAuthorship({ru:{_authorship:{heroTitle:'guessed'}}}));
  assert.throws(()=>entrySchema.parse({...row,_authorship:{body_ru:'guessed'}}));
});

test('media and slot parsing retain independent caption and alt authorship',()=>{
  const slot=readLibrary().slots[0];
  const _authorship={caption_ru:'ai',alt_en:'human'};
  assert.deepEqual(slotSchema.parse({...slot,_authorship})._authorship,_authorship);
  const asset={id:'test-image',path:'/media/shared/test.png',title:'Test',alt_ru:'',alt_en:'',caption_ru:'',caption_en:'',tags:[],project:'',uploadedAt:new Date().toISOString(),_authorship};
  assert.deepEqual(assetSchema.parse(asset)._authorship,_authorship);
});

test('graph authorship follows the visible annotation and never bypasses owner approval',()=>{
  const node={id:'node',originalKey:'private',type:'качество',researchStatus:'черновик',title_ru:'Узел',title_en:'Node',explanation_ru:'Source',explanation_en:'Source',predecessors:[],formula:''};
  const graph={schemaVersion:1,nodes:[node],edges:[]};
  const override={id:'node',annotation_ru:'Annotation',annotation_en:'',_authorship:{annotation_ru:'ai',annotation_en:'ai',extra_en:'human'}};
  assert.equal(publicGraph(graph,[override]).nodes.length,0);
  const visible=publicGraph(graph,[{...override,approvedForPublication:true}]).nodes[0];
  assert.equal(visible._authorship.explanation_ru,'ai');
  assert.equal(visible._authorship.explanation_en,undefined);
  assert.equal(visible.researchStatus,'черновик');
  assert.equal(visible._authorship.extra_en,'human');
});
