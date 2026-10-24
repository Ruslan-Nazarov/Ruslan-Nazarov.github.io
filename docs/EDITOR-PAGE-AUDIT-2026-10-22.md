# Соответствие страниц редактору — 22.10.2026

Проверены 88 HTML-адресов: 86 страниц RU/EN, корневая страница выбора языка и 404. Служебный файл подтверждения Яндекса не является редактируемой страницей и сохранён без изменений. Внешние сайты книг не входят в эту сборку: здесь редактируются их описания и ссылки.

## Как найти содержимое

В локальном редакторе на http://127.0.0.1:4322/ добавлен список «Страница сайта». Он строится из тех же маршрутов, что и сайт. Выбор адреса открывает конкретный материал или отфильтрованные подписи страницы. «Где редактировать остальные элементы страницы» ведёт к связанным материалам, общим настройкам и медиабиблиотеке. Предпросмотр показывает настоящую сохранённую сборку и обновляется после пересборки.

Каталоги собираются из записей соответствующей коллекции. Хронология — из дат и событий проектов, публикаций и дневника. Полная страница тезисов и отдельные главы используют одни тексты. Переключение представления одного файла сохраняет несохранённые правки; переход к другому материалу требует подтверждения при наличии правок.

## Исправленные расхождения

- Надписи поиска, 404, пояснения авторства, подписи просмотра изображений, оглавления и заглушек вынесены из шаблонов в редактируемые RU/EN-поля.
- Общие ссылки подвала, ссылка на лицензию, значок вкладки, монограмма, изображение для соцсетей и выбор проекта в фокусе доступны в настройках.
- Вставки изображений в тексты главной и About теперь обрабатываются тем же компонентом, что и в материалах. Ранее редактор вставлял маркер, который эти страницы не отображали.
- Описание изображения в конкретной галерее получает приоритет перед общим alt медиабиблиотеки; общая подпись остаётся в библиотеке. Поля снабжены пояснением.
- Условия показа подзаголовка и девиза проверяются для выбранного языка.
- Тексты демонстрационных карточек графа редактируются в подписях страницы графа. Формулы, типы, исследовательские статусы и связи исходного графа поступают через проверяемый импорт. Для импортированных узлов остаются отдельные аннотации и явное разрешение на публикацию.
- Материалы в списке редактора подписаны названиями; поиск также принимает постоянный ID.

## Проверка сохранения и результата

**npm run test:editor-pages** в отдельной копии изменил заголовок, краткое описание и основной текст 31 публичного материала на обоих языках через UI редактора, сохранил их и проверил результат после настоящей сборки. Проверены все 88 HTML-адресов, поля специальных страниц, сборные тезисы, RSS, живые подписи поиска и демонстрационных узлов графа, изображения в тексте главной и About, alt галереи. Тестовые маркеры не записывались в рабочие материалы; публикация не вызывалась.

Также прошли 33 unit-теста, все 28 браузерных сценариев, проверка Astro/TypeScript без ошибок и предупреждений, сценарии редактора и медиабиблиотеки. Локальная сборка проверяет 89 HTML-файлов с учётом файла Яндекса и индексирует 86 страниц.

## Полный список

Все строки, кроме корня и 404, проверены на двух языках. Дополнительные элементы каждой страницы доступны через связанные источники в редакторе.

| Адрес | Страница | Основной источник в редакторе |
| --- | --- | --- |
| `/{ru,en}/` | Главная страница | Страницы сайта → Главная |
| `/{ru,en}/research/` | Исследования | Подписи этой страницы |
| `/{ru,en}/projects/` | Проекты | Подписи этой страницы |
| `/{ru,en}/publications/` | Публикации | Подписи этой страницы |
| `/{ru,en}/journal/` | Дневник | Подписи этой страницы |
| `/{ru,en}/timeline/` | Хронология | Страницы сайта → Хронология |
| `/{ru,en}/about/` | Об авторе | Страницы сайта → Об авторе и контакты |
| `/{ru,en}/search/` | Поиск | Подписи этой страницы |
| `/{ru,en}/legal/` | Права на материалы | Страницы сайта → Права на материалы |
| `/{ru,en}/privacy/` | Приватность | Страницы сайта → Приватность |
| `/{ru,en}/projects/mathematical-parser/graph/` | Интерактивный граф | Подписи этой страницы |
| `/{ru,en}/publications/theses-2020-2026/full/` | Тезисы — одной страницей | Подписи этой страницы |
| `/{ru,en}/research/mathematics/` | Математика | research / mathematics |
| `/{ru,en}/research/physics/` | Физика | research / physics |
| `/{ru,en}/research/education/` | Образование | research / education |
| `/{ru,en}/research/artificial-intelligence/` | Искусственный интеллект | research / artificial-intelligence |
| `/{ru,en}/projects/mathematical-parser/` | Диалектический математический парсер | projects / mathematical-parser |
| `/{ru,en}/projects/papanda/` | papanda — диалектические конспекты | projects / papanda |
| `/{ru,en}/projects/papanda-languages/` | papanda Languages | projects / papanda-languages |
| `/{ru,en}/projects/dialectic-ai/` | DialecticAI | projects / dialectic-ai |
| `/{ru,en}/projects/ai-algorithm/` | AI_algorithm | projects / ai-algorithm |
| `/{ru,en}/projects/personal-time-management/` | Личный тайм-менеджмент | projects / personal-time-management |
| `/{ru,en}/publications/human-understanding-ai-education/` | Понимание как ключевая человеческая способность в образовании с ИИ | publications / human-understanding-ai-education |
| `/{ru,en}/publications/can-ai-think-differently/` | Можно ли научить ИИ мыслить иначе? | publications / can-ai-think-differently |
| `/{ru,en}/publications/explaining-mathematics-ai/` | Как объяснять математику в эпоху ИИ? | publications / explaining-mathematics-ai |
| `/{ru,en}/publications/opposites-algorithm-overview/` | Предварительный обзор алгоритма поиска противоположностей (противоречий) | publications / opposites-algorithm-overview |
| `/{ru,en}/publications/edge-ai-reasoning/` | Где проходит граница рассуждений ИИ | publications / edge-ai-reasoning |
| `/{ru,en}/publications/future-education-ai/` | Будущее образования с ИИ | publications / future-education-ai |
| `/{ru,en}/publications/arman-ai-architecture/` | Заметка об «Армане»: новая архитектура искусственного интеллекта | publications / arman-ai-architecture |
| `/{ru,en}/publications/recurrent-networks-transformers/` | От рекуррентных сетей к трансформерам: что дальше? | publications / recurrent-networks-transformers |
| `/{ru,en}/publications/hash-mathematics-concept/` | Как заставить ИИ работать с противоречиями: концепция хэш-математики | publications / hash-mathematics-concept |
| `/{ru,en}/publications/beyond-memorization/` | За пределами запоминания: как ИИ побуждает к диалектическому сдвигу в образовании | publications / beyond-memorization |
| `/{ru,en}/publications/data-science-handbook/` | Handbook Data Science 2025 | publications / data-science-handbook |
| `/{ru,en}/publications/language-handbook/` | Как выучить много иностранных языков? Диалектический подход | publications / language-handbook |
| `/{ru,en}/publications/theses-2020-2026/` | Тезисы 2020–2026 | publications / theses-2020-2026 |
| `/{ru,en}/journal/education-project-pages/` | На сайте представлены два образовательных проекта | journal / education-project-pages |
| `/{ru,en}/journal/parser-project-page/` | Опубликована страница незавершённого математического парсера | journal / parser-project-page |
| `/{ru,en}/publications/theses-2020-2026/chapters/foundations/` | Введение и диалектика | theses / foundations |
| `/{ru,en}/publications/theses-2020-2026/chapters/mathematics/` | Математика | theses / mathematics |
| `/{ru,en}/publications/theses-2020-2026/chapters/physics/` | Физика | theses / physics |
| `/{ru,en}/publications/theses-2020-2026/chapters/education/` | Образование | theses / education |
| `/{ru,en}/publications/theses-2020-2026/chapters/artificial-intelligence/` | Искусственный интеллект | theses / artificial-intelligence |
| `/{ru,en}/projects/papanda/dialectical-notes/` | Диалектические конспекты | pages / dialectical-notes |
| `/` | Выбор языка / | Подписи этой страницы |
| `/404.html` | Страница 404 | Подписи этой страницы |
