import {test,expect} from './fixtures';
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
test('articles and catalogs omit technical blocks and preserve links and keyboard menu',async({page})=>{
  await page.goto('/ru/projects/papanda/');
  await expect(page.locator('.article-contents,.reading-mode')).toHaveCount(0);
  await page.goto('/ru/publications/');
  await expect(page.locator('.article-contents,.reading-mode')).toHaveCount(0);
  await page.goto('/ru/publications/can-ai-think-differently/');
  await expect(page.locator('.publication-actions a')).toHaveAttribute('href',/medium.com/);
  await page.setViewportSize({width:320,height:800});
  await page.locator('.menu-toggle').click();await page.locator('#main-nav a').first().focus();await page.keyboard.press('Escape');
  await expect(page.locator('.menu-toggle')).toBeFocused();await expect(page.locator('#main-nav')).toBeHidden();
});
