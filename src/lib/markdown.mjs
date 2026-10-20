import { unified } from 'unified';
import parse from 'remark-parse';
import gfm from 'remark-gfm';
import math from 'remark-math';
import rehype from 'remark-rehype';
import sanitize, { defaultSchema } from 'rehype-sanitize';
import katex from 'rehype-katex';
import stringify from 'rehype-stringify';

// Strip unsafe HTML/URLs before generating trusted KaTeX markup.
const processor=unified().use(parse).use(gfm).use(math).use(rehype).use(sanitize,{
  ...defaultSchema, attributes:{...defaultSchema.attributes, code:[...(defaultSchema.attributes.code||[]),['className',/^language-./,'math-inline','math-display']]}
}).use(katex,{trust:false,strict:'warn',throwOnError:false,maxExpand:1000}).use(stringify);
export async function markdown(text=''){return String(await processor.process(text));}
