export const navigation = [
  {path:'about',ru:'Об авторе',en:'About the author'},
  {path:'publications/theses-2020-2026/full',ru:'Тезисы по диалектике',en:'Theses on Dialectics'},
  {path:'ai-theses',ru:'Тезисы об ИИ',en:'AI theses'},
  {path:'articles',ru:'Статьи',en:'Articles'},
  {path:'blog',ru:'Блог',en:'Blog'},
  {path:'books',ru:'Книги',en:'Books'},
  {path:'projects',ru:'Проекты',en:'Projects'},
  {path:'contact',ru:'Контакты',en:'Contact'}
];
export function activeNavigation(path) {
  return navigation.filter(item=>path===item.path||path.startsWith(item.path+'/'))
    .sort((a,b)=>b.path.length-a.path.length)[0]?.path;
}
