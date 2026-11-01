export const aiProjectIds = ['dialectic-ai', 'papanda', 'ai-algorithm'];
export const promptsProjectId = 'useful-prompts';

export const vibeCategories = [
  {id:'learning', ru:'Обучение и работа с текстом', en:'Learning and text', ids:['papanda-languages','mathematical-parser','reader','russian-language-engine']},
  {id:'planning', ru:'Планирование и работа с ИИ', en:'Planning and AI workflows', ids:['personal-time-management','protocol-ai']},
  {id:'media', ru:'Медиа и творчество', en:'Media and creativity', ids:['podcast-sound-lab','musiclab','korinis']},
  {id:'tools', ru:'Компьютер и файлы', en:'Computer and files', ids:['albert','desktools','convert','archiveguard','drivecopy']},
];

export function projectCatalog(rows) {
  const select = ids => ids.flatMap(id => rows.filter(row => row.id === id));
  const assigned = new Set([...aiProjectIds, promptsProjectId, ...vibeCategories.flatMap(group => group.ids)]);
  const categories = vibeCategories.map(group => ({...group, rows:select(group.ids)})).filter(group => group.rows.length);
  const remaining = rows.filter(row => !assigned.has(row.id));
  if (remaining.length) categories.push({id:'other', ru:'Другие приложения', en:'Other applications', rows:remaining});
  return {ai:select(aiProjectIds), categories, prompts:rows.find(row => row.id === promptsProjectId)};
}
