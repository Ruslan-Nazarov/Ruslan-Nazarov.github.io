import {markdown} from './markdown.mjs';

// Use the manuscript headings and the renderer's own IDs, rather than the
// five storage groups that predate publication of the full manuscript.
export async function thesisContents(chapters, lang) {
  const contents=[];
  for(const chapter of chapters){
    const headings=[];
    await markdown(chapter[`body_${lang}`]||'', {headings,headingPrefix:`chapter-${chapter.id}-`});
    const sections=chapter.editorialStatus==='final'?headings.filter(h=>h.level===2):[];
    if(sections.length){
      contents.push(...sections.map(h=>({...h,subsection:/^(?:Подраздел|Subsection)\s+\d+\.\d+/u.test(h.title)})));
    }else{
      contents.push({id:`chapter-${chapter.id}`,title:chapter[`title_${lang}`],subsection:false});
    }
  }
  return contents;
}
