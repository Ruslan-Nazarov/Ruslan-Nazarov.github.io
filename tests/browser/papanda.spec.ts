import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const row=JSON.parse(readFileSync('src/content/projects/papanda.json','utf8'));
const lib=JSON.parse(readFileSync('src/data/media.json','utf8'));
for(const lang of ['ru','en'])test(`papanda ${lang}: author copy, ordered placeholders, language switch and mobile`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/${lang}/projects/papanda/`);
  await expect(page.locator('h1')).toHaveText(row['title_'+lang]);
  await expect(page.locator('.papanda-motto')).toHaveText(row['motto_'+lang]);
  await expect(page.locator('.page-description')).toHaveText(row['summary_'+lang]);
  const headings=[...row['body_'+lang].matchAll(/^#{2,3} (.+)$/gm)].map(match=>match[1]);
  expect(await page.locator('.prose h2,.prose h3').allTextContents()).toEqual(headings);
  expect(await page.locator('[data-media-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-media-id')))).toEqual(lib.slots.map((s:any)=>s.id));
  for(const slot of lib.slots){const figure=page.locator(`[data-media-id="${slot.id}"]`);await expect(figure.locator('figcaption')).toHaveText(slot['caption_'+lang]);await expect(figure.locator('[role=img]')).toHaveAttribute('aria-label',slot['alt_'+lang])}
  await expect(page.locator('a[href*="papanda.kz"],a[download],a[href*="releases/download"],a[href=""],a[href="#"]')).toHaveCount(0);
  await expect(page.locator('.example-links')).toHaveCount(0);
  await page.screenshot({path:`.local/papanda-${lang}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.local/papanda-${lang}-mobile.png`,fullPage:true});
  const other=lang==='ru'?'en':'ru';await page.locator(`[data-language="${other}"]`).click();await expect(page).toHaveURL(new RegExp(`/${other}/projects/papanda/$`));
  expect(errors).toEqual([]);
});
