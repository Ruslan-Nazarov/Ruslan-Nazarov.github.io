/* Visual Markdown editing. The textarea remains the canonical saved value. */
window.mountRichText = function(input, label, {request, image, focus}) {
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const root = make('div', undefined, 'rich-editor');
  input.setAttribute('aria-label', label + ' — Markdown');
  const modes = make('div', undefined, 'rich-modes');
  const tools = make('div', undefined, 'rich-tools');
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Форматирование: ' + label);
  const visual = make('div', undefined, 'rich-surface');
  visual.setAttribute('role', 'textbox');
  visual.setAttribute('aria-multiline', 'true');
  visual.setAttribute('aria-label', label + ' — визуальный редактор');
  visual.spellcheck = true;
  visual.lang = /(^|\/)\s*(English|en)/.test(input.dataset.fieldPath) || /_en$/.test(input.dataset.field) ? 'en' : 'ru';
  const footer = make('div', undefined, 'rich-footer');
  const count = make('span'), message = make('span');
  footer.append(count, message);
  let mode = 'visual', revision = 0, ready = false, range = null, original = input.value;
  let baseline = '', sources = new WeakMap();
  let media = {items:[], slots:[]};
  const history = []; let historyIndex = -1;
  const preferencesKey = 'research-editor-typing';
  let preferences = {doubleSpace:true, dash:true, yo:true};
  try { Object.assign(preferences, JSON.parse(localStorage.getItem(preferencesKey) || '{}')); } catch {}
  function button(parent, text, title, action) {
    const control = make('button', text); control.type = 'button';
    control.title = title; control.setAttribute('aria-label', title);
    control.addEventListener('mousedown', event => event.preventDefault());
    control.onclick = action; parent.append(control); return control;
  }
  const visualButton = button(modes, 'Текст', 'Визуальный редактор', () => show('visual'));
  const sourceButton = button(modes, 'Markdown', 'Исходный Markdown', () => show('source'));
  sourceButton.className = 'rich-source-button';
  const expand = button(modes, 'Развернуть ↗', 'Развернуть редактор', () => {
    const expanded = root.classList.toggle('rich-expanded');
    expand.textContent = expanded ? 'Свернуть ↙' : 'Развернуть ↗';
    expand.setAttribute('aria-pressed', String(expanded));
  }); expand.className = 'rich-expand'; expand.setAttribute('aria-pressed', 'false');
  function rememberRange() {
    const selection = getSelection();
    if (selection.rangeCount && visual.contains(selection.anchorNode) && visual.contains(selection.focusNode)) {
      range = selection.getRangeAt(0).cloneRange();
      const node = currentBlock();
      block.value = /^(P|H2|H3|H4|BLOCKQUOTE)$/.test(node?.tagName) ? node.tagName.toLowerCase() : 'p';
      for (const [control,value] of alignmentButtons) control.setAttribute('aria-pressed',String((node?.getAttribute('align') || 'left') === value));
      boldButton.setAttribute('aria-pressed',String(document.queryCommandState('bold')));
      italicButton.setAttribute('aria-pressed',String(document.queryCommandState('italic')));
    }
  }
  function restoreRange() {
    visual.focus(); const selection = getSelection();
    if (range && visual.contains(range.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(range); }
    else { const end = document.createRange(); end.selectNodeContents(visual); end.collapse(false); selection.removeAllRanges(); selection.addRange(end); }
  }
  function emit() { input.dispatchEvent(new Event('input', {bubbles: true})); }
  function stats() { const text = mode === 'visual' ? visual.innerText : input.value; count.textContent = (text.trim().match(/\S+/g) || []).length + ' слов'; }
  function snapshot() {
    const entry = {html: visual.innerHTML, markdown: input.value, sources:[...visual.childNodes].map(node => sources.get(node))};
    if (history[historyIndex]?.html === entry.html && history[historyIndex]?.markdown === entry.markdown) return;
    history.splice(historyIndex + 1); history.push(entry);
    if (history.length > 100) history.shift();
    historyIndex = history.length - 1;
  }
  function undo(direction) {
    const next = historyIndex + direction; if (next < 0 || next >= history.length) return;
    historyIndex = next; const entry = history[next]; visual.innerHTML = entry.html;
    sources = new WeakMap(); [...visual.childNodes].forEach((node,index) => { if (entry.sources[index]) sources.set(node,entry.sources[index]); });
    input.value = entry.markdown; baseline = visual.innerHTML; original = input.value;
    range = null; emit(); stats(); restoreRange();
  }
  button(tools, '↶', 'Отменить (Ctrl+Z)', () => undo(-1));
  button(tools, '↷', 'Повторить (Ctrl+Shift+Z)', () => undo(1));
  const block = make('select'); block.setAttribute('aria-label', 'Стиль абзаца');
  for (const [value, text] of [['p','Обычный текст'],['h2','Заголовок 2'],['h3','Заголовок 3'],['h4','Заголовок 4'],['blockquote','Цитата']]) block.append(new Option(text, value));
  block.onchange = () => command('formatBlock', block.value); tools.append(block);
  const boldButton = button(tools, 'Ж', 'Полужирный (Ctrl+B)', () => command('bold')); boldButton.className = 'rich-bold';
  const italicButton = button(tools, 'К', 'Курсив (Ctrl+I)', () => command('italic')); italicButton.className = 'rich-italic';
  button(tools, '• Список', 'Маркированный список', () => command('insertUnorderedList'));
  button(tools, '1. Список', 'Нумерованный список', () => command('insertOrderedList'));
  button(tools, '▦ Таблица', 'Вставить таблицу', editTable);
  button(tools, '❝ Цитата', 'Оформить цитату', () => command('formatBlock', 'blockquote'));
  const alignmentButtons = [];
  for (const [value, icon, title] of [['left','☰','По левому краю'],['center','☰','По центру'],['right','☰','По правому краю'],['justify','☰','По ширине']]) {
    const control = button(tools, icon, title, () => alignBlock(value));
    control.className = 'rich-align rich-align-' + value;
    control.setAttribute('aria-pressed', 'false'); alignmentButtons.push([control,value]);
  }
  button(tools, '↑', 'Переместить блок вверх', () => moveBlock(-1));
  button(tools, '↓', 'Переместить блок вниз', () => moveBlock(1));
  button(tools, '▦ Дата', 'Вставить дату', () => {
    const today = new Date(), local = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
    dialog('Дата', [['date','Дата (ГГГГ-ММ-ДД)',local]], ({date}) => {
      const parsed = new Date(date + 'T12:00:00');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(+parsed) || parsed.toISOString().slice(0,10) !== date) throw new Error('Укажите существующую дату в формате ГГГГ-ММ-ДД.');
      insertNode(document.createTextNode(parsed.toLocaleDateString(visual.lang === 'en' ? 'en-GB' : 'ru-RU')));
    });
  });
  button(tools, 'Ссылка', 'Вставить или изменить ссылку', () => editLink());
  button(tools, 'Изображение', 'Вставить изображение', () => { rememberRange(); image(); });
  button(tools, 'Формула', 'Вставить формулу', () => editFormula());
  button(tools, 'Очистить', 'Убрать выделение и ссылки', () => { command('removeFormat'); command('unlink'); });
  const settings = make('div', undefined, 'rich-settings');
  const settingsPanel = make('div', undefined, 'rich-settings-panel'); settingsPanel.hidden = true;
  const settingsButton = button(settings, '⚙', 'Настройки автозамены', () => {
    settingsPanel.hidden = !settingsPanel.hidden; settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  }); settingsButton.setAttribute('aria-expanded', 'false');
  for (const [key,caption] of [['doubleSpace','Двойной пробел → точка'],['dash','Подсказка: дефис → тире'],['yo','еее → ё']]) {
    const row = make('label', caption), toggle = make('input'); toggle.type = 'checkbox'; toggle.checked = preferences[key]; toggle.setAttribute('role','switch');
    toggle.onchange = () => { preferences[key] = toggle.checked; try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch {} };
    row.append(toggle); settingsPanel.append(row);
  }
  settings.append(settingsPanel); tools.append(settings);
  settings.addEventListener('focusout', event => { if (!settings.contains(event.relatedTarget)) { settingsPanel.hidden = true; settingsButton.setAttribute('aria-expanded','false'); } });
  function currentBlock() {
    const selection = getSelection(); let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node.parentNode !== visual) node = node.parentElement;
    return node?.parentNode === visual ? node : null;
  }
  function alignBlock(value) {
    if (!ready || input.disabled) return;
    restoreRange(); const node = currentBlock(); if (!node || node.matches('.rich-token')) return;
    node.setAttribute('align', value); changed(); rememberRange();
  }
  function moveBlock(direction) {
    if (!ready || input.disabled) return;
    restoreRange(); const node = currentBlock(); if (!node) return;
    const sibling = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) visual.insertBefore(node, sibling); else visual.insertBefore(sibling, node);
    restoreRange(); changed(); rememberRange();
  }
  function editTable() {
    dialog('Таблица', [['rows','Строк данных','2'],['columns','Столбцов','2']], ({rows,columns}) => {
      const height = Number(rows), width = Number(columns);
      if (!Number.isInteger(height) || !Number.isInteger(width) || height < 1 || height > 30 || width < 1 || width > 12) throw new Error('Укажите от 1 до 30 строк и от 1 до 12 столбцов.');
      const table = make('table');
      const head = make('thead'), body = make('tbody'); table.append(head,body);
      for (let r = 0; r <= height; r++) {
        const row = make('tr');
        for (let c = 0; c < width; c++) row.append(make(r ? 'td' : 'th', r ? 'Текст' : 'Заголовок ' + (c+1)));
        (r ? body : head).append(row);
      }
      restoreRange(); let node = currentBlock();
      // Tables are document blocks, never children of a paragraph.
      if (node) node.after(table); else visual.append(table);
      const caret = document.createRange(); caret.selectNodeContents(table.rows[1].cells[0]); caret.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(caret); rememberRange(); changed();
    });
  }
  function command(name, value = null) {
    if (!ready || input.disabled) return;
    restoreRange(); document.execCommand(name, false, value); changed(); rememberRange();
  }
  const safeUrl = url => /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(url);
  function dialog(title, fields, apply) {
    rememberRange(); const modal = make('dialog', undefined, 'rich-dialog'), form = make('form');
    form.append(make('h2', title)); const controls = {};
    for (const [name, caption, value] of fields) {
      const field = make('label', caption), control = make('input'); control.value = value; field.append(control); form.append(field); controls[name] = control;
    }
    const error = make('p'); error.setAttribute('role', 'alert'); form.append(error);
    const actions = make('div');
    button(actions, 'Отмена', 'Отмена', () => modal.close());
    const submit = make('button', 'Вставить', 'primary'); submit.type = 'submit'; actions.append(submit); form.append(actions);
    form.onsubmit = event => { event.preventDefault(); try { apply(Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]))); modal.close(); } catch (e) { error.textContent = e.message; } };
    modal.append(form); document.body.append(modal); modal.addEventListener('close', () => { modal.remove(); restoreRange(); }, {once:true}); modal.showModal();
    Object.values(controls)[0].focus();
  }
  function editLink() {
    restoreRange(); const selection = getSelection(), anchor = selection.anchorNode?.parentElement?.closest('a');
    const text = anchor && visual.contains(anchor) ? anchor.textContent : selection.toString();
    if (anchor && visual.contains(anchor)) { range = document.createRange(); range.selectNode(anchor); selection.removeAllRanges(); selection.addRange(range); }
    dialog('Ссылка', [['url','Адрес ссылки',anchor?.getAttribute('href') || 'https://'],['text','Текст ссылки',text]], ({url,text}) => {
      if (!safeUrl(url.trim())) throw new Error('Укажите https://, mailto: или путь страницы /…');
      const link = make('a', text || url); link.setAttribute('href', url.trim()); insertNode(link);
    });
  }
  function editFormula() {
    dialog('Формула', [['formula','Формула LaTeX','a^2 + b^2 = c^2']], ({formula}) => {
      if (!formula.trim()) throw new Error('Введите формулу.');
      insertNode(protectedNode('$' + formula.replace(/^\$+|\$+$/g, '') + '$', 'inlineMath', formula));
    });
  }
  function protectedNode(raw, type, title) {
    const inline = ['inlineMath','inlineCode','image','imageReference','linkReference'].includes(type);
    const node = make(inline ? 'span' : 'div', title || raw, 'rich-token');
    node.contentEditable = 'false'; node.dataset.rawMarkdown = raw;
    node.title = 'Сохраняется без изменений. Для редактирования откройте Markdown.';
    return node;
  }
  function mediaNode(raw, selected) {
    const id = raw.slice(8,-2), slot = media.slots.find(slot => slot.id === id);
    const item = selected || media.items.find(item => item.id === (slot?.mediaId || id));
    const node = protectedNode(raw, 'image', ''); node.classList.add('rich-media'); node.replaceChildren();
    if (item?.path && !item.missing) {
      const picture = make('img'); picture.src = '/api/media/file?path=' + encodeURIComponent(item.path);
      picture.alt = item['alt_' + visual.lang] || item.title || ''; picture.loading = 'lazy'; node.append(picture);
    }
    node.append(make('span', '▧ ' + (slot?.title || item?.title || 'Изображение'))); return node;
  }
  function renderNode(node, markdown) {
    const raw = markdown.slice(node.position?.start.offset, node.position?.end.offset);
    const tags = {paragraph:'p',heading:'h'+node.depth,strong:'strong',emphasis:'em',delete:'del',blockquote:'blockquote',list:node.ordered?'ol':'ul',listItem:'li',break:'br',thematicBreak:'hr',link:'a',table:'table',tableRow:'tr',tableCell:'td'};
    if (node.type === 'text') {
      const fragment = document.createDocumentFragment();
      // Media directives are text in remark; keep their identity intact in visual editing.
      for (const part of node.value.split(/(\[\[media:[a-zA-Z0-9_-]+\]\])/g)) fragment.append(/^\[\[media:/.test(part) ? mediaNode(part) : document.createTextNode(part));
      return fragment;
    }
    if (!tags[node.type]) return protectedNode(raw, node.type, node.type === 'inlineMath' ? node.value : node.type === 'math' ? 'Формула: ' + node.value : node.type === 'image' ? '▧ ' + (node.alt || 'Изображение') : raw);
    // Task lists carry metadata that contenteditable cannot preserve by itself.
    if (node.type === 'list' && node.children.some(item => item.checked !== null && item.checked !== undefined)) return protectedNode(raw, node.type);
    const element = make(tags[node.type]);
    if (node.data?.hProperties?.align) element.setAttribute('align', node.data.hProperties.align);
    if (node.type === 'table') {
      const head = make('thead'), body = make('tbody'); element.append(head,body);
      node.children.forEach((row,index) => {
        const tr = make('tr'); row.children.forEach((cell,column) => {
          const td = make(index ? 'td' : 'th');
          if (node.align[column]) td.setAttribute('align',node.align[column]);
          cell.children.forEach(child => td.append(renderNode(child,markdown))); tr.append(td);
        }); (index ? body : head).append(tr);
      }); return element;
    }
    if (node.type === 'link') {
      if (safeUrl(node.url)) element.setAttribute('href', node.url);
      if (node.title) element.setAttribute('title', node.title);
    }
    if (node.type === 'list' && node.ordered && node.start !== 1) element.start = node.start;
    for (const child of node.children || []) element.append(renderNode(child, markdown));
    return element;
  }
  const escapeText = text => text.replace(/\\/g, '\\\\').replace(/([`*_[\]<>~])/g, '\\$1').replace(/(^|\n)(\s*)([#>+-]|\d+[.)])(?=\s)/g, '$1$2\\$3');
  function serialize(node) {
    const saved = sources.get(node);
    if (saved && saved.html === node.outerHTML) return saved.raw;
    const content = serializeContent(node);
    const align = node.nodeType === Node.ELEMENT_NODE && node.getAttribute('align');
    return ['P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','BLOCKQUOTE','TABLE'].includes(node.tagName) && /^(left|center|right|justify)$/.test(align) ? '<!-- editor-align:' + align + ' -->\n\n' + content : content;
  }
  function serializeContent(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.nodeValue.replace(/\u00a0/g, ' '));
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.dataset.rawMarkdown !== undefined) return node.dataset.rawMarkdown;
    const inner = () => [...node.childNodes].map(serialize).join('');
    const tag = node.tagName, content = inner();
    if (tag === 'TABLE') {
      const rows = [...node.rows];
      const cell = node => [...node.childNodes].map(serialize).join('').trim().replace(/\r?\n/g, ' ').replace(/(?<!\\)\|/g, '\\|');
      const line = row => '| ' + [...row.cells].map(cell).join(' | ') + ' |';
      if (!rows.length) return '';
      const separator = '| ' + [...rows[0].cells].map(td => ({left:':---',center:':---:',right:'---:'}[td.getAttribute('align')] || '---')).join(' | ') + ' |';
      return [line(rows[0]),separator,...rows.slice(1).map(line)].join('\n') + '\n\n';
    }
    if (/^H[1-6]$/.test(tag)) return '#'.repeat(Number(tag[1])) + ' ' + content.trim() + '\n\n';
    if (['B','STRONG','I','EM','DEL','S','STRIKE'].includes(tag)) {
      const mark = ['B','STRONG'].includes(tag) ? '**' : ['I','EM'].includes(tag) ? '*' : '~~';
      return content.replace(/^(\s*)(.*?)(\s*)$/s, (_, before, body, after) => body ? before + mark + body + mark + after : content);
    }
    if (tag === 'A') return safeUrl(node.getAttribute('href') || '') ? '[' + content + '](<' + node.getAttribute('href').replace(/[<>\n]/g, '') + '>' + (node.title ? ' "' + node.title.replace(/["\\]/g, '\\$&') + '"' : '') + ')' : content;
    if (tag === 'BR') return '  \n';
    if (tag === 'HR') return '\n\n---\n\n';
    if (tag === 'BLOCKQUOTE') return content.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (['UL','OL'].includes(tag)) return [...node.children].map((li,index) => {
      const prefix = tag === 'OL' ? ((Number(node.getAttribute('start')) || 1) + index) + '. ' : '- ';
      return prefix + serialize(li).trim().replace(/\n/g, '\n' + ' '.repeat(prefix.length));
    }).join('\n') + '\n\n';
    if (tag === 'LI') return [...node.childNodes].map(child => ['UL','OL'].includes(child.tagName) ? '\n' + serialize(child) : serialize(child)).join('');
    if (['P','DIV'].includes(tag)) return content.trim() + '\n\n';
    return content;
  }
  function serializeDocument() {
    if (visual.innerHTML === baseline) return original;
    return [...visual.childNodes].map(node => {
      const value = serialize(node), saved = sources.get(node);
      return saved && saved.html === node.outerHTML && !['SPAN','A'].includes(node.tagName) ? value + '\n\n' : value;
    }).join('').trim();
  }
  function changed() {
    if (!ready) return;
    input.value = serializeDocument(); emit(); stats(); snapshot();
  }
  function insertNode(node) {
    if (!ready || input.disabled) return;
    restoreRange(); const selection = getSelection(), current = selection.getRangeAt(0);
    current.deleteContents(); current.insertNode(node); current.setStartAfter(node); current.collapse(true);
    selection.removeAllRanges(); selection.addRange(current); rememberRange(); changed();
  }
  async function render() {
    const version = ++revision, text = input.value; ready = false; visual.contentEditable = 'false';
    root.setAttribute('aria-busy', 'true'); message.textContent = 'Подготовка текста…';
    try {
      mountRichText.mediaRequest ||= request('/api/media').catch(() => ({items:[],slots:[]}));
      const [tree, library] = await Promise.all([request('/api/editor/parse', {text}), mountRichText.mediaRequest]);
      media = library;
      if (version !== revision || !root.isConnected) return;
      sources = new WeakMap(); visual.replaceChildren(...tree.children.map(node => {
        const element = renderNode(node, text);
        sources.set(element, {html:element.outerHTML, raw:text.slice(node.position.start.offset, node.position.end.offset)});
        return element;
      }));
      if (!visual.childNodes.length) visual.append(make('p'));
      original = text; baseline = visual.innerHTML; ready = true; range = null;
      visual.contentEditable = String(!input.disabled); message.textContent = 'Ctrl+B · Ctrl+I · Ctrl+Z'; stats(); snapshot();
    } catch (error) {
      if (version !== revision) return;
      mode = 'source'; updateMode(); message.textContent = 'Визуальный режим недоступен: ' + error.message;
    } finally { if (version === revision) root.removeAttribute('aria-busy'); }
  }
  function updateMode() {
    const source = mode === 'source'; input.hidden = !source; visual.hidden = source; tools.hidden = source;
    visualButton.setAttribute('aria-pressed', String(!source)); sourceButton.setAttribute('aria-pressed', String(source)); stats();
  }
  function show(next) {
    if (mode === next || input.disabled) return;
    if (mode === 'visual') { if (ready) input.value = serializeDocument(); ++revision; }
    mode = next; updateMode();
    if (mode === 'visual') render();
    else { root.removeAttribute('aria-busy'); message.textContent = 'Исходный текст Markdown'; input.focus(); }
  }
  visual.addEventListener('input', changed);
  visual.addEventListener('beforeinput', event => {
    if (!ready || input.disabled || event.isComposing || event.inputType !== 'insertText') return;
    const selection = getSelection();
    if (!selection.isCollapsed || selection.anchorNode?.nodeType !== Node.TEXT_NODE || !visual.contains(selection.anchorNode)) return;
    const leaf = selection.anchorNode;
    if (leaf.parentElement.closest('.rich-token,code,pre')) return;
    const before = leaf.textContent.slice(0,selection.anchorOffset);
    let remove = 0, replacement = '';
    if (preferences.dash && event.data === ' ' && /\S -$/.test(before)) { remove = 1; replacement = '— '; }
    else if (preferences.doubleSpace && event.data === ' ' && /[\p{L}\p{N}] $/u.test(before)) { remove = 1; replacement = '. '; }
    else if (preferences.yo && /^[еЕ]$/.test(event.data) && /(?:^|[^\p{L}])[еЕ]{2}$/u.test(before)) { remove = 2; replacement = before.endsWith('ЕЕ') ? 'Ё' : 'ё'; }
    if (!remove) return;
    event.preventDefault(); const caret = selection.getRangeAt(0); caret.setStart(leaf,selection.anchorOffset-remove);
    selection.removeAllRanges(); selection.addRange(caret); document.execCommand('insertText',false,replacement); changed(); rememberRange();
  });
  visual.addEventListener('focus', focus);
  visual.addEventListener('keyup', rememberRange); visual.addEventListener('mouseup', rememberRange);
  visual.addEventListener('blur', rememberRange);
  visual.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); });
  visual.addEventListener('paste', event => {
    event.preventDefault(); command('insertText', event.clipboardData.getData('text/plain'));
  });
  // Block HTML/file drops; images enter through the media library.
  visual.addEventListener('drop', event => event.preventDefault());
  visual.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['z','y','b','i','k'].includes(event.key.toLowerCase())) {
      event.preventDefault(); const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') undo(key === 'y' || event.shiftKey ? 1 : -1);
      else if (key === 'k') editLink(); else command(key === 'b' ? 'bold' : 'italic');
    }
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!settingsPanel.hidden) { settingsPanel.hidden = true; settingsButton.setAttribute('aria-expanded','false'); settingsButton.focus(); }
    else if (root.classList.contains('rich-expanded')) expand.click();
  });
  input.addEventListener('input', () => { if (mode === 'source') stats(); });
  input.richEditor = {
    setValue: async text => {
      input.value=text;emit();
      if(mode==='visual')await render();else{++revision;stats()}
    },
    focus: () => mode === 'source' ? input.focus() : visual.focus(),
    lock: locked => { visual.contentEditable = String(ready && !locked); },
    insertMedia: item => {
      if (mode === 'source') { input.setRangeText('\n\n[[media:'+item.id+']]\n\n', input.selectionStart, input.selectionEnd, 'end'); emit(); }
      else { if (!ready) throw new Error('Дождитесь подготовки визуального редактора.'); insertNode(mediaNode('[[media:'+item.id+']]', item)); }
    }
  };
  root.append(modes, tools, visual, input, footer); updateMode();
  // Mount first: rendering is asynchronous and checks that this editor is still attached.
  queueMicrotask(render); return root;
};
