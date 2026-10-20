import type { APIRoute } from 'astro';
import {getCollection,site,localize,pathFor} from '../../lib/content.mjs';
export function getStaticPaths(){return [{params:{lang:'ru'}},{params:{lang:'en'}}]}
const escape=(value:string)=>value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export const GET:APIRoute=({params})=>{
  const lang=params.lang!;
  const rows=getCollection('journal').slice().sort((a:any,b:any)=>b.date.localeCompare(a.date));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escape(site.name+' — '+site[lang].journal)}</title><link>https://ruslan-nazarov.github.io/${lang}/journal/</link><description>${escape(site[lang].heroText)}</description><language>${lang}</language><atom:link href="https://ruslan-nazarov.github.io/${lang}/rss.xml" rel="self" type="application/rss+xml"/>${rows.map((r:any)=>`<item><title>${escape(localize(r,'title',lang))}</title><link>https://ruslan-nazarov.github.io${pathFor('journal',r,lang)}</link><guid isPermaLink="false">${r.id}-${lang}</guid><pubDate>${new Date(r.date+'T12:00:00Z').toUTCString()}</pubDate><description>${escape(localize(r,'summary',lang))}</description>${r.researchAreas.map((a:string)=>`<category>${escape(a)}</category>`).join('')}</item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
