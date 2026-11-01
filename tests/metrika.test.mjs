import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Metrica initializes without session replay and classifies link clicks', () => {
  const listeners = {};
  const scripts = [];
  class Element { constructor(href) { this.href = href; } closest() { return this; } }
  const document = {
    currentScript: {dataset: {metricaId: '12345'}},
    createElement: () => ({}), head: {appendChild: script => scripts.push(script)},
    addEventListener: (name, callback) => { listeners[name] = callback; }
  };
  const window = {};
  vm.runInNewContext(readFileSync('public/metrika.js', 'utf8'), {window, document, Element, URL, location: new URL('https://example.org/ru/')});
  assert.equal(scripts[0].src, 'https://mc.yandex.ru/metrika/tag.js');
  assert.equal(window.ym.a[0][0], 12345);
  assert.equal(window.ym.a[0][2].webvisor, false);
  for (const href of ['https://example.org/a.pdf?x=1', 'https://other.org/', 'mailto:hello@example.org', 'https://example.org/ru/']) listeners.click({target: new Element(href)});
  assert.deepEqual(Array.from(window.ym.a.slice(1), args => args[2]), ['file_click', 'external_link_click', 'contact_click']);
});
