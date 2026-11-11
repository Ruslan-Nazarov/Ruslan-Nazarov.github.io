import {test,expect} from './fixtures';
import {readFileSync,readdirSync} from 'node:fs';
import {allContent} from '../../src/lib/content.mjs';
import {markdown} from '../../src/lib/markdown.mjs';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const chapters=readdirSync('src/content/theses').filter(f=>f.endsWith('.json')).map(f=>read('src/content/theses/'+f));
for(const lang of ['ru','en']){
  test(`final chapters ${lang} use the same source in both reading modes`,async({page})=>{
    await page.goto(`/${lang}/publications/theses-2020-2026/`);
    await expect(page.locator('.thesis-toolbar a').first()).toContainText(lang==='ru'?'Читать одной страницей':'Read as one page');
    const pdf=page.getByRole('link',{name:`PDF ${lang.toUpperCase()} ↓`,exact:true});
    await expect(pdf).toHaveAttribute('href',`/theses/october-2026/theses-${lang}.pdf`);
    const response=await page.request.get((await pdf.getAttribute('href'))!);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
    await page.goto(`/${lang}/publications/theses-2020-2026/full/`);
    await expect(page.locator('[data-chapter-overview]')).toHaveCount(0);
    for(const chapter of chapters){
      const paragraphs=await page.locator('#chapter-'+chapter.id+' p').allTextContents();
      expect(paragraphs.length).toBeGreaterThan(0);
      await page.goto(`/${lang}/publications/theses-2020-2026/chapters/${chapter.slug}/`);
      await expect(page.locator('[data-chapter-overview]')).toHaveCount(0);
      expect(await page.locator('.prose p').allTextContents()).toEqual(paragraphs);
      await page.goto(`/${lang}/publications/theses-2020-2026/full/`);
    }
  });
  test(`articles and books ${lang} show full texts, covers and reading links`,async({page})=>{
    await page.goto(`/${lang}/articles/`);
    const articles=allContent().publications.filter((row:any)=>row.type==='article'&&row.readingMode==='full');
    await expect(page.locator('.article-entry')).toHaveCount(articles.length);
    for(const row of articles){
      await page.goto(`/${lang}/publications/${row.slug}/`);
      // Compare readable text, including articles whose opening has inline Markdown.
      const paragraph=await page.evaluate(html=>{
        const document=new DOMParser().parseFromString(html,'text/html');
        return [...document.querySelectorAll('p,pre,li')].find(p=>p.textContent?.trim())?.textContent;
      },await markdown(row['body_'+lang]));
      expect(paragraph).toBeTruthy();
      await expect(page.locator('.prose')).toContainText(paragraph!);
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
