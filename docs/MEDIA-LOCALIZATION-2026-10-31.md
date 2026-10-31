# Иллюстрации приложений

Русские оригиналы сохранены без изменений. Английские варианты подготовлены встроенным `image_gen` в режиме редактирования изображений. Подписи английской страницы прямо обозначают перевод изображения; это не подтверждение запуска программы с английским интерфейсом.

## Тайм менеджмент

| Вид | Русский оригинал | Английская версия |
| --- | --- | --- |
| Основной экран | [overview-ru.png](../public/media/time-management/overview-ru.png) | [overview-en.png](../public/media/time-management/overview-en.png) |
| Календарь | [calendar-ru.png](../public/media/time-management/calendar-ru.png) | [calendar-en.png](../public/media/time-management/calendar-en.png) |
| Стикеры | [stickers-ru.png](../public/media/time-management/stickers-ru.png) | [stickers-en.png](../public/media/time-management/stickers-en.png) |

Автор уточнил смысл пары: «Главное» — дело, определяющее жизнь на текущий период; «Замена» — другое дело, чтобы отдохнуть от главного. На английской иллюстрации использованы Main focus и For a change. Страница проекта теперь описывает именно эту пару, рабочие панели, календарь, заметки и стикеры.

[Точные запросы редактирования изображений](time-management-image-prompts.json).

## Языковое приложение

В трёх основных английских иллюстрациях переведены подписи интерфейса. Учебные слова, предложения и русские пояснения к изучаемым словам сохранены. Например, казахское «салық» не заменено английским переводом: карточка должна по-прежнему показывать задание со скрытым ответом.

| Вид | Русский оригинал | Английская версия |
| --- | --- | --- |
| Разбор предложения | [sentence-ru.jpg](../public/media/papanda-languages/sentence-ru.jpg) | [sentence-en.png](../public/media/papanda-languages/sentence-en.png) |
| Многоязычная карточка | [vocabulary-ru.jpg](../public/media/papanda-languages/vocabulary-ru.jpg) | [vocabulary-en.png](../public/media/papanda-languages/vocabulary-en.png) |
| Повторение слова | [practice-ru.jpg](../public/media/papanda-languages/practice-ru.jpg) | [practice-en.png](../public/media/papanda-languages/practice-en.png) |

Остальные три оригинала включены в дополнительную галерею. Они остаются русскими на обеих версиях страницы; английские подписи указывают язык интерфейса:

- [Словарь с предупреждением о переводе](../public/media/papanda-languages/dictionary-ru.jpg).
- [Карточка слова «иголка» и личная ассоциация](../public/media/papanda-languages/needle-ru.jpg).
- [Разбор казахского предложения](../public/media/papanda-languages/kazakh-sentence-ru.jpg).

[Точные запросы перевода подписей интерфейса](language-app-image-prompts.json).

## Другие полученные кадры

Для Podcast Sound Lab, MusicLab и математической карты дополнительно получены шесть оригинальных кадров. Текст внутри них не менялся; на английских страницах подписи указывают русский интерфейс.

| Проект и вид | Оригинал |
| --- | --- |
| Podcast Sound Lab, видеоредактор | [video-workspace-ru.png](../public/media/podcast-sound-lab/video-workspace-ru.png) |
| Podcast Sound Lab, монтажная шкала | [video-timeline-ru.png](../public/media/podcast-sound-lab/video-timeline-ru.png) |
| MusicLab, плейлисты | [playlists-ru.png](../public/media/musiclab/playlists-ru.png) |
| MusicLab, статистика | [listening-statistics-ru.png](../public/media/musiclab/listening-statistics-ru.png) |
| Математическая карта, маршрут | [route-ru.png](../public/media/mathematical-parser/route-ru.png) |
| Математическая карта, 3D-вид | [map-3d-ru.png](../public/media/mathematical-parser/map-3d-ru.png) |

Снимки математической карты показывают рабочую версию приложения. Встроенная в сайт интерактивная демонстрация по-прежнему использует свой отдельный небольшой набор данных. Разбор произвольной формулы этими снимками не заявляется.

## Подключение на сайте

У изображения в `src/data/media.json` может быть дополнительный `path_en`. Английская страница выбирает его, а при отсутствии переведённого варианта использует оригинал. Русские снимки papanda с конспектом «Трансформеры» продолжают показываться на обеих версиях страницы с прежними подписями языка.

Перед сборкой проверяется наличие заявленных английских файлов. Портретные снимки ограничены по высоте на странице и открываются в полном размере при нажатии.
