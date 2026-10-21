# papanda Languages — content sources

Prepared on 2026-10-21 as a bilingual editorial description, with author
proofreading deferred to the next editorial pass. The project stays
`active` / `In development`; it is not presented as a completed product or
as a demonstrated educational result.

The owner supplied and confirmed these public addresses:

- App source: https://github.com/Ruslan-Nazarov/papanda-language-app
- Original book: https://ruslan-nazarov.github.io/handbook_Languages/
- Android build: https://expo.dev/accounts/runaz/projects/papanda-app/builds/ac5fed96-5e12-419e-b8c6-59dc8b1d452c

The app repository was read through the connected GitHub tool, without
modifying it. Inspected revision: `f335096e744f7723ed51d59b80662444bd961ec2`.
Sources for statements on the page:

| Source | Information used |
| --- | --- |
| `README.md` | Author's opening motto; sentence analysis, morphemes, vocabulary, review and statistics; AI examples and built-in fallback; Android build availability |
| `package.json`, `app.json` | Source version 1.0.1; mobile application |
| `src/constants/languages.ts` | English, Italian, Spanish, German, French, Kazakh and Latin |
| `src/screens/SentenceTrainerScreen.tsx` | Generated, cached and built-in sentence fallback |
| `src/services/sentenceGeneration.ts` | Vocabulary-based generation and validation |
| `src/screens/BrainWorkoutScreen.tsx`, `src/utils/statistics.ts` | Review priority based on memory weight; iMW is an internal model, not an independent proficiency measure |
| `src/store/useStore.ts` | Persisted practice data on the device |
| `book/README.md` | Methodological link to the author's book; sentence meaning and structure as a starting point |

The Russian motto reproduces the author's README wording. The rest of the
page is a site editorial description, with a matching English version;
`editorialStatus` is `editorial_summary`. Source review does not constitute
a device test or an evaluation of educational effectiveness. No participant
counts, measured learning outcomes or release dates were invented. The
README's download URL and installation advice were not copied; the page
uses the specific Expo build address supplied by the owner.

The original book and its CC BY-NC-ND 4.0 licence are unchanged. The site
links to its existing publication card and the original external edition;
book chapters were not reproduced or translated.

Three illustration slots use the existing media registry and local editor:
`papanda-languages-sentence`, `papanda-languages-vocabulary`,
`papanda-languages-practice`. Each has bilingual alt/captions and initially
renders a placeholder. No screenshots were invented. All seven papanda
notes slots retain their previous IDs and texts. An inline media marker
now suppresses the redundant empty gallery for any project, rather than
using a papanda-only exception. Existing populated galleries are retained.

Project-page browser checks cover both projects in RU/EN, heading order,
slot isolation, empty-link protection, language switching and mobile
layout. Existing unit tests scope papanda's seven slots by project so
adding a second project's media cannot break them.
