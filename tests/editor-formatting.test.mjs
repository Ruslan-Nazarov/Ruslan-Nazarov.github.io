import test from 'node:test';
import assert from 'node:assert/strict';
import {markdown} from '../src/lib/markdown.mjs';

test('editor alignment renders with formatting while arbitrary HTML remains disabled', async () => {
  for (const align of ['left','center','right','justify']) {
    assert.match(await markdown(`<!-- editor-align:${align} -->\n\nТекст **жирный**`), new RegExp(`<p align="${align}">Текст <strong>жирный</strong></p>`));
  }
  assert.match(await markdown('<!-- editor-align:right -->\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'), /<table align="right">/);
  const unsafe = await markdown('<!-- editor-align:center" onclick="alert(1) -->\n\nТекст\n\n<script>alert(1)</script>');
  assert.doesNotMatch(unsafe, /onclick|<script|align=/);
});
