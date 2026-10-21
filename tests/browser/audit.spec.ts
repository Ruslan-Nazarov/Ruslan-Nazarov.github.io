import {test,expect} from '@playwright/test';
import {routes} from '../../src/lib/content.mjs';

test('all bilingual pages fit narrow phones and desktop with valid images and no runtime errors',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const lang of ['ru','en'])for(const path of routes()){
    await page.goto(`/${lang}/${path?path+'/':''}`);
    await expect(page.locator('main h1')).toHaveCount(1);
    for(const width of [320,768,1440]){
      await page.setViewportSize({width,height:900});
      const overflow=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(e).position!=='absolute').slice(0,5).map(e=>e.tagName+'.'+e.className)}));
      expect.soft(overflow.actual,`${lang}/${path} at ${width}: ${overflow.offenders.join(', ')}`).toBeLessThanOrEqual(width+1);
    }
    expect(await page.locator('main img').evaluateAll(images=>images.filter(i=>(i as HTMLImageElement).complete&&!(i as HTMLImageElement).naturalWidth).map(i=>i.getAttribute('src')))).toEqual([]);
  }
  expect(errors).toEqual([]);
});
test('article contents, reading labels and keyboard menu work',async({page})=>{
  await page.goto('/ru/projects/papanda/');
  const anchor=page.locator('.article-contents a').last();const href=await anchor.getAttribute('href');
  await anchor.click();expect(new URL(page.url()).hash).toBe(encodeURI(href!));
  await page.goto('/ru/publications/');
  await expect(page.locator('.reading-mode')).toHaveCount(13);
  await page.goto('/ru/publications/can-ai-think-differently/');
  await expect(page.locator('.publication-actions a')).toHaveAttribute('href',/medium.com/);
  await page.setViewportSize({width:320,height:800});
  await page.locator('.menu-toggle').click();await page.locator('#main-nav a').first().focus();await page.keyboard.press('Escape');
  await expect(page.locator('.menu-toggle')).toBeFocused();await expect(page.locator('#main-nav')).toBeHidden();
});
test('editor preserves defaults, explains readiness and locks fields during save',async({page})=>{
  await page.goto('http://127.0.0.1:4322/');
  page.on('dialog',dialog=>dialog.accept('audit-draft'));
  await page.locator('#collections .new').first().click();
  await expect(page.locator('[data-field=order]')).toHaveValue('100');
  await expect(page.locator('#readiness')).toContainText('Скрыто с сайта');
  await page.locator('[data-field=publish]').check();await expect(page.locator('#readiness')).toContainText('русская версия');
  await page.route('**/api/save',async route=>{await new Promise(r=>setTimeout(r,300));await route.fulfill({json:{message:'Сохранено локально (имитация)'}})});
  await page.locator('#save').click();await expect(page.locator('[data-field=title_ru]')).toBeDisabled();
  await expect(page.locator('#status')).toContainText('Сохранено локально');await expect(page.locator('[data-field=title_ru]')).toBeEnabled();
});
