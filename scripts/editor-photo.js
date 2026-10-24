/* Basic photo editing, local server only. Crop coordinates refer to the rotated image. */
const photoDialog=el('dialog');photoDialog.id='photo-editor';photoDialog.setAttribute('aria-label','Редактирование фото');
photoDialog.innerHTML=`<div class="media-heading"><h2>Редактирование фото</h2><button type="button" id="photo-close">Отмена ×</button></div>
<p class="media-upload-note">Выделите область мышью или пальцем. Точные границы можно задать в процентах. При замене файл изменится во всех материалах; исходник можно восстановить.</p>
<div id="photo-status" role="status" aria-live="polite"></div>
<div class="photo-layout"><div><div id="photo-stage"><canvas id="photo-canvas" aria-label="Предпросмотр фото"></canvas><div id="photo-crop" aria-hidden="true"></div></div><p id="photo-dimensions"></p></div>
<div class="photo-controls"><div class="photo-actions"><button type="button" id="photo-left">↶ 90°</button><button type="button" id="photo-right">↷ 90°</button><button type="button" id="photo-flip-x">Отразить ↔</button><button type="button" id="photo-flip-y">Отразить ↕</button></div>
<label>Пропорции<select id="photo-ratio"><option value="free">Свободно</option><option value="1">Квадрат 1:1</option><option value="1.3333333333">4:3</option><option value="1.7777777778">16:9</option><option value="0.75">Портрет 3:4</option></select></label>
<fieldset><legend>Обрезка, %</legend><div class="photo-coordinates"><label>Слева<input id="photo-x" type="number" min="0" max="99.9" step="0.1" value="0"></label><label>Сверху<input id="photo-y" type="number" min="0" max="99.9" step="0.1" value="0"></label><label>Ширина<input id="photo-width" type="number" min="0.1" max="100" step="0.1" value="100"></label><label>Высота<input id="photo-height" type="number" min="0.1" max="100" step="0.1" value="100"></label></div></fieldset>
<label>Яркость <output id="photo-brightness-value">100%</output><input id="photo-brightness" type="range" min="50" max="150" value="100"></label>
<label>Контраст <output id="photo-contrast-value">100%</output><input id="photo-contrast" type="range" min="50" max="150" value="100"></label>
<button type="button" id="photo-reset">Сбросить правки</button><button type="button" id="photo-restore" hidden>Восстановить исходник</button></div></div>
<div class="photo-footer"><button type="button" id="photo-copy" class="primary">Сохранить копию</button><button type="button" id="photo-replace">Заменить файл</button></div>`;
document.body.append(photoDialog);
let photoSourceValue,photoDone,photoInfoValue,photoImage,photoEdit,photoLoading=false,photoRequest=0;
const photoMessage=(text,error=false)=>{const status=$('#photo-status');status.textContent=text;status.className=error?'error':''};
const photoDefaults=()=>({rotation:0,flipX:false,flipY:false,brightness:1,contrast:1,crop:{x:0,y:0,width:1,height:1}});
function photoLock(lock){photoLoading=lock;photoDialog.querySelectorAll('button,input,select').forEach(x=>{x.disabled=lock});$('#photo-close').disabled=false;}
function photoSize(){const swap=photoEdit.rotation%180!==0;return {width:swap?photoInfoValue.height:photoInfoValue.width,height:swap?photoInfoValue.width:photoInfoValue.height};}
function showCrop(){
  const c=photoEdit.crop,box=$('#photo-crop');Object.assign(box.style,{left:c.x*100+'%',top:c.y*100+'%',width:c.width*100+'%',height:c.height*100+'%'});
  for(const key of ['x','y','width','height'])$('#photo-'+key).value=String(Math.round(c[key]*1000)/10);
  const size=photoSize();$('#photo-dimensions').textContent=`Результат: ${Math.max(1,Math.round(size.width*c.width))} × ${Math.max(1,Math.round(size.height*c.height))} px`;
}
function drawPhoto(){
  if(!photoImage)return;
  const canvas=$('#photo-canvas'),swap=photoEdit.rotation%180!==0;canvas.width=swap?photoImage.naturalHeight:photoImage.naturalWidth;canvas.height=swap?photoImage.naturalWidth:photoImage.naturalHeight;
  $('#photo-stage').style.width=Math.min(canvas.width,700,innerHeight*.62*canvas.width/canvas.height)+'px';
  const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(photoEdit.flipX?-1:1,photoEdit.flipY?-1:1);ctx.rotate(photoEdit.rotation*Math.PI/180);
  ctx.filter=`brightness(${photoEdit.brightness}) contrast(${photoEdit.contrast})`;ctx.drawImage(photoImage,-photoImage.naturalWidth/2,-photoImage.naturalHeight/2);
  for(const key of ['brightness','contrast']){$('#photo-'+key).value=String(photoEdit[key]*100);$('#photo-'+key+'-value').value=Math.round(photoEdit[key]*100)+'%'}
  $('#photo-flip-x').setAttribute('aria-pressed',String(photoEdit.flipX));$('#photo-flip-y').setAttribute('aria-pressed',String(photoEdit.flipY));showCrop();
}
async function openPhotoEditor(source,onDone){
  photoSourceValue=source;photoDone=onDone;photoEdit=photoDefaults();photoImage=null;photoInfoValue=null;const request=++photoRequest;
  $('#photo-stage').hidden=true;$('#photo-restore').hidden=true;$('#photo-replace').hidden=!source.id;$('#photo-copy').textContent=source.id?'Сохранить копию':'Применить к загрузке';$('#photo-ratio').value='free';
  photoDialog.showModal();photoLock(true);photoMessage('Загрузка фото…');
  try{
    const info=await api('/api/media/edit-info',source);if(request!==photoRequest||!photoDialog.open)return;
    const img=new Image();img.src=info.preview;await img.decode();if(request!==photoRequest||!photoDialog.open)return;
    photoInfoValue=info;photoImage=img;$('#photo-stage').hidden=false;$('#photo-restore').hidden=!info.canRestore;drawPhoto();photoMessage('Выберите область и настройте фото.');photoLock(false);
  }catch(error){if(request===photoRequest){photoMessage(error.message,true);$('#photo-close').disabled=false}}
}
$('#photo-close').onclick=()=>photoDialog.close();
photoDialog.addEventListener('close',()=>{photoRequest++;photoImage=null});
photoDialog.addEventListener('cancel',event=>{if(photoLoading)event.preventDefault()});
function resetPhotoCrop(){photoEdit.crop={x:0,y:0,width:1,height:1};$('#photo-ratio').value='free';drawPhoto();}
$('#photo-left').onclick=()=>{photoEdit.rotation=(photoEdit.rotation+270)%360;resetPhotoCrop()};
$('#photo-right').onclick=()=>{photoEdit.rotation=(photoEdit.rotation+90)%360;resetPhotoCrop()};
for(const [id,key] of [['x','flipX'],['y','flipY']])$('#photo-flip-'+id).onclick=()=>{photoEdit[key]=!photoEdit[key];resetPhotoCrop()};
$('#photo-reset').onclick=()=>{photoEdit=photoDefaults();$('#photo-ratio').value='free';drawPhoto()};
for(const key of ['brightness','contrast'])$('#photo-'+key).oninput=()=>{photoEdit[key]=Number($('#photo-'+key).value)/100;drawPhoto()};
for(const key of ['x','y','width','height'])$('#photo-'+key).onchange=()=>{
  const c=photoEdit.crop;let n=Number($('#photo-'+key).value)/100;if(!Number.isFinite(n)){showCrop();return}
  c[key]=Math.max((key==='width'||key==='height') ? 0.001 : 0,Math.min(1,n));c.x=Math.min(c.x,.999);c.y=Math.min(c.y,.999);c.width=Math.min(c.width,1-c.x);c.height=Math.min(c.height,1-c.y);$('#photo-ratio').value='free';showCrop();
};
$('#photo-ratio').onchange=()=>{
  const ratio=Number($('#photo-ratio').value);if(!Number.isFinite(ratio))return;
  const size=photoSize();let width=1,height=size.width/(ratio*size.height);if(height>1){height=1;width=ratio*size.height/size.width}
  photoEdit.crop={x:(1-width)/2,y:(1-height)/2,width,height};showCrop();
};
const photoStage=$('#photo-stage');let photoStart=null;
function photoPoint(event){const box=photoStage.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};}
photoStage.onpointerdown=event=>{if(photoLoading||!photoImage)return;event.preventDefault();photoStart=photoPoint(event);photoStage.setPointerCapture(event.pointerId)};
photoStage.onpointermove=event=>{
  if(!photoStart)return;const point=photoPoint(event);let width=Math.abs(point.x-photoStart.x),height=Math.abs(point.y-photoStart.y);
  const ratio=Number($('#photo-ratio').value),size=photoSize();if(Number.isFinite(ratio)){height=width*size.width/(ratio*size.height);const maxHeight=point.y>=photoStart.y?1-photoStart.y:photoStart.y;if(height>maxHeight){height=maxHeight;width=height*ratio*size.height/size.width}}
  if(width<.001||height<.001)return;
  photoEdit.crop={x:point.x>=photoStart.x?photoStart.x:photoStart.x-width,y:point.y>=photoStart.y?photoStart.y:photoStart.y-height,width,height};showCrop();
};
photoStage.onpointerup=()=>{photoStart=null};photoStage.onpointercancel=()=>{photoStart=null};
async function savePhoto(mode){
  if(photoLoading||!photoInfoValue)return;photoLock(true);$('#photo-close').disabled=true;photoMessage('Сохранение фото…');
  try{const result=await api('/api/media/edit',{...photoSourceValue,revision:photoInfoValue.revision,edit:photoEdit,mode});photoDialog.close();await photoDone(result)}catch(error){photoMessage(error.message,true)}finally{photoLock(false)}
}
$('#photo-copy').onclick=()=>savePhoto(photoSourceValue.id?'copy':'draft');$('#photo-replace').onclick=()=>savePhoto('replace');
$('#photo-restore').onclick=async()=>{
  if(photoLoading)return;photoLock(true);$('#photo-close').disabled=true;photoMessage('Восстановление исходника…');
  try{const result=await api('/api/media/restore',{...photoSourceValue,revision:photoInfoValue.revision});photoDialog.close();await photoDone(result)}catch(error){photoMessage(error.message,true)}finally{photoLock(false)}
};
