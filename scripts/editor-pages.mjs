import {collections,rawCollection,readJSON,pathFor} from '../src/lib/content.mjs';
const target=(collection,name='settings',view)=>({collection,name,...(view?{view}:{})});
export function editorPages(){
  const sections=readJSON('src/data/sections.json');
  const pages=[
    {id:'home',path:'',label:'Главная',target:target('site','settings','home')},
    ...Object.entries(sections).map(([id,row])=>({id,path:id,label:row.title_ru,target:target('sections','settings',id)})),
    {id:'about',path:'about',label:'Об авторе и контакты',target:target('site','settings','about')},
    {id:'timeline',path:'timeline',label:'Хронология',target:target('site','settings','timeline')},
    {id:'legal',path:'legal',label:'Права на материалы',target:target('site','settings','legal')},
    {id:'privacy',path:'privacy',label:'Приватность',target:target('site','settings','privacy')}
  ];
  for(const collection of collections)for(const row of rawCollection(collection))pages.push({
    id:collection+'/'+row.id,path:pathFor(collection,row,'ru').replace(/^\/ru\/|\/$/g,''),
    label:row.title_ru||row.title_en||row.id,target:target(collection,row.id),draft:!row.publish
  });
  return pages.map(page=>({...page,sources:[]}));
}
