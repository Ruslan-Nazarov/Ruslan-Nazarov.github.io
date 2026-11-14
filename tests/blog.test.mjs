import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { blogMarkdown, blogPostSchema, readBlogPosts } from '../src/lib/blog.mjs';
import { markdown } from '../src/lib/markdown.mjs';

const example = {
  slug: 'video-0123456789abcdef', language: 'ru', title: 'Тестовая запись',
  summary: 'Описание', date: '2026-11-14', category: 'ai', tags: ['ИИ'],
  body: '## {:collapsed} Подзаголовок\n\n**Основной текст**',
};

test('blog accepts author-language posts and validates their dates, categories and filenames', t => {
  const dir = mkdtempSync(join(tmpdir(), 'rn-blog-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, example.slug + '.json'), JSON.stringify(example));
  assert.deepEqual(readBlogPosts(dir), [example]);
  assert.equal(blogPostSchema.safeParse({ ...example, date: '2026-02-30' }).success, false);
  assert.equal(blogPostSchema.safeParse({ ...example, category: 'other' }).success, false);
  writeFileSync(join(dir, 'wrong.json'), JSON.stringify(example));
  assert.throws(() => readBlogPosts(dir), /filename/);
});

test('blog markdown strips editor folding and avoids untrusted HTML or unpublished local links', async () => {
  const body = blogMarkdown(example.body + '\n\n<script>alert(1)</script>\n\n[local](/draft/) [external](https://example.org)\n\n{:align=center} Строка');
  const html = await markdown(body, { externalLinksOnly: true });
  assert.match(html, /<h2>Подзаголовок<\/h2>/);
  assert.match(html, /<strong>Основной текст<\/strong>/);
  assert.match(html, /href="https:\/\/example.org"/);
  assert.match(html, /align="center"/);
  assert.doesNotMatch(html, /<script|href="\/draft\/|collapsed/);
});
