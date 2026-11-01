import {readFileSync, mkdirSync, writeFileSync, cpSync, rmSync, lstatSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {routes} from '../src/lib/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const launch = JSON.parse(readFileSync('src/data/launch.json', 'utf8'));
if (!launch.enabled) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {stdio:'inherit', shell:process.platform === 'win32', windowsHide:true});
  process.exit(result.status ?? 1);
}
if (!Number.isFinite(Date.parse(launch.at))) throw new Error('Invalid launch date');

const copy = {
  ru: {
    title:'Запуск 11 ноября 2026', name:'Руслан Назаров', otherUrl:'/en/', otherLang:'en', otherLabel:'EN',
    eyebrow:'Исследования и инструменты понимания', heading:'Скоро открытие',
    description:'Сайт готовится к запуску. До скорой встречи!', date:'11 ноября 2026', timezone:'00:00 · Кызылорда, UTC+5',
    countdownLabel:'До запуска', hours:'часов', minutes:'минут', seconds:'секунд',
    finished:'Запуск совсем скоро. Сайт готовится к открытию.', noScript:'Запуск сайта — 11 ноября 2026 в 00:00 (UTC+5). Для обратного отсчёта включите JavaScript.'
  },
  en: {
    title:'Launching November 11, 2026', name:'Ruslan Nazarov', otherUrl:'/ru/', otherLang:'ru', otherLabel:'RU',
    eyebrow:'Research & Tools for Understanding', heading:'Coming soon',
    description:'The website is getting ready to launch. See you soon!', date:'November 11, 2026', timezone:'00:00 · Qyzylorda, UTC+5',
    countdownLabel:'Until launch', hours:'hours', minutes:'minutes', seconds:'seconds',
    finished:'Launching soon. The website is getting ready to open.', noScript:'Launching November 11, 2026 at 00:00 (UTC+5). Enable JavaScript for the countdown.'
  }
};
const template = readFileSync('src/launch/index.html', 'utf8');
const logo = readFileSync('public/icons/rn-logo.svg', 'utf8');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const render = lang => template.replace(/\{\{(\w+)\}\}/g, (_, key) => key === 'logo' ? logo : escape(({...copy[lang], lang, at:launch.at})[key]));
const pages = routes();
// The public artifact is built from an allowlist, without copying public/ or an old build.
const output = resolve(root, 'dist');
if (output !== join(root, 'dist') || (existsSync(output) && lstatSync(output).isSymbolicLink())) throw new Error('Unsafe output directory');
rmSync(output, {recursive:true, force:true});
mkdirSync(output, {recursive:true});
function write(path, data) {
  const target = join(output, path);
  mkdirSync(resolve(target, '..'), {recursive:true});
  writeFileSync(target, data);
}
write('index.html', render('ru'));
write('404.html', render('ru'));
for (const lang of ['ru','en']) {
  const html = render(lang);
  for (const path of pages) write(`${lang}/${path ? path+'/' : ''}index.html`, html);
}
write('launch.css', readFileSync('src/launch/launch.css'));
write('launch-fonts.css', readFileSync('src/styles/fonts.css'));
write('countdown.mjs', readFileSync('src/launch/countdown.mjs'));
write('icons/rn-favicon.svg', readFileSync('public/icons/rn-favicon.svg'));
write('robots.txt', 'User-agent: *\nDisallow: /\n');
// Preserve the existing webmaster verification file byte for byte.
write('yandex_64f199e3e08207c6.html', readFileSync('public/yandex_64f199e3e08207c6.html'));
cpSync('public/fonts', join(output, 'fonts'), {recursive:true});
console.log(`Launch screen built for ${pages.length * 2 + 2} routes. Launch: ${launch.at}. Content, downloads and search index excluded.`);
