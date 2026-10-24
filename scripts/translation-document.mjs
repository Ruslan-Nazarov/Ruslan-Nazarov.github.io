// Prepare prose for translation and reconstruct the original document structure.
import {randomBytes} from 'node:crypto';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const protectedPattern=/\[\[media:[^\]\r\n]+\]\]|```[\s\S]*?```|`[^`\r\n]+`|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\r\n])+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\{\{[^{}\r\n]+\}\}|\{[a-z_][\w.]*\}/gi;
const escapeMarkdown=text=>text.replace(/[\\`*_{}\[\]<>~#!|]/g,'\\$&').replace(/^(\s*)([-+]|\d+[.)])(?=\s)/gm,'$1\\$2');

export function prepareTranslation(text,format='text'){
  const parts=[],segments=[];
  function add(start,end,content=text.slice(start,end),markdown=false){
    if(!content.trim())return;
    const leading=content.match(/^\s*/)[0],trailing=content.match(/\s*$/)[0];
    content=content.slice(leading.length,content.length-trailing.length);
    const chunks=[];
    // Keep each translatable segment below a bounded response size.
    while(content.length>6000){let split=content.lastIndexOf(' ',6000);if(split<3000)split=6000;chunks.push(content.slice(0,split));content=content.slice(split)}
    chunks.push(content);
    parts.push({start,end,leading,trailing,chunks:chunks.map(source=>{
      const nonce='RN_KEEP_'+randomBytes(8).toString('hex')+'_',keep=[];
      const masked=source.replace(protectedPattern,original=>{const token=nonce+keep.length+'_END';keep.push({token,original});return token});
      const translatable=/\p{L}/u.test(masked.replace(new RegExp(nonce+'\\d+_END','g'),''));
      const index=translatable?segments.push(masked)-1:null;
      return {source,keep,markdown,index};
    })});
  }
  if(format==='text')add(0,text.length);
  else{
    function walk(node){
      if(node.type==='text')add(node.position.start.offset,node.position.end.offset,node.value,true);
      else if(['image','imageReference'].includes(node.type)){
        const start=node.position.start.offset,raw=text.slice(start,node.position.end.offset),alt=raw.match(/^!\[((?:\\.|[^\]\\])*)\]/);
        if(alt)add(start+2,start+2+alt[1].length,node.alt,true);
      }else for(const child of node.children||[])walk(child);
    }
    walk(parser.parse(text));
  }
  return {segments,assemble(translations){
    if(!Array.isArray(translations)||translations.length!==segments.length)throw new Error('Translation segments are incomplete');
    let result=text;
    for(const part of parts.toReversed()){
      if(part.chunks.every(chunk=>chunk.index===null))continue;
      const translated=part.chunks.map(chunk=>{
        if(chunk.index===null)return chunk.source;
        let output=translations[chunk.index];
        if(typeof output!=='string'||!output.trim()||output.length>60000)throw new Error('Empty or invalid translation');
        for(const {token}of chunk.keep)if(output.split(token).length!==2)throw new Error('Protected content changed');
        // Reject a token from another segment as well as missing/duplicated tokens.
        const known=new Set(chunk.keep.map(item=>item.token));
        for(const token of output.match(/RN_KEEP_[a-f0-9]{16}_\d+_END/g)||[])if(!known.has(token))throw new Error('Unexpected protected content');
        if(chunk.markdown)output=escapeMarkdown(output);
        for(const {token,original}of chunk.keep)output=output.replace(chunk.markdown?escapeMarkdown(token):token,()=>original);
        return output;
      }).join('');
      result=result.slice(0,part.start)+part.leading+translated+part.trailing+result.slice(part.end);
    }
    return result;
  }};
}
