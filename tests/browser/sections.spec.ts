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
  test(`research, diary and chronology ${lang} contain public material with working links`,async({page,request})=>{
    for(const area of ['mathematics','physics','education','artificial-intelligence']){
      await page.goto(`/${lang}/research/${area}/`);
      await expect(page.locator('.editorial-note')).toHaveCount(0);
      expect(await page.locator('.question-list li').count()).toBeGreaterThanOrEqual(3);
      expect((await page.locator('.prose').innerText()).length).toBeGreaterThan(500);
    }
    await page.goto(`/${lang}/journal/`);await expect(page.locator('[data-filter-item]')).toHaveCount(2);
    const rss=await request.get(`/${lang}/rss.xml`);expect(await rss.text()).toContain('education-project-pages');expect(await rss.text()).toContain('parser-project-page');expect(await rss.text()).not.toContain('PRIVATE_DRAFT');
    await page.goto(`/${lang}/timeline/`);await expect(page.locator(`a[href="/${lang}/journal/parser-project-page/"]`)).toBeVisible();
    await page.goto(`/${lang}/about/`);await expect(page.locator('a[href="mailto:runaz2007@gmail.com"]')).toBeVisible();
    await page.goto(`/${lang}/`);await expect(page.locator(`a.button[href="/${lang}/projects/papanda/"]`)).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    for(const path of [`/${lang}/research/artificial-intelligence/`,`/${lang}/journal/`,`/${lang}/publications/theses-2020-2026/full/`]){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)}
  });
}
