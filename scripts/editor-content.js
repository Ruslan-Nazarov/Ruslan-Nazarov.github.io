/* Documents, their prose and reading links are the main editing surface. */
let sectionView='research',resolvePageMaterials;
function contentDetails(parent,title,render){
  const box=el('details');box.className='content-details';box.append(el('summary',title));render(box);parent.append(box);return box;
}
function contentFields(fields,parent,value,names){
  renderFields(names.map(name=>fields.find(field=>field.name===name)).filter(Boolean),parent,value);
}
function renderMaterialPicker(parent,value,{section=false}={}){
  const box=el('section');box.className='material-picker';box.append(el('h3','Материалы на странице'),el('p','Добавьте статьи или другие страницы. Их названия станут ссылками на сайте.'));
  const chosen=el('div');chosen.className='material-list';
  const picker=el('select');picker.setAttribute('aria-label','Выбрать материал');picker.append(new Option('Выберите статью или страницу…',''));
  const available=schemas.filter(schema=>schema.entries).flatMap(schema=>schema.entries.map(entry=>({...entry,collection:schema.name})));
  for(const item of available.filter(item=>item.collection!==current.collection||item.id!==current.name))picker.append(new Option(item.title+(item.publish?'':' · черновик'),item.collection+'/'+item.id));
  const materialData=Object.fromEntries(schemas.filter(schema=>schema.entries).map(schema=>[schema.name,schema.entries]));
  const selected=()=>resolvePageMaterials(value,materialData,{collection:section?'sections':current.collection,catalogue:section?sectionView:undefined});
  const redraw=()=>{chosen.replaceChildren();for(const item of selected()){
    const row=el('div');row.className='material-row';const entry=available.find(entry=>entry.collection===item.collection&&entry.id===item.id);
    const open=el('button',entry?.title||item.id);open.type='button';open.onclick=()=>load(item.collection,item.id).catch(error=>notify(error.message,true));
    const remove=el('button','Убрать');remove.type='button';remove.onclick=()=>{
      (value.hiddenMaterials??=[]).push({collection:item.collection,id:item.id});
      if(section&&item.collection===sectionView)(value.excludedMaterials??=[]).push(item.id);
      value.materials=(value.materials||[]).filter(other=>other.collection!==item.collection||other.id!==item.id);
      for(const [field,collection]of Object.entries({relatedPublications:'publications',relatedProjects:'projects',relatedJournal:'journal'}))if(collection===item.collection)value[field]=(value[field]||[]).filter(id=>id!==item.id);
      dirty=true;redraw();updateSaveState();
    };row.append(open,remove);chosen.append(row);
  }if(!chosen.children.length)chosen.append(el('p','Материалы пока не добавлены.'));};
  const add=el('button','Добавить материал');add.type='button';add.onclick=()=>{if(!picker.value)return;const [collection,id]=picker.value.split('/');if(!selected().some(item=>item.collection===collection&&item.id===id)){value.hiddenMaterials=(value.hiddenMaterials||[]).filter(ref=>ref.collection!==collection||ref.id!==id);if(section&&collection===sectionView)value.excludedMaterials=(value.excludedMaterials||[]).filter(other=>other!==id);else(value.materials??=[]).push({collection,id});dirty=true;redraw();updateSaveState()}picker.value='';};
  const controls=el('div');controls.className='content-actions';controls.append(picker,add);box.append(chosen,controls);parent.append(box);redraw();
}
function renderDocumentContent(fields,parent,value,{section=false}={}){
  parent.classList.add('document-content');
  const main=el('section');main.className='document-writing';parent.append(main);
  contentFields(fields,main,value,['title_ru','title_en','summary_ru','summary_en']);
  let mode;
  if(!section&&current.collection==='publications'){
    contentFields(fields,main,value,['readingMode']);mode=main.querySelector('[data-field=readingMode]');
    if(!value.readingMode)mode.value='';
  }
  const body=el('div');body.className='document-body';contentFields(fields,body,value,['body_ru','body_en']);
  if((section||current.collection==='pages')&&!value.body_ru&&!value.body_en)contentDetails(main,'Добавить текст страницы',box=>box.append(body));else main.append(body);
  const links=el('section');links.className='document-links';links.append(el('h3','Ссылки на внешние ресурсы'));contentFields(fields,links,value,['links']);parent.append(links);
  const syncMode=()=>{body.hidden=value.readingMode==='external';links.classList.toggle('external-primary',body.hidden);};
  if(mode)mode.addEventListener('input',()=>{if(value.readingMode==='external'&&value.editorialStatus==='final')value.editorialStatus='external_publication';syncMode()});syncMode();
  renderMaterialPicker(parent,value,{section});

  if(!section)contentDetails(parent,'Изображения и вложения',box=>contentFields(fields,box,value,['heroImage','gallery','pdf_ru','pdf_en']));
  const extra=['questions_ru','questions_en','openProblems_ru','openProblems_en','statusLabel_ru','statusLabel_en','byline_ru','byline_en','motto_ru','motto_en','exampleLinks','timeline'].filter(name=>fields.some(field=>field.name===name));
  if(!section&&extra.length)contentDetails(parent,'Дополнительные тексты',box=>contentFields(fields,box,value,extra));
  if(!section){
    const status=el('section');status.className='document-status';
    const label=el('label','Статус документа'),select=el('select');select.setAttribute('aria-label','Статус документа');
    for(const [key,title] of [['draft','Черновик'],['ready','Готов к публикации'],['revision','Новая редакция — ещё не готова']])select.append(new Option(title,key));
    select.value=!value.publish?'draft':value.ready_ru&&value.ready_en?'ready':'revision';
    const syncStatus=()=>{if(select.value==='ready')value.editorialStatus=value.readingMode==='external'?'external_publication':value.readingMode==='forthcoming'?'editorial_summary':value.readingMode==='full'||value.body_ru?.trim()&&value.body_en?.trim()?'final':'editorial_summary';};
    select.onchange=()=>{value.publish=select.value!=='draft';value.ready_ru=value.ready_en=select.value==='ready';syncStatus();dirty=true;readiness();updateSaveState()};
    mode?.addEventListener('input',syncStatus);
    label.append(select);status.append(label,el('p','Черновик можно сохранить и посмотреть. Готовые материалы выйдут на сайт после нажатия «Опубликовать».'));parent.prepend(status);
  }
  if(!section)contentDetails(parent,'Параметры страницы',box=>{
    contentFields(fields,box,value,[...(current.collection==='pages'?['showInMenu']:[]),'featured','date','type','status','targetDate','startedDate','order','slug','license','symbol']);
    if(current.collection==='pages'){const path=el('p','Адрес: /ru/'+(value.pagePath||value.slug)+'/');path.className='help';box.append(path);}
    const taxonomy=fields.find(field=>field.name==='researchAreas');
    if(taxonomy){const group=el('fieldset');group.append(el('legend','Направления исследований'));
      for(const entry of schemas.find(schema=>schema.name==='research')?.entries||[]){const label=el('label'),input=el('input');input.type='checkbox';input.checked=value.researchAreas?.includes(entry.id)||false;input.onchange=()=>{value.researchAreas=(value.researchAreas||[]).filter(id=>id!==entry.id);if(input.checked)value.researchAreas.push(entry.id);dirty=true};label.append(input,document.createTextNode(entry.title));group.append(label)}box.append(group);
    }contentFields(fields,box,value,['tags']);
  });
}
function renderSection(){
  const schema=schemas.find(schema=>schema.name==='sections').fields.find(field=>field.name===sectionView);
  $('#document').replaceChildren();renderDocumentContent(schema.fields,$('#document'),record[sectionView],{section:true});
  $('#title').textContent=record[sectionView].title_ru;renderPageContext(pageIndex.find(page=>page.id===sectionView));setupWorkspace();
}
function newDocument(kind='pages'){
  if(working)return;
  const dialog=el('dialog');dialog.className='new-document';dialog.setAttribute('aria-label','Создать материал');
  const form=el('form');form.method='dialog';form.append(el('h2','Создать'));
  const type=el('select');type.setAttribute('aria-label','Что создать');
  for(const [key,label]of [['pages','Страница'],['publications','Статья на сайте'],['external','Ссылка на внешний ресурс'],['projects','Проект'],['research','Направление исследований'],['journal','Запись дневника']])type.append(new Option(label,key));type.value=kind;
  const title=el('input');title.required=true;title.placeholder='Название';title.setAttribute('aria-label','Название нового материала');
  const address=el('input');address.placeholder='Адрес сформируется из названия';address.setAttribute('aria-label','Адрес новой страницы');address.pattern='[a-z0-9]+(-[a-z0-9]+)*';
  let manual=false;address.oninput=()=>manual=true;
  const letters={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  title.oninput=()=>{if(!manual)address.value=[...title.value.toLowerCase()].map(char=>letters[char]??char).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)};
  const create=el('button','Создать');create.type='submit';create.className='primary';const cancel=el('button','Отмена');cancel.type='button';cancel.onclick=()=>dialog.close();
  form.append(type,title,address,el('p','Название, текст и английский перевод можно дописать после создания.'),create,cancel);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
  form.onsubmit=async event=>{event.preventDefault();const collection=type.value==='external'?'publications':type.value;const name=address.value||'page-'+Date.now();
    if(schemas.find(schema=>schema.name===collection).files.includes(name)){address.setCustomValidity('Такой адрес уже существует. Выберите другой.');address.reportValidity();address.oninput=()=>{manual=true;address.setCustomValidity('')};return}
    const titleValue=title.value,external=type.value==='external';dialog.close();if(!await load(collection,name,true))return;record.title_ru=titleValue;
    if(collection==='publications'){record.type='article';record.readingMode=external?'external':'full';record.editorialStatus=external?'external_publication':'awaiting_content'}
    if(collection==='pages')record.showInMenu=true;
    if(collection==='journal'){record.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());record.type='research-note'}
    $('#document').replaceChildren();renderDocumentContent(schemas.find(schema=>schema.name===collection).fields,$('#document'),record);$('#title').textContent=titleValue;setupWorkspace();updateSaveState();
  };dialog.showModal();title.focus();
}
