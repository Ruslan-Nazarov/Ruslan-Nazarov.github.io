import { unified } from 'unified';
import parse from 'remark-parse';
import gfm from 'remark-gfm';
import math from 'remark-math';
import rehype from 'remark-rehype';
import sanitize, { defaultSchema } from 'rehype-sanitize';
import katex from 'rehype-katex';
import stringify from 'rehype-stringify';

// Heading IDs and the contents list come from the same parsed document.
// A shared accumulator also keeps IDs unique across embedded media blocks.
function headingLinks(){return (tree,file)=>{
  const headings=file.data.headings;
  if(!headings)return;
  const text=node=>node.value||node.children?.map(text).join('')||'';
  const walk=node=>{
    if(node.type==='element'&&/^h[23]$/.test(node.tagName)){
      const title=text(node),base=(file.data.headingPrefix||'section-')+(title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'heading');
      let id=base,n=2;while(headings.some(h=>h.id===id))id=base+'-'+n++;
      node.properties={...node.properties,id};headings.push({id,title,level:Number(node.tagName[1])});
    }
    node.children?.forEach(walk);
  };walk(tree);
};}

// Strip unsafe HTML/URLs before generating trusted KaTeX markup.
const processor=unified().use(parse).use(gfm).use(math).use(rehype).use(sanitize,{
  ...defaultSchema, attributes:{...defaultSchema.attributes, code:[...(defaultSchema.attributes.code||[]),['className',/^language-./,'math-inline','math-display']]}
}).use(headingLinks).use(katex,{trust:false,strict:'warn',throwOnError:false,maxExpand:1000}).use(stringify);
export async function markdown(text='',data={}){return String(await processor.process({value:text,data}));}
