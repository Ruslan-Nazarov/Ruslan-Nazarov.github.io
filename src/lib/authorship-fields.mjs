// Only substantive prose gets an authorship indicator, regardless of its saved metadata.
export const authorshipFields = [
  'heroText', 'researchBody', 'featuredBody', 'publicationsBody',
  'collaborationText', 'aboutBody', 'rights', 'privacy',
  ...['body', 'questions', 'openProblems', 'annotation', 'explanation', 'extra']
    .flatMap(field => ['ru', 'en'].map(lang => `${field}_${lang}`))
];

export const isAuthorshipField = field => authorshipFields.includes(field);
