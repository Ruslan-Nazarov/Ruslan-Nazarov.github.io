import {writeFileSync} from 'node:fs';
import {stringify} from 'yaml';
import {readJSON} from '../src/lib/content.mjs';
const f=(name,type='string',extra={})=>({name,label:name,type,...(type==='date'?{default:'',options:{format:'yyyy-MM-dd'}}:{}),...extra});
const bilingual=(key,type='text')=>['ru','en'].map(l=>f(`${key}_${l}`,type));
const list=(name)=>f(name,'string',{list:true});
const objectList=(name,fields)=>f(name,'object',{list:true,fields});
const common=[
  f('id','string',{required:true,pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$',description:'Постоянный ID. Не менять после первого выпуска.'}),
  f('slug','string',{required:true,pattern:'^[a-z0-9]+(?:-[a-z0-9]+)*$'}),
  f('publish','boolean',{default:false,label:'Показывать на сайте',description:'Публично только при готовности обоих языков. Черновики видны в исходном GitHub, но не на сайте.'}),
  f('ready_ru','boolean',{default:false,label:'Русская версия готова'}),
  f('ready_en','boolean',{default:false,label:'English version ready'}),
  ...bilingual('title','string'),...bilingual('summary'),...bilingual('body','rich-text'),
  f('editorialStatus','select',{options:{values:['awaiting_content','editorial_summary','final','external_publication']},default:'awaiting_content'}),
  f('featured','boolean'),f('order','number',{default:100,label:'Порядок отображения'}),f('heroImage','image',{options:{media:'library'}}),
  objectList('gallery',[f('src','image',{options:{media:'library'}}),...bilingual('alt','string')]),
  list('researchAreas'),list('relatedProjects'),list('relatedPublications'),list('relatedJournal'),list('tags'),
  objectList('links',[...bilingual('label','string'),f('url')]),
  objectList('exampleLinks',[f('id'),...bilingual('label','string'),...bilingual('url','string')]),
  objectList('timeline',[f('date','date'),...bilingual('title','string')]),
  f('date','date',{description:'Только реальная дата события или публикации. Оставить пустым, если неизвестна.'})
];
const extras={
  research:[f('symbol'),...bilingual('questions'),...bilingual('openProblems')],
  projects:[f('status','select',{options:{values:['active','completed','paused']},default:'active'}),...bilingual('statusLabel','string'),...bilingual('byline','string'),...bilingual('motto','string')],
  publications:[f('type','select',{options:{values:['book','theses','article','technical-note']}}),f('license'),f('targetDate','date'),f('startedDate','date'),...bilingual('pdf','file')],
  journal:[f('type','select',{options:{values:['news','research-note','experiment','result']}})],
  theses:[], pages:[]
};
const site=readJSON('src/data/site.json'),ui=readJSON('src/data/ui.json');
const config={
  media:[{name:'library',label:'Медиабиблиотека',input:'public/media',output:'/media',extensions:['png','jpg','jpeg','webp','svg','gif']},{name:'images',label:'Images',input:'public/images',output:'/images'},{name:'files',label:'PDF / Files',input:'public/files',output:'/files'}],
  actions:[{name:'release-content',label:'Сохранить полные RU+EN версии перед новой редакцией',workflow:'content-release.yml'}],
  content:[
    {name:'site',label:'Главная / About / настройки',type:'file',path:'src/data/site.json',format:'json',fields:[
      f('name'),f('tagline'),f('portrait','image'),f('email'),f('formEndpoint'),f('cloudflareToken'),
      objectList('profiles',[f('label'),f('url')]),...['ru','en'].map(l=>f(l,'object',{fields:Object.keys(site[l]).map(k=>f(k,k.endsWith('Body')?'rich-text':'text'))}))
    ]},
    {name:'interface',label:'Подписи интерфейса RU / EN',type:'file',path:'src/data/ui.json',format:'json',fields:['ru','en'].map(l=>f(l,'object',{fields:Object.keys(ui[l]).map(k=>f(k,'text'))}))},
    ...Object.entries(extras).map(([name,fields])=>({name,label:name,type:'collection',path:`src/content/${name}`,format:'json',filename:'{fields.id}.json',view:{primary:'title_ru',fields:['id','title_ru','publish','ready_ru','ready_en']},fields:[...common,...fields]})),
    {name:'graph-overrides',label:'Граф — разрешения и аннотации',type:'collection',path:'src/content/graph-overrides',format:'json',filename:'{fields.id}.json',operations:{create:false,delete:false,rename:false},view:{primary:'id'},fields:[
      f('id','string',{readonly:true}),
      f('approvedForPublication','boolean',{default:false,label:'Я разрешаю публикацию узла',description:'Только владелец включает явно. Исследовательский статус не даёт разрешение на публикацию.'}),
      ...bilingual('annotation'),...bilingual('extra'),f('order','number'),f('featured','boolean'),list('tags'),f('image','image'),objectList('links',[f('url'),...bilingual('label','string')])
    ]}
  ]
};
writeFileSync('.pages.yml','# Pages CMS. Source graph and immutable IDs are deliberately outside editorial control.\n'+stringify(config));
console.log('Created Pages CMS collections and bilingual field schemas.');
