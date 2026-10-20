// One-time authoring helper. Not run during build; edited CMS content is never reset.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
const write = (path, data) => {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  if (existsSync(path)) throw new Error(`Refusing to overwrite ${path}`);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
};
const pair = (ru, en) => ({ ru, en });
const entry = (id, ru, en, summaryRu, summaryEn, extra = {}) => ({
  id, slug: id, publish: true, ready_ru: true, ready_en: true,
  title_ru: ru, title_en: en, summary_ru: summaryRu, summary_en: summaryEn,
  body_ru: '', body_en: '', editorialStatus: 'awaiting_content',
  researchAreas: [], relatedProjects: [], relatedPublications: [], relatedJournal: [],
  tags: [], featured: false, heroImage: '', gallery: [], links: [], timeline: [],
  ...extra,
});
const research = [
  entry('mathematics', 'Математика', 'Mathematics',
    'Как стремление упростить вычисление усложняет сам способ вычисления?',
    'How does the drive to simplify computation make the method of computation more complex?', {
      body_ru: 'В центре исследования — отношение между упрощением операций и развитием всё более сложных средств этого упрощения. Математические понятия рассматриваются через потребности, возникающие при использовании прежних средств.\n\nОсновной проект — **диалектический математический парсер**. Его задача — показывать связи между операциями, кризисами и способами их разрешения. Это концептуальная реконструкция в авторской модели; исторические утверждения требуют отдельных источников.',
      body_en: 'This research examines the relationship between simplifying operations and developing increasingly complex means of simplification. Mathematical concepts are considered through needs that arise from the use of earlier methods.\n\nThe main project is the **Dialectical Mathematical Parser**. It explores connections between operations, crises and their resolutions. This is a conceptual reconstruction within the author’s model; historical claims require separate sources.',
      questions_ru: 'Как раскрыть необходимость перехода к новой операции?\nГде заканчивается частный пример и начинается общий вывод?\nКак явно показывать недостающие шаги?',
      questions_en: 'What makes a transition to a new operation necessary?\nWhere does a particular example end and a general derivation begin?\nHow should missing steps be made explicit?',
      openProblems_ru: 'Проверка полноты выводов и сверка публичного графа с актуальным кодом парсера.',
      openProblems_en: 'Checking the completeness of derivations and reconciling the public graph with the current parser code.',
      relatedProjects: ['mathematical-parser'], relatedPublications: ['theses-2020-2026'], symbol: '∑'
    }),
  entry('physics', 'Физика', 'Physics',
    'Математическая форма и физический смысл: от операций к измерению.',
    'Mathematical form and physical meaning: from operations to measurement.', {
      body_ru: 'Начальные материалы направления — главы готовящихся тезисов об истории физики, Эйнштейне и диалектической физике, а также физические узлы математического парсера.\n\nВ парсере физический смысл связывается с путём получения величины, включая измерение. Математический вывод, опытная предпосылка и область применимости должны быть различимы. Полные тексты глав ещё не предоставлены.',
      body_en: 'The initial materials are chapters of the forthcoming theses on the history of physics, Einstein and dialectical physics, together with physical nodes in the mathematical parser.\n\nIn the parser, physical meaning is associated with the path by which a quantity is obtained, including measurement. Mathematical derivations, empirical premises and their domains of applicability must remain distinguishable. The full chapter texts have not yet been supplied.',
      questions_ru: 'Как различать математический вывод и опытную предпосылку?\nКак путь через измерение определяет смысл величины?',
      questions_en: 'How can mathematical derivation be distinguished from an empirical premise?\nHow does a measurement path determine the meaning of a quantity?',
      openProblems_ru: 'Подготовка авторских глав и проверка источников для исторических утверждений.',
      openProblems_en: 'Preparing the author’s chapters and verifying sources for historical claims.',
      relatedProjects: ['mathematical-parser'], relatedPublications: ['theses-2020-2026'], symbol: 'φ'
    }),
  entry('education', 'Образование', 'Education',
    'Понимание как самостоятельное восстановление развития мысли.',
    'Understanding through independently reconstructing the development of an idea.', {
      body_ru: 'Направление объединяет диалектическое обучение, методику конспекта papanda и изучение языков. Основной интерес — как учащийся сам выстраивает связи между процессом, его развитием, противоречием и разрешением.\n\nИИ рассматривается как источник сведений, критики и поддержки анализа. Гипотеза о пользе такого подхода требует проверки: наличие приложения или пилота само по себе не подтверждает эффективность обучения.',
      body_en: 'This area brings together dialectical learning, the papanda note-taking method and language learning. The central interest is how learners independently connect a process, its development, a contradiction and a resolution.\n\nAI is considered a source of information, criticism and analytical support. The proposed educational benefit requires evaluation: an application or pilot alone does not establish learning effectiveness.',
      questions_ru: 'Как сделать процесс построения понимания видимым?\nКак проверить образовательную гипотезу?\nКак соединить структуру языка и практику?',
      questions_en: 'How can the construction of understanding become visible?\nHow should an educational hypothesis be evaluated?\nHow can language structure and practice be connected?',
      openProblems_ru: 'Публикация реальных конспектов, описание ограничений метода и протоколов проверки.',
      openProblems_en: 'Publishing actual notes and documenting the method’s limitations and evaluation protocols.',
      relatedProjects: ['papanda', 'papanda-languages'], relatedPublications: ['language-handbook', 'theses-2020-2026'], symbol: '↗'
    }),
  entry('artificial-intelligence', 'Искусственный интеллект', 'Artificial Intelligence',
    'Архитектуры, проверка действий и альтернативные способы построения ИИ.',
    'Architectures, action verification and alternative approaches to building AI.', {
      body_ru: 'Исследование включает экспериментальную архитектуру агентов DialecticAI и незавершённую работу AI_algorithm. Это самостоятельные проекты: их не следует смешивать с математическим парсером.\n\nВ поле внимания — вероятностные и альтернативные подходы, математические модели, численные проверки и отклонённые гипотезы. Статья для arXiv находится в подготовке; опубликованный идентификатор не предоставлен.',
      body_en: 'This area includes the experimental DialecticAI agent architecture and the unfinished AI_algorithm research. These are separate projects and should not be conflated with the mathematical parser.\n\nThe focus includes probabilistic and alternative approaches, mathematical models, numerical checks and rejected hypotheses. An arXiv paper is in preparation; no published identifier has been supplied.',
      questions_ru: 'Какие предпосылки заложены в архитектуру?\nЧто подтверждает численная проверка, а что остаётся гипотезой?',
      questions_en: 'Which assumptions are embedded in an architecture?\nWhat does a numerical check establish, and what remains a hypothesis?',
      openProblems_ru: 'Подготовка проверяемого описания алгоритма, результатов тестов и рукописи статьи.',
      openProblems_en: 'Preparing a verifiable description of the algorithm, test results and the paper manuscript.',
      relatedProjects: ['dialectic-ai', 'ai-algorithm'], relatedPublications: ['data-science-handbook', 'theses-2020-2026'], symbol: 'λ'
    })
];
const projects = [
  entry('mathematical-parser', 'Диалектический математический парсер', 'Dialectical Mathematical Parser',
    'Граф развития математических операций: потребность, противоречие, разрешение.',
    'A graph of the development of mathematical operations: need, contradiction, resolution.', {
      status: 'active', featured: true, researchAreas: ['mathematics', 'physics'],
      tags: ['Python', 'Mathematics', 'Graph'],
      body_ru: '## Проблема\nКак объяснить формулу через развитие операций из простейшего, а не только перечислить правила её преобразования?\n\n## Модель и алгоритм\nКонцептуальная цепочка связывает потребность, кризис прежнего средства и его разрешение. Количественные операции лежат в основании; качество описывает смысл пути, в том числе физический путь через измерение. Пропуски вывода обозначаются явно.\n\n## Реализация\nСайт принимает нормализованный JSON-экспорт из Python `OPERATIONS_GRAPH`. Публичные аннотации и разрешение на публикацию редактируются отдельно. Ввод произвольной формулы здесь не реализуется.\n\n## Ограничения\nАктуальный репозиторий парсера пока не подключён. Демонстрационный граф основан на снимке перечня узлов от 29.09.2026 и требует сверки с кодом. Он не является исторической реконструкцией или доказательством полноты модели.',
      body_en: '## Problem\nHow can a formula be explained through the development of operations from simple foundations, rather than by listing transformation rules?\n\n## Model and algorithm\nA conceptual chain connects a need, a crisis of an earlier method and its resolution. Quantitative operations form the foundation; quality describes the meaning of a path, including physical measurement. Missing derivations are stated explicitly.\n\n## Implementation\nThe site accepts a normalized JSON export from Python `OPERATIONS_GRAPH`. Public annotations and publication approval are edited separately. Arbitrary formula input is not implemented here.\n\n## Limitations\nThe current parser repository is not connected. The demonstration graph uses a node-inventory snapshot dated 29 September 2026 and needs reconciliation with the code. It is neither a historical reconstruction nor evidence of the model’s completeness.',
      relatedPublications: ['theses-2020-2026']
    }),
  entry('papanda', 'papanda', 'papanda',
    'Образовательная система и диалектический конспект для самостоятельного построения понимания.',
    'An educational system and dialectical notes for independently constructing understanding.', {
      status: 'active', featured: true, researchAreas: ['education'], tags: ['Learning', 'Notes'],
      body_ru: '## Замысел\npapanda связывает образовательную систему с диалектическим конспектом. Учащийся восстанавливает процесс развития мысли, формулирует противоречия и рассматривает способы их разрешения.\n\n## Роль ИИ\nИИ может предоставлять сведения, критиковать рассуждение и поддерживать анализ. Самостоятельная работа учащегося остаётся центральной.\n\n## Границы утверждений\nДоступность приложения не доказывает эффективность метода. Реальные конспекты, иллюстрации и материалы пилотов будут добавлены после предоставления автором.',
      body_en: '## Intent\npapanda connects an educational system with dialectical notes. Learners reconstruct the development of an idea, formulate contradictions and examine possible resolutions.\n\n## The role of AI\nAI can supply information, critique reasoning and support analysis. The learner’s independent work remains central.\n\n## Limits of the claims\nAn available application does not establish the effectiveness of the method. Actual notes, illustrations and pilot materials will be added when supplied by the author.',
      links: [{ label_ru: 'Открыть papanda', label_en: 'Open papanda', url: 'https://papanda.kz' }],
      relatedPublications: ['language-handbook', 'theses-2020-2026']
    }),
  entry('papanda-languages', 'papanda Languages', 'papanda Languages',
    'Структурный разбор языка, контекстные примеры и практика повторения.',
    'Language structure, contextual examples and repetition practice.', {
      status: 'active', researchAreas: ['education'], tags: ['Languages', 'Learning'],
      body_ru: 'Самостоятельный проект приложения для изучения языков. В описанную функциональность входят структурный разбор предложений, работа с морфемами, контекстные примеры, словарь и интервальное повторение.\n\nТекущая стадия MVP или тестирования требует уточнения по актуальным материалам. Скриншоты и публичная ссылка пока не предоставлены. Описание функций не является отчётом об измеренных результатах обучения.',
      body_en: 'A separate language-learning application project. The described functionality includes sentence structure analysis, morphemes, contextual examples, a dictionary and spaced repetition.\n\nThe current MVP or testing stage needs verification against current materials. Screenshots and a public link have not yet been supplied. This functionality description is not a report of measured learning outcomes.',
      relatedPublications: ['language-handbook']
    }),
  entry('dialectic-ai', 'DialecticAI', 'DialecticAI',
    'Экспериментальная архитектура агентов Process / Contradiction / Leap.',
    'An experimental Process / Contradiction / Leap agent architecture.', {
      status: 'active', researchAreas: ['artificial-intelligence'], tags: ['Agents', 'Experiments'],
      body_ru: 'Архитектура исследует разделение ролей Process / Contradiction / Leap и проверку действий агентов. В описании проекта должны быть различимы архитектурные решения, тесты и наблюдаемость.\n\nИнженерная работоспособность не равна научному доказательству эффективности особого диалектического метода. Актуальные результаты тестов и материалы реализации ожидаются.',
      body_en: 'The architecture explores Process / Contradiction / Leap roles and verification of agent actions. Its documentation should distinguish architectural decisions, tests and observability.\n\nEngineering functionality is not scientific evidence for the effectiveness of a distinct dialectical method. Current test results and implementation materials are awaited.'
    }),
  entry('ai-algorithm', 'AI_algorithm', 'AI_algorithm',
    'Незавершённое исследование альтернативной архитектуры искусственного интеллекта.',
    'Unfinished research into an alternative artificial intelligence architecture.', {
      status: 'active', featured: true, researchAreas: ['artificial-intelligence'], tags: ['Algorithms', 'Research'],
      body_ru: 'Проект включает развитие итераций алгоритма, математическое описание, численные проверки и фиксацию отклонённых гипотез. Исследование не завершено.\n\nСтатья для arXiv готовится. Дата публикации, DOI и arXiv ID отсутствуют. Подтверждённые материалы и результаты будут добавляться по мере предоставления автором.',
      body_en: 'The project involves algorithm iterations, mathematical descriptions, numerical checks and a record of rejected hypotheses. The research is unfinished.\n\nAn arXiv paper is in preparation. No publication date, DOI or arXiv ID is available. Verified materials and results will be added as the author supplies them.',
      relatedPublications: ['data-science-handbook']
    }),
  entry('personal-time-management', 'Личный тайм-менеджмент', 'Personal Time-Management App',
    'Приложение для организации личного времени и задач.',
    'An application for organizing personal time and tasks.', {
      status: 'active', researchAreas: [], tags: ['Personal tool'],
      body_ru: 'Проект для личного использования. Эта страница предназначена для описания назначения, особенностей и галереи интерфейса.\n\nОбезличенные скриншоты с демонстрационными данными ещё не предоставлены. Они появятся здесь после загрузки автором. Публичный доступ, установка и репозиторий не предлагаются.',
      body_en: 'A project for personal use. This page is intended to describe its purpose, features and interface gallery.\n\nAnonymized screenshots containing demonstration data have not yet been supplied. They will appear here once uploaded by the author. Public access, installation and a repository are not offered.'
    }),
];
const publications = [
  entry('data-science-handbook', 'Handbook Data Science 2025', 'Handbook Data Science 2025',
    'Авторская книга по Data Science и искусственному интеллекту. Полный текст доступен на отдельном сайте.',
    'The author’s book on Data Science and artificial intelligence. The full text is available on a separate site.', {
      type: 'book', featured: true, researchAreas: ['artificial-intelligence'], tags: ['Data Science', 'AI'],
      license: 'CC BY-NC-ND 4.0', editorialStatus: 'external_publication',
      body_ru: 'Книга представлена как самостоятельное внешнее издание. Эта карточка связывает её с исследовательским направлением искусственного интеллекта; полный текст и сведения об издании находятся на исходном сайте.\n\nЛицензия внешней книги сохраняется: **CC BY-NC-ND 4.0**. Она не заменяется лицензией новых текстов этого сайта.',
      body_en: 'The book is presented as a separate external publication. This card connects it to the artificial intelligence research area; the full text and publication details remain on the original site.\n\nThe external book retains its **CC BY-NC-ND 4.0** licence. It is not replaced by the licence for new texts on this site.',
      links: [{label_ru: 'Читать книгу на исходном сайте', label_en: 'Read the original book', url: 'https://ruslan-nazarov.github.io/handbook_ai/'}],
      relatedProjects: ['ai-algorithm']
    }),
  entry('language-handbook', 'Как выучить много иностранных языков? Диалектический подход', 'How to Learn Many Foreign Languages? A Dialectical Approach',
    'Книга о методике изучения языков. Внешнее издание на русском языке.',
    'A book on language-learning methodology. The external edition is in Russian.', {
      type: 'book', featured: true, researchAreas: ['education'], tags: ['Languages', 'Education'],
      license: 'CC BY-NC-ND 4.0', editorialStatus: 'external_publication',
      body_ru: 'Авторская книга о диалектическом подходе к изучению иностранных языков. Здесь приводится краткая редакционная аннотация; оригинальный текст доступен на отдельном книжном сайте.\n\nКарточка связывает книгу с направлением образования и языковыми проектами. Наличие книги не является эмпирическим подтверждением эффективности описанного метода. Лицензия издания — **CC BY-NC-ND 4.0**.',
      body_en: 'The author’s book on a dialectical approach to learning foreign languages. This page provides a short editorial description; the original text is available on its separate book site.\n\nThe card connects the book to education and language projects. The existence of the book is not empirical evidence of the method’s effectiveness. The edition is licensed under **CC BY-NC-ND 4.0**.',
      links: [{label_ru: 'Читать книгу на исходном сайте', label_en: 'Read the original book', url: 'https://ruslan-nazarov.github.io/handbook_Languages/'}],
      relatedProjects: ['papanda', 'papanda-languages']
    }),
  entry('theses-2020-2026', 'Тезисы 2020–2026', 'Theses 2020–2026',
    'Предстоящая авторская публикация. Рабочее название; планируемый выпуск — 11 ноября 2026.',
    'A forthcoming publication. Working title; target release: 11 November 2026.', {
      type: 'theses', featured: true, researchAreas: research.map(x=>x.id), targetDate: '2026-11-11',
      startedDate: '2020-11-11', tags: ['Theses'], pdf_ru: '', pdf_en: '',
      body_ru: 'Работа над тезисами начата **11 ноября 2020 года**. Целевой срок выпуска — **11 ноября 2026 года**. Это план, а не состоявшаяся публикация.\n\nОкончательный авторский текст редактируется и пока не предоставлен. Ниже показана рабочая структура из пяти глав. Введение, диалектика и восстановление до диалектики объединены в первую главу; три физических раздела — в главу о физике. Структура редактируется в CMS.',
      body_en: 'Work on the theses began on **11 November 2020**. The target release date is **11 November 2026**. This is a plan, not a completed publication.\n\nThe final authorial text is being edited and has not yet been supplied. The working structure below contains five chapters. The introduction, dialectics and reconstruction before dialectics are grouped in the first chapter; three physics sections are grouped in the physics chapter. The structure can be edited in the CMS.'
    })
];
const chapters = [
  ['foundations','Введение и диалектика','Introduction and dialectics','Введение · Диалектика · Восстановление до диалектики','Introduction · Dialectics · Reconstruction before dialectics',[]],
  ['mathematics','Математика','Mathematics','Развитие математических операций','Development of mathematical operations',['mathematics']],
  ['physics','Физика','Physics','История физики · Эйнштейн · Диалектическая физика','History of physics · Einstein · Dialectical physics',['physics']],
  ['education','Образование','Education','Диалектическое обучение','Dialectical learning',['education']],
  ['artificial-intelligence','Искусственный интеллект','Artificial intelligence','Исследование подходов к ИИ','Research into approaches to AI',['artificial-intelligence']]
].map(([id,ru,en,sru,sen,areas], i)=> entry(id,ru,en,sru,sen,{order:i+1,researchAreas:areas}));
const pages = [
  entry('dialectical-notes','Диалектический конспект','Dialectical Notes',
    'Методика papanda: от описания процесса к противоречию и его разрешению.',
    'The papanda method: from describing a process to a contradiction and its resolution.', {
      researchAreas: ['education'], relatedProjects: ['papanda'],
      body_ru: '## Структура работы\n1. **Процесс.** Что происходит и в каких условиях?\n2. **Развитие.** Как меняется процесс и что порождают эти изменения?\n3. **Противоположный процесс.** Какая тенденция действует в ином направлении?\n4. **Противоречие.** Как связаны и сталкиваются эти тенденции?\n5. **Разрешение.** Что позволяет перейти к новой организации процесса?\n\n## Практика\nСтруктура служит опорой самостоятельного анализа, а не шаблоном для автоматического получения правильного ответа. Реальные авторские конспекты и изображения пока не предоставлены.\n\n## Ограничения\nНужны предметные знания, проверка источников и критика сделанных переходов. Эффективность обучения остаётся исследовательской гипотезой до эмпирической проверки.',
      body_en: '## Working structure\n1. **Process.** What happens, and under which conditions?\n2. **Development.** How does the process change, and what do these changes produce?\n3. **Opposite process.** Which tendency acts in another direction?\n4. **Contradiction.** How are these tendencies connected, and how do they conflict?\n5. **Resolution.** What enables a new organization of the process?\n\n## Practice\nThe structure supports independent analysis; it is not a template that automatically yields a correct answer. Actual authorial notes and images have not yet been supplied.\n\n## Limitations\nSubject knowledge, source checking and criticism of proposed transitions are necessary. Educational effectiveness remains a research hypothesis pending empirical evaluation.'
    })
];
for (const [name, rows] of Object.entries({ research, projects, publications, theses: chapters, pages, journal: [] })) {
  mkdirSync(`src/content/${name}`, { recursive:true });
  for (const row of rows) write(`src/content/${name}/${row.id}.json`, row);
}
// A deliberately private fixture to continuously test draft exclusion.
write('src/content/journal/unpublished-example.json', entry('unpublished-example','PRIVATE_DRAFT_SENTINEL_RU','PRIVATE_DRAFT_SENTINEL_EN','Черновик','Draft',{
  publish:false,ready_ru:false,ready_en:false,date:'2026-10-20',type:'research-note',body_ru:'PRIVATE_DRAFT_BODY',body_en:'PRIVATE_DRAFT_BODY'
}));
write('src/data/site.json', {
  name: 'Ruslan Nazarov', tagline: 'AI · Mathematics · Physics · Education',
  portrait: '', email: '', formEndpoint: '', cloudflareToken: '',
  profiles: [{label:'GitHub', url:'https://github.com/Ruslan-Nazarov'}],
  ru: {
    role:'Независимый исследователь', heroTitle:'Понимать, как развивается знание.',
    heroText:'Исследую искусственный интеллект, математику, физику и образование. Соединяю вопросы, проекты и тексты в открытую карту исследовательской работы.',
    heroNote:'Диалектика — общая методология: рассматривать развитие через противоречия и способы их разрешения.',
    intro:'Вопросы, которые связывают исследования',
    featured:'Избранные проекты', publications:'Книги и тексты', journal:'Исследовательский дневник',
    collaborationTitle:'Открыт к содержательному диалогу.',
    collaborationText:'Вопросы, критика и обсуждение возможного сотрудничества — часть исследовательской работы.',
    aboutTitle:'Об авторе и контакты',
    aboutBody:'Руслан Назаров — независимый исследователь. Основные интересы: искусственный интеллект, математика, физика и образование.\n\nДиалектика используется как общая исследовательская методология. Проекты охватывают математический парсер, архитектуры ИИ, образовательную систему papanda и изучение языков.\n\nРасширенная авторская биография и настоящий портрет готовятся. Представленные на сайте краткие описания подготовлены по техническому заданию; полные авторские материалы будут добавляться отдельно.',
    contactEmpty:'Адрес электронной почты пока не указан. Доступен подтверждённый профиль GitHub.',
    journalEmpty:'Дневник начинается с 2026 года. Подтверждённые датированные записи ещё не добавлены.',
    history:'11 ноября 2020 года — начало работы над тезисами. Это краткая историческая справка, а не восстановленный задним числом дневник.',
    rights:'Новые авторские тексты сайта — CC BY 4.0, если для материала не указано иное. Внешние книги сохраняют CC BY-NC-ND 4.0. Лицензия текстов не распространяется на программный код.',
    privacy:'Сайт статический, без собственной базы данных и учётных записей посетителей. Выбранные язык и тема сохраняются локально в браузере. При включении формы сообщения передаются указанному внешнему сервису. Аналитика загружается только при настроенном идентификаторе. Внешние сайты имеют собственные правила приватности.'
  },
  en: {
    role:'Independent Researcher', heroTitle:'Understanding how knowledge develops.',
    heroText:'I explore artificial intelligence, mathematics, physics and education, connecting questions, projects and texts into an open map of research.',
    heroNote:'Dialectics is the shared methodology: examining development through contradictions and their resolutions.',
    intro:'Questions connecting the research',
    featured:'Selected projects', publications:'Books and texts', journal:'Research journal',
    collaborationTitle:'Open to thoughtful conversation.',
    collaborationText:'Questions, criticism and discussions of possible collaboration are part of the research process.',
    aboutTitle:'About & Contact',
    aboutBody:'Ruslan Nazarov is an independent researcher with interests in artificial intelligence, mathematics, physics and education.\n\nDialectics serves as a shared research methodology. Projects span a mathematical parser, AI architectures, the papanda educational system and language learning.\n\nAn extended authorial biography and an authentic portrait are forthcoming. The short descriptions on this site were prepared from the project brief; full authorial materials will be added separately.',
    contactEmpty:'An email address has not yet been specified. The verified GitHub profile is available.',
    journalEmpty:'The journal begins in 2026. No verified dated entries have been added yet.',
    history:'11 November 2020 — work on the theses begins. This is a short historical reference, not a retrospectively reconstructed journal.',
    rights:'New authorial texts on this site are CC BY 4.0 unless stated otherwise. External books retain CC BY-NC-ND 4.0. The text licence does not apply to software code.',
    privacy:'This is a static site without its own database or visitor accounts. Language and theme preferences are stored locally in the browser. If enabled, the contact form sends messages to the configured external service. Analytics loads only when an identifier is configured. External sites have their own privacy policies.'
  }
});
write('src/data/graph/source.json', {schemaVersion:1, nodes:[], edges:[]});
write('src/data/graph/id-map.json', {});
mkdirSync('src/content/graph-overrides', { recursive:true });
const demoNodes = [
  ['addition','сложение','Сложение','Addition','a+b','кризис-разрешение',[]],
  ['multiplication','умножение','Умножение','Multiplication','a\\cdot b','кризис-разрешение',['addition']],
  ['power','степень','Степень','Power','a^n','кризис-разрешение',['multiplication']],
  ['root','корень','Корень','Root','\\sqrt[n]{a}','кризис-разрешение',['power']],
  ['division','деление','Деление','Division','\\frac{a}{b}','кризис-разрешение',['multiplication']],
  ['division-case','частный_случай_деления','Частный случай деления','A special case of division','\\frac{n}{n}=1\\quad(n\\ne0)','частный_случай',['division']]
].map(([id,originalKey,ru,en,formula,type,predecessors],i)=>({
  id:`demo-${id}`, originalKey, title_ru:ru,title_en:en,formula,type,
  predecessors: predecessors.map(x=>`demo-${x}`), researchStatus:'черновик',
  explanation_ru:'Демонстрационная карточка интерфейса по снимку перечня узлов от 29.09.2026. Полный вывод и тип требуют сверки с актуальным кодом. Эта запись не является одобренным узлом исследовательского графа.',
  explanation_en:'An interface demonstration card based on the node-inventory snapshot of 29 September 2026. The full derivation and type need reconciliation with the current code. This is not an approved research-graph node.',
  position:{x:80+(i<4?i: i===4?2:3)*270,y:i<4?80:260}, tags:['demo'], order:i, links:[]
}));
write('src/data/graph/demo.json',{demo:true,nodes:demoNodes, edges:demoNodes.flatMap(n=>n.predecessors.map(p=>({id:`${p}--${n.id}`,source:p,target:n.id})))});
console.log('Created editable bilingual content. No journal events or final thesis texts invented.');
