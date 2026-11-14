import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const blogCategories = {
  ai: { ru: 'Искусственный интеллект', en: 'Artificial intelligence' },
  education: { ru: 'Образование', en: 'Education' },
  science: { ru: 'Наука и философия', en: 'Science and philosophy' },
  projects: { ru: 'Проекты и инструменты', en: 'Projects and tools' },
  notes: { ru: 'Заметки', en: 'Notes' }
};

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date');

export const blogPostSchema = z.object({
  slug: z.string().regex(/^video-[a-f0-9]{16}$/),
  language: z.enum(['ru', 'en']),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(300),
  date: calendarDate,
  category: z.enum(['ai', 'education', 'science', 'projects', 'notes']),
  tags: z.array(z.string().regex(/^[\p{L}\p{N}_-]{1,40}$/u)).min(1).max(8),
  body: z.string().trim().min(1).max(100000)
}).strict();

export function readBlogPosts(directory = 'src/content/blog') {
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => {
      const post = blogPostSchema.parse(JSON.parse(readFileSync(join(directory, entry.name), 'utf8')));
      if (entry.name !== post.slug + '.json') throw new Error('Blog filename does not match slug: ' + entry.name);
      return post;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function blogDate(value, lang) {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    dateStyle: 'long', timeZone: 'UTC'
  }).format(new Date(value + 'T12:00:00Z'));
}

export function blogMarkdown(body) {
  // Section folding belongs to the editor. Blog headings always show their content.
  return body
    .replace(/^((?:\{:align=(?:left|center|right|justify)\} )?#{1,3} )\{:collapsed\} /gm, '$1')
    .replace(/^\{:align=(left|center|right|justify)\} (.+)$/gm, '\n<!-- editor-align:$1 -->\n$2');
}
