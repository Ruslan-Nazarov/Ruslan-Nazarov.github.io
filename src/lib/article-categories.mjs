export const articleCategories = [
  {id:'physics',ru:'Физика',en:'Physics'},
  {id:'mathematics',ru:'Математика',en:'Mathematics'},
  {id:'ai',ru:'ИИ',en:'AI'},
  {id:'education',ru:'Образование',en:'Education'},
  {id:'papanda_conspect',ru:'papanda_conspect',en:'papanda_conspect'}
];
export const articleCategory = row => articleCategories.find(category=>category.id===row.articleCategory);
export function publicationDate(row,lang) {
  if(!row.date)return '';
  return new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',row.datePrecision==='month'
    ? {month:'long',year:'numeric',timeZone:'UTC'}
    : {dateStyle:'long',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z'));
}
