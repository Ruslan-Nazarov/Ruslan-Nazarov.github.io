/* AI writes into the form only. Saving is the existing explicit action. */
function addMediaAI(form,getSource){
  const section=el('div');section.className='media-ai-controls';
  const note=el('input');note.type='text';note.maxLength=2000;note.placeholder='Контекст фото для ИИ (необязательно)';note.setAttribute('aria-label','Контекст фото для ИИ');
  const info=el('small','Фото отправится в OpenAI. Проверьте результат перед сохранением.');
  const status=el('p');status.className='media-ai-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let running=false,undo=null;
  const all=el('button','ИИ · заполнить поля');all.type='button';
  const undoButton=el('button','Отменить заполнение ИИ');undoButton.type='button';undoButton.hidden=true;
  const keys=['title','alt_ru','alt_en','caption_ru','caption_en','tags'].filter(key=>form.elements.namedItem(key));
  function snapshot(){return {values:Object.fromEntries(keys.map(key=>[key,form.elements.namedItem(key).value])),authorship:{...form.authorship._authorship}};}
  function syncAuthorship(){form.querySelectorAll('[data-authorship-field]').forEach(select=>{select.value=form.authorship._authorship?.[select.dataset.authorshipField]??'ai'})}
  async function generate(field){
    if(running||mediaBusy)return;running=true;mediaBusy=true;const controls=[...form.querySelectorAll('input,textarea,select,button')],disabled=controls.map(x=>x.disabled);
    try{
      const source=await getSource();const before=snapshot();controls.forEach(x=>{x.disabled=true});status.textContent='ИИ рассматривает фото…';
      const context={project:form.elements.namedItem('project')?.value||'',note:note.value};
      const result=await api('/api/media/describe',{...source,context});if(!form.isConnected)return;
      undo=before;form.authorship._authorship??={};
      for(const key of field?[field]:keys){
        form.elements.namedItem(key).value=key==='tags'?result.metadata.tags.join(', '):result.metadata[key];
        if(/^(alt|caption)_(ru|en)$/.test(key))form.authorship._authorship[key]='ai';
      }
      syncAuthorship();form.dispatchEvent(new Event('input',{bubbles:true}));undoButton.hidden=false;status.textContent='Поля заполнены ИИ. Проверьте тексты и сохраните.';
    }catch(error){status.textContent=error.message;mediaNotify(error.message,true)}
    finally{controls.forEach((x,i)=>{x.disabled=disabled[i]});running=false;mediaBusy=false}
  }
  all.onclick=()=>generate();undoButton.onclick=()=>{if(!undo)return;for(const [key,value] of Object.entries(undo.values))form.elements.namedItem(key).value=value;form.authorship._authorship={...undo.authorship};syncAuthorship();form.dispatchEvent(new Event('input',{bubbles:true}));undo=null;undoButton.hidden=true;status.textContent='Прежние тексты восстановлены.'};
  section.append(note,all,undoButton,info,status);form.append(section);
  for(const key of keys){const input=form.elements.namedItem(key),button=el('button','ИИ');button.type='button';button.className='media-ai-field';button.setAttribute('aria-label','Заполнить ИИ: '+key);button.onclick=()=>generate(key);input.parentElement.parentElement.append(button)}
}
