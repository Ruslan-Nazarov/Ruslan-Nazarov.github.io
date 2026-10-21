/* Local editor UI. Uses the existing loopback server and CSRF session. */
let mediaLibrary={items:[],slots:[]},mediaSelect=null,mediaSelected=null;
const panel=el('dialog');panel.id='media-panel';
panel.innerHTML=`<div class="media-heading"><h2>Медиабиблиотека</h2><button id="media-close">Закрыть ×</button></div>
<p class="media-upload-note">Сохранение меняет только рабочую папку. Отправка в GitHub — отдельной кнопкой «Опубликовать на сайте». PNG, JPEG, WebP, GIF, безопасный SVG; до 8 MiB и 40 млн пикселей. Скриншоты сохраняются без пережатия.</p>
<div class="media-tabs"><button id="media-assets-tab">Все изображения</button><button id="media-slots-tab">Заглушки / задачи</button><button id="media-new">+ Загрузить изображение</button></div>
<div id="media-status" class="media-status" role="status" aria-live="polite"></div>
<div id="media-assets"><div class="media-filters">
<label>Поиск<input id="media-search" type="search" placeholder="Название, alt, подпись, ID, путь"/></label>
<label>Проект<select id="media-project"><option value="">Все проекты</option></select></label>
<label>Тег<input id="media-tag" type="search" placeholder="Любой тег"/></label>
<label>Сортировка<select id="media-sort"><option value="new">Сначала новые</option><option value="old">Сначала старые</option><option value="title">По названию</option></select></label></div>
<div class="media-layout"><div id="media-grid" class="media-grid"></div><aside id="media-edit" class="media-edit">Выберите изображение или загрузите новое.</aside></div></div>
<div id="media-slots" hidden></div>`;
document.body.append(panel);
const mediaProjects=el('datalist');mediaProjects.id='media-project-options';panel.append(mediaProjects);
const full=el('dialog');full.id='media-full';const closeFull=el('button','Закрыть ×');closeFull.onclick=()=>full.close();full.append(closeFull,el('br'),el('img'));document.body.append(full);
function mediaNotify(message,error=false){$('#media-status').textContent=message;$('#media-status').className='media-status '+(error?'error':'success')}
function mediaTask(task){return async()=>{try{await task()}catch(error){mediaNotify(error.message,true)}}}
function fileUrl(path){return '/api/media/file?path='+encodeURIComponent(path)}
async function readMedia(){
  mediaLibrary=await api('/api/media');
  const projects=[...new Set([...mediaLibrary.items,...mediaLibrary.slots].map(x=>x.project).filter(Boolean).concat(schemas.find(s=>s.name==='projects')?.files||[]))].sort();
  mediaProjects.replaceChildren();for(const project of projects)mediaProjects.append(new Option(project,project));
  const select=$('#media-project'),old=select.value;select.replaceChildren(new Option('Все проекты',''));for(const p of projects)select.append(new Option(p,p));select.value=old;
  $('#media-slots-tab').textContent='Заглушки / задачи ('+mediaLibrary.slots.filter(s=>!s.mediaId||!mediaLibrary.items.some(i=>i.id===s.mediaId&&!i.missing)).length+')';
  renderMediaGrid();renderSlots();
}
async function openMedia(select=null){
  mediaSelect=select;mediaSelected=null;
  $('#media-edit').textContent=select?'Выберите изображение, затем нажмите «Вставить в материал».':'Выберите изображение для редактирования.';
  $('#media-assets').hidden=false;$('#media-slots').hidden=true;
  if(!panel.open)panel.showModal();
  try{await readMedia();mediaNotify(select?'Выбор файла из общей медиабиблиотеки.':'Все файлы из public/images и public/media.')}catch(error){mediaNotify(error.message,true)}
}
$('#media-open').onclick=()=>openMedia();$('#media-close').onclick=()=>panel.close();
$('#media-assets-tab').onclick=()=>{$('#media-assets').hidden=false;$('#media-slots').hidden=true};
$('#media-slots-tab').onclick=()=>{$('#media-assets').hidden=true;$('#media-slots').hidden=false};
for(const selector of ['#media-search','#media-project','#media-tag','#media-sort'])$(selector).addEventListener('input',renderMediaGrid);
function renderMediaGrid(){
  const query=$('#media-search').value.toLowerCase(),tag=$('#media-tag').value.toLowerCase(),project=$('#media-project').value,sort=$('#media-sort').value;
  // Search all metadata and folders together; an empty tag includes untagged images.
  const filtered=mediaLibrary.items.filter(i=>(!project||i.project===project)&&(!tag||i.tags.some(t=>t.toLowerCase().includes(tag)))&&JSON.stringify(i).toLowerCase().includes(query));
  filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='old'?a.uploadedAt.localeCompare(b.uploadedAt):b.uploadedAt.localeCompare(a.uploadedAt));
  const grid=$('#media-grid');grid.replaceChildren();
  for(const item of filtered){const tile=el('button');tile.className='media-tile';tile.dataset.mediaId=item.id;tile.setAttribute('aria-pressed',String(mediaSelected===item.id));
    const img=el('img');if(!item.missing)img.src=fileUrl(item.path);img.alt=item.missing?'Файл отсутствует':item.alt_ru||item.title;img.loading='lazy';tile.append(img,el('strong',item.title),el('small',item.project||'Общие'),el('small',item.tags.join(', ')));tile.onclick=()=>editMedia(item);grid.append(tile)}
  if(!filtered.length)grid.append(Object.assign(el('p','Изображения не найдены.'),{className:'media-empty'}));
}
function mediaField(parent,key,label,value='',multiline=false){
  const wrapper=el('label',label),input=el(multiline?'textarea':'input');input.name=key;input.value=value;wrapper.append(input);parent.append(wrapper);return input;
}
function metadataFields(parent,item={}){
  mediaField(parent,'title','Название',item.title||'');mediaField(parent,'project','Проект (латинский ID)',item.project||'').setAttribute('list','media-project-options');
  mediaField(parent,'tags','Теги через запятую',(item.tags||[]).join(', '));
  for(const lang of ['ru','en']){mediaField(parent,'alt_'+lang,'Alt '+lang.toUpperCase(),item['alt_'+lang]||'');mediaField(parent,'caption_'+lang,'Подпись '+lang.toUpperCase(),item['caption_'+lang]||'',true)}
}
function formMetadata(form){const data=Object.fromEntries(new FormData(form));data.tags=data.tags.split(',').map(x=>x.trim()).filter(Boolean);return data}
function previewMedia(item){full.querySelector('img').src=fileUrl(item.path);full.querySelector('img').alt=item.alt_ru||item.title;full.showModal()}
function action(parent,text,task){const button=el('button',text);button.type='button';button.onclick=mediaTask(task);parent.append(button);return button}
function editMedia(item){
  mediaSelected=item.id;renderMediaGrid();const aside=$('#media-edit');aside.replaceChildren();
  const img=el('img');if(!item.missing)img.src=fileUrl(item.path);img.alt=item.missing?'Файл отсутствует':item.alt_ru||item.title;aside.append(img,el('h3',item.title),el('code',item.id+' · '+item.path),el('p','Загружено: '+new Date(item.uploadedAt).toLocaleString('ru-RU')));
  action(aside,'Полный размер',()=>previewMedia(item));
  if(mediaSelect)action(aside,'Вставить в материал',()=>{if(item.missing)throw new Error('Файл отсутствует. Сначала замените изображение.');if(!item.alt_ru.trim()||!item.alt_en.trim())throw new Error('Заполните alt RU и EN.');mediaSelect(item);panel.close()});
  const form=el('form');form.onsubmit=e=>e.preventDefault();metadataFields(form,item);aside.append(form);
  action(form,'Сохранить метаданные',async()=>{await api('/api/media/metadata',{...item,...formMetadata(form)});await readMedia();editMedia(mediaLibrary.items.find(x=>x.id===item.id));mediaNotify('Метаданные сохранены локально. Пересоберите сайт для предпросмотра.');});
  const replace=mediaField(aside,'replacement','Заменить файл (тот же формат)');replace.type='file';replace.accept='.png,.jpg,.jpeg,.webp,.gif,.svg';
  replace.onchange=mediaTask(async()=>{const file=replace.files[0];if(!file)return;if(!confirm('Заменить изображение во всех материалах, сохранив ID и путь?'))return;await api('/api/media/upload',{...await filePayload(file),replaceId:item.id});await readMedia();editMedia(mediaLibrary.items.find(x=>x.id===item.id));mediaNotify('Файл заменён, ID и ссылки сохранены.');});
  action(aside,'Где используется / удалить',async()=>{
    const usage=await api('/api/media/usage?id='+encodeURIComponent(item.id));
    const message='Использование: '+[...usage.slots.map(s=>'заглушка '+s),...usage.documents].join(', ');
    mediaNotify(message==='Использование: '?'Файл не используется.':message);
    if(usage.documents.length){mediaNotify(message+'. Удаление заблокировано до удаления ссылок из материалов и опубликованных версий.',true);return}
    if(!confirm((usage.slots.length?message+'. При удалении эти места снова станут заглушками. ':'Файл не используется. ')+'Удалить файл и метаданные?'))return;
    await api('/api/media/delete',{id:item.id,confirm:true});mediaSelected=null;aside.textContent='Файл удалён локально.';await readMedia();mediaNotify('Удалено. Привязанные места безопасно возвращены к заглушкам.');
  });
}
async function filePayload(file){
  if(file.size>8*1024*1024)throw new Error('Максимальный размер — 8 MiB.');
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  return {name:file.name,mime:file.type,base64};
}
$('#media-new').onclick=()=>{
  $('#media-assets').hidden=false;$('#media-slots').hidden=true;mediaSelected=null;renderMediaGrid();const aside=$('#media-edit');aside.replaceChildren(el('h3','Новое изображение'));
  const form=el('form');form.onsubmit=e=>e.preventDefault();const file=mediaField(form,'file','Файл');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,.gif,.svg';metadataFields(form);aside.append(form);
  const upload=action(form,'Загрузить и сохранить локально',async()=>{
    if(!file.files[0])throw new Error('Выберите файл.');
    const metadata=formMetadata(form);delete metadata.file;
    if(!metadata.alt_ru.trim()||!metadata.alt_en.trim())throw new Error('Заполните alt RU и EN.');
    upload.disabled=true;try{const item=await api('/api/media/upload',{...metadata,...await filePayload(file.files[0])});await readMedia();editMedia(item);mediaNotify('Изображение сохранено локально и добавлено в медиабиблиотеку.')}finally{upload.disabled=false}
  });
};
function renderSlots(){
  const container=$('#media-slots');container.replaceChildren(el('p','Назначьте существующий файл. ID и место в тексте останутся прежними. Alt и подписи этого места редактируются отдельно от общих метаданных файла.'));
  for(const slot of mediaLibrary.slots){
    const ready=mediaLibrary.items.some(i=>i.id===slot.mediaId&&!i.missing);
    const row=el('section');row.className='slot-row';row.dataset.slotId=slot.id;row.append(el('strong',slot.id),el('span',ready?'Готово · '+slot.mediaId:'Задача: изображение отсутствует'),el('p',slot.caption_ru),el('p',slot.caption_en));
    const label=el('label','Изображение из медиабиблиотеки '),select=el('select');select.setAttribute('aria-label','Изображение '+slot.id);select.append(new Option('Без изображения — заглушка',''));
    for(const item of mediaLibrary.items)select.append(new Option(item.title,item.id));select.value=slot.mediaId;label.append(select);row.append(label);
    action(row,'Сохранить привязку',async()=>{await api('/api/media/bind',{slotId:slot.id,mediaId:select.value});await readMedia();mediaNotify('Привязка сохранена локально. Пересоберите сайт и проверьте RU / EN.');});
    const details=el('details');details.append(el('summary','Изменить alt и подписи RU / EN'));const form=el('form');form.onsubmit=e=>e.preventDefault();form.className='media-edit';
    mediaField(form,'title','Название',slot.title);for(const lang of ['ru','en']){mediaField(form,'alt_'+lang,'Alt '+lang.toUpperCase(),slot['alt_'+lang]);mediaField(form,'caption_'+lang,'Подпись '+lang.toUpperCase(),slot['caption_'+lang],true)}
    action(form,'Сохранить тексты заглушки',async()=>{await api('/api/media/slot',{...slot,...Object.fromEntries(new FormData(form))});await readMedia();mediaNotify('Тексты заглушки сохранены локально.');});details.append(form);row.append(details);container.append(row);
  }
}
