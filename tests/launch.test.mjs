import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {relative, join} from 'node:path';
import {remainingTime} from '../src/launch/countdown.mjs';
import {routes} from '../src/lib/content.mjs';

const deadline = '2026-11-11T00:00:00+05:00';
test('launch countdown uses total hours and the explicit UTC+5 launch instant', () => {
  assert.deepEqual(remainingTime(deadline, Date.parse('2026-11-01T00:00:00+05:00')), {hours:240, minutes:0, seconds:0, finished:false});
  assert.deepEqual(remainingTime(deadline, Date.parse('2026-11-10T17:58:57Z')), {hours:1, minutes:1, seconds:3, finished:false});
  assert.deepEqual(remainingTime(deadline, Date.parse('2026-11-10T18:59:59.500Z')), {hours:0, minutes:0, seconds:1, finished:false});
  for (const now of ['2026-11-10T19:00:00Z','2026-11-12T00:00:00Z']) {
    assert.deepEqual(remainingTime(deadline, Date.parse(now)), {hours:0, minutes:0, seconds:0, finished:true});
  }
});

test('closed public build replaces deep links and excludes content, downloads and search assets', {skip:!JSON.parse(readFileSync('src/data/launch.json','utf8')).enabled}, () => {
  const result = spawnSync(process.execPath, ['scripts/build-public.mjs'], {encoding:'utf8', windowsHide:true});
  assert.equal(result.status, 0, result.stderr);
  const files = readdirSync('dist', {recursive:true, withFileTypes:true}).filter(entry=>entry.isFile());
  assert.ok(files.length > 100);
  for (const entry of files) {
    const path = relative('dist', join(entry.parentPath, entry.name)).replaceAll('\\','/');
    assert.ok(/^(?:(?:ru|en)\/.*index\.html|index\.html|404\.html|launch(?:-fonts)?\.css|countdown\.mjs|robots\.txt|yandex_64f199e3e08207c6\.html|icons\/rn-favicon\.svg|fonts\/[^/]+)$/.test(path), `Unexpected public asset: ${path}`);
  }
  for (const lang of ['ru','en']) for (const path of routes()) {
    const html = readFileSync(`dist/${lang}/${path ? path+'/' : ''}index.html`, 'utf8');
    assert.ok(html.includes(`lang="${lang}"`));
    assert.ok(html.includes(`data-launch-at="${deadline}"`));
    assert.ok(html.includes('noindex, nofollow'));
    assert.ok(!html.includes('{{'));
    assert.ok(!html.includes('data-pagefind-body'));
  }
  assert.deepEqual(readFileSync('dist/yandex_64f199e3e08207c6.html'), readFileSync('public/yandex_64f199e3e08207c6.html'));
});
