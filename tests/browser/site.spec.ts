import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('brand remains readable in system light and dark themes in both languages',async({page,request})=>{
  const site=JSON.parse(readFileSync('src/data/site.json','utf8'));
  for(const colorScheme of ['light','dark'] as const){
    await page.emulateMedia({colorScheme});
    for(const lang of ['ru','en'] as const){
      await page.goto(`/${lang}/`);
      await expect(page.locator('.brand-text')).toContainText(site[lang].brandDescriptor);
      await expect(page.locator('body')).toHaveCSS('background-color',colorScheme==='light'?'rgb(238, 236, 224)':'rgb(18, 22, 28)');
      await expect(page.locator('.brand .site-mark svg g')).toHaveCSS('fill',colorScheme==='light'?'rgb(29, 39, 51)':'rgb(234, 230, 223)');
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.fonts.check('500 32px "Source Serif 4"',document.querySelector('h1')!.textContent!))).toBe(true);
      expect(await page.evaluate(()=>document.fonts.check('400 18px Inter',document.querySelector('.brand-text small')!.textContent!))).toBe(true);
      if(lang==='ru')await page.screenshot({path:`.local/brand-${colorScheme}.png`});
    }
  }
  for(const asset of [site.favicon,site.socialImage,'/icons/rn-favicon.svg','/icons/apple-touch-icon.png','/site.webmanifest'])expect((await request.get(asset)).status()).toBe(200);
});
test('simple home and corresponding language switch',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/ru/');
  await expect(page.locator('h1')).toHaveText(JSON.parse(readFileSync('src/data/site.json','utf8')).ru.heroTitle);
  await expect(page.locator('#theme-select')).toHaveCount(0);
  await expect(page.locator('.section-directory a')).toHaveCount(7);
  await expect(page.locator('.section-directory').getByRole('link',{name:'Тезисы по диалектике'})).toHaveAttribute('href','/ru/publications/theses-2020-2026/full/');
  await expect(page.locator('.section-directory').getByRole('link',{name:'Тезисы об ИИ'})).toHaveAttribute('href','/ru/ai-theses/');
  await page.screenshot({path:'.local/home-desktop.png',fullPage:true});
  await page.goto('/ru/projects/mathematical-parser/');
  await page.locator('[data-language="en"]').click();
  await expect(page).toHaveURL(/\/en\/projects\/mathematical-parser\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.goto('/');await expect(page).toHaveURL(/\/en\/$/);
  expect(errors).toEqual([]);
});
test('navigation has seven sections and catalogues display all entries without filters',async({page,request})=>{
  for(const lang of ['ru','en']){
    for(const section of ['projects','publications']){
      await page.goto('/'+lang+'/'+section+'/');
      await expect(page.locator('#main-nav a')).toHaveCount(7);
      await expect(page.locator('.filter-bar,.result-count,.page-description')).toHaveCount(0);
      expect(await page.locator(section==='projects'?'.project-entry':'.card').count()).toBeGreaterThan(0);
      if(section==='projects'){
        await expect(page.locator('.project-section > h2')).toHaveText(lang==='ru'?['ИИ','Вайбкодинг']:['AI','Vibe coding']);
        await expect(page.locator('#ai .project-entry')).toHaveCount(3);
        await expect(page.locator('#vibecoding .project-entry')).toHaveCount(14);
        await expect(page.locator('.project-prompts a')).toHaveAttribute('href','https://github.com/Ruslan-Nazarov/useful_prompts');
      }
    }
    for(const path of ['research','journal','timeline','research/physics','journal/parser-project-page'])expect((await request.get('/'+lang+'/'+path+'/')).status()).toBe(404);
  }
});
test('React Flow loads, filters, selects and shows ancestors and descendants',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/ru/projects/mathematical-parser/graph/');
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await expect(page.locator('.react-flow__edge-path')).toHaveCount(5);
  const edgeViewport=await page.locator('.react-flow__edge-path').first().evaluate(p=>p.closest('svg')!.getBoundingClientRect().width);
  expect(edgeViewport).toBeGreaterThan(0);
  await page.locator('.react-flow__node').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.graph-detail h2')).toHaveText('Сложение');
  await page.locator('.graph-text-list button').filter({hasText:'Умножение'}).click();
  await expect(page.locator('.graph-detail h2')).toHaveText('Умножение');
  await page.locator('.relation-filter select').selectOption('predecessors');
  await expect(page.locator('.graph-related button')).toHaveCount(1);
  await page.locator('.relation-filter select').selectOption('descendants');
  await expect(page.locator('.graph-related button')).toHaveCount(4);
  await page.getByLabel('Найти узел',{exact:true}).fill('Корень');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await page.screenshot({path:'.local/graph-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Одобренный граф (0)',exact:true}).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('Pagefind searches only the current language',async({page})=>{
  await page.goto('/ru/search/');
  const input=page.locator('.pagefind-ui__search-input');
  await input.fill('papanda');
  await expect(page.locator('.pagefind-ui__result-link').first()).toBeVisible();
  for(const href of await page.locator('.pagefind-ui__result-link').evaluateAll(links=>links.map(a=>(a as HTMLAnchorElement).getAttribute('href'))))expect(href).toMatch(/^\/ru\//);
  await page.goto('/en/search/');await page.locator('.pagefind-ui__search-input').fill('papanda');
  await expect(page.locator('.pagefind-ui__result-link').first()).toBeVisible();
  for(const href of await page.locator('.pagefind-ui__result-link').evaluateAll(links=>links.map(a=>(a as HTMLAnchorElement).getAttribute('href'))))expect(href).toMatch(/^\/en\//);
});
test('mobile layouts, navigation and graph controls remain accessible',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/ru/','/en/projects/','/ru/publications/theses-2020-2026/full/','/ru/projects/mathematical-parser/graph/']){
    await page.goto(path);await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    if(path==='/ru/'){await page.screenshot({path:'.local/home-mobile.png',fullPage:true});await page.getByRole('button',{name:/Меню/}).click();await expect(page.locator('#main-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#main-nav')).toBeHidden()}
  }
  await page.locator('.graph-text-list button').first().click();
  await expect(page.locator('.graph-detail h2')).toHaveText('Сложение');
  await page.screenshot({path:'.local/graph-mobile.png',fullPage:true});
});
test('metadata, Yandex verification and safe absent integrations',async({page,request})=>{
  await page.goto('/ru/about/');
  await expect(page.locator('form.contact-form')).toHaveCount(0);
  await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href','https://ruslan-nazarov.github.io/en/about/');
  const verification=await request.get('/yandex_64f199e3e08207c6.html');
  expect(await verification.body()).toEqual(readFileSync('public/yandex_64f199e3e08207c6.html'));
  for(const lang of ['ru','en'])expect((await request.get(`/${lang}/rss.xml`)).status()).toBe(404);
  const res=await request.get('/no-such-page/');expect(res.status()).toBe(404);
});


