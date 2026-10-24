/* Local editor UI. Uses the existing loopback server and CSRF session. */
let mediaLibrary={items:[],slots:[]},mediaTarget=null,mediaSelected=null,mediaDirty=false,mediaBusy=false;
const panel=el('dialog');panel.id='media-panel';panel.setAttribute('aria-labelledby','media-title');
panel.innerHTML=`<div class="media-heading"><h2 id="media-title">Медиабиблиотека</h2><button id="media-close">Закрыть ×</button></div><div id="media-status" class="media-status" role="status" aria-live="polite"></div><div class="media-scroll">
<div class="media-placement"><div class="media-placement-fields"><div><label for="media-document">Материал</label><select id="media-document" aria-describedby="media-destination-help"><option value="">Выберите материал…</option></select></div><div><label for="media-destination">Куда добавить изображение</label><select id="media-destination" aria-describedby="media-destination-help"></select></div></div><span id="media-destination-help" class="help"></span></div>
<div class="media-tabs"><button id="media-assets-tab" aria-pressed="true">Все изображения</button><button id="media-slots-tab" aria-pressed="false">Заглушки / задачи</button><button id="media-new">+ Загрузить изображение</button></div>
<div id="media-assets"><div class="media-filters">
<label>Поиск<input id="media-search" type="search" placeholder="Название, alt, подпись, ID, путь"/></label>
<label>Проект<select id="media-project"><option value="">Все проекты</option></select></label>
<details class="media-extra-filters"><summary>Другие фильтры</summary><label>Тег<input id="media-tag" type="search" placeholder="Любой тег"/></label>
<label>Сортировка<select id="media-sort"><option value="new">Сначала новые</option><option value="old">Сначала старые</option><option value="title">По названию</option></select></label></details></div>
<div class="media-layout"><div id="media-grid" class="media-grid"></div><aside id="media-edit" class="media-edit" hidden></aside></div></div>
<div id="media-slots" hidden></div></div><div id="media-footer" class="media-footer" hidden></div>`;
document.body.append(panel);
const mediaProjects=el('datalist');mediaProjects.id='media-project-options';panel.append(mediaProjects);
const full=el('dialog');full.id='media-full';full.setAttribute('aria-label','Изображение в полном размере');const closeFull=el('button','Закрыть ×');closeFull.onclick=()=>full.close();const fullHeading=el('div');fullHeading.className='media-heading';fullHeading.append(el('strong','Полный размер'),closeFull);const fullScroll=el('div');fullScroll.className='media-full-scroll';fullScroll.append(el('img'));full.append(fullHeading,fullScroll);document.body.append(full);
function discardMediaChanges(){if(mediaBusy)return false;if(mediaDirty&&!confirm('Есть несохранённые изменения изображения. Закрыть их без сохранения?'))return false;mediaDirty=false;return true}
panel.addEventListener('input',event=>{if(event.target.closest('#media-edit form,#media-slots'))mediaDirty=true});
panel.addEventListener('change',event=>{if(event.target.closest('#media-edit form,#media-slots'))mediaDirty=true});
panel.addEventListener('cancel',event=>{if(!discardMediaChanges())event.preventDefault()});
window.addEventListener('beforeunload',event=>{if(mediaDirty){event.preventDefault();event.returnValue=''}});
function mediaNotify(message,error=false){$('#media-status').textContent=message;$('#media-status').className='media-status '+(error?'error':'success')}
function mediaTask(task){return async()=>{try{await task()}catch(error){mediaNotify(error.message,true)}}}
function fileUrl(path){return '/api/media/file?path='+encodeURIComponent(path)}
async function readMedia(){
  const slotDrafts=[...$('#media-slots').querySelectorAll('.slot-row')].map(row=>{
    const slot=mediaLibrary.slots.find(slot=>slot.id===row.dataset.slotId),form=row.querySelector('form'),select=row.querySelector('select');
    if(!slot||!form)return null;
    const text=Object.fromEntries([...new FormData(form)].filter(([key])=>['title','alt_ru','alt_en','caption_ru','caption_en'].includes(key)));
    const authorship={...parentAuthorship(form)};
    return {id:slot.id,text,authorship,binding:select.value,open:row.querySelector('details').open,
      textDirty:Object.entries(text).some(([key,value])=>value!==slot[key])||JSON.stringify(authorship)!==JSON.stringify(slot._authorship||{}),bindingDirty:select.value!==slot.mediaId};
  }).filter(Boolean);
  mediaLibrary=await api('/api/media');
  const projects=[...new Set([...mediaLibrary.items,...mediaLibrary.slots].map(x=>x.project).filter(Boolean).concat(schemas.find(s=>s.name==='projects')?.files||[]))].sort();
  mediaProjects.replaceChildren();for(const project of projects)mediaProjects.append(new Option(project,project));
  const select=$('#media-project'),old=select.value;select.replaceChildren(new Option('Все проекты',''));for(const p of projects)select.append(new Option(p,p));select.value=old;
  $('#media-slots-tab').textContent='Заглушки / задачи ('+mediaLibrary.slots.filter(s=>!s.mediaId||!mediaLibrary.items.some(i=>i.id===s.mediaId&&!i.missing)).length+')';
  renderMediaGrid();renderSlots();
  let pending=false;
  for(const draft of slotDrafts){
    const row=[...$('#media-slots').querySelectorAll('.slot-row')].find(row=>row.dataset.slotId===draft.id),slot=mediaLibrary.slots.find(slot=>slot.id===draft.id);if(!row||!slot)continue;
    const form=row.querySelector('form');row.querySelector('details').open=draft.open;
    if(draft.textDirty){
      for(const [key,value]of Object.entries(draft.text))form.elements.namedItem(key).value=value;
      form.authorship._authorship=draft.authorship;
      form.querySelectorAll('[data-authorship-field]').forEach(input=>{input.value=draft.authorship[input.dataset.authorshipField]??'ai'});
      pending||=Object.entries(draft.text).some(([key,value])=>value!==slot[key])||JSON.stringify(draft.authorship)!==JSON.stringify(slot._authorship||{});
    }
    if(draft.bindingDirty){row.querySelector('select').value=draft.binding;pending||=draft.binding!==slot.mediaId}
  }
  mediaDirty=pending;
}
function updateMediaDestinations(target=null){
  const targets=mediaTargets(),destination=$('#media-destination');
  mediaTarget=targets.includes(target)?target:targets.includes(activeMediaTarget)?activeMediaTarget:targets.length===1?targets[0]:null;
  destination.replaceChildren(new Option(targets.length?'Выберите поле страницы…':current?'Нет полей для изображения':'Сначала выберите материал выше',''));
  targets.forEach((input,index)=>destination.append(new Option(input.dataset.mediaTarget,String(index))));
  destination.value=mediaTarget?String(targets.indexOf(mediaTarget)):'';destination.disabled=!targets.length;
  $('#media-destination-help').textContent=targets.length?'Выберите поле и изображение, затем нажмите «Вставить в материал».':current?'В этом материале нет полей для изображения. Можно выбрать другой материал или работать с библиотекой.':'Сначала выберите материал здесь, в списке выше. Можно также загружать изображения без привязки к странице.';
  destination.onchange=()=>{mediaTarget=targets[Number(destination.value)]||null;if(destination.value==='')mediaTarget=null;const insert=$('#media-insert');if(insert)insert.disabled=!mediaTarget};
  const insert=$('#media-insert');if(insert)insert.disabled=!mediaTarget;
}
function updateMediaDocuments(){
  const select=$('#media-document');select.replaceChildren(new Option('Выберите материал…',''));
  for(const schema of schemas){const group=el('optgroup');group.label=schema.label;for(const name of schema.files)group.append(new Option(schema.type==='file'?schema.label:name,schema.name+'/'+name));if(current?.collection===schema.name&&!schema.files.includes(current.name))group.append(new Option(current.name,current.collection+'/'+current.name));select.append(group)}
  select.value=current?current.collection+'/'+current.name:'';
}
$('#media-document').onchange=async()=>{
  const select=$('#media-document'),previous=current?current.collection+'/'+current.name:'',next=select.value;
  if(mediaBusy||!next||next===previous){select.value=previous;return}
  select.disabled=true;
  try{const [collection,name]=next.split('/');if(await load(collection,name)){updateMediaDestinations();mediaNotify('')}else select.value=previous}
  catch(error){select.value=previous;mediaNotify(error.message,true)}finally{select.disabled=false}
};
function showMediaTab(slots){$('#media-assets').hidden=slots;$('#media-slots').hidden=!slots;$('.media-placement').hidden=slots;$('#media-assets-tab').setAttribute('aria-pressed',String(!slots));$('#media-slots-tab').setAttribute('aria-pressed',String(slots));$('#media-footer').hidden=slots||!$('#media-footer').children.length}
async function openMedia(target=null){
  mediaSelected=null;mediaDirty=false;$('#media-footer').replaceChildren();updateMediaDocuments();updateMediaDestinations(target);
  $('#media-edit').replaceChildren();$('#media-edit').hidden=true;
  showMediaTab(false);
  for(const id of ['#media-search','#media-project','#media-tag'])$(id).value='';
  if(!panel.open)panel.showModal();
  try{await readMedia();mediaNotify('')}catch(error){mediaNotify(error.message,true)}
}
$('#media-open').onclick=()=>openMedia();$('#media-close').onclick=()=>{if(discardMediaChanges())panel.close()};
function switchMediaTab(slots){
  if($('#media-slots').hidden===!slots)return;
  if(!discardMediaChanges())return;
  renderSlots();const item=mediaLibrary.items.find(x=>x.id===mediaSelected);if(item)editMedia(item);else{$('#media-edit').replaceChildren();$('#media-edit').hidden=true;$('#media-footer').replaceChildren()}
  showMediaTab(slots);
}
$('#media-assets-tab').onclick=()=>switchMediaTab(false);
$('#media-slots-tab').onclick=()=>switchMediaTab(true);
for(const selector of ['#media-search','#media-project','#media-tag','#media-sort'])$(selector).addEventListener('input',renderMediaGrid);
function renderMediaGrid(){
  const query=$('#media-search').value.toLowerCase(),tag=$('#media-tag').value.toLowerCase(),project=$('#media-project').value,sort=$('#media-sort').value;
  // Search all metadata and folders together; an empty tag includes untagged images.
  const filtered=mediaLibrary.items.filter(i=>(!project||i.project===project)&&(!tag||i.tags.some(t=>t.toLowerCase().includes(tag)))&&JSON.stringify(i).toLowerCase().includes(query));
  filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='old'?a.uploadedAt.localeCompare(b.uploadedAt):b.uploadedAt.localeCompare(a.uploadedAt));
  const grid=$('#media-grid');grid.replaceChildren();
  for(const item of filtered){const tile=el('button');tile.className='media-tile';tile.dataset.mediaId=item.id;tile.setAttribute('aria-pressed',String(mediaSelected===item.id));
    const img=el('img');if(!item.missing)img.src=fileUrl(item.path);img.alt=item.missing?'Файл отсутствует':item.alt_ru||item.title;img.loading='lazy';tile.append(img,el('strong',item.title),el('small',item.project||'Общие'),el('small',item.tags.join(', ')));tile.onclick=()=>{if(discardMediaChanges()){editMedia(item);if(innerWidth<=760)$('#media-edit').scrollIntoView({block:'start'})}};grid.append(tile)}
  if(!filtered.length)grid.append(Object.assign(el('p','Изображения не найдены.'),{className:'media-empty'}));
}
function mediaField(parent,key,label,value='',multiline=false){
  const wrapper=el('div'),fieldLabel=el('label',label),input=el(multiline?'textarea':'input');input.name=key;input.value=value;fieldLabel.append(input);wrapper.append(fieldLabel);parent.append(wrapper);return input;
}
function metadataFields(parent,item={}){
  parent.authorship={_authorship:{...item._authorship}};
  mediaField(parent,'title','Название',item.title||'');mediaField(parent,'project','Проект (латинский ID)',item.project||'').setAttribute('list','media-project-options');
  mediaField(parent,'tags','Теги через запятую',(item.tags||[]).join(', '));
  for(const lang of ['ru','en']){mediaField(parent,'alt_'+lang,'Alt '+lang.toUpperCase(),item['alt_'+lang]||'');mediaField(parent,'caption_'+lang,'Подпись '+lang.toUpperCase(),item['caption_'+lang]||'',true)}
  for(const key of ['alt_ru','alt_en','caption_ru','caption_en'])authorshipControl(parent.elements.namedItem(key).parentElement.parentElement,parent.authorship,key,key,()=>{mediaDirty=true});
  addMediaTranslations(parent,item.id?'media/'+item.id:null);
}
function addMediaTranslations(form,scope=null){
  const store=createLanguageStateStore(scope,api);form.languageState=store;
  let controls=[];
  const lock=locked=>{
    if(locked){mediaBusy=true;controls=[...panel.querySelectorAll('input,textarea,select,button')].map(input=>[input,input.disabled]);for(const [input]of controls)input.disabled=true}
    else{for(const [input,disabled]of controls)input.disabled=disabled;mediaBusy=false}
  };
  for(const key of ['alt','caption']){
    const source=form.elements.namedItem(key+'_ru'),target=form.elements.namedItem(key+'_en');
    mountFieldTranslation(source,target,source.parentElement.parentElement,{request:api,label:key==='alt'?'Описание изображения':'Подпись изображения',lock,store,applied:()=>{mediaDirty=true},
      getAuthor:()=>form.authorship._authorship?.[target.name],setAuthor:author=>{form.authorship._authorship??={};if(author)form.authorship._authorship[target.name]=author;else delete form.authorship._authorship[target.name]}
    });
  }
}
function parentAuthorship(form){return form.authorship?._authorship||{}}
function formMetadata(form){const data=Object.fromEntries(new FormData(form));data._authorship=parentAuthorship(form);data.tags=data.tags.split(',').map(x=>x.trim()).filter(Boolean);return data}
function previewMedia(item){full.querySelector('img').src=fileUrl(item.path);full.querySelector('img').alt=item.alt_ru||item.title;full.showModal()}
function action(parent,text,task){const button=el('button',text);button.type='button';button.onclick=mediaTask(async()=>{if(mediaBusy)return;mediaBusy=true;const disabled=button.disabled;button.disabled=true;try{await task()}finally{mediaBusy=false;if(button.isConnected)button.disabled=disabled}});parent.append(button);return button}
function editMedia(item,pending=null){
  mediaDirty=false;mediaSelected=item.id;renderMediaGrid();const aside=$('#media-edit');aside.replaceChildren();aside.hidden=false;const footer=$('#media-footer');footer.replaceChildren();footer.hidden=false;
  const back=el('button','↑ К списку изображений');back.type='button';back.className='media-back';back.onclick=()=>$('#media-grid').scrollIntoView({block:'start'});aside.append(back);
  const img=el('img');if(!item.missing)img.src=fileUrl(item.path);img.alt=item.missing?'Файл отсутствует':item.alt_ru||item.title;aside.append(img);
  action(aside,'Полный размер',()=>previewMedia(item));
  const form=el('form');form.onsubmit=e=>e.preventDefault();metadataFields(form,item);aside.append(form);
  addMediaAI(form,()=>({id:item.id}));
  if(/\.(png|jpe?g|webp)$/i.test(item.path))action(aside,'Обрезать / изменить фото',async()=>{
    const pending=formMetadata(form);
    await openPhotoEditor({id:item.id},async result=>{
      if(pending.title===item.title)pending.title=result.item.title;
      await readMedia();editMedia(result.item,pending);
      mediaNotify('Фото сохранено локально. При необходимости сохраните изменения текстов.');
    });
  });
  const insert=action(footer,'Вставить в материал',async()=>{
    const target=mediaTarget;
    if(!target?.isConnected||target.disabled)throw new Error('Выберите поле страницы для вставки изображения.');
    if(item.missing)throw new Error('Файл отсутствует. Сначала замените изображение.');
    const metadata=formMetadata(form);
    for(const lang of ['ru','en'])if(!metadata['alt_'+lang].trim()){form.elements.namedItem('alt_'+lang).focus();throw new Error('Добавьте описание изображения в Alt '+lang.toUpperCase()+'. Затем нажмите «Вставить в материал».')}
    insert.disabled=true;
    try{
      if(Object.keys(metadata).some(key=>JSON.stringify(metadata[key])!==JSON.stringify(item[key]??(key==='_authorship'?{}:undefined))))Object.assign(item,await api('/api/media/metadata',{...item,...metadata}));
      target.insertMedia(item);activeMediaTarget=target;mediaDirty=false;panel.close();revealMediaTarget(target);if(target.richEditor)target.richEditor.focus();else target.focus();updateSaveState();
      notify('Изображение добавлено в «'+target.dataset.mediaTarget+'». Сохраните материал.');
    }finally{insert.disabled=!mediaTarget}
  });
  insert.id='media-insert';insert.className='primary';insert.disabled=!mediaTarget;
  action(footer,'Сохранить метаданные',async()=>{await api('/api/media/metadata',{...item,...formMetadata(form)});await readMedia();editMedia(mediaLibrary.items.find(x=>x.id===item.id));mediaNotify('Метаданные сохранены локально. Пересоберите сайт для предпросмотра.');});
  const fileDetails=el('details');fileDetails.className='media-file-details';fileDetails.append(el('summary','Файл и использование'),el('code',item.id+' · '+item.path),el('p','Загружено: '+new Date(item.uploadedAt).toLocaleString('ru-RU')));aside.append(fileDetails);
  const replace=mediaField(fileDetails,'replacement','Заменить файл (тот же формат)');replace.type='file';replace.accept='.png,.jpg,.jpeg,.webp,.gif,.svg';
  replace.onchange=mediaTask(async()=>{const file=replace.files[0];if(!file||mediaBusy)return;if(!confirm('Заменить изображение во всех материалах, сохранив ID и путь?')){replace.value='';return}const draft=formMetadata(form);mediaBusy=true;replace.disabled=true;try{await api('/api/media/upload',{...await filePayload(file),replaceId:item.id});await readMedia();editMedia(mediaLibrary.items.find(x=>x.id===item.id),draft);mediaNotify('Файл заменён, ID и ссылки сохранены. Правки текстов остались в форме.')}finally{mediaBusy=false;if(replace.isConnected){replace.disabled=false;replace.value=''}}});
  action(fileDetails,'Где используется / удалить',async()=>{
    const usage=await api('/api/media/usage?id='+encodeURIComponent(item.id));
    const message='Использование: '+[...usage.slots.map(s=>'заглушка '+s),...usage.documents].join(', ');
    mediaNotify(message==='Использование: '?'Файл не используется.':message);
    if(usage.documents.length){mediaNotify(message+'. Удаление заблокировано до удаления ссылок из материалов и опубликованных версий.',true);return}
    if(!confirm((usage.slots.length?message+'. При удалении эти места снова станут заглушками. ':'Файл не используется. ')+'Удалить файл и метаданные?'))return;
    await api('/api/media/delete',{id:item.id,confirm:true});mediaSelected=null;mediaDirty=false;footer.replaceChildren();footer.hidden=true;aside.textContent='Файл удалён локально.';await readMedia();mediaNotify('Удалено. Привязанные места безопасно возвращены к заглушкам.');
  });
  if(pending){
    for(const [key,value]of Object.entries(pending)){const input=form.elements.namedItem(key);if(input)input.value=key==='tags'?value.join(', '):value}
    form.authorship._authorship={...pending._authorship};form.querySelectorAll('[data-authorship-field]').forEach(input=>{input.value=pending._authorship?.[input.dataset.authorshipField]??'ai'});
    mediaDirty=Object.keys(pending).some(key=>JSON.stringify(pending[key])!==JSON.stringify(item[key]??(key==='_authorship'?{}:undefined)));
  }
}
async function filePayload(file){
  if(file.size>8*1024*1024)throw new Error('Максимальный размер — 8 MiB.');
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  return {name:file.name,mime:file.type,base64};
}
$('#media-new').onclick=()=>{
  if(!discardMediaChanges())return;
  showMediaTab(false);mediaSelected=null;renderMediaGrid();const aside=$('#media-edit');aside.replaceChildren(el('h3','Новое изображение'));aside.hidden=false;const footer=$('#media-footer');footer.replaceChildren();footer.hidden=false;
  const form=el('form');form.onsubmit=e=>e.preventDefault();const file=mediaField(form,'file','Файл');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,.gif,.svg';file.parentElement.append(Object.assign(el('span','PNG, JPEG, WebP, GIF, SVG · до 8 МБ'),{className:'help'}));metadataFields(form);aside.append(form);
  let editedFile=null;
  const uploadSource=async()=>{if(!file.files[0])throw new Error('Сначала выберите фото.');return editedFile||await filePayload(file.files[0])};
  addMediaAI(form,uploadSource);
  action(form,'Обрезать / изменить фото',async()=>openPhotoEditor(await uploadSource(),result=>{editedFile=result.file;mediaNotify('Правки применены к выбранному фото. Нажмите «Загрузить и сохранить локально».')}));
  mediaNotify('Выберите фото, при необходимости заполните подписи и нажмите «Загрузить и сохранить локально». Alt RU и EN можно добавить перед вставкой в материал.');
  file.onchange=()=>{editedFile=null;if(file.files[0]){if(!form.elements.namedItem('title').value)form.elements.namedItem('title').value=file.files[0].name;mediaNotify('Выбран файл: '+file.files[0].name+'. Нажмите «Загрузить и сохранить локально».')}};
  const upload=action(footer,'Загрузить и сохранить локально',async()=>{
    if(!file.files[0])throw new Error('Выберите файл.');
    const metadata=formMetadata(form);delete metadata.file;
    // Alt is required when inserting/binding, not when storing a new file.
    mediaNotify('Загрузка изображения…');upload.disabled=true;try{const item=await api('/api/media/upload',{...metadata,...await uploadSource()});await readMedia();editMedia(item);mediaNotify('Изображение сохранено локально и добавлено в медиабиблиотеку.')}finally{upload.disabled=false}
  });
  upload.className='primary';
  aside.scrollIntoView({block:'nearest'});file.click();
};
function renderSlots(){
  const container=$('#media-slots');container.replaceChildren(el('p','Назначьте существующий файл. ID и место в тексте останутся прежними. Alt и подписи этого места редактируются отдельно от общих метаданных файла.'));
  for(const slot of mediaLibrary.slots){
    const ready=mediaLibrary.items.some(i=>i.id===slot.mediaId&&!i.missing);
    const row=el('section');row.className='slot-row';row.dataset.slotId=slot.id;row.append(el('strong',slot.id),el('span',ready?'Готово · '+slot.mediaId:'Задача: изображение отсутствует'),el('p',slot.caption_ru),el('p',slot.caption_en));
    const label=el('label','Изображение из медиабиблиотеки '),select=el('select');select.setAttribute('aria-label','Изображение '+slot.id);select.append(new Option('Без изображения — заглушка',''));
    for(const item of mediaLibrary.items)select.append(new Option(item.title,item.id));select.value=slot.mediaId;label.append(select);row.append(label);
    action(row,'Сохранить привязку',async()=>{await api('/api/media/bind',{slotId:slot.id,mediaId:select.value});await readMedia();mediaNotify('Привязка сохранена локально. Пересоберите сайт и проверьте RU / EN.');});
    const details=el('details');details.append(el('summary','Изменить alt и подписи RU / EN'));const form=el('form');form.onsubmit=e=>e.preventDefault();form.className='media-edit';form.authorship={_authorship:{...slot._authorship}};
    mediaField(form,'title','Название',slot.title);for(const lang of ['ru','en']){mediaField(form,'alt_'+lang,'Alt '+lang.toUpperCase(),slot['alt_'+lang]);mediaField(form,'caption_'+lang,'Подпись '+lang.toUpperCase(),slot['caption_'+lang],true)}
    for(const key of ['alt_ru','alt_en','caption_ru','caption_en'])authorshipControl(form.elements.namedItem(key).parentElement.parentElement,form.authorship,key,key,()=>{mediaDirty=true});
    addMediaTranslations(form,'slots/'+slot.id);
    addMediaAI(form,()=>{if(!slot.mediaId)throw new Error('Сначала привяжите изображение к заглушке.');return {id:slot.mediaId}});
    action(form,'Сохранить тексты заглушки',async()=>{await api('/api/media/slot',{...slot,...Object.fromEntries(new FormData(form)),_authorship:parentAuthorship(form)});mediaDirty=false;await readMedia();mediaNotify('Тексты заглушки сохранены локально.');});details.append(form);row.append(details);container.append(row);
  }
}
