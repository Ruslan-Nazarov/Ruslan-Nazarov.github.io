// Shared by the public page and its editor: order, anchors and displayed records.
export const homeSections = [
  {id:'hero',label:'Первый экран',title:'heroTitle',fields:['heroEyebrow','heroTitle','heroText','heroNote'],copy:['explore','viewProjects','notebook'],description:'Заголовок и вступление слева, карточка автора и карта направлений справа.'},
  {id:'research',number:'01',label:'Исследования',title:'intro',fields:['intro','researchBody'],copy:['research'],description:'Поясняющий текст, затем карточки направлений в том же порядке, что на сайте.'},
  {id:'featured',number:'02',label:'Проекты',title:'featured',fields:['featured','featuredBody'],shared:['featuredProject'],copy:['projects','read'],description:'Текст о проекте в фокусе. Кнопки берутся из выбранного проекта.'},
  {id:'publications',number:'03',label:'Публикации',title:'publications',fields:['publications','publicationsBody'],copy:['publications','allPublications'],description:'Поясняющий текст и избранные публикации. Состав меняется отметкой «Избранный материал» в публикации.'},
  {id:'journal',number:'04',label:'Дневник',title:'journal',fields:['journal'],copy:['journal','allJournal'],description:'Три последние опубликованные записи по дате. Если записей нет, блок скрыт.'},
  {id:'collaboration',label:'Контакты',title:'collaborationTitle',fields:['collaborationTitle','collaborationText'],copy:['contact'],description:'Приглашение к разговору внизу главной страницы и кнопка перехода к контактам.'}
];

export const homeFieldLabels = {
  heroEyebrow:'Надпись над заголовком',heroTitle:'Заголовок',heroText:'Вступительный текст',heroNote:'Примечание под кнопками',
  intro:'Заголовок блока',researchBody:'Текст перед карточками направлений',featured:'Заголовок блока',featuredBody:'Текст о проекте',
  publications:'Заголовок блока',publicationsBody:'Текст перед публикациями',journal:'Заголовок блока',
  collaborationTitle:'Заголовок блока',collaborationText:'Текст приглашения'
};

export function homeContent(data,settings){
  return {
    research:data.research,
    featured:data.projects.filter(row=>row.id===settings.featuredProject),
    publications:data.publications.filter(row=>row.featured&&['external_publication','final'].includes(row.editorialStatus)),
    journal:data.journal.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3)
  };
}
