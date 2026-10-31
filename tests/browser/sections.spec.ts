import {test,expect} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const chapters=readdirSync('src/content/theses').filter(f=>f.endsWith('.json')).map(f=>read('src/content/theses/'+f));
for(const lang of ['ru','en']){
  test(`chapter overviews ${lang} use the same source in both reading modes`,async({page})=>{
    await page.goto(`/${lang}/publications/theses-2020-2026/`);
    await expect(page.locator('.thesis-toolbar a').first()).toContainText(lang==='ru'?'Обзор и главы':'Overview and chapters');
    await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
    await page.goto(`/${lang}/publications/theses-2020-2026/full/`);
    await expect(page.locator('[data-chapter-overview]')).toHaveCount(5);
    for(const chapter of chapters){
      const paragraph=chapter['body_'+lang].split('\n\n')[1];
      await expect(page.locator('#chapter-'+chapter.id)).toContainText(paragraph);
      await page.goto(`/${lang}/publications/theses-2020-2026/chapters/${chapter.slug}/`);
      await expect(page.locator('[data-chapter-overview]')).toHaveCount(1);
      await expect(page.locator('.prose')).toContainText(paragraph);
      await page.goto(`/${lang}/publications/theses-2020-2026/full/`);
    }
  });
  test(`articles and books ${lang} show full texts, covers and reading links`,async({page})=>{
    await page.goto(`/${lang}/articles/`);
    const articles=JSON.parse(readFileSync('src/data/published.json','utf8')).publications.filter((row:any)=>row.type==='article'&&row.readingMode==='full');
    await expect(page.locator('.card')).toHaveCount(articles.length);
    for(const row of articles){
      await page.goto(`/${lang}/publications/${row.slug}/`);
      const paragraph=row['body_'+lang].split('\n\n').find((part:string)=>part.trim()&&!part.startsWith('#')).replace(/\\\./g,'.').replace(/^\*|\*$/g,'');
      await expect(page.locator('.prose')).toContainText(paragraph);
    }
    await page.goto(`/${lang}/books/`);
    await expect(page.locator('.book-entry')).toHaveCount(2);
    await expect(page.locator('.book-cover')).toHaveCount(2);
    expect(await page.locator('.book-cover').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
    for(const link of await page.locator('.book-entry .button').evaluateAll(links=>links.map(a=>(a as HTMLAnchorElement).href)))expect(link).toMatch(/^https:\/\/ruslan-nazarov.github.io\/handbook_/);
    await page.setViewportSize({width:320,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
}
