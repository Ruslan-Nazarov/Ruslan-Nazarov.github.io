import { unified } from 'unified';
import parse from 'remark-parse';
import gfm from 'remark-gfm';
import math from 'remark-math';
import rehype from 'remark-rehype';
import sanitize, { defaultSchema } from 'rehype-sanitize';
import katex from 'rehype-katex';
import stringify from 'rehype-stringify';
import editorAlign from './remark-editor-align.mjs';

// Heading IDs and the contents list come from the same parsed document.
// A shared accumulator also keeps IDs unique across embedded media blocks.
function blogLinks(){return (tree,file)=>{
  if(!file.data.externalLinksOnly)return;
  const walk=node=>{
    if(node.tagName==='a'&&!/^(https?:|mailto:)/i.test(node.properties?.href||'')){
      node.tagName='span';node.properties={};
    }
    if(node.tagName==='img'&&!/^https?:/i.test(node.properties?.src||'')){
      node.tagName='span';node.children=[{type:'text',value:node.properties?.alt||''}];node.properties={};
    }
    node.children?.forEach(walk);
  };walk(tree);
};}
function headingLinks(){return (tree,file)=>{
  const headings=file.data.headings;
  const text=node=>node.value||node.children?.map(text).join('')||'';
  const walk=node=>{
    // The page already supplies its h1; imported document titles are sections.
    if(node.type==='element'&&node.tagName==='h1')node.tagName='h2';
    if(headings&&node.type==='element'&&/^h[23]$/.test(node.tagName)){
      const title=text(node),base=(file.data.headingPrefix||'section-')+(title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'heading');
      let id=base,n=2;while(headings.some(h=>h.id===id))id=base+'-'+n++;
      node.properties={...node.properties,id};headings.push({id,title,level:Number(node.tagName[1])});
    }
    node.children?.forEach(walk);
  };walk(tree);
};}

// Strip unsafe HTML/URLs before generating trusted KaTeX markup.
const processor=unified().use(parse).use(gfm).use(math).use(editorAlign).use(rehype).use(sanitize,{
  ...defaultSchema, attributes:{...defaultSchema.attributes, code:[...(defaultSchema.attributes.code||[]),['className',/^language-./,'math-inline','math-display']]}
}).use(blogLinks).use(headingLinks).use(katex,{trust:false,strict:'warn',throwOnError:false,maxExpand:1000}).use(stringify);
export async function markdown(text='',data={}){return String(await processor.process({value:text,data}));}
