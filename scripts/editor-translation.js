/* Translation is explicit; edit tracking and side-by-side comparison are local. */
(() => {
const stores=new Map();
const providerStatus=fetch('/api/editor/translation-status').then(response=>response.ok?response.json():null).catch(()=>null);
// Fingerprints detect editorial changes; they are not used for authentication.
const fingerprint=text=>{let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i)}return text.length.toString(16)+':'+(a>>>0).toString(16).padStart(8,'0')+':'+(b>>>0).toString(16).padStart(8,'0')};
const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
const dateLabel=value=>value?new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'дата пока не записана';

window.createLanguageStateStore=function(scope,request){
  if(scope&&stores.has(scope))return stores.get(scope);
  const fields=Object.create(null),listeners=new Set();let pending=Object.create(null),timer,writing=null,inFlight=null,loading=null,loaded=false,writeFailed=false;
  const changed=()=>{for(const listener of listeners)listener()};
  const store={fields,get loaded(){return loaded},get ready(){return store.load()},
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},
    persistence(key){return scope&&(Object.hasOwn(pending,key)||inFlight&&Object.hasOwn(inFlight,key))?(writeFailed?'error':'pending'):'saved'},
    load(){
      if(loaded)return Promise.resolve();
      if(!loading)loading=Promise.resolve().then(()=>scope?request('/api/editor/language-state?scope='+encodeURIComponent(scope)):{fields:{}}).then(result=>{Object.assign(fields,result.fields);loaded=true;changed()}).finally(()=>{loading=null});
      return loading;
    },
    save(key,value){fields[key]=value;if(!scope)return;pending[key]={...value};clearTimeout(timer);timer=setTimeout(()=>store.flush().catch(()=>{}),250)},
    async flush(){
      clearTimeout(timer);await store.ready;if(!scope)return;
      if(writing)await writing;
      while(Object.keys(pending).length){
        const batch=pending;pending=Object.create(null);inFlight=batch;writeFailed=false;
        writing=Promise.resolve().then(()=>request('/api/editor/language-state',{scope,fields:batch})).catch(error=>{pending={...batch,...pending};writeFailed=true;throw error});
        changed();
        try{await writing}finally{writing=null;inFlight=null;changed()}
      }
    }
  };
  // Never silently reset an earlier synchronization mark after a failed metadata read.
  store.ready.catch(()=>{});
  if(scope)stores.set(scope,store);return store;
};

window.mountFieldTranslation=function(source,target,parent,{request,label,format='text',lock=()=>{},applied=()=>{},getAuthor,setAuthor,store,fieldKey}){
  if(source.translationControl)return;
  store??=createLanguageStateStore(null,request);fieldKey??=JSON.stringify([source.dataset.field||source.name]);
  const sourceField=source.closest('.field')||source.parentElement.parentElement,targetField=target.closest('.field')||target.parentElement.parentElement;
  const row=make('div');row.className='field-translation';
  const translate=make('button','Перевести на английский');translate.type='button';translate.className='translate-field';translate.dataset.translateField=source.dataset.field||source.name;
  translate.setAttribute('aria-label','Перевести на английский: '+label);translate.title='Перевести текст этого поля через подключённый ИИ и подставить перевод в English';
  providerStatus.then(info=>{if(info?.configured){translate.title='Перевести только текст этого поля через '+info.provider+' · '+info.model;translate.dataset.provider=info.provider}});
  const undo=make('button','Отменить перевод');undo.type='button';undo.className='undo-translation';undo.hidden=true;
  const compare=make('button','Сравнить RU/EN');compare.type='button';compare.className='compare-fields';compare.setAttribute('aria-label','Сравнить RU/EN: '+label);
  const badge=make('span');badge.className='translation-state';badge.setAttribute('role','status');
  const status=make('span');status.className='translation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  row.append(translate,compare,undo,badge,status);parent.append(row);source.translationControl=row;
  const mirror=make('div');mirror.className='field-translation translation-mirror';
  const compareEnglish=compare.cloneNode(true),englishBadge=badge.cloneNode(true);mirror.append(compareEnglish,englishBadge);targetField.append(mirror);
  let running=false,previous=null,state,dialog,metadataWarning=false;
  const initial={ru:fingerprint(source.value),en:fingerprint(target.value)};
  const authorship=()=>targetField.querySelector('[data-authorship-field]');
  getAuthor??=()=>authorship()?.value;
  setAuthor??=author=>{const select=authorship();if(select&&author){select.value=author;select.dispatchEvent(new Event('change',{bubbles:true}))}};
  const sourceAuthorship=sourceField.querySelector('[data-authorship-field]');
  function syncAuthorship(){
    const author=sourceAuthorship?.value;
    if(author&&author!==getAuthor())setAuthor(author);
  }
  function persist(){store.save(fieldKey,state)}
  function refresh(){
    if(!state)return;
    const ru=fingerprint(source.value),en=fingerprint(target.value),now=new Date().toISOString();let changed=false;
    if(state.seenRu!==ru){state.seenRu=ru;state.ruEditedAt=now;changed=true}
    if(state.seenEn!==en){state.seenEn=en;state.enEditedAt=now;changed=true}
    if(changed)persist();
    const ruChanged=state.ru!==ru,enChanged=state.en!==en;
    let text,kind='unverified';
    if(!source.value.trim()){text='Нет русского текста';kind='missing'}
    else if(!target.value.trim()){text='Нет английского текста';kind='missing'}
    else if(ruChanged||enChanged){kind='stale';text=ruChanged&&enChanged?'Оба текста изменены — проверьте соответствие':ruChanged?'Русский текст изменён — проверьте English':'English изменён — проверьте соответствие'}
    else if(state.method==='unverified')text='Соответствие ещё не подтверждено';
    else{kind='synced';text=state.method==='translation'?'Перевод обновлён':'Соответствие подтверждено'}
    if(kind==='synced'&&!running)syncAuthorship();
    const persistence=store.persistence(fieldKey);
    if(metadataWarning&&persistence==='saved'){metadataWarning=false;status.textContent='Перевод добавлен в English. Проверьте и сохраните.'}
    if(persistence==='error'){text='Метка соответствия не сохранена';kind='stale'}
    else if(kind==='synced'&&persistence==='pending'){text='Сохраняю метку соответствия…';kind='unverified'}
    for(const node of [badge,englishBadge]){node.textContent=text;node.dataset.state=kind;node.title='Русский: '+dateLabel(state.ruEditedAt)+'\nEnglish: '+dateLabel(state.enEditedAt)+(state.syncedAt?'\nСогласовано: '+dateLabel(state.syncedAt):'')}
    for(const field of [sourceField,targetField])field.classList.toggle('translation-stale',kind==='stale'||kind==='missing');
    if(dialog?.open)fillDialog();
  }
  function initialize(){
    if(!source.isConnected)return;
    if(!state){state=store.fields[fieldKey]?{...store.fields[fieldKey]}:{...initial,seenRu:initial.ru,seenEn:initial.en,ruEditedAt:null,enEditedAt:null,syncedAt:null,method:'unverified'};persist()}
    refresh();
  }
  const unsubscribe=store.subscribe(()=>{if(!source.isConnected){unsubscribe();return}if(store.loaded)initialize()});
  store.ready.then(initialize).catch(()=>{for(const node of [badge,englishBadge]){node.textContent='Не удалось загрузить метки. Повторите действие.';node.dataset.state='stale'}});
  function edited(){if(!running)status.textContent='';refresh()}
  source.addEventListener('input',edited);target.addEventListener('input',edited);
  sourceAuthorship?.addEventListener('change',edited);
  function synchronize(method){state.ru=fingerprint(source.value);state.en=fingerprint(target.value);state.seenRu=state.ru;state.seenEn=state.en;state.syncedAt=new Date().toISOString();state.method=method;syncAuthorship();persist();refresh()}
  async function put(text,author){
    if(target.richEditor)await target.richEditor.setValue(text);
    else{target.value=text;target.dispatchEvent(new Event('input',{bubbles:true}))}
    setAuthor(author);applied(target);
  }
  translate.onclick=async()=>{
    if(running||source.disabled||target.disabled)return;
    if(!source.value.trim()){status.textContent='Сначала заполните русский текст.';return}
    if(source.value.length>120000){status.textContent='Для одного перевода допустимо до 120 000 символов.';return}
    try{await store.ready;initialize()}catch{status.textContent='Метки соответствия недоступны. Попробуйте ещё раз.';return}
    const text=source.value,before=target.value,author=getAuthor(),beforeState={...state};
    running=true;lock(true);row.setAttribute('aria-busy','true');translate.textContent='Перевожу…';status.textContent='Готовлю английский текст…';
    try{
      const result=await request('/api/editor/translate',{text,format,label});
      if(!source.isConnected||!target.isConnected)return;
      if(source.value!==text||target.value!==before)throw new Error('Текст изменился во время перевода. Повторите перевод для текущей версии.');
      if(typeof result.translation!=='string'||!result.translation.trim())throw new Error('Перевод пуст. Английское поле сохранено.');
      await put(result.translation,'ai');synchronize('translation');
      previous={text:before,author,translated:result.translation,state:beforeState};undo.hidden=false;
      try{await store.flush();metadataWarning=false;status.textContent='Перевод добавлен в English. Проверьте и сохраните.'}catch{metadataWarning=true;status.textContent='Перевод готов, но метка соответствия не сохранилась.'}
    }catch(error){status.textContent=error.message}
    finally{running=false;lock(false);translate.textContent='Перевести на английский';row.removeAttribute('aria-busy')}
  };
  undo.onclick=async()=>{
    if(running||target.disabled||!previous)return;
    if(target.value!==previous.translated){status.textContent='Английский текст уже отредактирован. Отмена не заменяет новые правки.';return}
    running=true;lock(true);
    try{await put(previous.text,previous.author);state={...previous.state};persist();refresh();await store.flush();previous=null;undo.hidden=true;status.textContent='Предыдущий английский текст восстановлен.'}
    catch(error){status.textContent=error.message}
    finally{running=false;lock(false)}
  };
  function fillDialog(){
    dialog.querySelector('[data-compare-ru]').textContent=source.value;dialog.querySelector('[data-compare-en]').textContent=target.value;
    dialog.querySelector('[data-compare-dates]').textContent='Русский: '+dateLabel(state?.ruEditedAt)+' · English: '+dateLabel(state?.enEditedAt);
    dialog.querySelector('.confirm-language-sync').disabled=!state||!source.value.trim()||!target.value.trim();
  }
  async function showComparison(){
    if(running||source.disabled||target.disabled)return;
    try{await store.ready;initialize()}catch{status.textContent='Метки соответствия недоступны. Попробуйте ещё раз.';return}
    if(!dialog){
      dialog=make('dialog');dialog.className='language-comparison';dialog.ownerSource=source;dialog.setAttribute('aria-label','Сравнение RU/EN: '+label);
      const header=make('div');header.className='language-comparison-heading';header.append(make('h2',label));const close=make('button','Закрыть ×');close.type='button';close.onclick=()=>dialog.close();header.append(close);
      const dates=make('p');dates.dataset.compareDates='';dates.className='help';
      const columns=make('div');columns.className='language-comparison-columns';
      for(const lang of ['ru','en']){const section=make('section');section.append(make('h3',lang==='ru'?'Русский':'English'));const text=make('pre');text.dataset[lang==='ru'?'compareRu':'compareEn']='';section.append(text);columns.append(section)}
      const help=make('p','Сравните смысл текстов. После ручного перевода подтвердите, что обе версии согласованы.');help.className='help';
      const confirm=make('button','Подтвердить соответствие');confirm.type='button';confirm.className='primary confirm-language-sync';
      confirm.onclick=async()=>{if(!state)return;synchronize('manual');try{await store.flush();dialog.close();status.textContent='Соответствие этих версий подтверждено.'}catch{help.textContent='Не удалось сохранить метку. Попробуйте ещё раз.'}};
      dialog.append(header,dates,columns,help,confirm);document.body.append(dialog);
    }
    fillDialog();dialog.showModal();
  }
  compare.onclick=showComparison;compareEnglish.onclick=showComparison;
};

window.installEditorTranslations=function(root,record,options){
  const fields=[...root.querySelectorAll('[data-field]')].filter(input=>input.editorBinding),byObject=new Map(),peers=new WeakMap(),paths=new WeakMap();
  function visit(value,path=[]){
    if(!value||typeof value!=='object')return;paths.set(value,path);
    if(value.ru&&value.en&&typeof value.ru==='object'&&typeof value.en==='object')peers.set(value.ru,value.en);
    for(const [key,child]of Object.entries(value))visit(child,[...path,Array.isArray(value)?Number(key):key]);
  }
  visit(record);
  for(const input of fields){const {value,key}=input.editorBinding;if(!byObject.has(value))byObject.set(value,new Map());byObject.get(value).set(key,input)}
  for(const input of fields){
    const {value,key,field}=input.editorBinding;if(field.readonly||!['string','text','rich-text'].includes(field.type))continue;
    const target=key.endsWith('_ru')?byObject.get(value)?.get(key.slice(0,-3)+'_en'):byObject.get(peers.get(value))?.get(key);
    if(!target||target.editorBinding.field.readonly||!['string','text','rich-text'].includes(target.editorBinding.field.type))continue;
    mountFieldTranslation(input,target,input.closest('.field'),{...options,fieldKey:JSON.stringify([...(paths.get(value)||[]),key]),label:field.label||key,format:field.type==='rich-text'?'markdown':'text'});
  }
};
})();
