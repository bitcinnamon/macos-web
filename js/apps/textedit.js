import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 文本${t('app.te2.9e58bcb9c382')} (TextEdit) — Leopard-style rich-text documents with VFS persistence.
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><rect x="10" y="4" width="44" height="56" rx="3" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><g stroke="#b0b8c8" stroke-width="1.6"><line x1="16" y1="16" x2="48" y2="16"/><line x1="16" y1="23" x2="48" y2="23"/><line x1="16" y1="30" x2="48" y2="30"/><line x1="16" y1="37" x2="40" y2="37"/></g><path d="M46 34 L54 42 L38 58 L30 60 L32 50 Z" fill="#d8935a" stroke="#8a5a30" stroke-width="1.5"/><path d="M46 34 L54 42 L50 46 L42 38 Z" fill="#c8c8c8" stroke="#8a5a30" stroke-width="1.5"/></svg>`;

  function sanitizeRichText(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowedTags = new Set([
      'B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','BLOCKQUOTE','PRE',
      'UL','OL','LI','FONT','SPAN','IMG','A',
    ]);
    [...template.content.querySelectorAll('*')].forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.textContent || ''));
        return;
      }

      const href = node.tagName === 'A' ? String(node.getAttribute('href') || '').trim() : '';
      const src = node.tagName === 'IMG' ? String(node.getAttribute('src') || '').trim() : '';
      const alt = node.tagName === 'IMG' ? String(node.getAttribute('alt') || '') : '';
      const font = node.tagName === 'FONT' ? {
        size:String(node.getAttribute('size') || ''),
        color:String(node.getAttribute('color') || ''),
        face:String(node.getAttribute('face') || ''),
      } : null;
      const alignment = node.style?.textAlign || '';
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));

      if (node.tagName === 'A' && /^(?:https?:|mailto:)/i.test(href) && !/[\u0000-\u001f\u007f]/.test(href)) {
        node.href = href;
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      }
      if (node.tagName === 'IMG') {
        if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src) && src.length <= 4 * 1024 * 1024) node.src = src;
        if (alt) node.alt = alt.slice(0, 300);
        node.draggable = false;
      }
      if (node.tagName === 'FONT' && font) {
        if (/^[1-7]$/.test(font.size)) node.setAttribute('size', font.size);
        if (/^(?:#[0-9a-f]{3,8}|[a-z]{1,20})$/i.test(font.color)) node.setAttribute('color', font.color);
        if (/^[\w .,'"-]{1,80}$/u.test(font.face)) node.setAttribute('face', font.face);
      }
      if (['left','right','center','justify','start','end'].includes(alignment)) node.style.textAlign = alignment;
    });
    return template.innerHTML;
  }

  function open(arg) {
    let preferences = System.getAppPreferences?.('textedit') || {};
    const path = arg?.path ? VFS.normalize(arg.path) : null;
    const node = path ? VFS.get(path) : null;
    const extension = path ? (VFS.baseName(path).split('.').pop() || '').toLowerCase() : '';
    const textNode = node?.type === 'file' && (
      typeof node.richText === 'string'
      || typeof node.content === 'string'
      || /^text\//i.test(node.mime || '')
      || ['txt','text','rtf','md','html','htm','log','csv'].includes(extension)
    );
    const toolbar = el('div', 'te-toolbar');
    const wrap = el('div', 'te-document');
    const ruler = el('div', 'te-ruler');
    ruler.setAttribute('aria-label', t('app.te2.f3f2f47abeec'));
    const rulerMarks = el('div', 'te-ruler-marks');
    rulerMarks.innerHTML = Array.from({ length:12 }, (_, index) => `<i><span>${index + 1}</span></i>`).join('');
    ruler.appendChild(rulerMarks);
    const page = el('div', 'te-page');
    page.contentEditable = 'true';
    page.spellcheck = true;
    page.setAttribute('role', 'textbox');
    page.setAttribute('aria-multiline', 'true');
    page.setAttribute('aria-label', t('ui.a13a4fa3b593'));
    const scroll = el('div', 'te-scroll');
    scroll.appendChild(page);
    wrap.append(ruler, scroll);
    let richDocument = typeof node?.richText === 'string' || (!path && preferences.documentFormat !== 'plain');
    if (!path && preferences.showRuler === false) ruler.classList.add('hidden');

    if (textNode) {
      if (typeof node.richText === 'string') page.innerHTML = sanitizeRichText(node.richText);
      else page.innerText = node.content || '';
    }

    let win = null;
    let lastSavedMarkup = page.innerHTML;
    let closePrompt = null;
    let saveFeedbackTimer = 0;
    let findState = { query:'', matches:[], index:-1, ignoreCase:true };
    const applyPreferences = () => {
      page.style.fontFamily = String(preferences.fontFamily || 'Helvetica');
      page.style.fontSize = `${Number(preferences.fontSize) || 13}px`;
      page.spellcheck = preferences.checkSpelling !== false;
      wrap.classList.toggle('wrap-to-page', !!preferences.wrapToPage);
      wrap.classList.toggle('plain-document', !richDocument);
      toolbar.classList.toggle('plain-document', !richDocument);
      page.dataset.smartQuotes = preferences.smartQuotes === false ? 'false' : 'true';
    };
    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'textedit') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('textedit') || {};
      applyPreferences();
      emitDocumentState();
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);
    const documentName = () => win?._path ? VFS.baseName(win._path) : t('ui.35563060dc88');
    const updateStatus = () => {
      if (!win?._status) return;
      const raw = page?.innerText ?? page?.textContent ?? '';
      const text = String(raw).replace(/\n$/, '');
      const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
      win._status.textContent = t('ui.charsWords2', { chars: text.length.toLocaleString(), words: words.toLocaleString(), dirty: win._documentDirty ? t('ui.83e8b2389032') : '' });
    };
    const emitDocumentState = () => {
      if (win) {
        win.dataset.texteditRich = String(richDocument);
        win.dataset.texteditSpellcheck = String(page.spellcheck);
        win.dispatchEvent(new CustomEvent('app-command-state-changed',{bubbles:true}));
      }
      document.dispatchEvent(new CustomEvent('document-state-changed', {
        detail:{ appId:'textedit', window:win, dirty:!!win?._documentDirty, path:win?._path || null },
      }));
    };
    const setDirty = (dirty) => {
      if (!win) return;
      const next = !!dirty;
      if (win._documentDirty === next) {
        updateStatus();
        return;
      }
      win._documentDirty = next;
      win.classList.toggle('document-dirty', next);
      win._title.textContent = documentName();
      updateStatus();
      emitDocumentState();
    };
    const checkDirty = () => setDirty(page.innerHTML !== lastSavedMarkup);
    const loadSavedDocument = () => {
      const saved = win?._path ? VFS.get(win._path) : null;
      if (saved?.type === 'file') {
        if (typeof saved.richText === 'string') page.innerHTML = sanitizeRichText(saved.richText);
        else page.innerText = saved.content || '';
      } else page.innerHTML = '';
      lastSavedMarkup = page.innerHTML;
      setDirty(false);
      page.focus();
    };
    page.addEventListener('paste', (event) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      event.preventDefault();
      const plain = clipboard.getData('text/plain');
      const rich = richDocument ? clipboard.getData('text/html') : '';
      if (rich) document.execCommand('insertHTML', false, sanitizeRichText(rich));
      else document.execCommand('insertText', false, plain);
      checkDirty();
    });

    const runFormat = (command, value) => {
      page.focus();
      document.execCommand(command, false, value);
      checkDirty();
    };
    const capturedRange = () => {
      const selection = getSelection();
      if (!selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      return page.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    };
    const restoreRange = (range) => {
      if (!range) return;
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      page.focus();
    };
    const selectOccurrence = (start,length) => {
      const walker = document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
      let offset = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const next = offset + node.data.length;
        if (!startNode && start >= offset && start <= next) {
          startNode = node;
          startOffset = Math.min(node.data.length,start-offset);
        }
        const end = start + length;
        if (startNode && end >= offset && end <= next) {
          endNode = node;
          endOffset = Math.min(node.data.length,end-offset);
          break;
        }
        offset = next;
      }
      if (!startNode || !endNode) return false;
      const range = document.createRange();
      range.setStart(startNode,startOffset);
      range.setEnd(endNode,endOffset);
      restoreRange(range);
      return true;
    };
    const rebuildMatches = (query,ignoreCase) => {
      const text = page.innerText;
      const source = ignoreCase ? text.toLocaleLowerCase('zh-CN') : text;
      const needle = ignoreCase ? query.toLocaleLowerCase('zh-CN') : query;
      const matches = [];
      let offset = 0;
      while (needle && (offset=source.indexOf(needle,offset)) >= 0) {
        matches.push({start:offset,length:query.length});
        offset += Math.max(1,query.length);
      }
      findState = {query,matches,index:-1,ignoreCase};
    };
    const showFindPanel = () => {
      const pane = el('div','textedit-find');
      pane.innerHTML = `<label><span>${t('app.te2.e26135d4928d')}</span><input class="aqua-input te-find-query"></label><label><span>${t('app.te2.3809b0b1c2c5')}</span><input class="aqua-input te-replace-query"></label><label class="spp-check te-find-case"><input type="checkbox" checked> ${t('app.te2.d6f2d9a936fe')}</label><output></output><div class="te-find-actions"><button class="aqua-btn te-find-previous">${t('app.te2.60298e4698a4')}</button><button class="aqua-btn te-find-next default">${t('app.te2.2c79f15437ea')}</button><button class="aqua-btn te-replace-one">${t('app.te2.94a29510081a')}</button><button class="aqua-btn te-replace-all">${t('app.te2.d085c435b99f')}</button></div>`;
      const query = pane.querySelector('.te-find-query');
      const replacement = pane.querySelector('.te-replace-query');
      const ignoreCase = pane.querySelector('.te-find-case input');
      const status = pane.querySelector('output');
      query.value = findState.query;
      const update = () => {
        rebuildMatches(query.value,ignoreCase.checked);
        status.textContent = query.value ? t('ui.findFound', { n: findState.matches.length }) : t('ui.7f7f5b825514');
      };
      const move = (direction) => {
        if (query.value !== findState.query || ignoreCase.checked !== findState.ignoreCase) update();
        if (!findState.matches.length) {
          status.textContent = t('ui.1f95e3e91611');
          return System.beep();
        }
        findState.index = (findState.index+direction+findState.matches.length)%findState.matches.length;
        const match = findState.matches[findState.index];
        selectOccurrence(match.start,match.length);
        status.textContent = t('ui.findNth', { i: findState.index+1, n: findState.matches.length });
      };
      query.addEventListener('input',update);
      ignoreCase.addEventListener('change',update);
      pane.querySelector('.te-find-previous').addEventListener('click',() => move(-1));
      pane.querySelector('.te-find-next').addEventListener('click',() => move(1));
      pane.querySelector('.te-replace-one').addEventListener('click',() => {
        const selected = getSelection()?.toString() || '';
        const equal = ignoreCase.checked
          ? selected.toLocaleLowerCase('zh-CN') === query.value.toLocaleLowerCase('zh-CN')
          : selected === query.value;
        if (!equal) return move(1);
        document.execCommand('insertText',false,replacement.value);
        checkDirty();
        update();
        move(1);
      });
      pane.querySelector('.te-replace-all').addEventListener('click',() => {
        const needle = query.value;
        if (!needle) return;
        let replacements = 0;
        const walker = document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const expression = new RegExp(escaped,ignoreCase.checked?'gi':'g');
        nodes.forEach((node) => {
          node.data = node.data.replace(expression,() => {replacements++;return replacement.value;});
        });
        checkDirty();
        update();
        status.textContent = t('app.te.replacedN', { n: replacements });
      });
      update();
      System.showSheet({
        parent:win,title:t('ui.cc489deac223'),content:pane,className:'textedit-find-sheet',initialFocus:query,
        buttons:[{label:t('ui.33246f6a5e5b'),cancel:true}],
      });
    };
    const showFontPanel = () => {
      const selectionRange = capturedRange();
      const pane = el('div','textedit-font-panel');
      pane.innerHTML = `<label><span>${t('app.te2.a8b074bac3b0')}：</span><select class="spp-select te-font-family"><option>Helvetica</option><option>Lucida Grande</option><option>Georgia</option><option>Times New Roman</option><option>Monaco</option></select></label><label><span>${t('app.te2.10129b7752a0')}：</span><select class="spp-select te-font-size"><option value="2">10</option><option value="3">13</option><option value="4">16</option><option value="5">20</option><option value="6">26</option><option value="7">36</option></select></label><label><span>${t('app.te2.e862e1414e42')}</span><select class="spp-select te-font-color"><option value="#111111">${t('app.te2.8080b506a6f8')}</option><option value="#234f7b">${t('app.te2.40ab87b43a3c')}</option><option value="#982c25">${t('app.te2.ba98a2024e93')}</option><option value="#2d742f">${t('app.te2.bb185f756932')}</option><option value="#6b3f87">${t('app.te2.2d917c5fd85a')}</option></select></label><p class="te-font-preview">Aa ${t('app.te2.a8b074bac3b0')}${t('app.te2.95a49c04c144')} 123</p>`;
      const family = pane.querySelector('.te-font-family');
      const size = pane.querySelector('.te-font-size');
      const color = pane.querySelector('.te-font-color');
      family.value = preferences.fontFamily || 'Helvetica';
      const update = () => {
        const preview = pane.querySelector('.te-font-preview');
        preview.style.fontFamily = family.value;
        preview.style.fontSize = `${({2:10,3:13,4:16,5:20,6:26,7:36})[size.value]}px`;
        preview.style.color = color.value;
      };
      family.addEventListener('change',update);size.addEventListener('change',update);color.addEventListener('change',update);update();
      System.showSheet({
        parent:win,title:t('ui.b50d4d8352f5'),content:pane,className:'textedit-font-sheet',initialFocus:family,
        buttons:[
          {label:t('ui.4d0b4688c787'),cancel:true},
          {label:t('ui.4562024ddec7'),default:true,action:() => {
            restoreRange(selectionRange);
            document.execCommand('fontName',false,family.value);
            document.execCommand('fontSize',false,size.value);
            document.execCommand('foreColor',false,color.value);
            checkDirty();
          }},
        ],
      });
    };
    const insertLink = () => {
      const selectionRange = capturedRange();
      System.promptSheet({
        parent:win,title:t('ui.4676bc6678f0'),message:t('app.te.webLink'),placeholder:'https://example.com',okLabel:t('ui.94191ce210d3'),
        onOK:(value) => {
          let address = String(value || '').trim();
          if (!address) return false;
          if (!/^(https?:|mailto:)/i.test(address)) address = `https://${address}`;
          restoreRange(selectionRange);
          document.execCommand('createLink',false,address);
          checkDirty();
        },
      });
    };
    const convertDocument = (toRich) => {
      if (toRich === richDocument) return;
      const apply = () => {
        if (!toRich) page.textContent = page.innerText;
        richDocument = toRich;
        applyPreferences();
        setDirty(true);
        emitDocumentState();
      };
      if (!toRich && /<(?:b|strong|i|em|u|font|a|ul|ol|img)\b/i.test(page.innerHTML)) {
        System.confirmSheet({
          parent:win,headline:t('app.te.makePlain'),
          message:t('ui.e8dd248949a6'),
          okLabel:t('app.te2.ffa25ab828e2'),danger:true,onOK:apply,
        });
      } else apply();
    };
    const makeButton = (label, command, title) => {
      const button = el('button', 'te-btn', label);
      button.type = 'button';
      button.title = title;
      button.dataset.command = command;
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => runFormat(command));
      return button;
    };
    const bold = makeButton('<b>B</b>', 'bold', t('ui.67c6b77f89a1'));
    const italic = makeButton('<i>I</i>', 'italic', t('ui.af5a2c8bffa9'));
    const underline = makeButton('<u>U</u>', 'underline', t('ui.9bc18ae51e69'));
    const alignLeft = makeButton('≡', 'justifyLeft', t('app.te2.3ab9b61cb9d1'));
    const alignCenter = makeButton('≡', 'justifyCenter', t('ui.5009324782b9'));
    alignCenter.classList.add('te-align-center');
    const alignRight = makeButton('≡', 'justifyRight', t('app.te2.97e935bbcca6'));
    alignRight.classList.add('te-align-right');
    const sizeSelect = el('select', 'aqua-input te-size');
    sizeSelect.setAttribute('aria-label', t('app.te2.10129b7752a0'));
    [['2',t('app.te.28a39669a7')],['3',t('app.te.regular')],['4',t('app.te.larger')],['5',t('app.te.5d422c066f')],['6',t('app.te2.de14523bd34f')]].forEach(([value, label]) => {
      const option = el('option', '', label);
      option.value = value;
      if (value === '3') option.selected = true;
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener('change', () => runFormat('fontSize', sizeSelect.value));
    const saveButton = el('button', 'te-btn te-save', t('ui.091ca5213ef3'));
    saveButton.type = 'button';
    saveButton.title = t('ui.e8f247507165');
    saveButton.dataset.command = 'save';
    toolbar.append(bold, italic, underline, el('span', 'te-tool-separator'), alignLeft, alignCenter, alignRight, sizeSelect, el('span', 'te-toolbar-space'), saveButton);
    applyPreferences();

    win = System.createWindow({
      app:'textedit', title:documentName(), width:620, height:500,
      toolbar, content:wrap, statusbar:'',
      onClose:(window, context) => {
        if (context.force || !window._documentDirty) {
          document.removeEventListener('app-preferences-changed', preferencesChanged);
          return true;
        }
        if (closePrompt?.shield.isConnected) return false;
        const body = el('div', 'te-save-warning');
        const warningIcon = el('div', 'te-save-warning-icon');
        warningIcon.innerHTML = icon;
        const copy = el('div');
        copy.innerHTML = `<h3>${t('app.te.saveChanges', { name: documentName() })}</h3><p>${t('app.te.loseChanges')}</p>`;
        body.append(warningIcon, copy);
        const finishClose = () => setTimeout(() => {
          if (window.isConnected) System.closeWindow(window);
        }, 170);
        closePrompt = System.showSheet({
          parent:window, title:'', content:body, className:'te-save-warning-sheet',
          buttons:[
            { label:t('ui.4d0b4688c787'), cancel:true },
            { label:t('ui.de1b2ada2597'), danger:true, action:() => { setDirty(false); finishClose(); } },
            { label:t('ui.091ca5213ef3'), default:true, action:() => setTimeout(() => doSave(false, finishClose), 170) },
          ],
          onClose:() => { closePrompt = null; },
        });
        return false;
      },
    });
    win._path = path && textNode ? path : null;
    win._title.textContent = documentName();
    win._documentDirty = false;
    updateStatus();
    emitDocumentState();
    if (win._path) System.addRecentDocument?.(win._path, 'textedit');

    function writeTo(targetPath) {
      targetPath = VFS.normalize(targetPath);
      let saved = false;
      try {
        const nextNode = {
          type:'file',
          content:page.innerText,
          mime:richDocument ? 'text/rtf' : 'text/plain',
        };
        if (richDocument) nextNode.richText = sanitizeRichText(page.innerHTML);
        saved = VFS.putNode(targetPath, nextNode);
      } catch (error) {
        console.error('TextEdit save failed:', error);
      }
      if (!saved) {
        System.alertBox(t('ui.868a514aef84'), t('ui.02e7fac011aa'));
        return false;
      }
      win._path = targetPath;
      lastSavedMarkup = page.innerHTML;
      setDirty(false);
      System.addRecentDocument?.(targetPath, 'textedit');
      clearTimeout(saveFeedbackTimer);
      win._title.textContent = `${documentName()} — ${t('app.te2.7e0fc9b90334')}`;
      saveFeedbackTimer = setTimeout(() => {
        if (win.isConnected) win._title.textContent = documentName();
      }, 900);
      return true;
    }

    function doSave(saveAs = false, onSaved) {
      if (win._path && !saveAs) {
        const saved = writeTo(win._path);
        if (saved) onSaved?.();
        return saved;
      }
      const directory = win._path ? VFS.parentOf(win._path) : paths.documents;
      const extension = richDocument ? 'rtf' : preferences.addTxtExtension === false ? '' : 'txt';
      const suggested = win._path ? VFS.baseName(win._path) : VFS.uniqueName(directory, t('ui.35563060dc88'), extension ? `.${extension}` : '');
      System.savePanel({
        parent:win, title:t('ui.8f588809f08d'), startPath:directory,
        name:suggested, extension:extension || undefined,
        typeLabel:richDocument ? t('ui.f45f80425bf4') : t('ui.0373f454fa15'), allowOverwrite:true,
        onSave:(targetPath) => {
          const saved = writeTo(targetPath);
          if (saved) onSaved?.();
          return saved;
        },
      });
      return false;
    }

    function revertDocument() {
      if (!win._path || !win._documentDirty) return;
      System.confirmSheet({
        parent:win, title:t('ui.47a932875db2'),
        headline:t('app.te.revertTo', { name: documentName() }),
        message:t('ui.52f711105e09'),
        okLabel:t('app.te2.6a3a4ac1ad35'), danger:true, onOK:loadSavedDocument,
      });
    }

    saveButton.addEventListener('click', () => doSave(false));
    page.addEventListener('input', checkDirty);
    page.addEventListener('keyup', updateStatus);
    page.addEventListener('mouseup', updateStatus);
    page.addEventListener('keydown', (event) => {
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault();
        runFormat('insertUnorderedList');
        return;
      }
      if (preferences.smartQuotes === false || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '"' && event.key !== "'") return;
      event.preventDefault();
      const selection = getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const prefix = range?.startContainer?.nodeType === Node.TEXT_NODE
        ? range.startContainer.data.slice(0,range.startOffset)
        : '';
      const opening = !prefix || /[\s([{—–-]$/.test(prefix);
      document.execCommand('insertText',false,event.key === '"' ? (opening?'“':'”') : (opening?'‘':'’'));
      checkDirty();
    });
    win.addEventListener('leopard-command', (event) => {
      const command = event.detail?.command;
      if (!command) return;
      if (command === 'open-document') {
        event.preventDefault();
        System.openPanel({
          parent:win, title:t('ui.af5b1c2db6f3'), startPath:win._path ? VFS.parentOf(win._path) : paths.documents,
          types:['txt','text','rtf','md','html','htm'], allowUpload:true,
          onOpen:(nextPath) => {
            System.addRecentDocument?.(nextPath, 'textedit');
            System.launch('textedit', { path:nextPath });
          },
        });
      } else if (command === 'save' || command === 'save-as') {
        event.preventDefault();
        doSave(command === 'save-as');
      } else if (command === 'revert-document') {
        event.preventDefault();
        revertDocument();
      } else if (command === 'toggle-ruler') {
        event.preventDefault();
        ruler.classList.toggle('hidden');
        emitDocumentState();
      } else if (command === 'show-fonts') {
        event.preventDefault();
        showFontPanel();
      } else if (command === 'find-text') {
        event.preventDefault();
        showFindPanel();
      } else if (command === 'insert-link') {
        event.preventDefault();
        insertLink();
      } else if (command === 'make-plain') {
        event.preventDefault();
        convertDocument(false);
      } else if (command === 'make-rich') {
        event.preventDefault();
        convertDocument(true);
      } else if (command === 'toggle-spelling') {
        event.preventDefault();
        preferences = System.updateAppPreferences?.('textedit',{checkSpelling:!page.spellcheck}) || {...preferences,checkSpelling:!page.spellcheck};
        page.spellcheck = preferences.checkSpelling !== false;
        emitDocumentState();
      } else if (command === 'bigger') {
        event.preventDefault();
        sizeSelect.value = String(Math.min(6, (+sizeSelect.value || 3) + 1));
        runFormat('fontSize', sizeSelect.value);
      } else if (command === 'smaller') {
        event.preventDefault();
        sizeSelect.value = String(Math.max(2, (+sizeSelect.value || 3) - 1));
        runFormat('fontSize', sizeSelect.value);
      } else if (['bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight','insertUnorderedList','indent','outdent'].includes(command)) {
        event.preventDefault();
        runFormat(command);
      }
    });
    page.focus();
  }

  System.registerApp({
    id:'textedit', name:t('ui.868a514aef84'), icon, open, multiWindow:true,
    about:t('app.te.about'),
    keywords:t('app.te.keywords'),
  });
})();
