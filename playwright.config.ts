import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  timeout:30000,fullyParallel:false,workers:1,
  use:{baseURL:'http://127.0.0.1:4321',viewport:{width:1440,height:1000},locale:'ru-RU',trace:'retain-on-failure',screenshot:'only-on-failure'},
  reporter:[['list'],['html',{open:'never'}]]
});
