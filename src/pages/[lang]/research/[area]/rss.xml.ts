import type {APIRoute} from 'astro';
import {getCollection,localize,pathFor,site} from '../../../../lib/content.mjs';
export function getStaticPaths(){return ['ru','en'].flatMap(lang=>getCollection('research').map((area:any)=>({params:{lang,area:area.slug},props:{id:area.id,title:localize(area,'title',lang)}})))}
const escape=(text:string)=>text.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export const GET:APIRoute=({params,props})=>{
  const lang=params.lang!;
  const rows=getCollection('journal').filter((row:any)=>row.date).filter((r:any)=>r.researchAreas.includes(props.id)).sort((a:any,b:any)=>b.date.localeCompare(a.date));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escape(site.name+' — '+props.title)}</title><link>https://ruslan-nazarov.github.io/${lang}/research/${params.area}/</link><description>${escape(props.title)}</description><language>${lang}</language><atom:link href="https://ruslan-nazarov.github.io/${lang}/research/${params.area}/rss.xml" rel="self" type="application/rss+xml"/>${rows.map((r:any)=>`<item><title>${escape(localize(r,'title',lang))}</title><link>https://ruslan-nazarov.github.io${pathFor('journal',r,lang)}</link><guid isPermaLink="false">${r.id}-${lang}</guid><pubDate>${new Date(r.date+'T12:00:00Z').toUTCString()}</pubDate><description>${escape(localize(r,'summary',lang))}</description></item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
