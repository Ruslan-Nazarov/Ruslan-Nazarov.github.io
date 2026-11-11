import {test as base,expect} from '@playwright/test';

// Exercise the local Metrica integration without sending test visits or
// depending on the third-party tracker. Its event logic has unit coverage.
export const test=base.extend({
  page:async({page},use)=>{
    await page.route('https://mc.yandex.ru/**',route=>route.abort());
    await use(page);
  }
});
export {expect};
