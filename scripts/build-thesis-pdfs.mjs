import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {unified} from 'unified';
import parse from 'remark-parse';
import gfm from 'remark-gfm';
import {allContent} from '../src/lib/content.mjs';

const parser=unified().use(parse).use(gfm);
const text=node=>node.type==='text'?node.value:node.children?.map(text).join('')||'';
const chapters=allContent().theses;
if(chapters.length!==5||chapters.some(c=>c.editorialStatus!=='final'))throw new Error('PDF export requires five final bilingual chapters');
const documents=['ru','en'].map(lang=>({lang,blocks:chapters.flatMap(chapter=>parser.parse(chapter[`body_${lang}`]).children.map(node=>{
  if(!['heading','paragraph'].includes(node.type)||node.children.some(n=>n.type!=='text'))throw new Error(`Unsupported manuscript formatting in ${chapter.id}; extend the PDF renderer before exporting`);
  return {type:node.type,depth:node.depth,text:text(node)};
}))}));
mkdirSync('.local/theses-pdf',{recursive:true});
mkdirSync('output/pdf',{recursive:true});
const input=resolve('.local/theses-pdf/source.json');
writeFileSync(input,JSON.stringify({draft:!process.argv.includes('--release'),documents},null,2)+'\n');
const result=spawnSync(process.env.PDF_PYTHON||'python',[resolve('scripts/build-thesis-pdfs.py'),input,resolve('output/pdf')],{stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
for(const lang of ['ru','en'])copyFileSync(`output/pdf/theses-${lang}.pdf`,`public/theses/october-2026/theses-${lang}.pdf`);
