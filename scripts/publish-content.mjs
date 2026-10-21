import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const REPOSITORY='Ruslan-Nazarov/Ruslan-Nazarov.github.io';
const REMOTE=`https://github.com/${REPOSITORY}.git`;
export const isEditablePath=path=>!path.split('/').some(p=>p==='..'||p==='.')&&/^(src\/content\/[^\r\n]+\.json|src\/data\/(site|ui|published|media)\.json|public\/(images|files|media)\/[^\r\n]+)$/.test(path);
export async function publishContent({root=process.cwd(),build,expectedRemote=REMOTE}={}) {
  const git=async(...args)=>{
    const {stdout}=await exec('git',args,{cwd:root,windowsHide:true,maxBuffer:4*1024*1024,timeout:120000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
    return stdout;
  };
  const changes=async()=>{
    const entries=(await git('status','--porcelain=v1','-z','--untracked-files=all')).split('\0').filter(Boolean);
    const paths=[];
    for(const entry of entries){
      if(/[RCU]/.test(entry.slice(0,2)))throw new Error('Обнаружены переименования или конфликты Git. Завершите их перед публикацией.');
      const path=entry.slice(3);
      if(!isEditablePath(path))throw new Error(`Есть изменения вне материалов сайта: ${path}. Сначала сохраните изменения кода отдельно.`);
      paths.push(path);
    }
    return paths;
  };
  if((await git('remote','get-url','--push','origin')).trim()!==expectedRemote)throw new Error('Публикация разрешена только в репозиторий персонального сайта.');
  await changes();
  await git('fetch','origin','main');
  const remoteHead=(await git('rev-parse','origin/main')).trim();
  try{await git('merge-base','--is-ancestor','origin/main','HEAD')}
  catch{throw new Error('На GitHub есть новые изменения. Сначала синхронизируйте локальную ветку с origin/main; публикация остановлена без перезаписи удалённых данных.');}
  await build();
  const paths=await changes();
  if(paths.length){
    await git('add','-A','--',...paths);
    await git('commit','-m','Update website content from local editor');
  }
  const sha=(await git('rev-parse','HEAD')).trim();
  await git('push','origin','HEAD:refs/heads/main');
  return {message:sha===remoteHead?'На сайте уже опубликована эта версия. Новых изменений нет.':'Материалы отправлены в GitHub. Сайт обновится автоматически после успешной сборки — обычно за 1–2 минуты.',sha,url:'https://ruslan-nazarov.github.io/',actions:`https://github.com/${REPOSITORY}/actions/workflows/deploy.yml`};
}
