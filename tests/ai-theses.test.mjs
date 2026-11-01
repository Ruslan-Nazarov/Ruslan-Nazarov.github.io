import test from 'node:test';
import assert from 'node:assert/strict';
import {allContent,routes} from '../src/lib/content.mjs';
import {aiThesesExcerpt} from '../src/lib/ai-theses.mjs';
import {navigation} from '../src/lib/navigation.mjs';
import {pageMaterials} from '../src/lib/page-materials.mjs';

test('AI page takes only the complete quote from point 12 of the common manuscript',()=>{
  const data=allContent(),chapter=data.theses.find(c=>c.id==='artificial-intelligence');
  const page=data.pages.find(p=>p.id==='ai-theses');
  assert.ok(routes().includes('ai-theses'));
  assert.ok(navigation.some(item=>item.path==='ai-theses'));
  for(const record of [page,chapter]){
    const materials=pageMaterials(record,data);
    for(const id of ['dialectic-ai','ai-algorithm','data-science-handbook'])assert.ok(materials.some(ref=>ref.id===id));
  }
  for(const lang of ['ru','en']){
    const body=chapter[`body_${lang}`],quote=aiThesesExcerpt(chapter,lang);
    const [open,close]=lang==='ru'?['«','»']:['“','”'];
    assert.ok(quote.startsWith('1. '));
    assert.ok(quote.includes('3\\.10 '));
    assert.ok(quote.includes('5\\.2 '));
    assert.ok(body.includes(open+quote+close+'\n\n13\\.'));
    assert.ok(!quote.includes('12\\.')&&!quote.includes('13\\.'));
    assert.ok(page[`body_${lang}`].includes(`/${lang}/publications/theses-2020-2026/full/#chapter-artificial-intelligence`));
    const updated={...chapter,[`body_${lang}`]:body.replace(open+'1. ',open+'1. Updated ')};
    assert.ok(aiThesesExcerpt(updated,lang).startsWith('1. Updated '));
    assert.throws(()=>aiThesesExcerpt({...chapter,[`body_${lang}`]:body.replace('12\\.','99\\.')},lang),/point 12/);
  }
});
