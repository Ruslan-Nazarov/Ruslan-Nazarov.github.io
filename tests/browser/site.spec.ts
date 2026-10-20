import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('local editor rebuilds the site and search index without publishing',async({page})=>{
  test.setTimeout(90000);
  await page.goto('http://127.0.0.1:4322/');
  await page.getByRole('button',{name:'Пересобрать сайт',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Сайт и поиск обновлены',{timeout:75000});
  await page.goto('/ru/search/');
  await expect(page.locator('.pagefind-ui__search-input')).toBeVisible();
});
test('home, persistent theme and corresponding language switch',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/ru/');
  await expect(page.locator('h1')).toHaveText('Как человек приходит к пониманию — и какую роль в этом играет ИИ?');
  await page.locator('#theme-select').selectOption('dark');
  await page.reload();await expect(page.locator('html')).toHaveClass(/dark/);
  await page.locator('#theme-select').selectOption('light');
  await page.screenshot({path:'.local/home-desktop.png',fullPage:true});
  await page.goto('/ru/projects/mathematical-parser/');
  await page.locator('[data-language="en"]').click();
  await expect(page).toHaveURL(/\/en\/projects\/mathematical-parser\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.goto('/');await expect(page).toHaveURL(/\/en\/$/);
  expect(errors).toEqual([]);
});
test('catalog filters combine and reset',async({page})=>{
  await page.goto('/ru/projects/');
  await expect(page.locator('[data-filter-item]:visible')).toHaveCount(6);
  await page.locator('[data-filter-area]').selectOption('education');
  await expect(page.locator('[data-filter-item]:visible')).toHaveCount(2);
  await page.locator('[data-filter-search]').fill('Languages');
  await expect(page.locator('[data-filter-item]:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  await expect(page.locator('[data-filter-item]:visible')).toHaveCount(6);
  await page.locator('[data-filter-search]').fill('not-existing');
  await expect(page.locator('[data-no-results]')).toBeVisible();
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
test('RSS, metadata, Yandex verification and safe absent integrations',async({page,request})=>{
  await page.goto('/ru/about/');
  await expect(page.locator('form.contact-form')).toHaveCount(0);
  await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href','https://ruslan-nazarov.github.io/en/about/');
  const verification=await request.get('/yandex_64f199e3e08207c6.html');
  expect(await verification.body()).toEqual(readFileSync('public/yandex_64f199e3e08207c6.html'));
  for(const lang of ['ru','en']){const rss=await request.get(`/${lang}/rss.xml`);expect(rss.ok()).toBe(true);expect(await rss.text()).not.toContain('PRIVATE_DRAFT')}
  const res=await request.get('/no-such-page/');expect(res.status()).toBe(404);
});
test('local editor loads structured fields, saves locally and rejects unauthenticated writes',async({page,request})=>{
  await page.goto('http://127.0.0.1:4322/');
  await page.getByRole('button',{name:'settings',exact:true}).first().click();
  await expect(page.locator('input[data-field="name"]')).toHaveValue('Ruslan Nazarov');
  await expect(page.locator('textarea[data-field="heroTitle"]')).toHaveCount(2);
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Сохранено локально');
  const response=await request.post('http://127.0.0.1:4322/api/save',{data:{collection:'site',name:'settings',data:{}}});
  expect(response.status()).toBe(403);
  const publish=await request.post('http://127.0.0.1:4322/api/publish',{data:{}});
  expect(publish.status()).toBe(403);
  await expect(page.getByRole('button',{name:'Опубликовать на сайте',exact:true})).toBeVisible();
  await page.screenshot({path:'.local/editor.png',fullPage:false});
});


test('local editor publication button explains deployment result',async({page})=>{
  await page.route('**/api/publish',async route=>{
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-editor-token']).toBeTruthy();
    await route.fulfill({json:{message:'Материалы отправлены в GitHub. Сайт обновится автоматически.',sha:'test-commit',actions:'https://github.com/Ruslan-Nazarov/Ruslan-Nazarov.github.io/actions/workflows/deploy.yml'}});
  });
  await page.goto('http://127.0.0.1:4322/');
  await page.getByRole('button',{name:'Опубликовать на сайте',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Сайт обновится автоматически');
  await expect(page.locator('#status a')).toHaveAttribute('href','https://github.com/Ruslan-Nazarov/Ruslan-Nazarov.github.io/actions/workflows/deploy.yml');
  await expect(page.getByRole('button',{name:'Опубликовать на сайте',exact:true})).toBeEnabled();
});
