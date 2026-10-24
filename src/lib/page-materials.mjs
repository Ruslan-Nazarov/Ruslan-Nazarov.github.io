// Shared by the public templates and the local editor.
export const materialKey=ref=>`${ref.collection}/${ref.id}`;
export function pageMaterials(record,data,{collection=record?.collection,catalogue=undefined}={}){
  if(!record)return [];
  const refs=[...(catalogue?(data[catalogue]||[]).filter(row=>!(record.excludedMaterials||[]).includes(row.id)).map(row=>({collection:catalogue,id:row.id})):[]),...(record.materials||[])];
  for(const [field,target] of Object.entries({relatedProjects:'projects',relatedPublications:'publications',relatedJournal:'journal'})){
    for(const row of data[target]||[])if(record[field]?.includes(row.id)||collection==='research'&&row.researchAreas?.includes(record.id)||collection==='projects'&&row.relatedProjects?.includes(record.id))refs.push({collection:target,id:row.id});
  }
  for(const [target,rows] of Object.entries(data))for(const row of rows)if(collection==='research'&&row.researchAreas?.includes(record.id)||collection==='projects'&&row.relatedProjects?.includes(record.id))refs.push({collection:target,id:row.id});
  const hidden=new Set((record.hiddenMaterials||[]).map(materialKey)),seen=new Set();
  return refs.filter(ref=>{const key=materialKey(ref);if(key===`${collection}/${record.id}`||hidden.has(key)||seen.has(key))return false;seen.add(key);return data[ref.collection]?.some(row=>row.id===ref.id)});
}
export function materialHref(collection,row,lang){
  if(row.readingMode==='external'&&row.links?.[0]?.url)return row.links[0].url;
  if(collection==='theses')return `/${lang}/publications/theses-2020-2026/chapters/${row.slug}/`;
  if(collection==='pages')return `/${lang}/${row.pagePath||(row.id==='dialectical-notes'?'projects/papanda/'+row.slug:row.slug)}/`;
  return `/${lang}/${collection}/${row.slug}/`;
}
