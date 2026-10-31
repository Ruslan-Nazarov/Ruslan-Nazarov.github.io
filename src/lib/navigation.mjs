export const navigation = [
  {path:'about',ru:'Об авторе',en:'About the author'},
  {path:'publications/theses-2020-2026/chapters/physics',ru:'Тезисы по физике',en:'Physics theses'},
  {path:'publications/theses-2020-2026/chapters/artificial-intelligence',ru:'Тезисы об ИИ',en:'AI theses'},
  {path:'articles',ru:'Статьи',en:'Articles'},
  {path:'books',ru:'Книги',en:'Books'},
  {path:'projects',ru:'Проекты',en:'Projects'},
  {path:'contact',ru:'Контакты',en:'Contact'}
];
export function activeNavigation(path) {
  return navigation.filter(item=>path===item.path||path.startsWith(item.path+'/'))
    .sort((a,b)=>b.path.length-a.path.length)[0]?.path;
}
