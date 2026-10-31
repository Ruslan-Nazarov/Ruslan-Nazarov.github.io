import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const lib=JSON.parse(readFileSync('src/data/media.json','utf8'));
const algorithm=JSON.parse(readFileSync('src/data/papanda-algorithm.json','utf8'));
for(const project of ['papanda','papanda-languages','mathematical-parser','dialectic-ai','protocol-ai','personal-time-management','podcast-sound-lab','musiclab','useful-prompts']){
const row=JSON.parse(readFileSync(`src/content/projects/${project}.json`,'utf8'));
const slots=lib.slots.filter((s:any)=>s.project===project&&s.status==='ready');
for(const lang of ['ru','en'])test(`${project} ${lang}: copy, ready illustrations, language switch and mobile`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/${lang}/projects/${row.slug}/`);
  await expect(page.locator('h1')).toHaveText(row['title_'+lang]);
  await expect(page.locator('.papanda-motto')).toHaveText(row['motto_'+lang]);
  await expect(page.locator('.page-description')).toHaveText(row['summary_'+lang]);
  await expect(page.locator('.detail-sidebar .badge')).toHaveText(row['statusLabel_'+lang]);
  if(project==='mathematical-parser'){
    await expect(page.locator('.prose blockquote')).toContainText(lang==='ru'?'ещё не завершён':'is not complete');
    await expect(page.locator('.prose blockquote')).toContainText(lang==='ru'?'Исходный код пока не опубликован':'The source code has not been published yet');
    await expect(page.getByRole('link',{name:lang==='ru'?'Открыть демонстрацию ↗':'Open the demo ↗',exact:true})).toHaveAttribute('href',`/${lang}/projects/mathematical-parser/graph/`);
    await expect(page.locator('.prose input')).toHaveCount(0);
  }
  if(project==='papanda'){
    const diagram=page.locator('[data-algorithm-diagram]');
    await expect(diagram).toHaveAttribute('data-algorithm-diagram',lang);
    expect(await diagram.locator('.algorithm-step-title').allTextContents()).toEqual(algorithm[lang].steps.map((step:any)=>step.title));
    expect(await diagram.locator('.algorithm-prompt').allTextContents()).toEqual(algorithm[lang].steps.map((step:any)=>step.prompt));
    expect(await diagram.locator('.algorithm-detail').allTextContents()).toEqual(algorithm[lang].steps.filter((step:any)=>step.detail).map((step:any)=>step.detail));
    await diagram.screenshot({path:`.local/papanda-algorithm-${lang}.png`});
    const screenshot=page.locator('[data-media-id="papanda-editor"]');
    await expect(screenshot.locator('img')).toHaveAttribute('src','/media/papanda/transformers-editor-ru.png');
    await expect(screenshot.locator('figcaption')).toContainText(lang==='ru'?'английский конспект готовится':'English note is in preparation');
    await screenshot.locator('a').click();
    await expect(page.locator('#media-viewer')).toBeVisible();
    await expect(page.locator('#media-viewer img')).toHaveAttribute('src',/\/media\/papanda\/transformers-editor-ru\.png$/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#media-viewer')).not.toBeVisible();
  }
  for(const link of row.links)await expect(page.locator('.detail-sidebar').getByRole('link',{name:link['label_'+lang]+' ↗',exact:true})).toHaveAttribute('href',link.url);
  const headings=[...row['body_'+lang].matchAll(/^#{2,3} (.+)$/gm)].map(match=>match[1]);
  expect(await page.locator('.prose h2,.prose h3').allTextContents()).toEqual(headings);
  expect(await page.locator('[data-media-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-media-id')))).toEqual(slots.map((s:any)=>s.id));
  for(const slot of slots){const figure=page.locator(`[data-media-id="${slot.id}"]`);await expect(figure.locator('figcaption')).toHaveText(slot['caption_'+lang]);await expect(figure.locator('img')).toHaveAttribute('alt',slot['alt_'+lang])}
  await expect(page.locator('.media-placeholder')).toHaveCount(0);
  await expect(page.locator('a[href*="papanda.kz"],a[download],a[href*="releases/download"],a[href=""],a[href="#"]')).toHaveCount(0);
  await expect(page.locator('.example-links')).toHaveCount(0);
  await page.screenshot({path:`.local/${project}-${lang}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.local/${project}-${lang}-mobile.png`,fullPage:true});
  const other=lang==='ru'?'en':'ru';await page.locator(`[data-language="${other}"]`).click();await expect(page).toHaveURL(new RegExp(`/${other}/projects/${row.slug}/$`));
  expect(errors).toEqual([]);
});
}
