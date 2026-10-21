# papanda and the local media library — 21 October 2026

The project page uses the author's `papanda_page_final_RU_EN.md` supplied in
the parent workspace. Both versions retain the source paragraphs, section
order, three ECG stages and the distinction between personal experience and
unverified educational effectiveness. The byline, title, motto, card summary
and body are editable data. No screenshots, quotes, results or live/download
addresses were invented. Optional confirmed ECG URLs live in `exampleLinks`;
empty URLs never create anchors. The supplied instructional link marker is
represented by a bilingual pending confirmation message.

`src/data/media.json` is a versioned registry. Seven slots retain stable IDs,
paired author alt/captions, a `placeholder|ready` state and an optional asset
ID. Body markers `[[media:id]]` work in projects, articles, pages and chapters.
`MediaBody.astro` renders sanitized Markdown between media components;
`Media.astro` resolves the file at build time and renders a placeholder when
the path is absent. Binding a screenshot changes registry data only. Asset
metadata supplies captions/alt for generic body inserts, hero images and
galleries. Slot-specific captions/alt take precedence for the seven author
illustrations. Public figures use a keyboard-accessible dialog with natural
size and scrolling, so formulas can be read on narrow screens.

The existing Astro routes, editorial readiness/snapshot rules, `.pages.yml`
field editor, build/search process, Git Credential Manager authorization and
GitHub Actions publishing are retained. Pages CMS documentation was inspected:
its image fields select/upload files in the Git repository; this does not
provide local filesystem access. A named `/media` source is configured for
Pages CMS, while the requested local catalog is implemented in the existing
loopback helper. Source references:

- https://pagescms.org/docs/configuration/media/
- https://pagescms.org/docs/configuration/fields/image/

The local helper discovers existing `public/images` and `public/media`
images without moving them. New uploads go into `public/media/<project>`;
metadata is persisted on upload/edit/binding. IDs, file paths and upload
dates cannot be altered through metadata editing. Replacement requires the
same image format to preserve all existing URLs. Raster bytes are decoded
for validation, then stored unchanged. The 8 MiB / 40 million pixel limits,
extension/MIME/decoder agreement and a small static SVG allowlist reject
active or externally referencing uploads. Legacy GIF/PDF uploads remain
available. SVGs using CSS, external resources, animation or unsupported
elements should be exported to PNG/WebP or the allowed static SVG subset.

The library shows search, project/tag filters, date/title sorting, full-size
preview, metadata editing, file replacement and missing-media tasks. Image
fields and body fields can reuse existing assets. Deletion reports both slot
bindings and references in current material, settings, saved publications and
source code. Direct references block deletion. Confirmed deletion of files
used only through slots clears bindings and returns those slots to
placeholders. Cancellation performs no mutation.

Editor endpoints remain local, host checked and CSRF protected; media paths
cannot escape the public media directories or follow symlinks. Uploads and
registry changes join the existing editorial Git allowlist. The dedicated
publish button asks for confirmation before invoking the existing
build/commit/push flow. Build or upstream conflicts stop that flow. Code
changes still must be committed separately before editorial publishing, as
required by the existing publisher. No production tokens or administrative
scripts enter `dist`; build verification checks for accidental leakage.

Verification commands:

```powershell
npm run check
npm test
npm run build
npm run test:browser
npm run test:features
npm run test:media
```

`test:media` creates an isolated checkout-shaped fixture, initializes a local
Git index and exercises the real editor API/UI with a test PNG. It verifies
search/filtering, slot assignment, reload persistence, Git changes, public
RU/EN captions and alt, mobile layout and viewer, replacement, metadata,
reuse, deletion cancellation/confirmation and invalid requests. It blocks
publish requests and never contacts GitHub. Publisher tests use temporary
local bare repositories, including media files and registry changes. Test
screenshots/logs remain under ignored `.local/` directories.
