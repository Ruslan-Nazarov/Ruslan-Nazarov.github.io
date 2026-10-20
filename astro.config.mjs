import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ruslan-nazarov.github.io',
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react(), sitemap({ filter: page => !/\/(search|404)\/?$/.test(page) })],
  vite: { server: { fs: { strict: true } } }
});
